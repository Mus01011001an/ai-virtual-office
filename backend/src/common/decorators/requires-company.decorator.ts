import { SetMetadata } from '@nestjs/common';

export const REQUIRES_COMPANY_KEY = 'requiresCompany';
export const RequiresCompany = () => SetMetadata(REQUIRES_COMPANY_KEY, true);
