import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Session, UserSession } from '@thallesp/nestjs-better-auth';
import { Permission } from 'src/lib/auth/permission.decorator';
import { P_EMPLOYEE_INSTRUCT, P_EMPLOYEE_READ } from 'src/common/constants/permissions';
import { ActiveCompany } from 'src/common/decorators/active-company.decorator';
import { RequiresCompany } from 'src/common/decorators/requires-company.decorator';
import { BrainService } from './brain.service';
import { BrainNoteDto, BrainPinDto } from '../catalog/catalog.dto';

/** Otak Kantor: memori bersama yang dibaca & ditulis semua AI dan anggota office. */
@ApiTags('Office - Otak Kantor')
@ApiBearerAuth()
@RequiresCompany()
@Permission(P_EMPLOYEE_READ)
@Controller('office/brain')
export class BrainController {
  constructor(private readonly brain: BrainService) {}

  @Get()
  list(@ActiveCompany() companyId: string, @Query('q') q?: string, @Query('kind') kind?: string, @Query('limit') limit?: string) {
    return this.brain.list(companyId, { q, kind, limit: limit ? parseInt(limit, 10) : undefined });
  }

  @Post()
  @Permission(P_EMPLOYEE_INSTRUCT)
  note(@ActiveCompany() companyId: string, @Body() dto: BrainNoteDto, @Session() s: UserSession) {
    return this.brain.record({
      companyId, kind: dto.kind, title: dto.title, content: dto.content,
      pinned: dto.pinned ?? dto.kind === 'brief', createdById: s.user.id,
    });
  }

  @Patch(':id')
  @Permission(P_EMPLOYEE_INSTRUCT)
  pin(@ActiveCompany() companyId: string, @Param('id') id: string, @Body() dto: BrainPinDto) {
    return this.brain.setPinned(companyId, id, dto.pinned);
  }

  @Delete(':id')
  @Permission(P_EMPLOYEE_INSTRUCT)
  remove(@ActiveCompany() companyId: string, @Param('id') id: string) {
    return this.brain.remove(companyId, id);
  }
}
