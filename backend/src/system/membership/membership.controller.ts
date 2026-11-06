import { P_MEMBER_MANAGE, P_MEMBER_READ } from 'src/common/constants/permissions';
import { RequiresCompany } from 'src/common/decorators/requires-company.decorator';
import { Permission } from 'src/lib/auth/permission.decorator';
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Session, UserSession } from '@thallesp/nestjs-better-auth';
import { MembershipService } from './membership.service';
import { ActiveCompany } from 'src/common/decorators/active-company.decorator';

@ApiTags('System - Membership')
@ApiBearerAuth()
@RequiresCompany()
@Permission(P_MEMBER_READ)
@Controller('system/memberships')
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  @Get()
  @ApiOperation({ summary: 'List all members of the active company' })
  findAll(
    @ActiveCompany() companyId: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.membershipService.findAll(companyId, {
      q,
      page: page ? parseInt(page, 10) : 0,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Post('invite')
  @Permission(P_MEMBER_MANAGE)
  @ApiOperation({ summary: 'Invite a user to the active company' })
  invite(
    @ActiveCompany() companyId: string,
    @Session() session: UserSession,
    @Body() body: { userId?: string; email?: string; username?: string; roleId?: string },
  ) {
    return this.membershipService.invite(companyId, session.user.id, body);
  }

  @Post('create-account')
  @Permission(P_MEMBER_MANAGE)
  @ApiOperation({ summary: 'Buat akun teman (username + password) & tentukan hak akses di office aktif' })
  createAccount(
    @ActiveCompany() companyId: string,
    @Session() session: UserSession,
    @Body() body: { name?: string; username?: string; email?: string; password: string; roleId?: string; permissions?: string[] },
  ) {
    return this.membershipService.createAccount(companyId, session.user.id, body);
  }

  @Put(':userId')
  @Permission(P_MEMBER_MANAGE)
  @ApiOperation({ summary: 'Update member role or status' })
  update(
    @ActiveCompany() companyId: string,
    @Param('userId') memberUserId: string,
    @Body() body: { roleId?: string; isActive?: boolean },
  ) {
    return this.membershipService.update(companyId, memberUserId, body);
  }

  @Delete(':userId')
  @Permission(P_MEMBER_MANAGE)
  @ApiOperation({ summary: 'Remove a member from the active company' })
  remove(
    @ActiveCompany() companyId: string,
    @Param('userId') memberUserId: string,
  ) {
    return this.membershipService.remove(companyId, memberUserId);
  }
}
