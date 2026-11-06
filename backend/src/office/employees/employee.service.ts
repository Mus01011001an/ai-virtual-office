import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { ActivityService } from 'src/system/activity/activity.service';
import { OfficeEventsService } from '../realtime/office-events.service';
import { AiEngineService } from '../ai-engine/ai-engine.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';

/** Jumlah meja di layout 3D (frontend office/layout.ts → DESKS). */
export const DESK_COUNT = 36;

const SELECT = {
  id: true, name: true, role: true, department: true, provider: true, providerId: true, model: true, skills: true,
  systemPrompt: true, deskIndex: true, appearance: true, status: true, slot: true, currentTask: true, currentTool: true,
  progress: true, isDemo: true, createdAt: true, updatedAt: true, deletedAt: true,
} satisfies Prisma.EmployeeSelect;

@Injectable()
export class EmployeeService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly activity: ActivityService,
    private readonly events: OfficeEventsService,
    private readonly aiEngine: AiEngineService,
  ) {}

  async findAll(companyId: string, p: { q?: string; deleted?: boolean; page?: number; limit?: number }) {
    const { q, deleted = false, page = 0, limit = 100 } = p;
    const where: Prisma.EmployeeWhereInput = { companyId, deletedAt: deleted ? { not: null } : null };
    if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { role: { contains: q, mode: 'insensitive' } }];
    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({ where, select: SELECT, orderBy: { deskIndex: 'asc' }, skip: page * limit, take: Math.min(limit, 200) }),
      this.prisma.employee.count({ where }),
    ]);
    return { data, meta: { total } };
  }

  async findOne(companyId: string, id: string) {
    const e = await this.prisma.employee.findFirst({ where: { id, companyId }, select: SELECT });
    if (!e) throw new NotFoundException('Employee tidak ditemukan');
    return e;
  }

  /** Provider wajib milik office ini & model wajib salah satu model yang diaktifkan di provider tsb. */
  private async resolveModel(companyId: string, providerId?: string | null, model?: string | null) {
    if (!providerId) return { providerId: null, provider: '', model: '' };
    const p = await this.prisma.aiProvider.findFirst({ where: { id: providerId, companyId, deletedAt: null } });
    if (!p) throw new BadRequestException('AI provider tidak ditemukan di office ini');
    if (!p.isActive) throw new BadRequestException(`AI provider "${p.name}" sedang nonaktif`);
    const chosen = model || p.defaultModel || p.models[0] || '';
    if (!chosen) throw new BadRequestException(`AI provider "${p.name}" belum punya model — tambahkan model dulu`);
    if (p.models.length && !p.models.includes(chosen)) throw new BadRequestException(`Model "${chosen}" belum diaktifkan di provider "${p.name}"`);
    return { providerId: p.id, provider: p.name, model: chosen };
  }

  private async freeDesk(companyId: string, wanted?: number) {
    const used = new Set((await this.prisma.employee.findMany({ where: { companyId, deletedAt: null }, select: { deskIndex: true } })).map((e) => e.deskIndex));
    if (wanted !== undefined && !used.has(wanted)) return wanted;
    for (let i = 0; i < DESK_COUNT; i++) if (!used.has(i)) return i;
    throw new BadRequestException('Semua meja sudah terisi');
  }

  private async feed(companyId: string, employeeId: string, kind: string, text: string) {
    const row = await this.prisma.employeeActivity.create({ data: { companyId, employeeId, kind, text } });
    this.events.emit(companyId, 'activity.created', row);
    return row;
  }

  async create(companyId: string, dto: CreateEmployeeDto, userId: string) {
    const m = await this.resolveModel(companyId, dto.providerId, dto.model);
    const deskIndex = await this.freeDesk(companyId, dto.deskIndex);
    let emp;
    try {
      emp = await this.prisma.employee.create({
        data: {
          companyId, name: dto.name.trim(), role: dto.role.trim(), department: dto.department?.trim() ?? '',
          ...m, skills: (dto.skills ?? []).map((s) => s.trim()).filter(Boolean), systemPrompt: dto.systemPrompt ?? '',
          appearance: (dto.appearance ?? {}) as Prisma.InputJsonValue, deskIndex, createdById: userId, updatedById: userId,
        },
        select: SELECT,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new BadRequestException('Meja sudah dipakai, coba lagi');
      throw err;
    }
    await this.feed(companyId, emp.id, 'info', `Bergabung sebagai ${emp.role}. Meja #${deskIndex + 1}${m.model ? ` · model ${m.provider}/${m.model}` : ''}.`);
    await this.feed(companyId, emp.id, 'info', 'Siap menerima instruksi dan menyelesaikan tugas mandiri.');
    await this.activity.log(companyId, userId).action('CREATE_EMPLOYEE').subject('Employee', emp.id).description(`Merekrut ${emp.name}`).save();
    this.events.emit(companyId, 'employee.created', emp);
    return emp;
  }

  async update(companyId: string, id: string, dto: UpdateEmployeeDto, userId: string) {
    const cur = await this.findOne(companyId, id);
    if (cur.deletedAt) throw new BadRequestException('Employee ada di sampah');
    const data: Prisma.EmployeeUpdateInput = { updatedById: userId };
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.role !== undefined) data.role = dto.role.trim();
    if (dto.department !== undefined) data.department = dto.department.trim();
    if (dto.skills !== undefined) data.skills = dto.skills.map((s) => s.trim()).filter(Boolean);
    if (dto.systemPrompt !== undefined) data.systemPrompt = dto.systemPrompt;
    if (dto.appearance !== undefined) data.appearance = dto.appearance as Prisma.InputJsonValue;
    if (dto.providerId !== undefined || dto.model !== undefined) {
      const m = await this.resolveModel(companyId, dto.providerId ?? cur.providerId, dto.model ?? (dto.providerId ? undefined : cur.model));
      data.provider = m.provider; data.model = m.model;
      data.aiProvider = m.providerId ? { connect: { id: m.providerId } } : { disconnect: true };
    }
    const emp = await this.prisma.employee.update({ where: { id }, data, select: SELECT });
    await this.activity.log(companyId, userId).action('UPDATE_EMPLOYEE').subject('Employee', id).details({ fields: Object.keys(dto) }).save();
    this.events.emit(companyId, 'employee.updated', emp);
    return emp;
  }

  async instruct(companyId: string, id: string, text: string, userName: string) {
    const emp = await this.findOne(companyId, id);
    if (emp.deletedAt) throw new BadRequestException('Employee ada di sampah');
    const row = await this.feed(companyId, id, 'instruction', `Instruksi dari ${userName}: ${text.trim()}`);
    // Phase 3: Picu AI Engine di background
    void this.handleDirectInstruction(companyId, id, text.trim(), userName);
    return row;
  }

  private async handleDirectInstruction(companyId: string, id: string, text: string, userName: string) {
    const emp = await this.prisma.employee.findFirst({
      where: { id, companyId },
      include: { aiProvider: true },
    });
    if (!emp) return;

    await this.prisma.employee.update({ where: { id }, data: { status: 'THINKING' } });
    this.events.emit(companyId, 'employee.updated', { id, status: 'THINKING' });

    try {
      let reply = '';
      if (emp.aiProvider && emp.aiProvider.isActive) {
        const result = await this.aiEngine.generateForEmployee(companyId, id, `Instruksi dari ${userName}: ${text}`);
        reply = result.text;
      } else {
        await new Promise((r) => setTimeout(r, 1000));
        reply = `Baik ${userName}, instruksi "${text.slice(0, 40)}" dipahami dan segera ditindaklanjuti dari sudut pandang ${emp.role}.`;
      }
      await this.feed(companyId, id, 'ai', reply);
    } catch (err: any) {
      await this.feed(companyId, id, 'warn', `Catatan: ${err.message}`);
    } finally {
      await this.prisma.employee.update({ where: { id }, data: { status: 'IDLE' } });
      this.events.emit(companyId, 'employee.updated', { id, status: 'IDLE' });
    }
  }

  async activities(companyId: string, id: string, limit = 100) {
    await this.findOne(companyId, id);
    const rows = await this.prisma.employeeActivity.findMany({
      where: { companyId, employeeId: id }, orderBy: { createdAt: 'desc' }, take: Math.min(limit, 300),
    });
    return { data: rows.reverse(), meta: { total: rows.length } };
  }

  async softDelete(companyId: string, id: string, userId: string) {
    const emp = await this.findOne(companyId, id);
    if (emp.deletedAt) throw new BadRequestException('Employee sudah di sampah');
    await this.prisma.employee.update({ where: { id }, data: { deletedAt: new Date(), updatedById: userId } });
    await this.activity.log(companyId, userId).action('DELETE_EMPLOYEE').subject('Employee', id).description(`Menghapus ${emp.name}`).save();
    this.events.emit(companyId, 'employee.deleted', { id });
    return { success: true, message: 'Employee dipindahkan ke sampah', data: { id } };
  }

  async restore(companyId: string, id: string, userId: string) {
    const emp = await this.findOne(companyId, id);
    if (!emp.deletedAt) throw new BadRequestException('Employee tidak ada di sampah');
    const deskIndex = await this.freeDesk(companyId, emp.deskIndex);
    const restored = await this.prisma.employee.update({ where: { id }, data: { deletedAt: null, deskIndex, updatedById: userId }, select: SELECT });
    this.events.emit(companyId, 'employee.created', restored);
    return restored;
  }

  async permanentDelete(companyId: string, id: string, userId: string) {
    const emp = await this.findOne(companyId, id);
    if (!emp.deletedAt) throw new BadRequestException('Pindahkan ke sampah dulu sebelum hapus permanen');
    await this.prisma.employee.delete({ where: { id } });
    await this.activity.log(companyId, userId).action('PERMANENT_DELETE_EMPLOYEE').subject('Employee', id).description(`Hapus permanen ${emp.name}`).save();
    return { success: true, message: 'Employee dihapus permanen', data: { id } };
  }
}
