import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { OfficeEventsService } from '../realtime/office-events.service';

/**
 * Diskusi "Kumpulkan tim". Phase 2 menyimpan pesan CEO + catatan sistem; balasan agent nyata
 * datang dari AI Engine (Phase 3). Balasan employee DEMO tetap simulasi lokal di frontend.
 */
@Injectable()
export class DiscussionService {
  constructor(private readonly prisma: DatabaseService, private readonly events: OfficeEventsService) {}

  private async validParticipants(companyId: string, ids: string[]) {
    const unique = Array.from(new Set(ids));
    if (!unique.length) return [];
    const found = await this.prisma.employee.findMany({ where: { companyId, id: { in: unique }, deletedAt: null }, select: { id: true } });
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
    return this.prisma.discussion.update({ where: { id }, data: { participantIds: await this.validParticipants(companyId, participantIds) } });
  }

  async post(companyId: string, id: string, userId: string, text: string) {
    const d = await this.get(companyId, id);
    if (d.endedAt) throw new BadRequestException('Diskusi sudah selesai');
    const msg = await this.prisma.discussionMessage.create({
      data: { companyId, discussionId: id, fromType: 'user', fromId: userId, text: text.trim() },
    });
    if (d.participantIds.length) {
      await this.prisma.employeeActivity.createMany({
        data: d.participantIds.map((employeeId) => ({ companyId, employeeId, kind: 'instruction', text: `Diskusi: ${text.trim()}` })),
      });
    }
    this.events.emit(companyId, 'discussion.message', msg);
    return msg;
  }

  async messages(companyId: string, id: string, limit = 200) {
    await this.get(companyId, id);
    const rows = await this.prisma.discussionMessage.findMany({
      where: { companyId, discussionId: id }, orderBy: { createdAt: 'desc' }, take: Math.min(limit, 500),
    });
    return { data: rows.reverse(), meta: { total: rows.length } };
  }

  async end(companyId: string, id: string) {
    const d = await this.get(companyId, id);
    if (d.endedAt) return d;
    return this.prisma.discussion.update({ where: { id }, data: { endedAt: new Date() } });
  }
}
