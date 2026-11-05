import { IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PROVIDER_TYPE_KEYS, ProviderType } from '../provider-types';

export class CreateAiProviderDto {
  @IsString()
  @MinLength(1, { message: 'Nama wajib diisi' })
  @MaxLength(60)
  name: string;

  @IsIn(PROVIDER_TYPE_KEYS)
  type: ProviderType;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  models?: string[];

  @IsOptional()
  @IsString()
  defaultModel?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Semua opsional; apiKey kosong / tidak dikirim = tetap memakai key lama. */
export class UpdateAiProviderDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60) name?: string;
  @IsOptional() @IsIn(PROVIDER_TYPE_KEYS) type?: ProviderType;
  @IsOptional() @IsString() baseUrl?: string;
  @IsOptional() @IsString() apiKey?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) models?: string[];
  @IsOptional() @IsString() defaultModel?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

/** Test sebelum disimpan (seperti tombol Test di n8n). Bila id diisi & apiKey kosong → pakai key tersimpan. */
export class TestAiProviderDto {
  @IsIn(PROVIDER_TYPE_KEYS) type: ProviderType;
  @IsOptional() @IsString() baseUrl?: string;
  @IsOptional() @IsString() apiKey?: string;
  @IsOptional() @IsString() id?: string;
}
