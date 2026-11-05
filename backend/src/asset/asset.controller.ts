// src/asset/asset.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from 'src/lib/auth/permission.decorator';
import { P_USER_READ } from 'src/common/constants/permissions';
import { AssetService } from './asset.service';
import { SyncAssetDto } from './dto/sync-asset.dto';

@ApiTags('Core - Assets')
@Controller('assets')
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  /**
   * =====================================================
   * SYNC ASSET (FINAL STATE)
   * =====================================================
   * Dipakai oleh:
   * - update profile avatar
   * - update product gallery
   *
   * POST /assets/sync
   */
  @Post('sync')
  @Permission(P_USER_READ)
  async sync(@Body() dto: SyncAssetDto) {
    await this.assetService.sync(dto);
    return { success: true };
  }
}
