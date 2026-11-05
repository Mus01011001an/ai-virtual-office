import {
  Inject,
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { ForbiddenException } from '@nestjs/common';

const S3_PREFIX = (process.env.S3_PREFIX || 'virtual-office').replace(/\/+$/, '');
import { Response } from 'express';
import { Readable } from 'stream';
import { getS3PermanentUrl } from 'src/common/infrastructure/s3';

/**
 * Standard API response shape
 */
export interface ApiResponse<T> {
  status: boolean;
  message: string | null;
  data: T;
}

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);

  constructor(
    @Inject('S3_CLIENT')
    private readonly s3: S3Client,
  ) {}

  private readonly bucket = process.env.S3_BUCKET as string;
  private readonly uploadExpires = 60 * 2; // 2 menit
  private readonly viewExpires = 60 * 60 * 24; // 24 jam

  // =========================
  // RESPONSE HELPERS
  // =========================
  protected ok<T>(data: T, message: string | null = null): ApiResponse<T> {
    return {
      status: true,
      message,
      data,
    };
  }

  // =========================
  // POST STYLE (UPLOAD VIA BACKEND)
  // =========================
  async uploadFile(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  }): Promise<
    ApiResponse<{
      filename: string;
      url: string;
      permanentUrl: string;
      size: number;
      mimeType: string;
      expiresIn: number;
      method: 'POST';
    }>
  > {
    const filename = this.generateFilename(file.originalname);

    await this.putObject(filename, file.buffer, file.mimetype);

    // URL permanen dari .env (S3_PUBLIC_URL / S3_ENDPOINT); endpoint internal → proxy backend
    const s3DirectUrl = getS3PermanentUrl(filename);
    const proxyUrl = `/api/v1/s3/file/${filename}`;

    return this.ok(
      {
        filename,
        url: s3DirectUrl, // Default ke Canonical Direct S3 URL
        permanentUrl: s3DirectUrl,
        proxyUrl,
        size: file.size,
        mimeType: file.mimetype,
        expiresIn: 0, // 0 = No expiration
        method: 'POST',
      },
      'Upload success',
    );
  }

  // =========================
  // POST UPLOAD (FROM URL)
  // =========================
  async uploadFromUrl(
    url: string,
    originalname: string,
    mimeType?: string,
  ): Promise<
    ApiResponse<{
      filename: string;
      url: string;
      size: number;
      mimeType: string;
      expiresIn: number;
      method: 'POST';
    }>
  > {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch file from URL: ${response.statusText}`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const size = buffer.length;
      const resolvedMimeType =
        mimeType ||
        response.headers.get('content-type') ||
        'application/octet-stream';

      return this.uploadFile({
        buffer,
        originalname,
        mimetype: resolvedMimeType,
        size,
      });
    } catch (error) {
      console.error('Error uploading from URL:', error);
      throw error;
    }
  }

  // =========================
  // PRESIGNED PUT (DIRECT UPLOAD)
  // =========================
  async generateUploadUrl(
    originalname: string,
    mimeType: string,
  ): Promise<
    ApiResponse<{
      filename: string;
      uploadUrl: string;
      readUrl: string;
      expiresIn: number;
      method: 'PUT';
    }>
  > {
    const filename = this.generateFilename(originalname);

    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: filename,
        ContentType: mimeType,
      }),
      { expiresIn: this.uploadExpires },
    );
    const readUrl = await getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: filename,
      }),
      { expiresIn: this.viewExpires },
    );

    return this.ok(
      {
        filename,
        uploadUrl,
        readUrl,
        expiresIn: this.uploadExpires,
        method: 'PUT',
      },
      'Upload URL generated',
    );
  }

  // =========================
  // PRESIGNED GET (VIEW)
  // =========================
  async generateViewUrl(filename: string): Promise<
    ApiResponse<{
      filename: string;
      url: string;
      expiresIn: number;
      method: 'GET';
    }>
  > {
    this.assertOwnKey(filename);
    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: filename,
      }),
      { expiresIn: this.viewExpires },
    );

    return this.ok(
      {
        filename,
        url,
        expiresIn: this.viewExpires,
        method: 'GET',
      },
      'View URL generated',
    );
  }

  // =========================
  // DELETE
  // =========================
  async delete(filename: string): Promise<ApiResponse<{ filename: string }>> {
    this.assertOwnKey(filename);
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: filename,
      }),
    );

    return this.ok({ filename }, 'File deleted');
  }

  // =========================
  // INTERNAL HELPERS
  // =========================
  private generateFilename(originalname: string): string {
    const safe = (originalname || 'file').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120);
    return `${S3_PREFIX}/uploads/${Date.now()}-${randomUUID()}-${safe}`;
  }

  /** Bucket dipakai bersama aplikasi lain → hanya key milik aplikasi ini yang boleh dibaca/dihapus. */
  private assertOwnKey(filename: string) {
    if (!filename || !filename.startsWith(`${S3_PREFIX}/`) || filename.includes('..')) {
      throw new ForbiddenException('File bukan milik Virtual AI Office');
    }
  }

  private async putObject(
    filename: string,
    buffer: Buffer,
    mime: string,
  ): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: filename,
        Body: buffer,
        ContentType: mime,
      }),
    );
  }

  /**
   * Internal helper (raw presigned GET)
   * Dipakai oleh uploadFile
   */
  async presignedGet(filename: string): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: filename,
      }),
      { expiresIn: this.viewExpires },
    );
  }

  /**
   * 🛡️ PERMANENT STREAMING PROXY: Mengalirkan binary langsung dari S3 ke client
   */
  async streamFile(filename: string, res: Response): Promise<void> {
    this.assertOwnKey(filename);
    if (filename.includes('\\')) throw new BadRequestException('Nama berkas tidak valid.');

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: filename,
      });

      const s3Response = await this.s3.send(command);

      if (!s3Response.Body) {
        throw new NotFoundException(`Berkas ${filename} tidak ditemukan.`);
      }

      const contentType = s3Response.ContentType || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      if (s3Response.ContentLength) {
        res.setHeader('Content-Length', s3Response.ContentLength.toString());
      }
      if (s3Response.ETag) {
        res.setHeader('ETag', s3Response.ETag);
      }

      // 🛡️ HTTP Cache Cerdas: Izinkan browser meng-cache hingga 7 hari (604800 detik)
      res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400, immutable');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      const stream = s3Response.Body as Readable;
      stream.pipe(res);
    } catch (err: any) {
      if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
        throw new NotFoundException(`Berkas ${filename} tidak ditemukan di penyimpanan cloud.`);
      }
      this.logger.error(`Gagal streaming berkas ${filename} dari S3: ${err.message}`);
      throw err;
    }
  }
}

