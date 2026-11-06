import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { OfficeEventsService } from '../realtime/office-events.service';
import { UpdateWhiteboardDto, WhiteboardPointDto, WhiteboardActionItemDto } from './dto/discussion.dto';

export interface WhiteboardData {
  topic: string;
  consensusScore: number;
  points: WhiteboardPointDto[];
  actionItems: WhiteboardActionItemDto[];
  summary: string;
}

@Injectable()
export class WhiteboardService {
  private readonly logger = new Logger(WhiteboardService.name);

  constructor(
    private readonly prisma: DatabaseService,
    private readonly events: OfficeEventsService,
  ) {}

  async getWhiteboard(companyId: string, discussionId: string): Promise<WhiteboardData> {
    const disc = await this.prisma.discussion.findFirst({
      where: { id: discussionId, companyId },
      select: { id: true, title: true, consensusScore: true, whiteboardData: true },
    });
    if (!disc) throw new NotFoundException('Diskusi tidak ditemukan');

    const raw = (disc.whiteboardData as Record<string, any>) || {};
    return {
      topic: raw.topic || disc.title || 'Diskusi Tim',
      consensusScore: typeof disc.consensusScore === 'number' ? disc.consensusScore : (raw.consensusScore || 0),
      points: Array.isArray(raw.points) ? raw.points : [],
      actionItems: Array.isArray(raw.actionItems) ? raw.actionItems : [],
      summary: raw.summary || '',
    };
  }

  async updateWhiteboard(
    companyId: string,
    discussionId: string,
    dto: UpdateWhiteboardDto,
  ): Promise<WhiteboardData> {
    const current = await this.getWhiteboard(companyId, discussionId);

    const updated: WhiteboardData = {
      topic: dto.topic !== undefined ? dto.topic : current.topic,
      consensusScore: dto.consensusScore !== undefined ? dto.consensusScore : current.consensusScore,
      points: dto.points !== undefined ? dto.points : current.points,
      actionItems: dto.actionItems !== undefined ? dto.actionItems : current.actionItems,
      summary: dto.summary !== undefined ? dto.summary : current.summary,
    };

    await this.prisma.discussion.update({
      where: { id: discussionId },
      data: {
        consensusScore: updated.consensusScore,
        whiteboardData: updated as any,
      },
    });

    this.events.emit(companyId, 'whiteboard.updated', {
      discussionId,
      whiteboard: updated,
    });

    return updated;
  }

  async appendPoint(
    companyId: string,
    discussionId: string,
    point: WhiteboardPointDto,
    newConsensusScore?: number,
  ): Promise<WhiteboardData> {
    const current = await this.getWhiteboard(companyId, discussionId);
    const points = [...current.points, point].slice(-12); // Simpan 12 poin perdebatan terbaru

    return this.updateWhiteboard(companyId, discussionId, {
      points,
      consensusScore: newConsensusScore !== undefined ? newConsensusScore : current.consensusScore,
    });
  }

  async setActionItems(
    companyId: string,
    discussionId: string,
    actionItems: WhiteboardActionItemDto[],
  ): Promise<WhiteboardData> {
    return this.updateWhiteboard(companyId, discussionId, { actionItems });
  }
}
