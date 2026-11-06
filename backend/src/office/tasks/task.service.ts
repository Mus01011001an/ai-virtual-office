import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { OfficeEventsService } from '../realtime/office-events.service';
import { AgentRuntimeService } from '../ai-engine/agent-runtime.service';
import { CreateTaskDto } from './dto/task.dto';

/**
 * Task Service (Phase 3 Autonomous AI Engine).
 * Saat task dibuat, AgentRuntime langsung mengeksekusi siklus otonom (QUEUED -> EXECUTING -> COMPLETED).
 */
@Injectable()
export class TaskService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly events: OfficeEventsService,
    private readonly agentRuntime: AgentRuntimeService,
  ) {}

  async findAll(companyId: string, p: { status?: string; employeeId?: string; page?: number; limit?: number }) {
    const { page = 0, limit = 50 } = p;
    const where: Prisma.TaskWhereInput = { companyId };
    if (p.status && (Object.values(TaskStatus) as string[]).includes(p.status)) where.status = p.status as TaskStatus;
    if (p.employeeId) where.employeeId = p.employeeId;
    const [data, total] = await Promise.all([
      this.prisma.task.findMany({ where, orderBy: { createdAt: 'desc' }, skip: page * limit, take: Math.min(limit, 200) }),
      this.prisma.task.count({ where }),
    ]);
    return { data, meta: { total } };
  }

  async create(companyId: string, employeeId: string, dto: CreateTaskDto, userId: string) {
    const emp = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId, deletedAt: null } });
    if (!emp) throw new NotFoundException('Employee tidak ditemukan');

    const task = await this.prisma.$transaction(async (tx) => {
      const t = await tx.task.create({
        data: {
          companyId,
          employeeId,
          title: dto.title.trim(),
          description: dto.description,
          source: dto.source ?? 'panel',
          createdById: userId,
        },
      });
      await tx.taskEvent.create({ data: { taskId: t.id, to: 'QUEUED', actorId: userId, note: 'Task dibuat' } });
      return t;
    });

    await this.prisma.employeeActivity.create({
      data: { companyId, employeeId, kind: 'instruction', text: `Task baru: ${task.title}` },
    });

    this.events.emit(companyId, 'task.event', { task, to: 'QUEUED' });

    // Phase 3: Picu siklus otonom di background
    void this.agentRuntime.processTask(companyId, task.id);

    return task;
  }

  async cancel(companyId: string, id: string, userId: string) {
    const t = await this.prisma.task.findFirst({ where: { id, companyId } });
    if (!t) throw new NotFoundException('Task tidak ditemukan');
    if (t.status !== 'QUEUED' && t.status !== 'WAITING') {
      throw new BadRequestException(`Task berstatus ${t.status} tidak bisa dibatalkan`);
    }

    const task = await this.prisma.$transaction(async (tx) => {
      const u = await tx.task.update({ where: { id }, data: { status: 'CANCELLED', finishedAt: new Date() } });
      await tx.taskEvent.create({ data: { taskId: id, from: t.status, to: 'CANCELLED', actorId: userId } });
      return u;
    });

    this.events.emit(companyId, 'task.event', { task, from: t.status, to: 'CANCELLED' });
    return task;
  }

  async events_(companyId: string, id: string) {
    const t = await this.prisma.task.findFirst({ where: { id, companyId }, include: { events: { orderBy: { createdAt: 'asc' } } } });
    if (!t) throw new NotFoundException('Task tidak ditemukan');
    return t.events;
  }
}
