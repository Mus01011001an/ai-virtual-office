import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DatabaseService } from 'src/database/database.service';
import { OfficeEventsService } from '../realtime/office-events.service';
import { WebhookNotificationService } from '../integrations/webhook-notification.service';
import { ApprovalRiskLevel, ApprovalStatus } from '@prisma/client';

export interface ToolRiskAssessment {
  riskLevel: ApprovalRiskLevel;
  reason: string;
  requiresApproval: boolean;
}

export interface CreateApprovalDto {
  companyId: string;
  taskId?: string;
  employeeId?: string;
  toolName: string;
  riskLevel: ApprovalRiskLevel;
  title: string;
  description?: string;
  inputPayload: Record<string, unknown>;
  expiresInMinutes?: number;
}

@Injectable()
export class ApprovalService implements OnModuleInit {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    private readonly prisma: DatabaseService,
    private readonly events: OfficeEventsService,
    private readonly webhooks: WebhookNotificationService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit() {}

  /**
   * Mengevaluasi tingkat risiko tool sebelum dieksekusi.
   */
  evaluateToolRisk(toolName: string, payload: Record<string, unknown>): ToolRiskAssessment {
    const payloadStr = JSON.stringify(payload || '').toLowerCase();

    // 1. Critical patterns (drop table, delete database, destructive commands)
    if (
      payloadStr.includes('drop table') ||
      payloadStr.includes('delete from') ||
      payloadStr.includes('truncate') ||
      payloadStr.includes('rm -rf') ||
      payloadStr.includes('format c:') ||
      payloadStr.includes('mkfs')
    ) {
      return {
        riskLevel: 'CRITICAL',
        reason: 'Ditemukan instruksi destruktif terhadap database atau filesystem sistem.',
        requiresApproval: true,
      };
    }

    // 2. High risk code execution patterns
    if (toolName === 'code_execution') {
      const code = String(payload.code || '').toLowerCase();
      if (
        code.includes('import os') ||
        code.includes('import subprocess') ||
        code.includes('import sys') ||
        code.includes('import socket') ||
        code.includes('import requests') ||
        code.includes('import urllib') ||
        code.includes('open(') ||
        code.includes('require(') ||
        code.includes('child_process')
      ) {
        return {
          riskLevel: 'HIGH',
          reason: 'Skrip berisi instruksi modul sistem/jaringan/filesystem yang memerlukan otorisasi pimpinan.',
          requiresApproval: true,
        };
      }
      return {
        riskLevel: 'MEDIUM',
        reason: 'Eksekusi kalkulasi dan pemrosesan data aman.',
        requiresApproval: false,
      };
    }

    // 3. Webhook modification / production config tools
    if (toolName === 'github_inspect_repo' || toolName === 'file_generate') {
      return {
        riskLevel: 'LOW',
        reason: 'Operasi pembacaan atau pembuatan artefak standar.',
        requiresApproval: false,
      };
    }

    return {
      riskLevel: 'LOW',
      reason: 'Operasi rutin tanpa dampak destruktif.',
      requiresApproval: false,
    };
  }

  /**
   * Membuat permohonan persetujuan baru dan menyiarkan notifikasi.
   */
  async createRequest(dto: CreateApprovalDto) {
    const expiresAt = dto.expiresInMinutes
      ? new Date(Date.now() + dto.expiresInMinutes * 60 * 1000)
      : new Date(Date.now() + 24 * 60 * 60 * 1000); // Default 24 jam

    const approval = await this.prisma.approvalRequest.create({
      data: {
        companyId: dto.companyId,
        taskId: dto.taskId,
        employeeId: dto.employeeId,
        toolName: dto.toolName,
        riskLevel: dto.riskLevel,
        status: 'PENDING',
        title: dto.title,
        description: dto.description,
        inputPayload: dto.inputPayload as any,
        expiresAt,
      },
      include: {
        task: { select: { id: true, title: true } },
        employee: { select: { id: true, name: true, role: true } },
      },
    });

    // 1. Emit SSE Realtime Event ke HUD
    this.events.emit(dto.companyId, 'approval.requested', approval);

    // 2. Dispatch notifikasi ke Telegram / Discord / Slack
    this.webhooks.dispatch({
      companyId: dto.companyId,
      event: 'approval.requested',
      title: `Otorisasi Diperlukan: ${approval.title}`,
      summary: `Agent [${approval.employee?.name || 'AI'}] meminta persetujuan untuk mengeksekusi tool "${dto.toolName}" (Tingkat Risiko: ${dto.riskLevel}).\n\nAlasan: ${dto.description || 'Pemeriksaan keamanan rutin.'}`,
      data: {
        approvalId: approval.id,
        taskId: dto.taskId,
        riskLevel: dto.riskLevel,
      },
    });

    return approval;
  }

  /**
   * Mengambil daftar persetujuan untuk tenant/company.
   */
  async getApprovals(companyId: string, status?: ApprovalStatus) {
    return this.prisma.approvalRequest.findMany({
      where: {
        companyId,
        ...(status ? { status } : {}),
      },
      include: {
        task: { select: { id: true, title: true, status: true } },
        employee: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Menghitung total persetujuan yang sedang PENDING.
   */
  async countPending(companyId: string): Promise<number> {
    return this.prisma.approvalRequest.count({
      where: {
        companyId,
        status: 'PENDING',
      },
    });
  }

  /**
   * Menyetujui permohonan eksekusi tool.
   */
  async approve(companyId: string, approvalId: string, reviewerId: string, reviewNote?: string) {
    const approval = await this.prisma.approvalRequest.findFirst({
      where: { id: approvalId, companyId },
      include: { employee: true, task: true },
    });

    if (!approval) throw new NotFoundException('Permohonan persetujuan tidak ditemukan.');
    if (approval.status !== 'PENDING') {
      throw new BadRequestException(`Permohonan sudah berstatus ${approval.status}.`);
    }

    const updated = await this.prisma.approvalRequest.update({
      where: { id: approvalId },
      data: {
        status: 'APPROVED',
        reviewerId,
        reviewNote: reviewNote || 'Disetujui oleh Administrator/Pimpinan.',
      },
      include: {
        task: { select: { id: true, title: true } },
        employee: { select: { id: true, name: true } },
      },
    });

    this.events.emit(companyId, 'approval.decided', updated);

    // Lanjutkan eksekusi jika permohonan terhubung dengan Task
    if (approval.taskId) {
      await this.resumeApprovedTask(companyId, approval, reviewNote);
    }

    return updated;
  }

  /**
   * Menolak permohonan eksekusi tool.
   */
  async reject(companyId: string, approvalId: string, reviewerId: string, reviewNote?: string) {
    const approval = await this.prisma.approvalRequest.findFirst({
      where: { id: approvalId, companyId },
      include: { employee: true, task: true },
    });

    if (!approval) throw new NotFoundException('Permohonan persetujuan tidak ditemukan.');
    if (approval.status !== 'PENDING') {
      throw new BadRequestException(`Permohonan sudah berstatus ${approval.status}.`);
    }

    const updated = await this.prisma.approvalRequest.update({
      where: { id: approvalId },
      data: {
        status: 'REJECTED',
        reviewerId,
        reviewNote: reviewNote || 'Ditolak demi keamanan sistem.',
      },
      include: {
        task: { select: { id: true, title: true } },
        employee: { select: { id: true, name: true } },
      },
    });

    this.events.emit(companyId, 'approval.decided', updated);

    // Batalkan task jika ditolak
    if (approval.taskId) {
      await this.prisma.task.update({
        where: { id: approval.taskId },
        data: { status: 'CANCELLED', finishedAt: new Date() },
      });
      await this.prisma.taskEvent.create({
        data: {
          taskId: approval.taskId,
          from: 'WAITING',
          to: 'CANCELLED',
          note: `Eksekusi ditolak: ${reviewNote || 'Dibatalkan oleh pimpinan'}`,
          actorId: reviewerId,
        },
      });

      if (approval.employeeId) {
        await this.prisma.employee.update({
          where: { id: approval.employeeId },
          data: { status: 'IDLE', currentTask: null, currentTool: null, progress: 0 },
        });
        this.events.emit(companyId, 'employee.updated', {
          id: approval.employeeId,
          status: 'IDLE',
          currentTask: null,
          currentTool: null,
          progress: 0,
        });
      }

      this.events.emit(companyId, 'task.event', {
        task: { id: approval.taskId, status: 'CANCELLED' },
        to: 'CANCELLED',
      });
    }

    return updated;
  }

  /**
   * Melanjutkan task yang telah disetujui pimpinan.
   */
  private async resumeApprovedTask(companyId: string, approval: any, note?: string) {
    try {
      // Lazy lookup tool registry & agent runtime
      const { ToolRegistryService } = await import('../ai-engine/tools/tool-registry.service');
      const { AgentRuntimeService } = await import('../ai-engine/agent-runtime.service');

      const toolRegistry = this.moduleRef.get(ToolRegistryService, { strict: false });
      const agentRuntime = this.moduleRef.get(AgentRuntimeService, { strict: false });

      // Catat approval event ke task event
      await this.prisma.taskEvent.create({
        data: {
          taskId: approval.taskId,
          from: 'WAITING',
          to: 'EXECUTING',
          note: `Otorisasi tool "${approval.toolName}" disetujui. ${note || ''}`,
        },
      });

      // Update status task kembali ke EXECUTING
      await this.prisma.task.update({
        where: { id: approval.taskId },
        data: { status: 'EXECUTING' },
      });

      // Lakukan eksekusi tool yang diotorisasi
      if (toolRegistry) {
        const resultOutput = await toolRegistry.execute(
          approval.toolName,
          (approval.inputPayload as any) || {},
          {
            companyId,
            employeeId: approval.employeeId,
            taskId: approval.taskId,
          },
        );

        // Simpan output ke approval request
        await this.prisma.approvalRequest.update({
          where: { id: approval.id },
          data: { outputResult: { output: resultOutput } },
        });

        // Trigger agent runtime untuk memproses kelanjutan task
        if (agentRuntime) {
          // Asinkronus melanjutkan task
          setTimeout(() => {
            agentRuntime.processTask(companyId, approval.taskId).catch((err: any) => {
              this.logger.error(`Error melanjutkan task yang di-approve: ${err.message}`);
            });
          }, 500);
        }
      }
    } catch (err: any) {
      this.logger.error(`Gagal meresume task yang disetujui: ${err.message}`);
    }
  }
}
