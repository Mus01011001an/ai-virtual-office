import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

export interface VoiceProfileDto {
  pitch?: number;
  rate?: number;
  gender?: 'male' | 'female' | 'neutral';
  preferredVoice?: string;
  provider?: 'webspeech' | 'openai' | 'elevenlabs';
}

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(private readonly prisma: DatabaseService) {}

  /**
   * Mengambil daftar profil vokal seluruh karyawan di kantor ini
   */
  async getVoiceProfiles(companyId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { companyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        role: true,
        department: true,
        voiceProfile: true,
      },
      orderBy: { deskIndex: 'asc' },
    });

    return employees.map((e) => ({
      employeeId: e.id,
      name: e.name,
      role: e.role,
      department: e.department,
      profile: e.voiceProfile,
    }));
  }

  /**
   * Memperbarui profil suara karyawan (pitch, rate, gender, preferred voice)
   */
  async updateVoiceProfile(companyId: string, employeeId: string, dto: VoiceProfileDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
    });

    if (!employee) {
      throw new NotFoundException(`Karyawan dengan ID ${employeeId} tidak ditemukan.`);
    }

    const currentProfile = (employee.voiceProfile as any) || {};
    const updatedProfile = {
      ...currentProfile,
      ...dto,
    };

    const updated = await this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        voiceProfile: updatedProfile,
      },
      select: {
        id: true,
        name: true,
        voiceProfile: true,
      },
    });

    return updated;
  }
}
