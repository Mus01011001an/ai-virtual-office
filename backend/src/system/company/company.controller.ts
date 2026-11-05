import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Session, UserSession } from '@thallesp/nestjs-better-auth';
import { Permission } from 'src/lib/auth/permission.decorator';
import { P_OFFICE_DELETE, P_OFFICE_READ, P_OFFICE_UPDATE } from 'src/common/constants/permissions';
import { ActiveCompany } from 'src/common/decorators/active-company.decorator';
import { RequiresCompany } from 'src/common/decorators/requires-company.decorator';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@ApiTags('System - Offices')
@ApiBearerAuth()
@Controller('system/companies')
export class CompanyController {
  constructor(private readonly service: CompanyService) {}

  /** "Sesi baru": siapa pun yang login boleh membuat office sendiri. */
  @Post()
  create(@Body() dto: CreateCompanyDto, @Session() session: UserSession) {
    return this.service.create(dto, session);
  }

  @Get('archived')
  archived(@Session() session: UserSession) {
    return this.service.archived(session.user.id);
  }

  @Get('current')
  @RequiresCompany()
  @Permission(P_OFFICE_READ)
  current(@ActiveCompany() companyId: string) {
    return this.service.findOne(companyId);
  }

  @Patch('current')
  @RequiresCompany()
  @Permission(P_OFFICE_UPDATE)
  update(@ActiveCompany() companyId: string, @Body() dto: UpdateCompanyDto, @Session() session: UserSession) {
    return this.service.update(companyId, dto, session.user.id);
  }

  @Delete('current')
  @RequiresCompany()
  @Permission(P_OFFICE_DELETE)
  remove(@ActiveCompany() companyId: string, @Session() session: UserSession) {
    return this.service.softDelete(companyId, session.user.id);
  }

  @Post(':id/restore')
  restore(@Param('id') id: string, @Session() session: UserSession) {
    return this.service.restore(id, session.user.id);
  }
}
