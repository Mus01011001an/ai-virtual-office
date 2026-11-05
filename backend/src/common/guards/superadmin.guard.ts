import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { AuthRequest } from 'src/lib/auth/rbac.type';

import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private prisma: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const sessionUser = req.session?.user;

    if (!sessionUser) {
      throw new ForbiddenException('User is not authenticated');
    }

    // Role check logic: fetch role from database using roleId
    const isSuperAdmin = (sessionUser as any).isSuperAdmin;
    if (isSuperAdmin === true) {
      return true;
    }

    throw new ForbiddenException('Akun ini bukan superadmin');
  }
}
