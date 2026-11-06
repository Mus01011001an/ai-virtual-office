import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);

  constructor(private readonly prisma: DatabaseService) {}

  async findAll(companyId: string) {
    return this.prisma.mcpServer.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const server = await this.prisma.mcpServer.findFirst({
      where: { id, companyId },
    });
    if (!server) throw new NotFoundException('MCP Server tidak ditemukan');
    return server;
  }

  async create(companyId: string, dto: {
    name: string;
    description?: string;
    transport?: string;
    url: string;
    headers?: Record<string, string>;
  }) {
    const cleanName = dto.name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const exists = await this.prisma.mcpServer.findFirst({
      where: { companyId, name: cleanName },
    });
    if (exists) {
      throw new BadRequestException(`Server dengan nama "${cleanName}" sudah terdaftar.`);
    }

    const server = await this.prisma.mcpServer.create({
      data: {
        companyId,
        name: cleanName,
        description: dto.description?.trim(),
        transport: dto.transport || 'sse',
        url: dto.url.trim(),
        headers: (dto.headers || {}) as any,
        isEnabled: true,
      },
    });

    // Coba sync tools langsung saat baru dibuat
    try {
      await this.syncTools(companyId, server.id);
    } catch (err: any) {
      this.logger.warn(`Gagal sync tools awal untuk MCP ${cleanName}: ${err.message}`);
    }

    return this.findOne(companyId, server.id);
  }

  async update(companyId: string, id: string, dto: {
    name?: string;
    description?: string;
    url?: string;
    isEnabled?: boolean;
    headers?: Record<string, string>;
  }) {
    await this.findOne(companyId, id);
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (dto.description !== undefined) data.description = dto.description.trim();
    if (dto.url !== undefined) data.url = dto.url.trim();
    if (dto.isEnabled !== undefined) data.isEnabled = dto.isEnabled;
    if (dto.headers !== undefined) data.headers = dto.headers;

    const updated = await this.prisma.mcpServer.update({
      where: { id },
      data,
    });

    if (dto.url !== undefined) {
      try {
        await this.syncTools(companyId, id);
      } catch (err: any) {
        this.logger.warn(`Gagal re-sync tools untuk MCP ${id}: ${err.message}`);
      }
    }

    return updated;
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    await this.prisma.mcpServer.delete({ where: { id } });
    return { success: true, message: 'Server MCP berhasil dihapus' };
  }

  /**
   * Menghubungi server MCP melalui JSON-RPC 2.0 tools/list untuk mengunduh definisi tools.
   */
  async syncTools(companyId: string, serverId: string) {
    const server = await this.findOne(companyId, serverId);
    this.logger.log(`Sinkronisasi tools dari MCP server "${server.name}" (${server.url})...`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...((server.headers as Record<string, string>) || {}),
    };

    const requestPayload = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/list',
      params: {},
    };

    try {
      const response = await fetch(server.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestPayload),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      let data: any;

      // Handle raw JSON atau SSE formatted text
      try {
        data = JSON.parse(text);
      } catch {
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              data = JSON.parse(line.slice(5).trim());
              break;
            } catch {}
          }
        }
      }

      if (!data) throw new Error('Respons tidak dapat diurai sebagai JSON atau SSE');

      const tools: McpToolDefinition[] = (data.result?.tools || data.tools || []).map((t: any) => ({
        name: t.name,
        description: t.description || `Tool dari MCP ${server.name}`,
        inputSchema: t.inputSchema || { type: 'object', properties: {} },
      }));

      await this.prisma.mcpServer.update({
        where: { id: serverId },
        data: {
          toolsCache: tools as any,
          lastSyncAt: new Date(),
        },
      });

      this.logger.log(`Berhasil sinkronisasi ${tools.length} tools dari MCP "${server.name}"`);
      return { success: true, toolsCount: tools.length, tools };
    } catch (err: any) {
      this.logger.error(`Sync tools gagal untuk MCP ${server.name}: ${err.message}`);
      throw new BadRequestException(`Gagal menghubungi server MCP: ${err.message}`);
    }
  }

  /**
   * Eksekusi tool MCP tertentu secara remote menggunakan JSON-RPC tools/call.
   */
  async callTool(companyId: string, serverName: string, toolName: string, args: Record<string, unknown>): Promise<string> {
    const server = await this.prisma.mcpServer.findFirst({
      where: { companyId, name: serverName, isEnabled: true },
    });
    if (!server) {
      throw new Error(`MCP Server "${serverName}" tidak ditemukan atau sedang dinonaktifkan di office ini.`);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((server.headers as Record<string, string>) || {}),
    };

    const payload = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    };

    const response = await fetch(server.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`MCP Server HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      const match = text.match(/data:\s*({.*})/);
      if (match) data = JSON.parse(match[1]);
      else return text;
    }

    if (data.error) {
      throw new Error(`MCP Error [${data.error.code}]: ${data.error.message}`);
    }

    const result = data.result;
    if (result?.content && Array.isArray(result.content)) {
      return result.content
        .map((c: any) => (typeof c === 'string' ? c : c.text || JSON.stringify(c)))
        .join('\n');
    }

    return typeof result === 'string' ? result : JSON.stringify(result ?? data);
  }

  /**
   * Mengambil semua tools MCP yang aktif untuk suatu company.
   */
  async getActiveToolsForCompany(companyId: string): Promise<Array<{
    serverName: string;
    toolName: string;
    fullName: string;
    description: string;
    parameters: Record<string, unknown>;
  }>> {
    const servers = await this.prisma.mcpServer.findMany({
      where: { companyId, isEnabled: true },
    });

    const activeTools: Array<{
      serverName: string;
      toolName: string;
      fullName: string;
      description: string;
      parameters: Record<string, unknown>;
    }> = [];

    for (const server of servers) {
      const tools = (server.toolsCache as unknown as McpToolDefinition[]) || [];
      for (const t of tools) {
        activeTools.push({
          serverName: server.name,
          toolName: t.name,
          fullName: `mcp__${server.name}__${t.name}`,
          description: `[MCP: ${server.name}] ${t.description || t.name}`,
          parameters: (t.inputSchema as Record<string, unknown>) || { type: 'object', properties: {} },
        });
      }
    }

    return activeTools;
  }
}
