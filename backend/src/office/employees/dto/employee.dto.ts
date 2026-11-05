import { IsArray, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateEmployeeDto {
  @IsString() @MinLength(1, { message: 'Nama wajib diisi' }) @MaxLength(40) name: string;
  @IsString() @MinLength(1, { message: 'Role wajib diisi' }) @MaxLength(80) role: string;
  @IsOptional() @IsString() @MaxLength(60) department?: string;
  /** AI provider yang sudah diset di office (wajib bila ingin memilih model) */
  @IsOptional() @IsString() providerId?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) skills?: string[];
  @IsOptional() @IsString() @MaxLength(20000) systemPrompt?: string;
  @IsOptional() @IsObject() appearance?: Record<string, unknown>;
  @IsOptional() @IsInt() @Min(0) @Max(35) deskIndex?: number;
}

export class UpdateEmployeeDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(40) name?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) role?: string;
  @IsOptional() @IsString() @MaxLength(60) department?: string;
  @IsOptional() @IsString() providerId?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) skills?: string[];
  @IsOptional() @IsString() @MaxLength(20000) systemPrompt?: string;
  @IsOptional() @IsObject() appearance?: Record<string, unknown>;
}

export class InstructionDto {
  @IsString() @MinLength(1) @MaxLength(4000) text: string;
}
