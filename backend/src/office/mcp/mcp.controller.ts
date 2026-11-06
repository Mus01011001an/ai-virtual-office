import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActiveCompany } from 'src/common/decorators/active-company.decorator';
import { RequiresCompany } from 'src/common/decorators/requires-company.decorator';
import { McpService } from './mcp.service';

@ApiTags('Office - Model Context Protocol (MCP)')
@ApiBearerAuth()
@RequiresCompany()
@Controller('office/mcp')
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar server MCP yang terhubung ke office aktif' })
  findAll(@ActiveCompany() companyId: string) {
    return this.mcpService.findAll(companyId);
  }

  @Post()
  @ApiOperation({ summary: 'Hubungkan server MCP baru' })
  create(
    @ActiveCompany() companyId: string,
    @Body() body: {
      name: string;
      description?: string;
      transport?: string;
      url: string;
      headers?: Record<string, string>;
    },
  ) {
    return this.mcpService.create(companyId, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ubah konfigurasi atau toggle aktif/nonaktif server MCP' })
  update(
    @ActiveCompany() companyId: string,
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      description?: string;
      url?: string;
      isEnabled?: boolean;
      headers?: Record<string, string>;
    },
  ) {
    return this.mcpService.update(companyId, id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Hapus server MCP dari office' })
  remove(@ActiveCompany() companyId: string, @Param('id') id: string) {
    return this.mcpService.remove(companyId, id);
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Sinkronisasi ulang tools/list dari server MCP' })
  sync(@ActiveCompany() companyId: string, @Param('id') id: string) {
    return this.mcpService.syncTools(companyId, id);
  }
}
