import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { ActivityService } from 'src/system/activity/activity.service';
import { decryptSecret, encryptSecret, maskSecret } from 'src/common/utils/secret-box';
import { API_KEY_PURPOSE, PROVIDER_TYPES, ProviderType } from './provider-types';
import { listRemoteModels, resolveBaseUrl } from './provider-client';
import { CreateAiProviderDto, TestAiProviderDto, UpdateAiProviderDto } from './dto/ai-provider.dto';

const PUBLIC_SELECT = {
  id: true, name: true, type: true, baseUrl: true, apiKeyHint: true, models: true, defaultModel: true,
  isActive: true, lastTestedAt: true, lastTestOk: true, lastTestMessage: true, createdAt: true, updatedAt: true, deletedAt: true,
  _count: { select: { employees: { where: { deletedAt: null } } } },
} as const;

const uniq = (a: string[]) => Array.from(new Set(a.map((s) => s.trim()).filter(Boolean)));

/** Kredensial AI provider per office. API key tidak pernah dikembalikan (hanya hint). */
@Injectable()
export class AiProviderService {
  constructor(private readonly prisma: DatabaseService, private readonly activity: ActivityService) {}

  types() {
    return Object.entries(PROVIDER_TYPES).map(([id, t]) => ({ id, ...t }));
  }

  async findAll(companyId: string, deleted = false) {
    const [rows, total] = await Promise.all([
      this.prisma.aiProvider.findMany({
        where: { companyId, deletedAt: deleted ? { not: null } : null },
        select: PUBLIC_SELECT, orderBy: { createdAt: 'asc' },
      }),
      this.prisma.aiProvider.count({ where: { companyId, deletedAt: deleted ? { not: null } : null } }),
    ]);
    return { data: rows.map(this.present), meta: { total } };
  }

  async findOne(companyId: string, id: string) {
    const row = await this.prisma.aiProvider.findFirst({ where: { id, companyId }, select: PUBLIC_SELECT });
    if (!row) throw new NotFoundException('AI provider tidak ditemukan');
    return this.present(row);
  }

  /** Daftar flat {provider, model} untuk dropdown model saat rekrut / edit AI employee. */
  async catalog(companyId: string) {
    const rows = await this.prisma.aiProvider.findMany({
      where: { companyId, deletedAt: null, isActive: true },
      select: { id: true, name: true, type: true, models: true, defaultModel: true, lastTestOk: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({ providerId: r.id, providerName: r.name, type: r.type, defaultModel: r.defaultModel, healthy: r.lastTestOk, models: r.models }));
  }

  async create(companyId: string, dto: CreateAiProviderDto, userId: string) {
    const baseUrl = resolveBaseUrl(dto.type, dto.baseUrl);
    const apiKey = (dto.apiKey ?? '').trim();
    if (!apiKey && dto.type !== 'openai_compatible') throw new BadRequestException('API key wajib diisi');
    const models = uniq(dto.models ?? []);
    const row = await this.prisma.aiProvider.create({
      data: {
        companyId, name: dto.name.trim(), type: dto.type, baseUrl,
        apiKeyEnc: apiKey ? encryptSecret(apiKey, API_KEY_PURPOSE) : '',
        apiKeyHint: maskSecret(apiKey),
        models, defaultModel: dto.defaultModel && models.includes(dto.defaultModel) ? dto.defaultModel : (models[0] ?? null),
        isActive: dto.isActive ?? true, createdById: userId, updatedById: userId,
      },
      select: { id: true },
    });
    await this.activity.log(companyId, userId).action('CREATE_AI_PROVIDER').subject('AiProvider', row.id).description(`Menambah AI provider ${dto.name}`).save();
    return this.findOne(companyId, row.id);
  }

  async update(companyId: string, id: string, dto: UpdateAiProviderDto, userId: string) {
    const cur = await this.prisma.aiProvider.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!cur) throw new NotFoundException('AI provider tidak ditemukan');
    const type = (dto.type ?? cur.type) as ProviderType;
    const data: Record<string, unknown> = { updatedById: userId };
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.type !== undefined || dto.baseUrl !== undefined) {
      data.type = type;
      data.baseUrl = resolveBaseUrl(type, dto.baseUrl ?? (dto.type && dto.type !== cur.type ? '' : cur.baseUrl));
    }
    if (dto.apiKey !== undefined && dto.apiKey.trim()) {
      data.apiKeyEnc = encryptSecret(dto.apiKey.trim(), API_KEY_PURPOSE);
      data.apiKeyHint = maskSecret(dto.apiKey.trim());
      data.lastTestOk = null; data.lastTestMessage = null; data.lastTestedAt = null;
    }
    const models = dto.models !== undefined ? uniq(dto.models) : cur.models;
    if (dto.models !== undefined) data.models = models;
    if (dto.defaultModel !== undefined || dto.models !== undefined) {
      const want = dto.defaultModel ?? cur.defaultModel;
      data.defaultModel = want && models.includes(want) ? want : (models[0] ?? null);
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    await this.prisma.aiProvider.update({ where: { id }, data });
    await this.activity.log(companyId, userId).action('UPDATE_AI_PROVIDER').subject('AiProvider', id)
      .details({ fields: Object.keys(dto).filter((k) => k !== 'apiKey'), apiKeyChanged: !!dto.apiKey?.trim() }).save();
    return this.findOne(companyId, id);
  }

  /** Test koneksi tanpa menyimpan (draft form) — key kosong + id = pakai key tersimpan. */
  async testDraft(companyId: string, dto: TestAiProviderDto) {
    let apiKey = (dto.apiKey ?? '').trim();
    if (!apiKey && dto.id) {
      const cur = await this.prisma.aiProvider.findFirst({ where: { id: dto.id, companyId } });
      if (!cur) throw new NotFoundException('AI provider tidak ditemukan');
      apiKey = decryptSecret(cur.apiKeyEnc, API_KEY_PURPOSE) ?? '';
    }
    return listRemoteModels(dto.type, resolveBaseUrl(dto.type, dto.baseUrl), apiKey);
  }

  /** Test kredensial tersimpan & catat hasilnya (badge sehat/gagal di UI). */
  async test(companyId: string, id: string) {
    const cur = await this.prisma.aiProvider.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!cur) throw new NotFoundException('AI provider tidak ditemukan');
    const apiKey = decryptSecret(cur.apiKeyEnc, API_KEY_PURPOSE) ?? '';
    if (cur.apiKeyEnc && !apiKey) {
      return { ok: false, latencyMs: 0, message: 'API key tidak bisa dibuka (BETTER_AUTH_SECRET berubah?) — isi ulang API key', models: [] };
    }
    const result = await listRemoteModels(cur.type as ProviderType, cur.baseUrl, apiKey);
    await this.prisma.aiProvider.update({
      where: { id }, data: { lastTestedAt: new Date(), lastTestOk: result.ok, lastTestMessage: result.message },
    });
    return result;
  }

  async softDelete(companyId: string, id: string, userId: string) {
    await this.findOne(companyId, id);
    await this.prisma.aiProvider.update({ where: { id }, data: { deletedAt: new Date(), updatedById: userId } });
    await this.activity.log(companyId, userId).action('DELETE_AI_PROVIDER').subject('AiProvider', id).save();
    return { success: true, message: 'AI provider dipindahkan ke sampah', data: { id } };
  }

  async restore(companyId: string, id: string, userId: string) {
    const cur = await this.prisma.aiProvider.findFirst({ where: { id, companyId, deletedAt: { not: null } } });
    if (!cur) throw new NotFoundException('AI provider tidak ada di sampah');
    await this.prisma.aiProvider.update({ where: { id }, data: { deletedAt: null, updatedById: userId } });
    return this.findOne(companyId, id);
  }

  async permanentDelete(companyId: string, id: string, userId: string) {
    const cur = await this.prisma.aiProvider.findFirst({ where: { id, companyId, deletedAt: { not: null } } });
    if (!cur) throw new BadRequestException('Pindahkan ke sampah dulu sebelum hapus permanen');
    await this.prisma.aiProvider.delete({ where: { id } }); // employee.providerId → SET NULL
    await this.activity.log(companyId, userId).action('PERMANENT_DELETE_AI_PROVIDER').subject('AiProvider', id).save();
    return { success: true, message: 'AI provider dihapus permanen', data: { id } };
  }

  private present = (r: any) => {
    const { _count, ...rest } = r;
    return { ...rest, employeeCount: _count?.employees ?? 0 };
  };
}
