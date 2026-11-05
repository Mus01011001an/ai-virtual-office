export class SyncAssetItemDto {
  id?: string; // asset lama
  key?: string; // asset baru (hasil upload)
  name?: string; // nama file aslinya
  mimeType?: string;
  size?: number;
  isPrimary?: boolean;
}

export class SyncAssetDto {
  subjectType: string;
  subjectId: string;
  field: string;
  assets: SyncAssetItemDto[];
}
