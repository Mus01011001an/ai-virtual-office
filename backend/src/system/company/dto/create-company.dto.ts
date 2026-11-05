import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @MinLength(1, { message: 'Nama office wajib diisi' })
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsIn(['EMPTY', 'DEMO_TEAM'])
  template?: 'EMPTY' | 'DEMO_TEAM';

  @IsOptional()
  @IsString()
  timezone?: string;
}
