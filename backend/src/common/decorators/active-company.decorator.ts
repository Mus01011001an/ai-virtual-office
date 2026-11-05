import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Custom decorator to extract the activeCompanyId from the current session.
 *
 * For super admin users: returns null (they can access all companies).
 * For regular users: returns session.user.activeCompanyId.
 *
 * Usage:
 *   @Get()
 *   findAll(@ActiveCompany() companyId: string | null) {
 *     return this.service.findAll(companyId);
 *   }
 */
export const ActiveCompany = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    const user = request?.user ?? request?.session?.user;
    const session = request?.session?.session ?? request?.session;
    return user?.activeCompanyId ?? session?.activeCompanyId ?? user?.companyId ?? null;
  },
);

/**
 * Extract the full active session user.
 */
export const ActiveUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request?.user ?? request?.session?.user ?? null;
  },
);
