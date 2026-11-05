// src/role/role.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service'; // atau PrismaService
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RoleService {
  constructor(private readonly db: DatabaseService) {}

  // CREATE
  async create(createRoleDto: CreateRoleDto, companyId: string | null) {
    if (createRoleDto.isDefault) {
      await this.db.role.updateMany({
        where: { isDefault: true, companyId },
        data: { isDefault: false },
      });
    }

    const role = await this.db.role.create({
      data: {
        name: createRoleDto.name,
        description: createRoleDto.description,
        isDefault: createRoleDto.isDefault || false,
        companyId,
      },
    });

    return role;
  }

  // READ ALL
  async findAll(companyId: string | null) {
    const whereClause = companyId
      ? { companyId } // 🔥 STRICT: Only show roles for THIS company
      : { companyId: null }; // 🔥 Only show global roles when no company is selected

    const [roles, total] = await Promise.all([
      this.db.role.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.role.count({ where: whereClause }),
    ]);

    return {
      data: roles,
      meta: { total },
    };
  }

  // READ ONE
  async findOne(id: string, companyId: string | null) {
    const whereClause = companyId
      ? { id, OR: [{ companyId }, { companyId: null }] }
      : { id };

    const role = await this.db.role.findFirst({
      where: whereClause,
    });

    if (!role) {
      throw new NotFoundException(`Role with id "${id}" not found`);
    }

    return role;
  }

  // UPDATE (PUT)
  async update(
    id: string,
    updateRoleDto: UpdateRoleDto,
    companyId: string | null,
  ) {
    // Ensure the role belongs to the company before updating
    const whereClause = companyId
      ? { id, companyId } // Cannot update global roles unless companyId is null
      : { id };

    const existing = await this.db.role.findFirst({ where: whereClause });
    if (!existing) {
      throw new NotFoundException(
        `Role with id "${id}" not found or access denied`,
      );
    }

    if (existing.name === 'superAdmin') {
      throw new ForbiddenException(
        'CRITICAL ERROR: The superAdmin role is a system-protected entity and cannot be modified.',
      );
    }

    // handle isDefault exclusivity
    if (updateRoleDto.isDefault === true) {
      await this.db.role.updateMany({
        where: { isDefault: true, id: { not: id }, companyId },
        data: { isDefault: false },
      });
    }

    const role = await this.db.role.update({
      where: { id },
      data: {
        isDefault:
          updateRoleDto.isDefault !== undefined
            ? updateRoleDto.isDefault
            : existing.isDefault,
        name: updateRoleDto.name ?? existing.name,
        description:
          updateRoleDto.description !== undefined
            ? updateRoleDto.description
            : existing.description,
      },
    });

    return role;
  }

  // DELETE
  async remove(id: string, companyId: string | null) {
    const defaultRole = await this.db.role.findFirst({
      where: { id, isDefault: true },
    });

    if (defaultRole) {
      throw new BadRequestException(`Can't remove default role`);
    }

    const whereClause = companyId
      ? { id, companyId } // Can only delete company-specific roles
      : { id };

    const existing = await this.db.role.findFirst({ where: whereClause });
    if (!existing) {
      throw new NotFoundException(
        `Role with id "${id}" not found or access denied`,
      );
    }

    if (existing.name === 'superAdmin') {
      throw new ForbiddenException(
        'CRITICAL ERROR: The superAdmin role is a system-protected entity and cannot be deleted.',
      );
    }

    await this.db.role.delete({
      where: { id },
    });

    return null;
  }
}
