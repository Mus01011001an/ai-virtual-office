import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { SkipThrottle } from '@nestjs/throttler';
import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { DatabaseService } from 'src/database/database.service';
import { s3 } from 'src/common/infrastructure/s3';
import { SuperAdminGuard } from 'src/common/guards/superadmin.guard';
import { UseGuards } from '@nestjs/common';

@ApiTags('Core - Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: DatabaseService) {}

  /** Publik & tanpa DB — dipakai Docker HEALTHCHECK (pola Musyan). */
  @Get()
  @AllowAnonymous()
  @SkipThrottle()
  live() {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }

  /** Cek DB + S3 (admin platform). */
  @Get('deep')
  @UseGuards(SuperAdminGuard)
  async deep() {
    const started = Date.now();
    const db = await this.prisma.$queryRaw`SELECT 1`.then(() => 'ok').catch((e) => `error: ${e.message}`);
    const storage = await s3.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET! })).then(() => 'ok').catch((e) => `error: ${e.name}`);
    return { db, s3: storage, pool: this.prisma.poolStats?.(), ms: Date.now() - started };
  }
}
