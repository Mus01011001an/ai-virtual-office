// src/role-permission/dto/update-role-permission.dto.ts
import { IsBoolean, IsString } from 'class-validator';

export class UpsertRolePermissionDto {
  @IsString()
  roleId: string;

  @IsString()
  apiPermissionName: string; // "example:create" dll

  @IsBoolean()
  allow: boolean;
}
