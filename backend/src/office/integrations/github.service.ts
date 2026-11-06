import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { OfficeEventsService } from '../realtime/office-events.service';
import { WebhookNotificationService } from './webhook-notification.service';
import { WebhookChannel } from '@prisma/client';

export interface CreateWebhookConfigDto {
  channel: WebhookChannel;
  name: string;
  url: string;
  secret?: string;
  events?: string[];
  isActive?: boolean;
}

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  constructor(
    private readonly prisma: DatabaseService,
    private readonly events: OfficeEventsService,
    private readonly webhookNotification: WebhookNotificationService,
  ) {}

  /**
   * Mengambil metadata repository publik via GitHub API v3.
   */
  async inspectRepo(owner: string, repo: string): Promise<string> {
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'AI-Virtual-Office-Inspector/1.0',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (!response.ok) {
        return `GitHub API Error: ${response.status} ${response.statusText}`;
      }

      const data = await response.json();
      return JSON.stringify({
        fullName: data.full_name,
        description: data.description,
        stars: data.stargazers_count,
        forks: data.forks_count,
        openIssues: data.open_issues_count,
        defaultBranch: data.default_branch,
        updatedAt: data.updated_at,
        htmlUrl: data.html_url,
      });
    } catch (err: any) {
      return `Gagal menginspeksi repositori GitHub ${owner}/${repo}: ${err.message}`;
    }
  }

  /**
   * Menangani event inbound dari GitHub Webhooks (push, pull_request, dll).
   */
  async handleInboundWebhook(companyId: string, githubEvent: string, payload: any) {
    this.logger.log(`Received GitHub Inbound Webhook event [${githubEvent}] for company ${companyId}`);

    let description = '';
    let actor = 'GitHub';

    if (githubEvent === 'push') {
      const commitCount = payload.commits?.length || 0;
      const ref = payload.ref || 'branch';
      const sender = payload.sender?.login || 'developer';
      actor = sender;
      description = `Push: ${commitCount} commit baru ke ${ref} oleh @${sender}. Pesan: ${payload.head_commit?.message?.slice(0, 100) || 'no message'}`;
    } else if (githubEvent === 'pull_request') {
      const action = payload.action;
      const title = payload.pull_request?.title || 'PR';
      const user = payload.pull_request?.user?.login || 'contributor';
      actor = user;
      description = `Pull Request [${action}]: #${payload.pull_request?.number} "${title}" oleh @${user}`;
    } else {
      description = `Event GitHub: ${githubEvent}`;
    }

    // 1. Siarkan visual trigger ke seluruh klien 3D (Server rack flashing + TopBar alert)
    this.events.emit(companyId, 'integration.event', {
      source: 'github',
      event: githubEvent,
      actor,
      description,
      timestamp: new Date().toISOString(),
    });

    // 2. Forward ke webhook eksternal (Telegram / Discord / Slack)
    await this.webhookNotification.dispatch({
      companyId,
      event: 'integration.event',
      title: `GitHub Activity: ${githubEvent.toUpperCase()}`,
      summary: description,
      data: { source: 'github', event: githubEvent },
    });

    return { received: true, event: githubEvent };
  }

  /**
   * Mengambil daftar webhook untuk company.
   */
  async listWebhooks(companyId: string) {
    const list = await this.prisma.webhookConfig.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    return list.map((w) => ({
      ...w,
      secret: this.webhookNotification.maskWebhookSecret(w.secret),
    }));
  }

  /**
   * Mendaftarkan webhook baru.
   */
  async createWebhook(companyId: string, createdById: string, dto: CreateWebhookConfigDto) {
    const encryptedSecret = dto.secret
      ? this.webhookNotification.encryptWebhookSecret(dto.secret)
      : null;

    const created = await this.prisma.webhookConfig.create({
      data: {
        companyId,
        channel: dto.channel,
        name: dto.name || `${dto.channel} Notification`,
        url: dto.url,
        secret: encryptedSecret,
        events: dto.events || ['task.completed', 'task.failed', 'approval.requested'],
        isActive: dto.isActive !== false,
        createdById,
      },
    });

    return {
      ...created,
      secret: this.webhookNotification.maskWebhookSecret(created.secret),
    };
  }

  /**
   * Menghapus konfigurasi webhook.
   */
  async deleteWebhook(companyId: string, webhookId: string) {
    const existing = await this.prisma.webhookConfig.findFirst({
      where: { id: webhookId, companyId },
    });
    if (!existing) throw new NotFoundException('Webhook tidak ditemukan.');

    await this.prisma.webhookConfig.delete({ where: { id: webhookId } });
    return { success: true };
  }

  /**
   * Mengirim notifikasi uji coba (ping).
   */
  async testWebhook(companyId: string, webhookId: string) {
    const existing = await this.prisma.webhookConfig.findFirst({
      where: { id: webhookId, companyId },
    });
    if (!existing) throw new NotFoundException('Webhook tidak ditemukan.');

    await this.webhookNotification.dispatch({
      companyId,
      event: 'integration.event',
      title: 'Uji Coba Integrasi Virtual Office',
      summary: `Ini adalah pesan tes integrasi webhook saluran ${existing.channel} dari AI Virtual Office. Sistem beroperasi normal.`,
      data: { test: true },
    });

    return { success: true, message: 'Notifikasi uji coba berhasil dikirim.' };
  }
}
