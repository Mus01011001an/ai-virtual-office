import { IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PROVIDER_TYPE_KEYS, ProviderType } from '../ai-providers/provider-types';

export class CreateTemplateDto {
  @IsString() @Matches(/^[a-z0-9-]{2,40}$/, { message: 'Key: huruf kecil, angka, tanda minus (2–40)' }) key: string;
  @IsString() @MinLength(1) @MaxLength(40) name: string;
  @IsString() @MinLength(1) @MaxLength(80) role: string;
  @IsOptional() @IsString() @MaxLength(60) department?: string;
  @IsOptional() @IsString() @MaxLength(160) tagline?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) skills?: string[];
  @IsOptional() @IsString() @MaxLength(20000) systemPrompt?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tools?: string[];
  @IsOptional() @IsObject() appearance?: Record<string, unknown>;
  @IsOptional() @IsString() providerId?: string | null;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdateTemplateDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(40) name?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) role?: string;
  @IsOptional() @IsString() @MaxLength(60) department?: string;
  @IsOptional() @IsString() @MaxLength(160) tagline?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) skills?: string[];
  @IsOptional() @IsString() @MaxLength(20000) systemPrompt?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tools?: string[];
  @IsOptional() @IsObject() appearance?: Record<string, unknown>;
  /** string kosong = lepas provider */
  @IsOptional() @IsString() providerId?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class GlobalProviderDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60) name?: string;
  @IsOptional() @IsIn(PROVIDER_TYPE_KEYS) type?: ProviderType;
  @IsOptional() @IsString() baseUrl?: string;
  @IsOptional() @IsString() apiKey?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) models?: string[];
  @IsOptional() @IsString() defaultModel?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class HiggsfieldSettingDto {
  @IsOptional() @IsString() @MaxLength(200) keyId?: string;
  @IsOptional() @IsString() @MaxLength(400) keySecret?: string;
  @IsOptional() @IsString() @MaxLength(120) imageModel?: string;
  @IsOptional() @IsString() @MaxLength(120) videoModel?: string;
  @IsOptional() @IsString() @MaxLength(120) imageToVideoModel?: string;
}

export class BrainNoteDto {
  @IsIn(['brief', 'decision', 'note']) kind: 'brief' | 'decision' | 'note';
  @IsString() @MinLength(1) @MaxLength(160) title: string;
  @IsString() @MinLength(1) @MaxLength(12000) content: string;
  @IsOptional() @IsBoolean() pinned?: boolean;
}

export class BrainPinDto {
  @IsBoolean() pinned: boolean;
}
