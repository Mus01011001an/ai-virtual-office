import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class StartDiscussionDto {
  @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) participantIds!: string[];
}
export class ParticipantsDto {
  @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) participantIds!: string[];
}
export class MessageDto {
  @IsString() @MinLength(1) @MaxLength(4000) text!: string;
}

export class InitiateDebateDto {
  @ApiProperty({ description: 'Topik permasalahan atau arsitektur yang akan didebatkan' })
  @IsNotEmpty()
  @IsString()
  topic!: string;

  @ApiPropertyOptional({ description: 'Maksimum putaran debat (default: 3)', default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  maxRounds?: number;

  @ApiPropertyOptional({ description: 'Peserta khusus debat (opsional)', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participantIds?: string[];
}

export class WhiteboardPointDto {
  @IsString()
  speaker!: string;

  @IsString()
  stance!: string;

  @IsString()
  text!: string;
}

export class WhiteboardActionItemDto {
  @IsString()
  assigneeName!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateWhiteboardDto {
  @ApiPropertyOptional({ description: 'Topik rapat' })
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiPropertyOptional({ description: 'Skor konsensus (0-100)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  consensusScore?: number;

  @ApiPropertyOptional({ description: 'Daftar poin perdebatan' })
  @IsOptional()
  @IsArray()
  points?: WhiteboardPointDto[];

  @ApiPropertyOptional({ description: 'Daftar action items' })
  @IsOptional()
  @IsArray()
  actionItems?: WhiteboardActionItemDto[];

  @ApiPropertyOptional({ description: 'Ringkasan rapat' })
  @IsOptional()
  @IsString()
  summary?: string;
}

export class ConcludeMeetingDto {
  @ApiPropertyOptional({ description: 'Apakah otomatis membuat Task tiket', default: true })
  @IsOptional()
  @IsBoolean()
  generateTasks?: boolean;

  @ApiPropertyOptional({ description: 'Apakah otomatis menyimpan risalah ke S3', default: true })
  @IsOptional()
  @IsBoolean()
  saveMoMToS3?: boolean;
}
