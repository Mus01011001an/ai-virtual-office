import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class QueryArtifactsDto {
  @ApiPropertyOptional({ description: 'Filter by employee ID' })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({ description: 'Filter by task ID' })
  @IsOptional()
  @IsString()
  taskId?: string;

  @ApiPropertyOptional({ description: 'Search filename' })
  @IsOptional()
  @IsString()
  q?: string;
}

export class CreateArtifactDto {
  @ApiPropertyOptional({ description: 'ID Employee penghasil berkas' })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({ description: 'ID Task terkait' })
  @IsOptional()
  @IsString()
  taskId?: string;

  @ApiProperty({ description: 'Nama berkas (misal: analisis.md)' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ description: 'Konten teks berkas' })
  @IsNotEmpty()
  @IsString()
  content!: string;

  @ApiPropertyOptional({ description: 'MIME Type (default: text/plain atau markdown)' })
  @IsOptional()
  @IsString()
  mimeType?: string;
}
