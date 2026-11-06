import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ActiveCompany } from 'src/common/decorators/active-company.decorator';
import { RequiresCompany } from 'src/common/decorators/requires-company.decorator';
import { RequiresCompanyGuard } from 'src/common/guards/requires-company.guard';
import { DatabaseService } from 'src/database/database.service';
import { randomUUID } from 'crypto';

interface JsonRpcRequest {
  jsonrpc: string;
  id?: string | number;
  method: string;
  params?: Record<string, any>;
}

@ApiTags('Office - External MCP Server for IDEs')
@ApiBearerAuth()
@UseGuards(RequiresCompanyGuard)
@RequiresCompany()
@Controller('office/mcp/server')
export class ExternalMcpServerController {
  private readonly logger = new Logger(ExternalMcpServerController.name);

  constructor(private readonly prisma: DatabaseService) {}

  /**
   * SSE Stream Endpoint untuk MCP Client (Antigravity, Cursor, Codex).
   * Spesifikasi MCP SSE Transport:
   * Klien membuka koneksi SSE, server mengirimkan event "endpoint" yang berisi URI untuk POST pesan.
   */
  @Get('sse')
  @ApiOperation({ summary: 'Koneksi SSE MCP untuk External IDE (Antigravity / Cursor / Codex)' })
  connectSse(
    @ActiveCompany() companyId: string,
    @Res() res: Response,
  ) {
    const sessionId = randomUUID();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Kirim endpoint event sesuai MCP Specification
    const messageEndpoint = `/api/v1/office/mcp/server/messages?sessionId=${sessionId}`;
    res.write(`event: endpoint\ndata: ${messageEndpoint}\n\n`);

    this.logger.log(`IDE MCP Client tersambung: sessionId=${sessionId}, companyId=${companyId}`);

    const heartbeat = setInterval(() => {
      res.write(': ping\n\n');
    }, 15000);

    res.on('close', () => {
      clearInterval(heartbeat);
      this.logger.log(`IDE MCP Client terputus: sessionId=${sessionId}`);
    });
  }

  /**
   * Endpoint penanganan pesan JSON-RPC 2.0 dari IDE.
   */
  @Post('messages')
  @ApiOperation({ summary: 'Eksekusi JSON-RPC 2.0 MCP dari External IDE' })
  async handleMessage(
    @ActiveCompany() companyId: string,
    @Query('sessionId') _sessionId: string,
    @Body() body: JsonRpcRequest,
  ) {
    const { id, method, params } = body;

    // 1. Handshake Inisialisasi
    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'ai-virtual-office-hub',
            version: '2.0.0',
          },
        },
      };
    }

    if (method === 'notifications/initialized') {
      return { jsonrpc: '2.0', result: {} };
    }

    // 2. Daftar Tools yang disediakan kantor untuk IDE
    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: [
            {
              name: 'list_office_agents',
              description: 'Mendapatkan daftar seluruh agen AI di virtual office beserta peran, model, status, dan meja kerjanya.',
              inputSchema: {
                type: 'object',
                properties: {},
              },
            },
            {
              name: 'delegate_task_to_agent',
              description: 'Menugaskan tugas dari IDE (coding, bug fix, deployment, document) ke salah satu agen AI virtual kantor.',
              inputSchema: {
                type: 'object',
                properties: {
                  employeeId: {
                    type: 'string',
                    description: 'ID agen penerima tugas (dapat diperoleh dari list_office_agents)',
                  },
                  title: {
                    type: 'string',
                    description: 'Judul tugas yang jelas dan actionable',
                  },
                  description: {
                    type: 'string',
                    description: 'Penjelasan rinci tentang instruksi tugas',
                  },
                },
                required: ['employeeId', 'title'],
              },
            },
            {
              name: 'get_office_status',
              description: 'Melihat ringkasan operasional kantor virtual: status shift, jumlah karyawan aktif, dan tugas yang sedang berjalan.',
              inputSchema: {
                type: 'object',
                properties: {},
              },
            },
          ],
        },
      };
    }

    // 3. Eksekusi Tool (tools/call)
    if (method === 'tools/call') {
      const toolName = params?.name;
      const args = params?.arguments || {};

      if (toolName === 'list_office_agents') {
        const employees = await this.prisma.employee.findMany({
          where: { companyId, deletedAt: null },
          select: {
            id: true,
            name: true,
            role: true,
            department: true,
            status: true,
            currentTask: true,
            model: true,
            skills: true,
            deskIndex: true,
          },
          orderBy: { deskIndex: 'asc' },
        });

        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(employees, null, 2),
              },
            ],
          },
        };
      }

      if (toolName === 'delegate_task_to_agent') {
        const { employeeId, title } = args;
        const employee = await this.prisma.employee.findFirst({
          where: { id: employeeId, companyId, deletedAt: null },
        });
        if (!employee) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: `Agen dengan ID ${employeeId} tidak ditemukan.` },
          };
        }

        const task = await this.prisma.task.create({
          data: {
            companyId,
            employeeId,
            title,
            status: 'QUEUED',
          },
        });

        // Update employee currentTask
        await this.prisma.employee.update({
          where: { id: employeeId },
          data: {
            currentTask: title,
            status: 'WORKING',
          },
        });

        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `Tugas "${title}" berhasil didelegasikan ke ${employee.name} (${employee.role}). Task ID: ${task.id}`,
              },
            ],
          },
        };
      }

      if (toolName === 'get_office_status') {
        const [company, totalAgents, activeTasks] = await Promise.all([
          this.prisma.company.findUnique({
            where: { id: companyId },
            include: { officeProfile: true },
          }),
          this.prisma.employee.count({ where: { companyId, deletedAt: null } }),
          this.prisma.task.count({ where: { companyId, status: { in: ['EXECUTING', 'QUEUED'] } } }),
        ]);

        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    officeName: company?.name,
                    timezone: company?.officeProfile?.timezone || 'Asia/Jakarta',
                    totalAgents,
                    activeTasksRunning: activeTasks,
                  },
                  null,
                  2,
                ),
              },
            ],
          },
        };
      }

      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Tool ${toolName} tidak dikenal.` },
      };
    }

    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Metode ${method} tidak didukung.` },
    };
  }
}

