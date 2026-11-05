import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from 'src/database/database.service';
import { PERMISSION_KEY } from './permission.decorator';
import { AuthRequest } from './rbac.type';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const sessionUser = req.session?.user;

    const permissionName = this.reflector.getAllAndOverride<string | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!permissionName) return true;

    const isPublic =
      this.reflector.getAllAndOverride<boolean>('PUBLIC', [
        context.getHandler(),
        context.getClass(),
      ]) ||
      this.reflector.getAllAndOverride<boolean>('isPublic', [
        context.getHandler(),
        context.getClass(),
      ]) ||
      this.reflector.getAllAndOverride<boolean>('public', [
        context.getHandler(),
        context.getClass(),
      ]);

    const isOptional =
      this.reflector.getAllAndOverride<boolean>('OPTIONAL', [
        context.getHandler(),
        context.getClass(),
      ]) ||
      this.reflector.getAllAndOverride<boolean>('optional', [
        context.getHandler(),
        context.getClass(),
      ]);

    // Jika endpoint bersifat public atau optional auth dan tanpa session user, bypass RbacGuard
    if ((isPublic || isOptional) && !sessionUser) {
      return true;
    }

    // Administrator (User.isSuperAdmin) memiliki akses penuh ke seluruh resource
    if ((sessionUser as any)?.isSuperAdmin) {
      return true;
    }

    // 0. Fast path: customSession sudah menghitung permission role aktif pada request yang sama
    //    (sama segarnya dengan query ulang) → hemat 2 round-trip DB.
    const sessUser: any = sessionUser;
    const sessionCompanyId = req.session?.session?.activeCompanyId;
    if (sessUser?.activeRole?.permissions && sessUser.activeCompanyId && (!sessionCompanyId || sessionCompanyId === sessUser.activeCompanyId)) {
      const perms: string[] = sessUser.activeRole.permissions;
      if (perms.includes('*') || perms.includes(permissionName)) return true;
      throw new ForbiddenException(`Access denied. Missing permission: ${permissionName}`);
    }

    // 1. Dapatkan activeCompanyId dari session context
    const activeCompanyId = req.session?.session?.activeCompanyId;
    let targetRoleId: string | null = null;
    let targetRoleName: string | null = null;

    if (activeCompanyId) {
      const membership = await this.prisma.companyMember.findUnique({
        where: {
          companyId_userId: {
            companyId: activeCompanyId,
            userId: (sessionUser as any).id,
          },
        },
        include: { role: true },
      });
      targetRoleId = membership?.roleId || null;
      targetRoleName = membership?.role?.name || null;
    }

    // Fallback ke global role jika tidak ada active company context
    if (!targetRoleId) {
      targetRoleId = sessionUser?.role?.id || (sessionUser as any)?.roleId;
      targetRoleName = sessionUser?.role?.name || null;
    }

    if (!targetRoleId) {
      throw new ForbiddenException('User has no role in the active workspace');
    }

    // 2. Query seluruh permissions dari role aktif di database
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId: targetRoleId },
      select: { permission: true },
    });

    const permissions = rolePermissions.map((rp) => rp.permission);

    // 3. Evaluasi strictly: Wildcard '*' atau Permission Spesifik
    const hasPermission =
      permissions.includes('*') || permissions.includes(permissionName);

    if (!hasPermission) {
      throw new ForbiddenException(
        `Access denied. Missing permission: ${permissionName}`,
      );
    }

    return true;
  }
}
