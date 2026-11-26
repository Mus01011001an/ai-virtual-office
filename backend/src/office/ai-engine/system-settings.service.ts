import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import {
  decryptSecret,
  encryptSecret,
  maskSecret,
} from 'src/common/utils/secret-box';

const PURPOSE = 'system-setting';

/** Setting level platform (superadmin). Nilai disimpan terenkripsi, hanya hint yang keluar ke UI. */
@Injectable()
export class SystemSettingsService {
  private cache = new Map<
    string,
    { at: number; value: Record<string, unknown> | null }
  >();

  constructor(private readonly prisma: DatabaseService) {}

  async getJson<T extends Record<string, unknown>>(
    key: string,
  ): Promise<T | null> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < 30_000) return hit.value as T | null;
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    let value: Record<string, unknown> | null = null;
    if (row?.valueEnc) {
      try {
        value = JSON.parse(decryptSecret(row.valueEnc, PURPOSE) ?? 'null');
      } catch {
        value = null;
      }
    }
    this.cache.set(key, { at: Date.now(), value });
    return value as T | null;
  }

  async setJson(
    key: string,
    value: Record<string, unknown>,
    hintSource: string,
    userId: string,
  ) {
    this.cache.delete(key);
    const valueEnc = encryptSecret(JSON.stringify(value), PURPOSE);
    const hint = maskSecret(hintSource);
    await this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, valueEnc, hint, updatedById: userId },
      update: { valueEnc, hint, updatedById: userId },
    });
    return { key, hint };
  }

  async hint(key: string) {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key },
      select: { hint: true, updatedAt: true },
    });
    return row
      ? { configured: true, hint: row.hint, updatedAt: row.updatedAt }
      : { configured: false, hint: null, updatedAt: null };
  }

  async clear(key: string) {
    this.cache.delete(key);
    await this.prisma.systemSetting.deleteMany({ where: { key } });
    return { key, configured: false };
  }
}
