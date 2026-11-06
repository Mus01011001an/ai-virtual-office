import { Body, Controller, Delete, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@thallesp/nestjs-better-auth';
import { ActiveCompany, ActiveUser } from 'src/common/decorators/active-company.decorator';
import { RequiresCompany } from 'src/common/decorators/requires-company.decorator';
import { RequiresCompanyGuard } from 'src/common/guards/requires-company.guard';
import { CreateWebhookConfigDto, GithubService } from './github.service';

@ApiTags('office-integrations')
@Controller('office/integrations')
export class IntegrationsController {
  constructor(private readonly githubService: GithubService) {}

  /**
   * Endpoint publik penerima Webhook GitHub (tidak memerlukan session guard agar GitHub dapat mengirim POST).
   */
  @Public()
  @Post('github/webhook')
  @ApiOperation({ summary: 'Menerima inbound webhook dari GitHub (push, PR)' })
  async handleGithubWebhook(
    @Query('companyId') companyIdQuery: string,
    @Headers('x-github-event') githubEvent: string,
    @Body() payload: any,
  ) {
    const companyId = companyIdQuery || payload?.companyId || 'default';
    return this.githubService.handleInboundWebhook(companyId, githubEvent || 'push', payload);
  }

  @ApiBearerAuth()
  @UseGuards(RequiresCompanyGuard)
  @RequiresCompany()
  @Get('webhooks')
  @ApiOperation({ summary: 'Mendapatkan daftar konfigurasi webhook eksternal' })
  async listWebhooks(@ActiveCompany() companyId: string) {
    return this.githubService.listWebhooks(companyId);
  }

  @ApiBearerAuth()
  @UseGuards(RequiresCompanyGuard)
  @RequiresCompany()
  @Post('webhooks')
  @ApiOperation({ summary: 'Mendaftarkan webhook eksternal baru (Telegram, Discord, Slack, HTTP)' })
  async createWebhook(
    @ActiveCompany() companyId: string,
    @ActiveUser() user: any,
    @Body() dto: CreateWebhookConfigDto,
  ) {
    return this.githubService.createWebhook(companyId, user?.id || 'admin', dto);
  }

  @ApiBearerAuth()
  @UseGuards(RequiresCompanyGuard)
  @RequiresCompany()
  @Delete('webhooks/:id')
  @ApiOperation({ summary: 'Menghapus konfigurasi webhook eksternal' })
  async deleteWebhook(
    @ActiveCompany() companyId: string,
    @Param('id') id: string,
  ) {
    return this.githubService.deleteWebhook(companyId, id);
  }

  @ApiBearerAuth()
  @UseGuards(RequiresCompanyGuard)
  @RequiresCompany()
  @Post('webhooks/:id/test')
  @ApiOperation({ summary: 'Mengirimkan notifikasi uji coba ke webhook terpilih' })
  async testWebhook(
    @ActiveCompany() companyId: string,
    @Param('id') id: string,
  ) {
    return this.githubService.testWebhook(companyId, id);
  }
}
