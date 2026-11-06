import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActiveCompany } from 'src/common/decorators/active-company.decorator';
import { RequiresCompany } from 'src/common/decorators/requires-company.decorator';
import { WorkstationService } from './workstation.service';
import { CreateArtifactDto, QueryArtifactsDto } from './dto/workstation.dto';
import { AgentBundleService } from '../ai-engine/agent-bundle.service';
import { AgentMemoryService } from '../ai-engine/agent-memory.service';

@ApiTags('Office - Workstation')
@ApiBearerAuth()
@RequiresCompany()
@Controller('office/workstation')
export class WorkstationController {
  constructor(
    private readonly service: WorkstationService,
    private readonly bundleService: AgentBundleService,
    private readonly memoryService: AgentMemoryService,
  ) {}

  @Get('traces/:employeeId')
  @ApiOperation({ summary: 'Mendapatkan seluruh riwayat trace percakapan & kognitif employee' })
  getConversationTraces(
    @ActiveCompany() companyId: string,
    @Param('employeeId') employeeId: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getConversationTraces(
      companyId,
      employeeId,
      limit ? parseInt(limit, 10) : 100,
    );
  }

  @Get('artifacts')
  @ApiOperation({ summary: 'Mendapatkan daftar berkas & artefak kerja agen' })
  getArtifacts(
    @ActiveCompany() companyId: string,
    @Query() query: QueryArtifactsDto,
  ) {
    return this.service.getArtifacts(companyId, query);
  }

  @Get('artifacts/:id')
  @ApiOperation({ summary: 'Mendapatkan isi konten berkas artefak untuk preview di HUD' })
  getArtifactContent(
    @ActiveCompany() companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.getArtifactContent(companyId, id);
  }

  @Post('artifacts')
  @ApiOperation({ summary: 'Menyimpan berkas / artefak baru ke storage S3' })
  createArtifact(
    @ActiveCompany() companyId: string,
    @Body() dto: CreateArtifactDto,
  ) {
    return this.service.createArtifact(companyId, dto);
  }

  @Get('performance')
  @ApiOperation({ summary: 'Mendapatkan metrik performa, ledger token, dan estimasi biaya' })
  getPerformance(
    @ActiveCompany() companyId: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.service.getPerformance(companyId, employeeId);
  }

  // Antigravity-Style Virtual File Tree & Skills Studio
  @Get('files/:employeeId')
  @ApiOperation({ summary: 'Daftar berkas virtual Antigravity agent (PERSONA, RULES, skills, KNOWLEDGE, config)' })
  getFiles(
    @ActiveCompany() companyId: string,
    @Param('employeeId') employeeId: string,
  ) {
    return this.bundleService.getFiles(companyId, employeeId);
  }

  @Post('files/:employeeId')
  @ApiOperation({ summary: 'Simpan / perbarui berkas virtual agent dan kompilasi ulang prompt' })
  upsertFile(
    @ActiveCompany() companyId: string,
    @Param('employeeId') employeeId: string,
    @Body() body: { path: string; content: string; name?: string },
  ) {
    return this.bundleService.upsertFile(companyId, employeeId, body.path, body.content, body.name);
  }

  @Delete('files/:employeeId')
  @ApiOperation({ summary: 'Hapus berkas virtual agent' })
  deleteFile(
    @ActiveCompany() companyId: string,
    @Param('employeeId') employeeId: string,
    @Query('path') path: string,
  ) {
    return this.bundleService.deleteFile(companyId, employeeId, path);
  }

  // Context Window Tracking & Memory Compaction
  @Get('context/:employeeId')
  @ApiOperation({ summary: 'Status realtime context window dan riwayat memori episodik agent' })
  getContextStatus(
    @ActiveCompany() companyId: string,
    @Param('employeeId') employeeId: string,
  ) {
    return this.memoryService.getContextStatus(companyId, employeeId);
  }

  @Post('context/:employeeId/compact')
  @ApiOperation({ summary: 'Rangkum milestone sesi aktif ke memori permanen dan segarkan context window' })
  compactContext(
    @ActiveCompany() companyId: string,
    @Param('employeeId') employeeId: string,
    @Body('reason') reason?: string,
  ) {
    return this.memoryService.compactSession(companyId, employeeId, reason);
  }
}
