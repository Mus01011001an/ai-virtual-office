import {
  ActiveCompany,
  ActiveUser,
} from 'src/common/decorators/active-company.decorator';
// src/role/role.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Permission } from 'src/lib/auth/permission.decorator';
import { P_ROLE_MANAGE } from 'src/common/constants/permissions';
import { ApiTags } from '@nestjs/swagger';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Session, UserSession } from '@thallesp/nestjs-better-auth';

@ApiTags('System - Roles')
@Controller('system/roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  // POST /role
  @Post()
  @Permission(P_ROLE_MANAGE)
  create(
    @Session() session: UserSession,
    @Body() createRoleDto: CreateRoleDto,
    @Query('companyId') overriddenCompanyId?: string,
  ) {
    const sessionCompanyId = (session?.user as any)?.companyId || null;
    const finalCompanyId =
      sessionCompanyId === null
        ? overriddenCompanyId || null
        : sessionCompanyId;
    return this.roleService.create(createRoleDto, finalCompanyId);
  }

  // GET /role
  @Get()
  findAll(
    @Session() session: UserSession,
    @Query('companyId') overriddenCompanyId?: string,
  ) {
    const sessionCompanyId = (session?.user as any)?.companyId || null;
    let finalCompanyId =
      sessionCompanyId === null
        ? overriddenCompanyId || null
        : sessionCompanyId;

    // Explicitly handle "null" string from query params if any
    if (finalCompanyId === 'null') finalCompanyId = null;

    console.log(
      `[DEBUG] RoleController.findAll - companyId used: ${finalCompanyId}`,
    );
    return this.roleService.findAll(finalCompanyId);
  }

  // GET /role/:id
  @Get(':id')
  findOne(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Query('companyId') overriddenCompanyId?: string,
  ) {
    const sessionCompanyId = (session?.user as any)?.companyId || null;
    const finalCompanyId =
      sessionCompanyId === null
        ? overriddenCompanyId || null
        : sessionCompanyId;
    return this.roleService.findOne(id, finalCompanyId);
  }

  // PUT /role/:id
  @Put(':id')
  @Permission(P_ROLE_MANAGE)
  update(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @Query('companyId') overriddenCompanyId?: string,
  ) {
    const sessionCompanyId = (session?.user as any)?.companyId || null;
    const finalCompanyId =
      sessionCompanyId === null
        ? overriddenCompanyId || null
        : sessionCompanyId;
    return this.roleService.update(id, updateRoleDto, finalCompanyId);
  }

  // DELETE /role/:id
  @Delete(':id')
  @Permission(P_ROLE_MANAGE)
  remove(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Query('companyId') overriddenCompanyId?: string,
  ) {
    const sessionCompanyId = (session?.user as any)?.companyId || null;
    const finalCompanyId =
      sessionCompanyId === null
        ? overriddenCompanyId || null
        : sessionCompanyId;
    return this.roleService.remove(id, finalCompanyId);
  }
}
