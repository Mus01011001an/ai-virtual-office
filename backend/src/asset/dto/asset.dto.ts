import { IsOptional, IsString, IsNumber } from 'class-validator';

export class AssetDto {
  @IsString()
  key: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsNumber()
  size?: number;
}
