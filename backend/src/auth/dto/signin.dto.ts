import { IsOptional, IsString, MinLength } from 'class-validator';

export class SignInDto {
  @IsOptional()
  @IsString({ message: 'Username tidak valid' })
  username?: string;

  @IsOptional()
  @IsString({ message: 'Email tidak valid' })
  email?: string;

  @IsString()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  password: string;

  @IsOptional()
  rememberMe?: boolean;
}

