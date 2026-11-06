import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { OfficeEventsService } from '../realtime/office-events.service';
import { AiEngineService } from '../ai-engine/ai-engine.service';
import { AgentRuntimeService } from '../ai-engine/agent-runtime.service';
import { DebateOrchestratorService } from './debate-orchestrator.service';
import { WhiteboardService } from './whiteboard.service';
import { S3Service } from 'src/s3/s3.service';
import { ConcludeMeetingDto, InitiateDebateDto } from './dto/discussion.dto';

/**
 * Diskusi "Kumpulkan tim" (Phase 3 & Phase 5 Multi-Agent Autonomous Debate).
 * Mendukung interaksi CEO ↔ Tim terarah dan Mode Debat Otonom Antar-Agen dengan 3D Whiteboard & Auto MoM.
 */
@Injectable()
export class DiscussionService {
  private readonly logger = new Logger(DiscussionService.name);

  constructor(
    private readonly prisma: DatabaseService,
    private readonly events: OfficeEventsService,
    private readonly aiEngine: AiEngineService,
    private readonly agentRuntime: AgentRuntimeService,
    private readonly debateOrchestrator: DebateOrchestratorService,
    private readonly whiteboard: WhiteboardService,
    private readonly s3Service: S3Service,
  ) {}

  private async validParticipants(companyId: string, ids: string[]) {
    const unique = Array.from(new Set(ids));
    if (!unique.length) return [];
    const found = await this.prisma.employee.findMany({
      where: { companyId, id: { in: unique }, deletedAt: null },
      select: { id: true },
    });
    return found.map((f) => f.id);
  }

  private async get(companyId: string, id: string) {
    const d = await this.prisma.discussion.findFirst({ where: { id, companyId } });
    if (!d) throw new NotFoundException('Diskusi tidak ditemukan');
    return d;
  }

  async start(companyId: string, userId: string, participantIds: string[]) {
    const ids = await this.validParticipants(companyId, participantIds);
    return this.prisma.discussion.create({ data: { companyId, startedById: userId, participantIds: ids } });
  }

  async setParticipants(companyId: string, id: string, participantIds: string[]) {
    const d = await this.get(companyId, id);
    if (d.endedAt) throw new BadRequestException('Diskusi sudah selesai');
    return this.prisma.discussion.update({
      where: { id },
      data: { participantIds: await this.validParticipants(companyId, participantIds) },
    });
  }

  async post(companyId: string, id: string, userId: string, text: string) {
    const d = await this.get(companyId, id);
    if (d.endedAt) throw new BadRequestException('Diskusi sudah selesai');

    const msg = await this.prisma.discussionMessage.create({
      data: { companyId, discussionId: id, fromType: 'user', fromId: userId, text: text.trim() },
    });

    if (d.participantIds.length) {
      await this.prisma.employeeActivity.createMany({
        data: d.participantIds.map((employeeId) => ({
          companyId,
          employeeId,
          kind: 'instruction',
          text: `Diskusi: ${text.trim()}`,
        })),
      });
    }

    this.events.emit(companyId, 'discussion.message', msg);

    // Phase 3: Picu respon agen AI peserta diskusi secara asinkron
    if (d.participantIds.length > 0) {
      void this.dispatchAiParticipants(companyId, id, d.participantIds, text.trim(), userId);
    }

    return msg;
  }

  /**
   * Memecah respons agen menjadi pesan-pesan pendek manusiawi (multi-message burst)
   */
  splitIntoHumanMessages(rawText: string): string[] {
    if (!rawText || !rawText.trim()) return [];

    // 1. Cek delimiter eksplisit '---' yang berada di baris baru
    const delimiterRegex = /(?:^|\n)\s*---\s*(?:\n|$)/g;
    if (delimiterRegex.test(rawText)) {
      const parts = rawText
        .split(delimiterRegex)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      if (parts.length > 0) return parts.slice(0, 4);
    }

    // 2. Fallback jika tidak menggunakan delimiter tapi teks panjang (> 200 karakter)
    const trimmed = rawText.trim();
    if (trimmed.length > 200) {
      // Pecah berdasarkan double newline (paragraf)
      const paragraphs = trimmed
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      if (paragraphs.length > 1) {
        return paragraphs.slice(0, 3);
      }

      // Jika masih satu paragraf panjang, pecah berdasarkan batas kalimat
      const sentences = trimmed.match(/[^.!?]+[.!?]+(?:\s|$)/g);
      if (sentences && sentences.length >= 2) {
        const chunks: string[] = [];
        let current = '';
        for (const s of sentences) {
          if ((current + s).length > 160 && current) {
            chunks.push(current.trim());
            current = s;
          } else {
            current += s;
          }
        }
        if (current.trim()) chunks.push(current.trim());
        if (chunks.length > 1) return chunks.slice(0, 3);
      }
    }

    return [trimmed];
  }

  private async dispatchAiParticipants(
    companyId: string,
    discussionId: string,
    participantIds: string[],
    userText: string,
    userId: string,
  ) {
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: participantIds }, companyId, deletedAt: null },
      include: { aiProvider: true },
    });

    if (!employees.length) return;

    // Menentukan siapa yang merespon: jika ada mention spesifik @Nama, panggil agen tersebut
    const lower = userText.toLowerCase();
    const mentioned = employees.filter((e) => lower.includes(e.name.toLowerCase()) || lower.includes(`@${e.name.toLowerCase()}`));
    const responders = mentioned.length > 0 ? mentioned : employees.slice(0, 2);

    for (const emp of responders) {
      // 1. Visual feedback: status THINKING
      await this.prisma.employee.update({ where: { id: emp.id }, data: { status: 'THINKING' } });
      this.events.emit(companyId, 'employee.updated', { id: emp.id, status: 'THINKING' });

      try {
        let replyText = '';

        if (emp.aiProvider && emp.aiProvider.isActive) {
          // 2a. Real LLM Inference via AI Engine
          const history = await this.prisma.discussionMessage.findMany({
            where: { discussionId },
            orderBy: { createdAt: 'desc' },
            take: 6,
          });

          const contextHistory = history.reverse().map((m) => ({
            role: (m.fromType === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.text,
          }));

          const result = await this.aiEngine.generateForEmployee(companyId, emp.id, userText, {
            temperature: 0.7,
            maxTokens: 250,
            contextHistory,
          });
          replyText = result.text;
        } else {
          // 2b. Simulated intelligent human-like response jika belum menghubungkan API key
          await new Promise((r) => setTimeout(r, 1000));
          replyText = `Siap mas, dari sudut pandang ${emp.role}: aku cek untuk "${userText.slice(0, 30)}..." ya! 👀\n---\nLangkah teknisnya udah aku susun dan segera aku tindaklanjuti.`;
        }

        // 3. Pecah respons menjadi pesan-pesan beruntun (multi-message burst)
        const chunks = this.splitIntoHumanMessages(replyText);

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];

          // Jeda mengetik alami antar-pesan
          if (i > 0) {
            this.events.emit(companyId, 'employee.updated', { id: emp.id, status: 'THINKING' });
            const typingWait = Math.min(2000, Math.max(900, chunk.length * 18));
            await new Promise((r) => setTimeout(r, typingWait));
          }

          // Simpan pesan balasan karyawan ke database
          const aiMsg = await this.prisma.discussionMessage.create({
            data: {
              companyId,
              discussionId,
              fromType: 'employee',
              fromId: emp.id,
              text: chunk,
            },
          });

          await this.prisma.employeeActivity.create({
            data: {
              companyId,
              employeeId: emp.id,
              kind: 'ai',
              text: `[Diskusi] ${chunk.slice(0, 80)}`,
            },
          });

          // Broadcast event realtime
          this.events.emit(companyId, 'discussion.message', aiMsg);
          this.events.emit(companyId, 'activity.created', {
            employeeId: emp.id,
            kind: 'ai',
            text: `[Diskusi] ${chunk.slice(0, 60)}...`,
          });
        }

        // 4. Deteksi apakah perintah meminta pembuatan task nyata
        const taskRegex = /\b(tolong|kerjakan|buat|bikin|perbaiki|fix|deploy|audit|analisis|test|implement)\b/i;
        if (taskRegex.test(userText)) {
          const taskTitle = userText.length > 70 ? userText.slice(0, 67) + '…' : userText;
          const task = await this.prisma.task.create({
            data: {
              companyId,
              employeeId: emp.id,
              title: taskTitle,
              description: `Dibuat dari diskusi: ${userText}`,
              source: 'discussion',
              createdById: userId,
            },
          });
          this.events.emit(companyId, 'task.event', { task, to: 'QUEUED' });
          void this.agentRuntime.processTask(companyId, task.id);
        }
      } catch (err: any) {
        this.logger.error(`Error dispatching AI response for ${emp.name}: ${err.message}`);
      } finally {
        await this.prisma.employee.update({ where: { id: emp.id }, data: { status: 'IDLE' } });
        this.events.emit(companyId, 'employee.updated', { id: emp.id, status: 'IDLE' });
      }
    }
  }

  async messages(companyId: string, id: string, limit = 200) {
    await this.get(companyId, id);
    const rows = await this.prisma.discussionMessage.findMany({
      where: { companyId, discussionId: id },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
    return { data: rows.reverse(), meta: { total: rows.length } };
  }

  /**
   * Memulai sesi debat otonom multi-agen berdasarkan topik tertentu.
   */
  async initiateDebate(companyId: string, id: string, dto: InitiateDebateDto, userId: string) {
    const d = await this.get(companyId, id);
    if (d.endedAt) throw new BadRequestException('Diskusi sudah selesai');

    const maxRounds = dto.maxRounds || 3;
    await this.prisma.discussion.update({
      where: { id },
      data: {
        title: dto.topic,
        mode: 'AUTONOMOUS_DEBATE',
        maxRounds,
        currentRound: 1,
      },
    });

    // Jalankan loop debat otonom di background
    void this.debateOrchestrator.runDebateLoop(
      companyId,
      id,
      dto.topic,
      maxRounds,
      dto.participantIds,
      userId,
    );

    return {
      discussionId: id,
      topic: dto.topic,
      mode: 'AUTONOMOUS_DEBATE',
      maxRounds,
      status: 'DEBATE_STARTED',
    };
  }

  /**
   * Mengakhiri rapat, menerbitkan Minutes of Meeting (MoM) ke S3, dan otomatis mendelegasikan tugas.
   */
  async conclude(companyId: string, id: string, dto?: ConcludeMeetingDto, userId?: string) {
    const d = await this.get(companyId, id);
    const endedAt = new Date();

    await this.prisma.discussion.update({
      where: { id },
      data: { endedAt },
    });

    const messages = await this.prisma.discussionMessage.findMany({
      where: { discussionId: id },
      orderBy: { createdAt: 'asc' },
    });

    const participants = await this.prisma.employee.findMany({
      where: { id: { in: d.participantIds }, companyId },
    });

    const dateStr = endedAt.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // 1. Susun dokumen Minutes of Meeting (MoM) Markdown
    let mom = `# 📋 RISALAH RAPAT KOORDINASI TIM (MINUTES OF MEETING)\n\n`;
    mom += `**Waktu**: ${dateStr} ${endedAt.toLocaleTimeString('id-ID')}\n`;
    mom += `**Topik Diskusi**: ${d.title}\n`;
    mom += `**Peserta Rapat**: ${participants.map((p) => `${p.name} (${p.role})`).join(', ') || 'Tim Virtual'}\n`;
    mom += `**Skor Konsensus Akhir**: ${d.consensusScore}%\n\n`;
    mom += `---\n\n## 1. Transkrip & Poin Diskusi\n\n`;

    const byId = new Map(participants.map((p) => [p.id, p]));
    for (const m of messages) {
      const sender = m.fromType === 'user' ? 'CEO' : byId.get(m.fromId || '')?.name || 'System';
      const role = byId.get(m.fromId || '')?.role || '';
      const stance = m.stance && m.stance !== 'NEUTRAL' ? ` [${m.stance}]` : '';
      mom += `- **${sender}**${role ? ` (${role})` : ''}${stance}: ${m.text}\n`;
    }

    // 2. Buat Action Items terstruktur
    const actionItems: Array<{ assigneeId: string; assigneeName: string; title: string; description: string }> = [];
    participants.forEach((p) => {
      actionItems.push({
        assigneeId: p.id,
        assigneeName: p.name,
        title: `Tindak lanjut rapat: ${d.title.slice(0, 45)} (${p.role})`,
        description: `Melaksanakan butir kesepakatan rapat tim mengenai "${d.title}" dari sudut pandang ${p.role}.`,
      });
    });

    mom += `\n## 2. Rencana Aksi & Delegasi Tugas\n\n`;
    actionItems.forEach((item) => {
      mom += `- [ ] **@${item.assigneeName}**: ${item.title}\n`;
    });
    mom += `\n---\n*Dokumen risalah diterbitkan otomatis oleh Virtual AI Office Engine dan tersimpan aman di S3 Storage.*`;

    // 3. Simpan ke MinIO S3 & Artifact table
    let artifact: any = null;
    if (dto?.saveMoMToS3 !== false) {
      try {
        const buffer = Buffer.from(mom, 'utf-8');
        const safeTitle = (d.title || 'MoM').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 35);
        const fileName = `Minutes_of_Meeting_${safeTitle}_${Date.now()}.md`;
        const uploadRes = await this.s3Service.uploadFile({
          buffer,
          originalname: fileName,
          mimetype: 'text/markdown',
          size: buffer.length,
        });

        artifact = await this.prisma.artifact.create({
          data: {
            companyId,
            name: fileName,
            mimeType: 'text/markdown',
            size: buffer.length,
            s3Key: uploadRes.data.filename,
            url: uploadRes.data.url,
            metadata: {
              discussionId: id,
              topic: d.title,
              consensusScore: d.consensusScore,
            },
          },
        });

        this.events.emit(companyId, 'artifact.created', artifact);
      } catch (s3Err: any) {
        this.logger.warn(`Gagal upload MoM ke S3: ${s3Err.message}`);
      }
    }

    // 4. Update Whiteboard state
    await this.whiteboard.updateWhiteboard(companyId, id, {
      summary: `Rapat ditutup dengan konsensus ${d.consensusScore}%. MoM tersimpan.`,
      actionItems: actionItems.map((a) => ({
        assigneeName: a.assigneeName,
        title: a.title,
        status: 'ASSIGNED',
      })),
    });

    // 5. Otomatis buat Task dan delegasikan ke AgentRuntime
    const createdTasks: any[] = [];
    if (dto?.generateTasks !== false) {
      for (const item of actionItems) {
        try {
          const task = await this.prisma.task.create({
            data: {
              companyId,
              employeeId: item.assigneeId,
              title: item.title,
              description: item.description,
              source: 'discussion',
              createdById: userId || null,
            },
          });
          createdTasks.push(task);
          this.events.emit(companyId, 'task.event', { task, to: 'QUEUED' });
          void this.agentRuntime.processTask(companyId, task.id);
        } catch (tErr: any) {
          this.logger.error(`Gagal membuat task dari diskusi: ${tErr.message}`);
        }
      }
    }

    this.events.emit(companyId, 'discussion.concluded', {
      discussionId: id,
      endedAt,
      artifact,
      tasksCount: createdTasks.length,
    });

    return {
      discussionId: id,
      endedAt,
      artifact,
      dispatchedTasks: createdTasks,
    };
  }

  async end(companyId: string, id: string) {
    return this.conclude(companyId, id);
  }
}
