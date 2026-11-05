import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Session, UserSession } from '@thallesp/nestjs-better-auth';
import { Permission } from 'src/lib/auth/permission.decorator';
import { P_EMPLOYEE_DELETE, P_EMPLOYEE_INSTRUCT, P_EMPLOYEE_READ, P_EMPLOYEE_WRITE } from 'src/common/constants/permissions';
import { ActiveCompany } from 'src/common/decorators/active-company.decorator';
import { RequiresCompany } from 'src/common/decorators/requires-company.decorator';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto, InstructionDto, UpdateEmployeeDto } from './dto/employee.dto';

@ApiTags('Office - Employees')
@ApiBearerAuth()
@RequiresCompany()
@Permission(P_EMPLOYEE_READ)
@Controller('office/employees')
export class EmployeeController {
  constructor(private readonly service: EmployeeService) {}

  @Get()
  findAll(@ActiveCompany() companyId: string, @Query('q') q?: string, @Query('deleted') deleted?: string,
    @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.findAll(companyId, {
      q, deleted: deleted === 'true',
      page: page ? parseInt(page, 10) : undefined, limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  findOne(@ActiveCompany() companyId: string, @Param('id') id: string) {
    return this.service.findOne(companyId, id);
  }

  @Get(':id/activity')
  activity(@ActiveCompany() companyId: string, @Param('id') id: string, @Query('limit') limit?: string) {
    return this.service.activities(companyId, id, limit ? parseInt(limit, 10) : undefined);
  }

  @Post()
  @Permission(P_EMPLOYEE_WRITE)
  create(@ActiveCompany() companyId: string, @Body() dto: CreateEmployeeDto, @Session() s: UserSession) {
    return this.service.create(companyId, dto, s.user.id);
  }

  @Patch(':id')
  @Permission(P_EMPLOYEE_WRITE)
  update(@ActiveCompany() companyId: string, @Param('id') id: string, @Body() dto: UpdateEmployeeDto, @Session() s: UserSession) {
    return this.service.update(companyId, id, dto, s.user.id);
  }

  @Post(':id/instructions')
  @Permission(P_EMPLOYEE_INSTRUCT)
  instruct(@ActiveCompany() companyId: string, @Param('id') id: string, @Body() dto: InstructionDto, @Session() s: UserSession) {
    return this.service.instruct(companyId, id, dto.text, s.user.name);
  }

  @Delete(':id')
  @Permission(P_EMPLOYEE_DELETE)
  remove(@ActiveCompany() companyId: string, @Param('id') id: string, @Query('force') force: string, @Session() s: UserSession) {
    return force === 'true' ? this.service.permanentDelete(companyId, id, s.user.id) : this.service.softDelete(companyId, id, s.user.id);
  }

  @Post(':id/restore')
  @Permission(P_EMPLOYEE_DELETE)
  restore(@ActiveCompany() companyId: string, @Param('id') id: string, @Session() s: UserSession) {
    return this.service.restore(companyId, id, s.user.id);
  }
}
