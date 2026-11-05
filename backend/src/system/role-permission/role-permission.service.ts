// src/system/role-permission/role-permission.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import {
  EXPLICIT_ONLY_PERMISSIONS,
  PERMISSION_DEFINITIONS,
} from './permission.definitions';

@Injectable()
export class RolePermissionService {
  constructor(private readonly prisma: DatabaseService) {}

  getDefinitions() {
    return {
      success: true,
      // Izin khusus (ghost mode) hanya diatur dari tab Permission super_admin
      data: PERMISSION_DEFINITIONS.filter(
        (def) => !EXPLICIT_ONLY_PERMISSIONS.includes(def.key),
      ),
    };
  }

  async getPermissionsByRole(roleId: string, companyId: string | null) {
    const whereClause = companyId
      ? { id: roleId, OR: [{ companyId }, { companyId: null }] } // Allows viewing global role perms
      : { id: roleId };

    const role = await this.prisma.role.findFirst({
      where: whereClause,
      include: {
        permissions: true,
      },
    });

    if (!role) {
      throw new NotFoundException(`Role "${roleId}" not found`);
    }

    return {
      success: true,
      data: {
        role: {
          id: role.id,
          name: role.name,
          description: role.description,
        },
        permissions: role.permissions.map((p) => p.permission),
      },
    };
  }

  async setPermissions(
    roleId: string,
    permissions: string[],
    companyId: string | null,
  ) {
    // Verify role exists and belongs to company (if company context)
    const whereClause = companyId
      ? { id: roleId, OR: [{ companyId }, { companyId: null }] }
      : { id: roleId };

    const role = await this.prisma.role.findFirst({
      where: whereClause,
    });

    if (!role) {
      throw new NotFoundException(`Role "${roleId}" not found`);
    }

    // Izin khusus tidak bisa diubah dari sini: pertahankan nilai yang diatur super_admin
    const preserved = await this.prisma.rolePermission.findMany({
      where: { roleId, permission: { in: EXPLICIT_ONLY_PERMISSIONS } },
      select: { permission: true },
    });
    permissions = Array.from(
      new Set([
        ...permissions.filter((p) => !EXPLICIT_ONLY_PERMISSIONS.includes(p)),
        ...preserved.map((p) => p.permission),
      ]),
    );

    // Replace all permissions for this role
    await this.prisma.$transaction(async (tx) => {
      // 1. Delete all existing permissions for this role
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      // 2. Insert new ones if there are any
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({
            roleId,
            permission: p,
          })),
        });
      }
    });

    return {
      success: true,
      message: 'Role permissions updated successfully',
    };
  }
}
