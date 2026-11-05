import { auth } from 'src/lib/auth';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class MembershipService {
  constructor(private readonly prisma: DatabaseService) {}

  /**
   * List all members of a company.
   * Scoped to activeCompanyId from session.
   */
  async findAll(
    companyId: string,
    params?: { q?: string; page?: number; limit?: number },
  ) {
    const { q, page = 0, limit = 20 } = params || {};
    const skip = page * limit;

    const where: any = {
      companyId,
      isActive: true,
      invitationStatus: 'accepted',
    };

    if (q) {
      where.user = {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.companyMember.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
          role: { select: { id: true, name: true } },
          inviter: { select: { id: true, name: true } },
        },
        skip,
        take: limit,
        orderBy: { joinedAt: 'desc' },
      }),
      this.prisma.companyMember.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  /**
   * Invite an existing user (by userId or email) to a company.
   */
  async invite(
    companyId: string,
    inviterUserId: string,
    dto: { userId?: string; email?: string; roleId?: string },
  ) {
    const { userId, email, roleId } = dto;
    await this.assertRoleInCompany(companyId, roleId);

    // Find the target user
    let targetUser: any = null;
    if (userId) {
      targetUser = await this.prisma.user.findUnique({ where: { id: userId } });
    } else if (email) {
      targetUser = await this.prisma.user.findUnique({ where: { email } });
    }

    if (!targetUser) throw new NotFoundException('User not found');

    // Check if already member
    const existing = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: targetUser.id } },
    });

    if (existing) {
      if (existing.isActive && existing.invitationStatus === 'accepted') {
        throw new BadRequestException(
          'User is already a member of this company',
        );
      }
      // Re-activate or re-invite
      return this.prisma.companyMember.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          invitationStatus: 'accepted',
          roleId: roleId ?? existing.roleId,
        },
      });
    }

    // Get default role if roleId not specified
    let finalRoleId = roleId;
    if (!finalRoleId) {
      const defaultRole = await this.prisma.role.findFirst({
        where: { companyId, isDefault: true },
      });
      finalRoleId = defaultRole?.id;
    }

    return this.prisma.companyMember.create({
      data: {
        companyId,
        userId: targetUser.id,
        roleId: finalRoleId,
        invitedBy: inviterUserId,
        invitationStatus: 'accepted',
        isDefault: false,
        isOwner: false,
        isActive: true,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        role: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Update member role or status.
   */
  async update(
    companyId: string,
    memberUserId: string,
    dto: { roleId?: string; isActive?: boolean },
  ) {
    await this.assertRoleInCompany(companyId, dto.roleId);
    const member = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: memberUserId } },
    });

    if (!member)
      throw new NotFoundException('Member not found in this company');
    if (member.isOwner && dto.isActive === false) {
      throw new BadRequestException('Cannot deactivate the company owner');
    }

    const updated = await this.prisma.companyMember.update({
      where: { id: member.id },
      data: {
        roleId: dto.roleId ?? member.roleId,
        isActive: dto.isActive ?? member.isActive,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        role: { select: { id: true, name: true } },
      },
    });

    if (dto.isActive === false) {
      const nextDefault = await this.prisma.companyMember.findFirst({
        where: { userId: memberUserId, isActive: true },
        orderBy: [{ isDefault: 'desc' }, { joinedAt: 'asc' }],
      });
      await this.prisma.session.updateMany({
        where: { userId: memberUserId, activeCompanyId: companyId },
        data: { activeCompanyId: nextDefault?.companyId ?? null },
      });
    }

    return updated;
  }

  /**
   * Remove a member from a company (soft: isActive = false).
   */
  async remove(companyId: string, memberUserId: string) {
    const member = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: memberUserId } },
    });

    if (!member)
      throw new NotFoundException('Member not found in this company');
    if (member.isOwner)
      throw new ForbiddenException('Cannot remove the company owner');

    const updated = await this.prisma.companyMember.update({
      where: { id: member.id },
      data: { isActive: false },
    });

    // Evict active sessions for memberUserId pointing to this company
    const nextDefault = await this.prisma.companyMember.findFirst({
      where: { userId: memberUserId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { joinedAt: 'asc' }],
    });
    await this.prisma.session.updateMany({
      where: { userId: memberUserId, activeCompanyId: companyId },
      data: { activeCompanyId: nextDefault?.companyId ?? null },
    });

    return updated;
  }

  /** roleId wajib milik office aktif (cegah memakai role dari office lain). */
  private async assertRoleInCompany(companyId: string, roleId?: string | null) {
    if (!roleId) return;
    const role = await this.prisma.role.findFirst({ where: { id: roleId, companyId } });
    if (!role) throw new BadRequestException('Role tidak ditemukan di office ini');
  }

  /**
   * Owner/manager membuat akun untuk teman (password sementara) dan langsung menambahkannya ke office ini.
   * Teman wajib mengganti password saat login pertama (User.mustChangePassword).
   */
  async createAccount(
    companyId: string,
    inviterUserId: string,
    dto: { name: string; email: string; password: string; roleId?: string },
  ) {
    const email = dto.email?.trim().toLowerCase();
    if (!dto.name?.trim() || !email || !dto.password || dto.password.length < 8) {
      throw new BadRequestException('Nama, email, dan password (min. 8 karakter) wajib diisi');
    }
    await this.assertRoleInCompany(companyId, dto.roleId);
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new BadRequestException('Email sudah terdaftar — gunakan undang anggota');
    const { user } = await auth.api.signUpEmail({ body: { email, password: dto.password, name: dto.name.trim() } });
    await this.prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: true } });
    return this.invite(companyId, inviterUserId, { userId: user.id, roleId: dto.roleId });
  }
}
