import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { OfficeEventsService } from '../realtime/office-events.service';
import { AiEngineService } from '../ai-engine/ai-engine.service';
import { WhiteboardService } from './whiteboard.service';
import { MessageStance } from '@prisma/client';

export interface DebateTurnPlan {
  speakerId: string;
  stance: MessageStance;
  directive: string;
}

@Injectable()
export class DebateOrchestratorService {
  private readonly logger = new Logger(DebateOrchestratorService.name);

  constructor(
    private readonly prisma: DatabaseService,
    private readonly events: OfficeEventsService,
    private readonly aiEngine: AiEngineService,
    private readonly whiteboard: WhiteboardService,
  ) {}

  /**
   * Menjalankan siklus debat otonom multi-agent (Round-Robin Debate Loop)
   */
  async runDebateLoop(
    companyId: string,
    discussionId: string,
    topic: string,
    maxRounds = 3,
    overrideParticipantIds?: string[],
    userId?: string,
  ) {
    const disc = await this.prisma.discussion.findFirst({
      where: { id: discussionId, companyId },
    });
    if (!disc) return;

    const participantIds = overrideParticipantIds?.length
      ? overrideParticipantIds
      : disc.participantIds;

    const participants = await this.prisma.employee.findMany({
      where: { id: { in: participantIds }, companyId, deletedAt: null },
      include: { aiProvider: true },
    });

    if (participants.length === 0) return;

    // Inisialisasi whiteboard state
    await this.whiteboard.updateWhiteboard(companyId, discussionId, {
      topic,
      consensusScore: 20,
      points: [],
      actionItems: [],
      summary: '',
    });

    // Simpan pesan sistem bahwa debat otonom dimulai
    const startMsg = await this.prisma.discussionMessage.create({
      data: {
        companyId,
        discussionId,
        fromType: 'system',
        stance: 'NEUTRAL',
        text: `🏛️ Sesi debat otonom dimulai untuk topik: "${topic}". Peserta: ${participants.map((p) => p.name).join(', ')}.`,
      },
    });
    this.events.emit(companyId, 'discussion.message', startMsg);

    let consensus = 20;
    const actualRounds = Math.min(Math.max(maxRounds, 1), 4);

    for (let round = 1; round <= actualRounds; round++) {
      // 1. Tentukan pembicara dan stance untuk putaran ini
      const plan = this.planTurn(round, actualRounds, participants);
      const speaker = participants.find((p) => p.id === plan.speakerId) || participants[0];

      // 2. Visual feedback: status THINKING
      await this.prisma.employee.update({
        where: { id: speaker.id },
        data: { status: 'THINKING' },
      });
      this.events.emit(companyId, 'employee.updated', { id: speaker.id, status: 'THINKING' });

      try {
        // 3. Ambil riwayat percakapan untuk konteks LLM
        const history = await this.prisma.discussionMessage.findMany({
          where: { discussionId },
          orderBy: { createdAt: 'desc' },
          take: 8,
        });

        const contextHistory = history.reverse().map((m) => ({
          role: (m.fromType === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: `[${m.fromType === 'user' ? 'CEO' : m.fromId ? (participants.find((p) => p.id === m.fromId)?.name || 'Rekan') : 'System'}] (${m.stance}): ${m.text}`,
        }));

        const prompt =
          `Topik Rapat: "${topic}".\n` +
          `Sikap / Peran Anda: [${plan.stance}].\n` +
          `Arahan: ${plan.directive}\n` +
          `Sampaikan tanggapan Anda layaknya manusia di ruang rapat startup (singkat, padat, berbobot, maksimal 2-3 kalimat pendek). ` +
          `Jika memiliki 2 poin terpisah, gunakan delimiter '---' di baris baru agar dikirim sebagai 2 balon pesan terpisah. ` +
          `Gunakan format markdown rapi untuk istilah teknis.`;

        let replyText = '';
        if (speaker.aiProvider && speaker.aiProvider.isActive) {
          const result = await this.aiEngine.generateForEmployee(companyId, speaker.id, prompt, {
            temperature: 0.75,
            maxTokens: 280,
            contextHistory,
          });
          replyText = result.text;
        } else {
          await new Promise((r) => setTimeout(r, 1200));
          replyText = this.generateFallbackDebateReply(speaker.name, speaker.role, topic, plan.stance);
        }

        // 4. Hitung kenaikan konsensus
        consensus = Math.min(95, consensus + Math.round(65 / actualRounds));

        // 5. Pecah jika ada delimiter multi-message
        const chunks = replyText
          .split(/(?:^|\n)\s*---\s*(?:\n|$)/g)
          .map((c) => c.trim())
          .filter((c) => c.length > 0);
        const actualChunks = chunks.length > 0 ? chunks.slice(0, 3) : [replyText.trim()];

        for (let cIdx = 0; cIdx < actualChunks.length; cIdx++) {
          const chunk = actualChunks[cIdx];
          if (cIdx > 0) {
            this.events.emit(companyId, 'employee.updated', { id: speaker.id, status: 'THINKING' });
            await new Promise((r) => setTimeout(r, 1200));
          }

          // Simpan pesan ke database
          const msg = await this.prisma.discussionMessage.create({
            data: {
              companyId,
              discussionId,
              fromType: 'employee',
              fromId: speaker.id,
              stance: plan.stance,
              turnIndex: round,
              text: chunk,
            },
          });

          // Update Papan Tulis (Whiteboard) hanya pada poin utama / chunk pertama
          if (cIdx === 0) {
            await this.whiteboard.appendPoint(
              companyId,
              discussionId,
              {
                speaker: speaker.name,
                stance: plan.stance,
                text: chunk.slice(0, 90) + (chunk.length > 90 ? '…' : ''),
              },
              consensus,
            );
          }

          // Emit realtime SSE
          this.events.emit(companyId, 'discussion.message', msg);
          this.events.emit(companyId, 'activity.created', {
            employeeId: speaker.id,
            kind: 'ai',
            text: `[Debat ${plan.stance}] ${chunk.slice(0, 60)}…`,
          });
        }

        // Jeda waktu antar pembicara agar terasa natural di 3D scene (1.5 detik)
        await new Promise((r) => setTimeout(r, 1500));
      } catch (err: any) {
        this.logger.error(`Error pada putaran debat ${round} untuk ${speaker.name}: ${err.message}`);
      } finally {
        await this.prisma.employee.update({
          where: { id: speaker.id },
          data: { status: 'IDLE' },
        });
        this.events.emit(companyId, 'employee.updated', { id: speaker.id, status: 'IDLE' });
      }

      // Hentikan jika konsensus sudah tinggi
      if (consensus >= 90) break;
    }

    // Update ronde dan konsensus final di tabel discussion
    await this.prisma.discussion.update({
      where: { id: discussionId },
      data: {
        consensusScore: consensus,
        currentRound: actualRounds,
      },
    });
  }

  private planTurn(
    round: number,
    totalRounds: number,
    participants: Array<{ id: string; name: string; role: string }>,
  ): DebateTurnPlan {
    const count = participants.length;

    if (round === 1) {
      // Putaran 1: Pengusul Ide / Proposal
      const lead =
        participants.find((p) => /lead|architect|head|chief/i.test(p.role)) ||
        participants[0];
      return {
        speakerId: lead.id,
        stance: 'PROPOSE',
        directive: 'Kemukakan usulan solusi arsitektural atau rencana aksi awal yang terstruktur.',
      };
    } else if (round < totalRounds) {
      // Putaran 2 / Pertengahan: Penantang Risiko / Feasibility Critic
      const challenger =
        participants.find(
          (p) =>
            /security|qa|devops|reliability|backend/i.test(p.role) &&
            p.id !== participants[0]?.id,
        ) || participants[(round - 1) % count];
      return {
        speakerId: challenger.id,
        stance: 'CRITIQUE',
        directive:
          'Tantang usulan rekan sebelumnya. Ungkapkan potensi celah keamanan, skalabilitas, beban server, atau kendala implementasi.',
      };
    } else {
      // Putaran Akhir: Perumus Konsensus / Kesimpulan
      const synthesizer =
        participants.find((p) => /manager|pm|chief|lead/i.test(p.role)) ||
        participants[participants.length - 1];
      return {
        speakerId: synthesizer.id,
        stance: 'SYNTHESIZE',
        directive:
          'Rangkum jalan tengah yang disepakati dari perdebatan ini. Tentukan kesepakatan akhir dan mitigasi kompromi.',
      };
    }
  }

  private generateFallbackDebateReply(
    name: string,
    role: string,
    topic: string,
    stance: MessageStance,
  ): string {
    if (stance === 'PROPOSE') {
      return `Berdasarkan analisis saya sebagai ${role}, untuk "${topic}", saya mengusulkan pendekatan modular bertahap dengan isolasi layer agar performa tetap stabil dan mudah di-maintain.`;
    } else if (stance === 'CRITIQUE') {
      return `Sebagai ${role}, saya melihat ada potensi bottleneck jika pendekatan itu langsung diterapkan tanpa caching dan rate limiting yang ketat. Kita harus perhitungkan kapasitas infrastruktur.`;
    } else if (stance === 'SUPPORT') {
      return `Saya setuju dengan poin tersebut. Dari sisi ${role}, mitigasi itu sangat tepat dan kita bisa menambahkan otomatisasi monitoring untuk memverifikasi hasilnya.`;
    } else {
      return `Sebagai kesimpulan tim: kita sepakat mengadopsi usulan utama dengan mitigasi caching yang disarankan. Saya rangkum ini sebagai rencana aksi resmi rapat kita.`;
    }
  }
}
