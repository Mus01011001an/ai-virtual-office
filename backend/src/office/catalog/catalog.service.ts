import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { encryptSecret, maskSecret } from 'src/common/utils/secret-box';
import { decryptSecret } from 'src/common/utils/secret-box';
import { API_KEY_PURPOSE, ProviderType } from '../ai-providers/provider-types';
import { listRemoteModels, resolveBaseUrl } from '../ai-providers/provider-client';
import { EmployeeService } from '../employees/employee.service';
import { ToolRegistryService } from '../ai-engine/tools/tool-registry.service';
import { HiggsfieldService, HIGGSFIELD_DEFAULTS, HIGGSFIELD_SETTING } from '../ai-engine/higgsfield.service';
import { SystemSettingsService } from '../ai-engine/system-settings.service';
import { DEFAULT_TEMPLATES } from './default-templates';
import { CreateTemplateDto, GlobalProviderDto, HiggsfieldSettingDto, UpdateTemplateDto } from './catalog.dto';

const PROVIDER_SELECT = {
  id: true, name: true, type: true, baseUrl: true, apiKeyHint: true, models: true, defaultModel: true,
  isActive: true, lastTestedAt: true, lastTestOk: true, lastTestMessage: true, createdAt: true,
} satisfies Prisma.AiProviderSelect;

const uniq = (a: string[]) => Array.from(new Set(a.map((s) => s.trim()).filter(Boolean)));

/**
 * Katalog AI global. Superadmin membuat/mengubah AI (persona, tool, model, tampilan) dan AI provider global;
 * setiap office cukup "pakai" AI dari katalog. Perubahan template langsung mengalir ke semua office.
 */
@Injectable()
export class CatalogService implements OnModuleInit {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    private readonly prisma: DatabaseService,
    private readonly employees: EmployeeService,
    private readonly tools: ToolRegistryService,
    private readonly higgsfield: HiggsfieldService,
    private readonly settings: SystemSettingsService,
  ) {}

  async onModuleInit() {
    try {
      if ((await this.prisma.agentTemplate.count()) > 0) return;
      await this.prisma.agentTemplate.createMany({
        data: DEFAULT_TEMPLATES.map((t) => ({ ...t, appearance: t.appearance as Prisma.InputJsonValue })),
        skipDuplicates: true,
      });
      this.logger.log(`Katalog AI di-seed: ${DEFAULT_TEMPLATES.length} AI bawaan`);
    } catch (e: any) {
      this.logger.warn(`Seed katalog AI dilewati: ${e.message}`);
    }
  }

  // ---------- office ----------

  /** Katalog untuk office: AI aktif + status sudah dipakai di office ini. */
  async listForCompany(companyId: string) {
    const [rows, used] = await Promise.all([
      this.prisma.agentTemplate.findMany({
        where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true, key: true, name: true, role: true, department: true, tagline: true, skills: true, tools: true,
          appearance: true, model: true, provider: { select: { isActive: true, deletedAt: true } },
        },
      }),
      this.prisma.employee.findMany({ where: { companyId, templateId: { not: null }, deletedAt: null }, select: { id: true, templateId: true } }),
    ]);
    return rows.map(({ provider, ...t }) => ({
      ...t,
      ready: !!provider && provider.isActive && !provider.deletedAt && !!t.model,
      employeeId: used.find((u) => u.templateId === t.id)?.id ?? null,
    }));
  }

  hire(companyId: string, templateId: string, userId: string) {
    return this.employees.createFromTemplate(companyId, templateId, userId);
  }

  // ---------- admin: template ----------

  async listTemplates() {
    const rows = await this.prisma.agentTemplate.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { provider: { select: { id: true, name: true } }, _count: { select: { employees: { where: { deletedAt: null } } } } },
    });
    return rows.map(({ _count, ...r }) => ({ ...r, usedBy: _count.employees }));
  }

  private async checkProvider(providerId?: string | null, model?: string) {
    if (!providerId) return;
    const p = await this.prisma.aiProvider.findFirst({ where: { id: providerId, companyId: null, deletedAt: null } });
    if (!p) throw new BadRequestException('AI provider global tidak ditemukan');
    if (model && p.models.length && !p.models.includes(model)) throw new BadRequestException(`Model "${model}" belum diaktifkan di ${p.name}`);
  }

  async createTemplate(dto: CreateTemplateDto) {
    await this.checkProvider(dto.providerId, dto.model);
    if (await this.prisma.agentTemplate.findUnique({ where: { key: dto.key } })) throw new BadRequestException('Key sudah dipakai');
    return this.prisma.agentTemplate.create({
      data: {
        key: dto.key, name: dto.name.trim(), role: dto.role.trim(), department: dto.department?.trim() ?? '',
        tagline: dto.tagline?.trim() ?? '', skills: uniq(dto.skills ?? []), systemPrompt: dto.systemPrompt ?? '',
        tools: uniq(dto.tools ?? []), appearance: (dto.appearance ?? {}) as Prisma.InputJsonValue,
        providerId: dto.providerId || null, model: dto.model ?? '', isActive: dto.isActive ?? true, sortOrder: dto.sortOrder ?? 99,
      },
    });
  }

  async updateTemplate(id: string, dto: UpdateTemplateDto) {
    const cur = await this.prisma.agentTemplate.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException('Template tidak ditemukan');
    const providerId = dto.providerId === undefined ? cur.providerId : dto.providerId || null;
    await this.checkProvider(providerId, dto.model ?? cur.model);
    const data: Prisma.AgentTemplateUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.role !== undefined) data.role = dto.role.trim();
    if (dto.department !== undefined) data.department = dto.department.trim();
    if (dto.tagline !== undefined) data.tagline = dto.tagline.trim();
    if (dto.skills !== undefined) data.skills = uniq(dto.skills);
    if (dto.systemPrompt !== undefined) data.systemPrompt = dto.systemPrompt;
    if (dto.tools !== undefined) data.tools = uniq(dto.tools);
    if (dto.appearance !== undefined) data.appearance = dto.appearance as Prisma.InputJsonValue;
    if (dto.providerId !== undefined) data.provider = providerId ? { connect: { id: providerId } } : { disconnect: true };
    if (dto.model !== undefined) data.model = dto.model;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    const row = await this.prisma.agentTemplate.update({ where: { id }, data });
    const synced = await this.employees.syncFromTemplate(id);
    return { ...row, synced };
  }

  /** Dipakai office → dinonaktifkan dari katalog (AI yang sudah dipakai tetap jalan); belum dipakai → dihapus. */
  async removeTemplate(id: string) {
    const used = await this.prisma.employee.count({ where: { templateId: id, deletedAt: null } });
    if (used) {
      await this.prisma.agentTemplate.update({ where: { id }, data: { isActive: false } });
      return { success: true, message: `Dinonaktifkan dari katalog (masih dipakai ${used} office)`, data: { id } };
    }
    await this.prisma.agentTemplate.delete({ where: { id } });
    return { success: true, message: 'Template dihapus', data: { id } };
  }

  toolOptions() {
    return this.tools.getDefinitions().map((t) => ({ name: t.name, description: t.description }));
  }

  // ---------- admin: AI provider global ----------

  listProviders() {
    return this.prisma.aiProvider.findMany({ where: { companyId: null, deletedAt: null }, select: PROVIDER_SELECT, orderBy: { createdAt: 'asc' } });
  }

  async createProvider(dto: GlobalProviderDto, userId: string) {
    if (!dto.name || !dto.type) throw new BadRequestException('Nama dan tipe wajib diisi');
    const apiKey = (dto.apiKey ?? '').trim();
    const models = uniq(dto.models ?? []);
    return this.prisma.aiProvider.create({
      data: {
        companyId: null, name: dto.name.trim(), type: dto.type, baseUrl: resolveBaseUrl(dto.type, dto.baseUrl),
        apiKeyEnc: apiKey ? encryptSecret(apiKey, API_KEY_PURPOSE) : '', apiKeyHint: maskSecret(apiKey),
        models, defaultModel: dto.defaultModel && models.includes(dto.defaultModel) ? dto.defaultModel : (models[0] ?? null),
        isActive: dto.isActive ?? true, createdById: userId, updatedById: userId,
      },
      select: PROVIDER_SELECT,
    });
  }

  async updateProvider(id: string, dto: GlobalProviderDto, userId: string) {
    const cur = await this.prisma.aiProvider.findFirst({ where: { id, companyId: null, deletedAt: null } });
    if (!cur) throw new NotFoundException('AI provider global tidak ditemukan');
    const type = (dto.type ?? cur.type) as ProviderType;
    const data: Prisma.AiProviderUpdateInput = { updatedById: userId };
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.type !== undefined || dto.baseUrl !== undefined) { data.type = type; data.baseUrl = resolveBaseUrl(type, dto.baseUrl ?? cur.baseUrl); }
    if (dto.apiKey?.trim()) { data.apiKeyEnc = encryptSecret(dto.apiKey.trim(), API_KEY_PURPOSE); data.apiKeyHint = maskSecret(dto.apiKey.trim()); }
    const models = dto.models !== undefined ? uniq(dto.models) : cur.models;
    if (dto.models !== undefined) data.models = models;
    if (dto.defaultModel !== undefined || dto.models !== undefined) {
      const want = dto.defaultModel ?? cur.defaultModel;
      data.defaultModel = want && models.includes(want) ? want : (models[0] ?? null);
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    const row = await this.prisma.aiProvider.update({ where: { id }, data, select: PROVIDER_SELECT });
    // nama provider tampil di employee → sinkronkan template yang memakainya
    const templates = await this.prisma.agentTemplate.findMany({ where: { providerId: id }, select: { id: true } });
    for (const t of templates) await this.employees.syncFromTemplate(t.id);
    return row;
  }

  async testProvider(id: string) {
    const cur = await this.prisma.aiProvider.findFirst({ where: { id, companyId: null, deletedAt: null } });
    if (!cur) throw new NotFoundException('AI provider global tidak ditemukan');
    const result = await listRemoteModels(cur.type as ProviderType, cur.baseUrl, decryptSecret(cur.apiKeyEnc, API_KEY_PURPOSE) ?? '');
    await this.prisma.aiProvider.update({ where: { id }, data: { lastTestedAt: new Date(), lastTestOk: result.ok, lastTestMessage: result.message } });
    return result;
  }

  async removeProvider(id: string, userId: string) {
    const cur = await this.prisma.aiProvider.findFirst({ where: { id, companyId: null, deletedAt: null } });
    if (!cur) throw new NotFoundException('AI provider global tidak ditemukan');
    await this.prisma.aiProvider.update({ where: { id }, data: { deletedAt: new Date(), updatedById: userId } });
    const templates = await this.prisma.agentTemplate.findMany({ where: { providerId: id }, select: { id: true } });
    await this.prisma.agentTemplate.updateMany({ where: { providerId: id }, data: { providerId: null } });
    for (const t of templates) await this.employees.syncFromTemplate(t.id);
    return { success: true, data: { id } };
  }

  // ---------- admin: Higgsfield ----------

  async higgsfieldStatus() {
    const [h, cfg] = await Promise.all([this.settings.hint(HIGGSFIELD_SETTING), this.settings.getJson<Record<string, string>>(HIGGSFIELD_SETTING)]);
    const fromEnv = !h.configured && !!process.env.HIGGSFIELD_API_KEY_ID;
    return {
      configured: h.configured || fromEnv, source: h.configured ? 'admin' : fromEnv ? 'env' : null, hint: h.hint, updatedAt: h.updatedAt,
      imageModel: cfg?.imageModel || HIGGSFIELD_DEFAULTS.imageModel,
      videoModel: cfg?.videoModel || HIGGSFIELD_DEFAULTS.videoModel,
      imageToVideoModel: cfg?.imageToVideoModel || HIGGSFIELD_DEFAULTS.imageToVideoModel,
    };
  }

  async saveHiggsfield(dto: HiggsfieldSettingDto, userId: string) {
    const cur = (await this.settings.getJson<Record<string, string>>(HIGGSFIELD_SETTING)) ?? {};
    const next = {
      keyId: dto.keyId?.trim() || cur.keyId || '',
      keySecret: dto.keySecret?.trim() || cur.keySecret || '',
      imageModel: dto.imageModel?.trim() ?? cur.imageModel ?? '',
      videoModel: dto.videoModel?.trim() ?? cur.videoModel ?? '',
      imageToVideoModel: dto.imageToVideoModel?.trim() ?? cur.imageToVideoModel ?? '',
    };
    if (!next.keyId || !next.keySecret) throw new BadRequestException('Key ID dan Key Secret Higgsfield wajib diisi');
    await this.settings.setJson(HIGGSFIELD_SETTING, next, next.keySecret, userId);
    return this.higgsfieldStatus();
  }

  testHiggsfield(dto?: HiggsfieldSettingDto) {
    return this.higgsfield.test(dto?.keyId && dto?.keySecret ? { keyId: dto.keyId.trim(), keySecret: dto.keySecret.trim() } : undefined);
  }

  async clearHiggsfield() {
    await this.settings.clear(HIGGSFIELD_SETTING);
    return this.higgsfieldStatus();
  }
}
