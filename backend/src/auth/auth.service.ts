import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserSession } from '@thallesp/nestjs-better-auth';
import { DatabaseService } from 'src/database/database.service';
import { auth } from 'src/lib/auth';
import { SignUpDto } from './dto/signup.dto';
import { SignInDto } from './dto/signin.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

/** Pola auth.service Musyan (signup/signin/workspaces/switch-company), tanpa sinkron Chatwoot. */
@Injectable()
export class AuthService {
  constructor(private readonly prisma: DatabaseService) {}

  async signUp(body: SignUpDto) {
    // Admin platform = pendaftar pertama selama belum ada admin aktif (pola "user pertama = superAdmin" Musyan)
    const activeAdmins = await this.prisma.user.count({ where: { isSuperAdmin: true, deletedAt: null } });
    if (activeAdmins > 0) {
      throw new BadRequestException('Pendaftaran publik dinonaktifkan. Silakan masuk menggunakan akun administrator atau minta undangan dari pemilik office.');
    }
    const { user } = await auth.api.signUpEmail({
      body: { email: body.email.toLowerCase(), password: body.password, name: body.name },
    });
    const result = await this.prisma.user.update({
      where: { id: user.id },
      data: { isSuperAdmin: activeAdmins === 0 },
      select: { id: true, name: true, email: true, isSuperAdmin: true },
    });
    return { user: result };
  }

  async signIn(body: SignInDto) {
    let signInResult: any;
    try {
      signInResult = await auth.api.signInEmail({
        body: { email: body.email.toLowerCase(), password: body.password, rememberMe: body.rememberMe },
        returnHeaders: true,
      });
    } catch (error: any) {
      if (error.body?.code === 'INVALID_EMAIL_OR_PASSWORD' || error.status === 401 || error.status === 400) {
        throw new BadRequestException('Email atau password salah');
      }
      throw error;
    }
    const { response: { user }, headers } = signInResult;
    const token: string | null = headers.get('set-auth-token');
    const rawToken = token ? token.split('.')[0] : null;

    // Akun yang sudah dihapus (soft delete) tidak boleh login: cabut sesi yang baru dibuat better-auth
    const status = await this.prisma.user.findUnique({ where: { id: user.id }, select: { deletedAt: true } });
    if (status?.deletedAt) {
      await this.prisma.session.deleteMany({ where: { userId: user.id } });
      throw new BadRequestException('Akun ini sudah dinonaktifkan');
    }

    // Pulihkan workspace (office) terakhir ke sesi baru
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { lastActiveCompanyId: true, companyId: true, mustChangePassword: true },
    });
    const memberships = await this.prisma.companyMember.findMany({
      where: { userId: user.id, isActive: true, invitationStatus: 'accepted', company: { deletedAt: null } },
      orderBy: { joinedAt: 'asc' },
    });
    const last = dbUser?.lastActiveCompanyId ?? dbUser?.companyId ?? null;
    const targetCompanyId = last && memberships.some((m) => m.companyId === last)
      ? last
      : (memberships.find((m) => m.isDefault)?.companyId ?? memberships[0]?.companyId ?? null);

    const validTokens = [rawToken, token].filter(Boolean) as string[];
    if (validTokens.length) {
      await this.prisma.session.updateMany({
        where: { token: { in: validTokens } },
        data: { sessionType: 'app', activeCompanyId: targetCompanyId },
      });
    }
    if (targetCompanyId && dbUser?.lastActiveCompanyId !== targetCompanyId) {
      await this.prisma.user.update({ where: { id: user.id }, data: { lastActiveCompanyId: targetCompanyId, companyId: targetCompanyId } });
    }
    return {
      token,
      id: user.id,
      name: user.name,
      email: user.email,
      activeCompanyId: targetCompanyId,
      mustChangePassword: dbUser?.mustChangePassword ?? false,
    };
  }

  async signOut(session: UserSession) {
    await auth.api.signOut({ headers: new Headers({ authorization: `Bearer ${session.session.token}` }) });
    return { success: true, message: 'Berhasil keluar', data: null };
  }

  /** Profil + konteks office aktif (hasil customSession). */
  getProfile(session: UserSession) {
    return session.user;
  }

  async getMyWorkspaces(session: UserSession) {
    const memberships = await this.prisma.companyMember.findMany({
      where: { userId: session.user.id, isActive: true, invitationStatus: 'accepted', company: { deletedAt: null } },
      include: {
        company: {
          select: {
            id: true, name: true, createdAt: true,
            officeProfile: { select: { template: true, timezone: true } },
            _count: { select: { employees: { where: { deletedAt: null } } } },
          },
        },
        role: { select: { id: true, name: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });
    return {
      data: memberships.map((m) => ({
        companyId: m.companyId,
        name: m.company.name,
        template: m.company.officeProfile?.template ?? 'EMPTY',
        timezone: m.company.officeProfile?.timezone ?? 'Asia/Jakarta',
        employeeCount: m.company._count.employees,
        role: m.role,
        isOwner: m.isOwner,
        isDefault: m.isDefault,
      })),
      meta: { total: memberships.length },
    };
  }

  async switchCompany(session: UserSession, companyId: string) {
    if (!companyId) throw new BadRequestException('companyId wajib diisi');
    const membership = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: session.user.id } },
      include: { company: { select: { deletedAt: true } } },
    });
    if (!membership || !membership.isActive || membership.invitationStatus !== 'accepted' || membership.company.deletedAt) {
      throw new NotFoundException('Kamu bukan anggota office ini');
    }
    await this.prisma.session.updateMany({ where: { token: session.session.token }, data: { activeCompanyId: companyId } });
    await this.prisma.user.update({ where: { id: session.user.id }, data: { lastActiveCompanyId: companyId, companyId } });
    return { activeCompanyId: companyId };
  }

  async changePassword(session: UserSession, dto: ChangePasswordDto) {
    try {
      await auth.api.changePassword({
        body: { currentPassword: dto.currentPassword, newPassword: dto.newPassword, revokeOtherSessions: true },
        headers: new Headers({ authorization: `Bearer ${session.session.token}` }),
      });
    } catch (error: any) {
      if (error.status === 400 || error.status === 401) throw new BadRequestException('Password lama salah');
      throw error;
    }
    await this.prisma.user.update({ where: { id: session.user.id }, data: { mustChangePassword: false } });
    return { success: true, message: 'Password berhasil diganti', data: null };
  }
}
