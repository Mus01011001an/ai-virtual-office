import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Session, UserSession } from '@thallesp/nestjs-better-auth';
import { Permission } from 'src/lib/auth/permission.decorator';
import { P_EMPLOYEE_READ, P_EMPLOYEE_WRITE } from 'src/common/constants/permissions';
import { ActiveCompany } from 'src/common/decorators/active-company.decorator';
import { RequiresCompany } from 'src/common/decorators/requires-company.decorator';
import { SuperAdminGuard } from 'src/common/guards/superadmin.guard';
import { CatalogService } from './catalog.service';
import { CreateTemplateDto, GlobalProviderDto, HiggsfieldSettingDto, UpdateTemplateDto } from './catalog.dto';

/** Office: lihat katalog AI & pakai AI ke kantor. */
@ApiTags('Office - Katalog AI')
@ApiBearerAuth()
@RequiresCompany()
@Permission(P_EMPLOYEE_READ)
@Controller('office/agent-catalog')
export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  @Get()
  list(@ActiveCompany() companyId: string) {
    return this.service.listForCompany(companyId);
  }

  @Post(':templateId/hire')
  @Permission(P_EMPLOYEE_WRITE)
  hire(@ActiveCompany() companyId: string, @Param('templateId') templateId: string, @Session() s: UserSession) {
    return this.service.hire(companyId, templateId, s.user.id);
  }
}

/** Superadmin: kelola katalog AI, AI provider global, dan integrasi Higgsfield. */
@ApiTags('Admin - Katalog AI')
@ApiBearerAuth()
@UseGuards(SuperAdminGuard)
@Controller('admin')
export class AdminCatalogController {
  constructor(private readonly service: CatalogService) {}

  @Get('agent-templates')
  templates() { return this.service.listTemplates(); }

  @Get('agent-templates/tools')
  tools() { return this.service.toolOptions(); }

  @Post('agent-templates')
  createTemplate(@Body() dto: CreateTemplateDto) { return this.service.createTemplate(dto); }

  @Patch('agent-templates/:id')
  updateTemplate(@Param('id') id: string, @Body() dto: UpdateTemplateDto) { return this.service.updateTemplate(id, dto); }

  @Delete('agent-templates/:id')
  removeTemplate(@Param('id') id: string) { return this.service.removeTemplate(id); }

  @Get('ai-providers')
  providers() { return this.service.listProviders(); }

  @Post('ai-providers')
  createProvider(@Body() dto: GlobalProviderDto, @Session() s: UserSession) { return this.service.createProvider(dto, s.user.id); }

  @Patch('ai-providers/:id')
  updateProvider(@Param('id') id: string, @Body() dto: GlobalProviderDto, @Session() s: UserSession) { return this.service.updateProvider(id, dto, s.user.id); }

  @Post('ai-providers/:id/test')
  testProvider(@Param('id') id: string) { return this.service.testProvider(id); }

  @Delete('ai-providers/:id')
  removeProvider(@Param('id') id: string, @Session() s: UserSession) { return this.service.removeProvider(id, s.user.id); }

  @Get('integrations/higgsfield')
  higgsfield() { return this.service.higgsfieldStatus(); }

  @Put('integrations/higgsfield')
  saveHiggsfield(@Body() dto: HiggsfieldSettingDto, @Session() s: UserSession) { return this.service.saveHiggsfield(dto, s.user.id); }

  @Post('integrations/higgsfield/test')
  testHiggsfield(@Body() dto: HiggsfieldSettingDto) { return this.service.testHiggsfield(dto); }

  @Delete('integrations/higgsfield')
  clearHiggsfield() { return this.service.clearHiggsfield(); }
}
