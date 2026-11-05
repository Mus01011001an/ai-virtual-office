import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SyncAssetDto } from './dto/sync-asset.dto';
import { getPresignedReadUrl } from 'src/common/infrastructure';

/* =====================
 * TYPES
 * ===================== */

export type AssetContext = {
  subjectType: string;
  field: string;
  as?: string; // 🔥 rename field di response
};

export type AssetImageResponse = {
  id: string;
  key: string;
  name: string | null;
  mimeType: string;
  size: number;
  url: string;
  bucket?: string | null;
};

@Injectable()
export class AssetService {
  constructor(private readonly prisma: DatabaseService) {}

  // =====================================================
  // SYNC
  // =====================================================

  async sync(dto: SyncAssetDto) {
    const { subjectType, subjectId, field, assets } = dto;

    return this.prisma.$transaction(async (tx) => {
      const existingIds = await this.getExistingIds(tx, {
        subjectType,
        subjectId,
        field,
      });

      const keepIds = this.getKeepIds(assets);

      await this.softDeleteMissing(
        tx,
        { subjectType, subjectId, field },
        existingIds,
        keepIds,
      );

      await this.createNewAssets(tx, { subjectType, subjectId, field }, assets);

      await this.applyPrimary(tx, { subjectType, subjectId, field }, assets);
    });
  }

  async syncSingle(
    ctx: { subjectType: string; subjectId: string; field: string },
    image?: SyncAssetDto['assets'][number] | null,
  ) {
    await this.sync({
      ...ctx,
      assets: image ? [{ ...image, isPrimary: true }] : [],
    });
  }

  // =====================================================
  // ATTACH (TYPE SAFE)
  // =====================================================

  async attachPrimaryToMany<T extends Record<string, any> & { id: string }>(
    ctx: AssetContext,
    entities: T[],
  ): Promise<(T & Record<string, AssetImageResponse | null>)[]> {
    if (!entities.length) return [];

    const assets = await this.prisma.assets.findMany({
      where: {
        subjectType: ctx.subjectType,
        field: ctx.field,
        subjectId: { in: entities.map((e) => e.id) },
        isPrimary: true,
        deletedAt: null,
      },
      select: {
        id: true,
        subjectId: true,
        key: true,
        originalName: true,
        mimeType: true,
        size: true,
        bucket: true,
      },
    });

    const map = new Map<string, (typeof assets)[number]>();
    assets.forEach((a) => map.set(a.subjectId || '', a));

    const responseKey = ctx.as ?? ctx.field;

    return Promise.all(
      entities.map(async (e) => {
        const asset = map.get(e.id);

        const image: AssetImageResponse | null = asset
          ? {
              id: asset.id,
              key: asset.key || '',
              name: asset.originalName,
              mimeType: asset.mimeType || '',
              size: asset.size || 0,
              url: await getPresignedReadUrl(asset.key || ''),
              bucket: asset.bucket,
            }
          : null;

        return {
          ...e,
          [responseKey]: image,
        } as T & Record<string, AssetImageResponse | null>;
      }),
    );
  }

  async attachPrimaryToOne<T extends { id: string }>(
    ctx: AssetContext,
    entity: T,
  ): Promise<T & Record<string, AssetImageResponse | null>> {
    const asset = await this.prisma.assets.findFirst({
      where: {
        subjectType: ctx.subjectType,
        subjectId: entity.id,
        field: ctx.field,
        deletedAt: null,
      },
      orderBy: { isPrimary: 'desc' },
      select: {
        id: true,
        key: true,
        originalName: true,
        mimeType: true,
        size: true,
        bucket: true,
      },
    });

    const responseKey = ctx.as ?? ctx.field;

    return {
      ...entity,
      [responseKey]: asset
        ? {
            id: asset.id,
            key: asset.key || '',
            name: asset.originalName,
            mimeType: asset.mimeType || '',
            size: asset.size || 0,
            url: await getPresignedReadUrl(asset.key || ''),
          }
        : null,
    } as T & Record<string, AssetImageResponse | null>;
  }

  async attachManyToMany<T extends { id: string }>(
    ctx: AssetContext,
    entities: T[],
  ): Promise<(T & Record<string, AssetImageResponse[]>)[]> {
    if (!entities.length) return [];

    const ids = entities.map((e) => e.id);

    const assets = await this.prisma.assets.findMany({
      where: {
        subjectType: ctx.subjectType,
        subjectId: { in: ids },
        field: ctx.field,
        deletedAt: null,
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        subjectId: true,
        key: true,
        originalName: true,
        mimeType: true,
        size: true,
        bucket: true,
      },
    });

    const grouped = new Map<string, AssetImageResponse[]>();

    for (const e of entities) {
      grouped.set(e.id, []);
    }

    for (const a of assets) {
      grouped.get(a.subjectId || '')?.push({
        id: a.id,
        key: a.key || '',
        name: a.originalName,
        mimeType: a.mimeType || '',
        size: a.size || 0,
        url: await getPresignedReadUrl(a.key || ''),
        bucket: a.bucket,
      });
    }

    const responseKey = ctx.as ?? ctx.field;

    return entities.map((e) => ({
      ...e,
      [responseKey]: grouped.get(e.id) ?? [],
    })) as (T & Record<string, AssetImageResponse[]>)[];
  }

  // =====================================================
  // PRIVATE HELPERS
  // =====================================================

  private async getExistingIds(
    tx: Prisma.TransactionClient,
    ctx: { subjectType: string; subjectId: string; field: string },
  ): Promise<string[]> {
    const rows = await tx.assets.findMany({
      where: {
        subjectType: ctx.subjectType,
        subjectId: ctx.subjectId,
        field: ctx.field,
        deletedAt: null,
      },
      select: { id: true },
    });

    return rows.map((r) => r.id);
  }

  private getKeepIds(assets: SyncAssetDto['assets']): string[] {
    return assets.filter((a) => typeof a.id === 'string').map((a) => a.id!);
  }

  private async softDeleteMissing(
    tx: Prisma.TransactionClient,
    ctx: { subjectType: string; subjectId: string; field: string },
    existingIds: string[],
    keepIds: string[],
  ) {
    const toDelete = existingIds.filter((id) => !keepIds.includes(id));
    if (!toDelete.length) return;

    await tx.assets.updateMany({
      where: {
        id: { in: toDelete },
        subjectType: ctx.subjectType,
        subjectId: ctx.subjectId,
        field: ctx.field,
      },
      data: {
        deletedAt: new Date(),
        isPrimary: false,
      },
    });
  }

  private async createNewAssets(
    tx: Prisma.TransactionClient,
    ctx: { subjectType: string; subjectId: string; field: string },
    assets: SyncAssetDto['assets'],
  ) {
    const toCreate = assets.filter(
      (
        a,
      ): a is {
        key: string;
        name?: string;
        mimeType?: string;
        size?: number;
      } => !a.id && typeof a.key === 'string' && a.key.length > 0,
    );

    if (!toCreate.length) return;

    await tx.assets.createMany({
      data: toCreate.map((a) => ({
        bucket: String(process.env.S3_BUCKET),
        key: a.key,
        originalName: a.name || null,
        mimeType: a.mimeType ?? 'image/jpeg',
        size: a.size ?? 0,
        subjectType: ctx.subjectType,
        subjectId: ctx.subjectId,
        field: ctx.field,
        isPrimary: false,
      })),
    });
  }

  private async applyPrimary(
    tx: Prisma.TransactionClient,
    ctx: { subjectType: string; subjectId: string; field: string },
    assets: SyncAssetDto['assets'],
  ) {
    const primary = assets.find((a) => a.isPrimary);
    if (!primary) return;

    await tx.assets.updateMany({
      where: {
        subjectType: ctx.subjectType,
        subjectId: ctx.subjectId,
        field: ctx.field,
      },
      data: { isPrimary: false },
    });

    if (primary.id) {
      await tx.assets.updateMany({
        where: {
          id: primary.id,
          subjectType: ctx.subjectType,
          subjectId: ctx.subjectId,
          field: ctx.field,
          deletedAt: null,
        },
        data: { isPrimary: true },
      });
      return;
    }

    if (primary.key) {
      await tx.assets.updateMany({
        where: {
          subjectType: ctx.subjectType,
          subjectId: ctx.subjectId,
          field: ctx.field,
          key: primary.key,
          deletedAt: null,
        },
        data: { isPrimary: true },
      });
    }
  }

  async deleteBySubject(ctx: { subjectType: string; subjectId: string }) {
    return this.prisma.assets.deleteMany({
      where: {
        subjectType: ctx.subjectType,
        subjectId: ctx.subjectId,
      },
    });
  }
}
