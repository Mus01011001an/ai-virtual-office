import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRES_COMPANY_KEY } from '../decorators/requires-company.decorator';

@Injectable()
export class RequiresCompanyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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

    if (isPublic) {
      return true;
    }

    const requiresCompany = this.reflector.getAllAndOverride<boolean>(
      REQUIRES_COMPANY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiresCompany) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request?.user ?? request?.session?.user;

    const session = request?.session?.session ?? request?.session;
    const companyId = user?.activeCompanyId ?? session?.activeCompanyId;

    if (!companyId) {
      throw new ForbiddenException(
        'Pilih atau buat office dulu untuk memakai fitur ini.',
      );
    }

    return true;
  }
}
