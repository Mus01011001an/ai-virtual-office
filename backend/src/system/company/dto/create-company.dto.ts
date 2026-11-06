import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DesignatedOwnerDto {
  @IsString()
  @MinLength(1, { message: 'Nama owner wajib diisi' })
  name: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsString()
  @MinLength(6, { message: 'Password owner minimal 6 karakter' })
  password: string;
}

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

  @IsOptional()
  @ValidateNested()
  @Type(() => DesignatedOwnerDto)
  owner?: DesignatedOwnerDto;
}
