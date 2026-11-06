import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserSession } from '@thallesp/nestjs-better-auth';
import { DatabaseService } from 'src/database/database.service';
import { ActivityService } from 'src/system/activity/activity.service';
import { DEFAULT_OFFICE_ROLES } from 'src/system/role-permission/permission.definitions';
import { auth } from 'src/lib/auth';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

const isValidTimezone = (tz: string) => {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false }
};

/**
 * Office = Company (pola company.service Musyan).
 * Mendukung pembuatan mandiri atau provisioning untuk SuperAdmin/Owner klien baru.
 */
@Injectable()
export class CompanyService {
  constructor(private readonly prisma: DatabaseService, private readonly activity: ActivityService) {}

  async create(dto: CreateCompanyDto, session: UserSession) {
    const userId = session.user.id;
    const timezone = dto.timezone ?? 'Asia/Jakarta';
    if (!isValidTimezone(timezone)) throw new BadRequestException('Timezone tidak valid');

    let ownerUserId = userId;
    let isProvisionedForOther = false;

    if (dto.owner?.email || dto.owner?.username || dto.owner?.name) {
      isProvisionedForOther = true;
      const rawUser = (dto.owner.username || dto.owner.name || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
      const email = (dto.owner.email?.trim().toLowerCase()) || `${rawUser || 'owner_' + Date.now()}@office.local`;
      let targetUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            ...(rawUser ? [{ username: { equals: rawUser, mode: 'insensitive' as const } }] : []),
            { email },
          ],
        },
      });
      if (!targetUser) {
        const { user } = await auth.api.signUpEmail({
          body: { email, password: dto.owner.password, name: dto.owner.name.trim() },
        });
        targetUser = await this.prisma.user.update({
          where: { id: user.id },
          data: { username: rawUser || null, mustChangePassword: true },
        });
      }
      ownerUserId = targetUser.id;
    }

    const company = await this.prisma.$transaction(async (tx) => {
      const c = await tx.company.create({ data: { name: dto.name.trim(), createdById: userId } });
      await tx.officeProfile.create({ data: { companyId: c.id, template: dto.template ?? 'EMPTY', timezone } });
      let ownerRoleId = '';
      for (const r of DEFAULT_OFFICE_ROLES) {
        const role = await tx.role.create({
          data: { name: r.name, description: r.description, isDefault: r.isDefault, companyId: c.id },
        });
        await tx.rolePermission.createMany({ data: r.permissions.map((permission) => ({ roleId: role.id, permission })) });
        if (r.name === 'Owner') ownerRoleId = role.id;
      }
      const hasDefault = await tx.companyMember.count({ where: { userId: ownerUserId, isDefault: true } });
      await tx.companyMember.create({
        data: { companyId: c.id, userId: ownerUserId, roleId: ownerRoleId, isOwner: true, isDefault: hasDefault === 0, invitationStatus: 'accepted' },
      });

      // Jika dibuatkan untuk orang lain, tambahkan juga pembuat (admin) sebagai Owner/Supervisor
      if (isProvisionedForOther && userId !== ownerUserId) {
        await tx.companyMember.create({
          data: { companyId: c.id, userId, roleId: ownerRoleId, isOwner: true, isDefault: false, invitationStatus: 'accepted' },
        });
      }

      return c;
    });

    if (!isProvisionedForOther) {
      // Pindahkan sesi pembuat ke office baru jika dibuat untuk diri sendiri
      await this.prisma.session.updateMany({ where: { token: session.session.token }, data: { activeCompanyId: company.id } });
      await this.prisma.user.update({ where: { id: userId }, data: { lastActiveCompanyId: company.id, companyId: company.id } });
    }

    await this.activity.log(company.id, userId).action('CREATE_OFFICE').subject('Company', company.id)
      .description(`Membuat office ${company.name}${isProvisionedForOther ? ' (Provisioned)' : ''}`).save();
    return this.findOne(company.id);
  }

  async findOne(companyId: string) {
    const c = await this.prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: {
        id: true, name: true, createdAt: true,
        officeProfile: { select: { template: true, timezone: true, workStart: true, workEnd: true, breaks: true } },
        _count: { select: { employees: { where: { deletedAt: null } }, members: { where: { isActive: true } } } },
      },
    });
    if (!c) throw new NotFoundException('Office tidak ditemukan');
    return {
      id: c.id, name: c.name, createdAt: c.createdAt,
      template: c.officeProfile?.template ?? 'EMPTY',
      timezone: c.officeProfile?.timezone ?? 'Asia/Jakarta',
      workStart: c.officeProfile?.workStart ?? '09:00',
      workEnd: c.officeProfile?.workEnd ?? '18:00',
      breaks: c.officeProfile?.breaks ?? [],
      employeeCount: c._count.employees,
      memberCount: c._count.members,
    };
  }

  async update(companyId: string, dto: UpdateCompanyDto, userId: string) {
    await this.findOne(companyId);
    if (dto.timezone && !isValidTimezone(dto.timezone)) throw new BadRequestException('Timezone tidak valid');
    const { name, ...profile } = dto;
    await this.prisma.$transaction(async (tx) => {
      if (name !== undefined) await tx.company.update({ where: { id: companyId }, data: { name: name.trim() } });
      if (Object.keys(profile).length) {
        await tx.officeProfile.upsert({ where: { companyId }, update: profile, create: { companyId, ...profile } });
      }
    });
    await this.activity.log(companyId, userId).action('UPDATE_OFFICE').subject('Company', companyId).details({ newValues: dto }).save();
    return this.findOne(companyId);
  }

  /** Soft delete — hanya owner. Anggota otomatis pindah ke office lain lewat self-healing customSession. */
  async softDelete(companyId: string, userId: string) {
    await this.assertOwner(companyId, userId);
    await this.findOne(companyId);
    await this.prisma.company.update({ where: { id: companyId }, data: { deletedAt: new Date() } });
    await this.prisma.session.updateMany({ where: { activeCompanyId: companyId }, data: { activeCompanyId: null } });
    await this.activity.log(companyId, userId).action('DELETE_OFFICE').subject('Company', companyId).save();
    return { success: true, message: 'Office dipindahkan ke arsip', data: { id: companyId } };
  }

  async restore(companyId: string, userId: string) {
    await this.assertOwner(companyId, userId);
    const c = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!c?.deletedAt) throw new BadRequestException('Office tidak sedang diarsipkan');
    await this.prisma.company.update({ where: { id: companyId }, data: { deletedAt: null } });
    await this.activity.log(companyId, userId).action('RESTORE_OFFICE').subject('Company', companyId).save();
    return this.findOne(companyId);
  }

  /** Office yang diarsipkan milik user (untuk tampilan "arsip"). */
  async archived(userId: string) {
    const rows = await this.prisma.companyMember.findMany({
      where: { userId, isOwner: true, company: { deletedAt: { not: null } } },
      select: { company: { select: { id: true, name: true, deletedAt: true } } },
    });
    return { data: rows.map((r) => r.company), meta: { total: rows.length } };
  }

  private async assertOwner(companyId: string, userId: string) {
    const m = await this.prisma.companyMember.findUnique({ where: { companyId_userId: { companyId, userId } } });
    if (!m?.isOwner) throw new ForbiddenException('Hanya pemilik office yang bisa melakukan ini');
  }
}
