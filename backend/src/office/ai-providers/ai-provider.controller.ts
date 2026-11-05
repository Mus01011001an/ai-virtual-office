import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Session, UserSession } from '@thallesp/nestjs-better-auth';
import { Permission } from 'src/lib/auth/permission.decorator';
import { P_AI_PROVIDER_MANAGE, P_AI_PROVIDER_READ } from 'src/common/constants/permissions';
import { SENSITIVE_RATE_LIMIT } from 'src/common/constants/rate-limit';
import { ActiveCompany } from 'src/common/decorators/active-company.decorator';
import { RequiresCompany } from 'src/common/decorators/requires-company.decorator';
import { AiProviderService } from './ai-provider.service';
import { CreateAiProviderDto, TestAiProviderDto, UpdateAiProviderDto } from './dto/ai-provider.dto';

@ApiTags('Office - AI Providers')
@ApiBearerAuth()
@RequiresCompany()
@Permission(P_AI_PROVIDER_READ)
@Controller('office/ai-providers')
export class AiProviderController {
  constructor(private readonly service: AiProviderService) {}

  @Get('types')
  types() {
    return this.service.types();
  }

  /** Model yang bisa dipilih AI employee (provider aktif saja). */
  @Get('catalog')
  catalog(@ActiveCompany() companyId: string) {
    return this.service.catalog(companyId);
  }

  @Get()
  findAll(@ActiveCompany() companyId: string, @Query('deleted') deleted?: string) {
    return this.service.findAll(companyId, deleted === 'true');
  }

  @Get(':id')
  findOne(@ActiveCompany() companyId: string, @Param('id') id: string) {
    return this.service.findOne(companyId, id);
  }

  @Post()
  @Permission(P_AI_PROVIDER_MANAGE)
  create(@ActiveCompany() companyId: string, @Body() dto: CreateAiProviderDto, @Session() s: UserSession) {
    return this.service.create(companyId, dto, s.user.id);
  }

  /** Test connection dari form (belum disimpan). */
  @Post('test')
  @Throttle(SENSITIVE_RATE_LIMIT)
  @Permission(P_AI_PROVIDER_MANAGE)
  testDraft(@ActiveCompany() companyId: string, @Body() dto: TestAiProviderDto) {
    return this.service.testDraft(companyId, dto);
  }

  @Post(':id/test')
  @Throttle(SENSITIVE_RATE_LIMIT)
  @Permission(P_AI_PROVIDER_MANAGE)
  test(@ActiveCompany() companyId: string, @Param('id') id: string) {
    return this.service.test(companyId, id);
  }

  @Patch(':id')
  @Permission(P_AI_PROVIDER_MANAGE)
  update(@ActiveCompany() companyId: string, @Param('id') id: string, @Body() dto: UpdateAiProviderDto, @Session() s: UserSession) {
    return this.service.update(companyId, id, dto, s.user.id);
  }

  @Delete(':id')
  @Permission(P_AI_PROVIDER_MANAGE)
  remove(@ActiveCompany() companyId: string, @Param('id') id: string, @Query('force') force: string, @Session() s: UserSession) {
    return force === 'true' ? this.service.permanentDelete(companyId, id, s.user.id) : this.service.softDelete(companyId, id, s.user.id);
  }

  @Post(':id/restore')
  @Permission(P_AI_PROVIDER_MANAGE)
  restore(@ActiveCompany() companyId: string, @Param('id') id: string, @Session() s: UserSession) {
    return this.service.restore(companyId, id, s.user.id);
  }
}
