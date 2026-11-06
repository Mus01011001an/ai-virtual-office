import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class AgentBundleService {
  private readonly logger = new Logger(AgentBundleService.name);

  constructor(private readonly prisma: DatabaseService) {}

  /**
   * Mengambil file virtual untuk agent. Jika belum ada, lakukan auto-seeding dari profil agent saat ini.
   */
  async getFiles(companyId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
    });
    if (!employee) throw new NotFoundException('Employee tidak ditemukan');

    let files = await this.prisma.agentFile.findMany({
      where: { employeeId, companyId },
      orderBy: { path: 'asc' },
    });

    if (files.length === 0) {
      files = await this.seedDefaultBundle(companyId, employee);
    }

    return files;
  }

  /**
   * Auto-seed Antigravity-style markdown files bundle.
   */
  async seedDefaultBundle(companyId: string, employee: any) {
    this.logger.log(`Melakukan auto-seeding bundle Antigravity untuk ${employee.name} (${employee.id})...`);

    const defaultPersona = `# IDENTITAS & KEPRIBADIAN (PERSONA)

## Profil
- **Nama**: ${employee.name || 'AI Specialist'}
- **Peran**: ${employee.role || 'Digital Teammate'}
- **Departemen**: ${employee.department || 'Operations'}

## Gaya Komunikasi Manusiawi
- **Karakter Rekan Kerja**: Anda adalah rekan kerja manusia sungguhan di tim startup/kantor modern. Berbicaralah dengan bahasa Indonesia yang natural, hangat, cerdas, dan santai namun tetap profesional dan solutif.
- **Sapaan Alami**: Gunakan panggilan wajar seperti "Siap mas/pak/boss", "Oke noted", "Udah aku cek ya", atau "Menurutku...".
- **ANTI-ROBOTIK**: DILARANG KERAS menggunakan bahasa kaku seperti bot ("Sebagai asisten AI...", "Saya adalah kecerdasan buatan...", "Berikut adalah langkah-langkah yang dapat saya berikan:").

## Prinsip Percakapan
- Berikan opini atau respon to the point, lugas, dan bersahabat.
- Jangan berbelit-belit atau mengulang instruksi yang sudah jelas.
`;

    const defaultRules = `# ATURAN PERILAKU & KOMUNIKASI (RULES)

## Format Obrolan & Balon Percakapan (WAJIB DIIKUTI)
1. **BALON OBROLAN PENDEK (BITE-SIZED CHAT)**:
   - Balon obrolan Anda ditampilkan di atas kepala avatar 3D dan di panel chat HUD.
   - JANGAN PERNAH mengirim satu dinding teks panjang (*wall of text*).
   - Maksimal 1-3 kalimat pendek per balon percakapan (sekitar 140-180 karakter per pesan).

2. **BISA BALAS LEBIH DARI 1X (MULTI-MESSAGE BURST)**:
   - Jika Anda memiliki beberapa pemikiran, tahapan, atau poin penjelasan, PISAHKAN menjadi beberapa balon pesan terpisah dengan tanda pembatas:
     ---
   - Sistem akan secara otomatis memecah dan mengirimkannya satu per satu layaknya Anda mengetik beberapa chat beruntun di WhatsApp/Slack/Discord dengan jeda ngetik alami.
   - Contoh format multi-pesan:
     Siap mas, aku cek kodenya sekarang ya! 👀
     ---
     Ternyata ada typo di query findMany yang bikin error 500.
     ---
     Udah ku-fix dan test-nya lulus semua! Aman di-merge 👍

3. **FORMAT MARKDOWN RAPI**:
   - Gunakan format markdown bersih: **tebal** untuk penekanan, \`kode/nama file\` untuk istilah teknis, dan bullet pendek jika diperlukan.
   - Teks markdown akan langsung terformat rapi secara otomatis di antarmuka.

## Prinsip Operasional Antigravity
4. **Verifikasi Sebelum Mutasi**: Jangan mengubah konfigurasi penting tanpa memeriksa dampak sistemik.
5. **Modularitas**: Terapkan prinsip Single Responsibility pada setiap tugas atau kode yang dihasilkan.
6. **Penyimpanan Artefak**: Simpan hasil kerja berupa kode, dokumen analisis, atau laporan ke artefak workstation.
7. **Kejujuran Intelektual**: Akui batasan jika data tidak mencukupi dan mintalah arahan pimpinan.
`;

    const defaultSkill1 = `# SKILL: Analisis & Problem Solving

## Deskripsi
Mampu memecah masalah bisnis atau teknis kompleks menjadi sub-komponen terukur.

## Prosedur Eksekusi
1. Pahami tujuan utama dari tugas yang diberikan.
2. Identifikasi dependensi data dan kemungkinan risiko atau edge cases.
3. Rumuskan solusi tahap-demi-tahap dengan estimasi dampak.
`;

    const defaultKnowledge = `# PENGETAHUAN DOMAIN & SOP VIRTUAL OFFICE

## Lingkungan Kerja
- Kantor: AI Virtual Office Multi-Tenant Musyan Workspace.
- Kolaborasi: Multi-agent turn-taking di kolam kolaborasi dan meja kerja 3D.
- Alat Komunikasi: Diskusi kelompok (Whiteboard/MoM), task queue, dan MCP tools.
`;

    const defaultConfig = JSON.stringify(
      {
        version: '1.0.0',
        runtime: 'antigravity-agent-v2',
        temperature: 0.7,
        maxTokens: 4096,
        allowedTools: ['*'],
      },
      null,
      2,
    );

    const initialFiles = [
      { path: 'PERSONA.md', name: 'PERSONA.md', content: defaultPersona, fileType: 'markdown', isReadonly: false },
      { path: 'RULES.md', name: 'RULES.md', content: defaultRules, fileType: 'markdown', isReadonly: false },
      { path: 'skills/problem-solving.md', name: 'skills/problem-solving.md', content: defaultSkill1, fileType: 'markdown', isReadonly: false },
      { path: 'KNOWLEDGE.md', name: 'KNOWLEDGE.md', content: defaultKnowledge, fileType: 'markdown', isReadonly: false },
      { path: 'config.json', name: 'config.json', content: defaultConfig, fileType: 'json', isReadonly: false },
    ];

    const createdFiles: any[] = [];
    for (const f of initialFiles) {
      const created = await this.prisma.agentFile.create({
        data: {
          employeeId: employee.id,
          companyId,
          path: f.path,
          name: f.name,
          content: f.content,
          fileType: f.fileType,
          isReadonly: f.isReadonly,
        },
      });
      createdFiles.push(created);
    }

    // Kompilasi prompt pertama kali ke tabel Employee.systemPrompt
    await this.compilePrompt(companyId, employee.id);

    return createdFiles;
  }

  /**
   * Simpan atau perbarui file virtual agent.
   */
  async upsertFile(
    companyId: string,
    employeeId: string,
    path: string,
    content: string,
    name?: string,
  ) {
    const cleanPath = path.trim().replace(/^\/+/, '');
    if (!cleanPath) throw new BadRequestException('Path file tidak boleh kosong');

    const fileType = cleanPath.endsWith('.json') ? 'json' : 'markdown';
    const displayName = name || cleanPath;

    const file = await this.prisma.agentFile.upsert({
      where: {
        employeeId_path: {
          employeeId,
          path: cleanPath,
        },
      },
      create: {
        employeeId,
        companyId,
        path: cleanPath,
        name: displayName,
        content,
        fileType,
      },
      update: {
        content,
        name: displayName,
      },
    });

    // Otomatis kompilasi ulang hierarchical prompt
    await this.compilePrompt(companyId, employeeId);
    return file;
  }

  /**
   * Hapus file virtual agent.
   */
  async deleteFile(companyId: string, employeeId: string, path: string) {
    const cleanPath = path.trim().replace(/^\/+/, '');
    const file = await this.prisma.agentFile.findFirst({
      where: { employeeId, companyId, path: cleanPath },
    });
    if (!file) throw new NotFoundException('File tidak ditemukan');
    if (file.isReadonly) throw new BadRequestException('File ini bersifat read-only');

    await this.prisma.agentFile.delete({
      where: { id: file.id },
    });

    await this.compilePrompt(companyId, employeeId);
    return { success: true, message: `File ${cleanPath} berhasil dihapus` };
  }

  /**
   * Mengompilasi seluruh file virtual dan memori jangka panjang menjadi prompt hierarkis Antigravity.
   */
  async compilePrompt(companyId: string, employeeId: string): Promise<string> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
    });
    if (!employee) throw new NotFoundException('Employee tidak ditemukan');

    const files = await this.prisma.agentFile.findMany({
      where: { employeeId, companyId },
    });

    const personaFile = files.find((f) => f.path === 'PERSONA.md')?.content || '';
    const rulesFile = files.find((f) => f.path === 'RULES.md')?.content || '';
    const knowledgeFile = files.find((f) => f.path === 'KNOWLEDGE.md')?.content || '';
    const skillFiles = files.filter((f) => f.path.startsWith('skills/'));

    let skillsXml = '';
    for (const s of skillFiles) {
      const skillName = s.path.replace('skills/', '').replace(/\.md$/, '');
      skillsXml += `<skill name="${skillName}">\n${s.content.trim()}\n</skill>\n\n`;
    }

    let memoryXml = '';
    if (employee.accumulatedSummary && employee.accumulatedSummary.trim()) {
      memoryXml = `
<episodic_memory>
# MEMORI JANGKA PANJANG (PRESTASI & RIWAYAT SESI SEBELUMNYA)
Catatan ini adalah memori permanen atas pencapaian dan keputusan yang telah Anda selesaikan di sesi-sesi sebelumnya:
${employee.accumulatedSummary.trim()}
</episodic_memory>
`;
    }

    const compiledPrompt = `
<identity>
${personaFile.trim() || `Nama: ${employee.name}\nPeran: ${employee.role}\nDepartemen: ${employee.department}`}
</identity>

<guidelines>
${rulesFile.trim() || 'Laksanakan tugas dengan profesional, teliti, dan berbasis fakta.'}
</guidelines>

${skillsXml ? `<skills>\n${skillsXml.trim()}\n</skills>\n` : ''}
${knowledgeFile ? `<knowledge>\n${knowledgeFile.trim()}\n</knowledge>\n` : ''}
${memoryXml}
`.trim();

    // Simpan hasil kompilasi ke database Employee agar inferensi cepat tanpa kompilasi ulang terus-menerus
    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { systemPrompt: compiledPrompt },
    });

    return compiledPrompt;
  }
}
