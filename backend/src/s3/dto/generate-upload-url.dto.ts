import { IsNotEmpty, IsString, IsMimeType } from 'class-validator';

export class GenerateUploadUrlDto {
  @IsString()
  @IsNotEmpty()
  originalname: string;

  @IsString()
  @IsMimeType()
  mimeType: string;
}

export class GenerateUploadUrlResponseDto {
  filename: string;
  uploadUrl: string;
  expiresIn: number;
  method: 'PUT';
}
