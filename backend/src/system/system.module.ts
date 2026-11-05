import { Module } from '@nestjs/common';
import { ActivityModule } from './activity/activity.module';
import { CompanyModule } from './company/company.module';
import { MembershipModule } from './membership/membership.module';
import { RoleModule } from './role/role.module';
import { RolePermissionModule } from './role-permission/role-permission.module';

/** Core system (pola Musyan): office/company, anggota, role, permission, audit log. */
@Module({
  imports: [ActivityModule, CompanyModule, MembershipModule, RoleModule, RolePermissionModule],
})
export class SystemModule {}
