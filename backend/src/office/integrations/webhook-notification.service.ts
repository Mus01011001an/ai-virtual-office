import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { decryptSecret, encryptSecret, hmacSha256Hex, maskSecret } from 'src/common/utils/secret-box';

export interface WebhookDispatchPayload {
  companyId: string;
  event: 'task.completed' | 'task.failed' | 'approval.requested' | 'standup.completed' | 'integration.event';
  title: string;
  summary: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class WebhookNotificationService {
  private readonly logger = new Logger(WebhookNotificationService.name);

  constructor(private readonly prisma: DatabaseService) {}

  /**
   * Mengirim notifikasi event ke seluruh channel webhook yang terdaftar dan aktif untuk company ini.
   */
  async dispatch(payload: WebhookDispatchPayload): Promise<void> {
    try {
      const webhooks = await this.prisma.webhookConfig.findMany({
        where: {
          companyId: payload.companyId,
          isActive: true,
        },
      });

      if (!webhooks || webhooks.length === 0) return;

      const relevant = webhooks.filter((w) => {
        if (!w.events || w.events.length === 0) return true;
        return w.events.includes('*') || w.events.includes(payload.event);
      });

      for (const hook of relevant) {
        // Asynchronous non-blocking dispatch
        this.sendToChannel(hook, payload).catch((err) => {
          this.logger.warn(`Gagal kirim webhook ${hook.channel} (${hook.id}): ${err.message}`);
        });
      }
    } catch (err: any) {
      this.logger.error(`Error mengambil konfigurasi webhook: ${err.message}`);
    }
  }

  private async sendToChannel(hook: any, payload: WebhookDispatchPayload): Promise<void> {
    const rawSecret = hook.secret ? decryptSecret(hook.secret, 'webhook') : null;

    switch (hook.channel) {
      case 'TELEGRAM':
        await this.sendTelegram(hook.url, rawSecret, payload);
        break;
      case 'DISCORD':
        await this.sendDiscord(hook.url, payload);
        break;
      case 'SLACK':
        await this.sendSlack(hook.url, payload);
        break;
      case 'GENERIC_HTTP':
      default:
        await this.sendGenericHttp(hook.url, rawSecret, payload);
        break;
    }
  }

  private async sendTelegram(urlOrEndpoint: string, botToken: string | null, payload: WebhookDispatchPayload): Promise<void> {
    let targetUrl = urlOrEndpoint;
    let chatId: string | undefined;

    // Jika url berisi https://api.telegram.org/bot<token>/sendMessage?chat_id=123
    try {
      const u = new URL(urlOrEndpoint);
      if (u.searchParams.has('chat_id')) {
        chatId = u.searchParams.get('chat_id') || undefined;
      }
    } catch {}

    if (!chatId && botToken && botToken.includes(':')) {
      targetUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
      // chatId bisa diambil dari urlOrEndpoint jika hanya chat_id yang dimasukkan di kolom URL
      chatId = urlOrEndpoint;
    }

    const htmlMessage = `🏢 <b>AI Virtual Office Alert</b>\n\n<b>Event:</b> <code>${payload.event}</code>\n<b>Title:</b> ${this.escapeHtml(payload.title)}\n\n${this.escapeHtml(payload.summary)}\n\n<i>🕒 ${new Date().toISOString()}</i>`;

    const body: Record<string, any> = {
      text: htmlMessage,
      parse_mode: 'HTML',
    };
    if (chatId) body.chat_id = chatId;

    await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
  }

  private async sendDiscord(url: string, payload: WebhookDispatchPayload): Promise<void> {
    const isError = payload.event === 'task.failed';
    const isApproval = payload.event === 'approval.requested';
    const color = isError ? 0xff4757 : isApproval ? 0xffa502 : 0x2ed573;

    const body = {
      embeds: [
        {
          title: `🏢 [Virtual Office] ${payload.title}`,
          description: payload.summary,
          color,
          fields: [
            { name: 'Event Type', value: `\`${payload.event}\``, inline: true },
            { name: 'Timestamp', value: new Date().toLocaleTimeString('id-ID'), inline: true },
          ],
          footer: { text: 'AI Virtual Office Realtime System' },
        },
      ],
    };

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
  }

  private async sendSlack(url: string, payload: WebhookDispatchPayload): Promise<void> {
    const body = {
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `🏢 ${payload.title}`, emoji: true },
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*Event:* \`${payload.event}\`\n${payload.summary}` },
        },
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: `AI Virtual Office • ${new Date().toISOString()}` }],
        },
      ],
    };

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
  }

  private async sendGenericHttp(url: string, secret: string | null, payload: WebhookDispatchPayload): Promise<void> {
    const rawBody = JSON.stringify({
      timestamp: new Date().toISOString(),
      ...payload,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'AI-Virtual-Office-Webhook/1.0',
      'X-Virtual-Office-Event': payload.event,
    };

    if (secret) {
      headers['X-Virtual-Office-Signature'] = `sha256=${hmacSha256Hex(secret, rawBody)}`;
    }

    await fetch(url, {
      method: 'POST',
      headers,
      body: rawBody,
      signal: AbortSignal.timeout(5000),
    });
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Helper untuk enkripsi secret webhook sebelum simpan ke DB.
   */
  encryptWebhookSecret(secret: string): string {
    return encryptSecret(secret, 'webhook');
  }

  /**
   * Mask secret untuk response API.
   */
  maskWebhookSecret(encryptedSecret?: string | null): string | null {
    if (!encryptedSecret) return null;
    const decrypted = decryptSecret(encryptedSecret, 'webhook');
    return maskSecret(decrypted);
  }
}
