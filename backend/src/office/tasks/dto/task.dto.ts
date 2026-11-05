import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTaskDto {
  @IsString() @MinLength(1, { message: 'Judul task wajib diisi' }) @MaxLength(200) title: string;
  @IsOptional() @IsString() @MaxLength(20000) description?: string;
  @IsOptional() @IsIn(['panel', 'discussion', 'api']) source?: 'panel' | 'discussion' | 'api';
}
