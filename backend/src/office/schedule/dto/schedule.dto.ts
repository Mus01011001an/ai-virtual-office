import { IsArray, IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateScheduleDto {
  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  workStart?: string;

  @IsOptional()
  @IsString()
  workEnd?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  workdays?: number[];

  @IsOptional()
  breaks?: Array<{ name: string; start: string; end: string }>;

  @IsOptional()
  @IsString()
  standupTime?: string;

  @IsOptional()
  @IsBoolean()
  autoStandupEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  proactiveEnabled?: boolean;
}

export class FastForwardScheduleDto {
  @IsString()
  clock!: string; // Format "HH:mm", e.g. "12:05" or "18:00"
}
