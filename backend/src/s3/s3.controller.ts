import { Permission } from 'src/lib/auth/permission.decorator';
import { P_FILE_UPLOAD } from 'src/common/constants/permissions';
import {
  Controller,
  Post,
  Get,
  Body,
  UploadedFile,
  UseInterceptors,
  Delete,
  Param,
  Res,
  ParseFilePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from '@thallesp/nestjs-better-auth';
import { Response } from 'express';
import { S3Service } from './s3.service';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('Core - S3')
@Controller('s3')
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}

  // =========================
  // POST UPLOAD (VIA BACKEND)
  // =========================
  @Post('upload')
  @Permission(P_FILE_UPLOAD)
  @ApiOperation({ summary: 'Upload file ke S3 dan dapatkan permanent URL' })
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.s3Service.uploadFile(file);
  }

  // =========================
  // PERMANENT STREAMING PROXY
  // =========================
  @Public()
  @SkipThrottle()
  @Get('file/:filename')
  @ApiOperation({ summary: 'Stream public asset image/file permanently from S3' })
  @ApiParam({ name: 'filename', description: 'Nama berkas S3' })
  async streamFile(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    return this.s3Service.streamFile(filename, res);
  }

  // =========================
  // GENERATE PRESIGNED PUT URL
  // =========================
  @Post('generate-upload-url')
  @Permission(P_FILE_UPLOAD)
  async generateUploadUrl(
    @Body()
    body: {
      originalname: string;
      mimeType: string;
    },
  ) {
    return this.s3Service.generateUploadUrl(body.originalname, body.mimeType);
  }

  // =========================
  // GENERATE PRESIGNED GET URL
  // =========================
  @Post('generate-view-url')
  async generateViewUrl(@Body() body: { filename: string }) {
    return this.s3Service.generateViewUrl(body.filename);
  }

  // =========================
  // DELETE FILE
  // =========================
  @Delete(':filename')
  @Permission(P_FILE_UPLOAD)
  async delete(@Param('filename') filename: string) {
    await this.s3Service.delete(filename);
    return { success: true };
  }
}

