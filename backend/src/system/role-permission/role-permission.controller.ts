// src/system/role-permission/role-permission.controller.ts
import { Controller, Get, Param, Put, Body, Query } from '@nestjs/common';
import { Permission } from 'src/lib/auth/permission.decorator';
import { P_ROLE_MANAGE } from 'src/common/constants/permissions';
import { ApiTags } from '@nestjs/swagger';
import { RolePermissionService } from './role-permission.service';
import {
  ActiveCompany,
  ActiveUser,
} from 'src/common/decorators/active-company.decorator';

@ApiTags('System - Role Permissions')
@Controller('system/role-permissions')
export class RolePermissionController {
  constructor(private readonly rolePermissionService: RolePermissionService) {}

  @Get('definitions')
  getDefinitions() {
    return this.rolePermissionService.getDefinitions();
  }

  @Get(':roleId')
  getByRole(
    @ActiveCompany() sessionCompanyId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.rolePermissionService.getPermissionsByRole(
      roleId,
      sessionCompanyId,
    );
  }

  @Put(':roleId')
  @Permission(P_ROLE_MANAGE)
  setPermissions(
    @ActiveCompany() sessionCompanyId: string,
    @Param('roleId') roleId: string,
    @Body('permissions') permissions: string[],
    @Query('companyId') overriddenCompanyId?: string,
  ) {
    const finalCompanyId = overriddenCompanyId || sessionCompanyId || null;
    return this.rolePermissionService.setPermissions(
      roleId,
      permissions,
      finalCompanyId,
    );
  }
}
