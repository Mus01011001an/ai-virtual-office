import { IsNotEmpty, IsString } from 'class-validator';

export class GenerateViewUrlDto {
  @IsString()
  @IsNotEmpty()
  filename: string;
}

export class GenerateViewUrlResponseDto {
  filename: string;
  url: string;
  expiresIn: number;
  method: 'GET';
}
