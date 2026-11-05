import * as P from 'src/common/constants/permissions';

export interface PermissionDefinition {
  group: 'office' | 'members' | 'ai' | 'workforce' | 'discussion' | 'files' | 'audit';
  isCore?: boolean;
  key: string;
  label: string;
  description: string;
}

/** Registry seluruh permission (dipakai matriks role & seeding role default). */
export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  { group: 'office', isCore: true, key: P.P_OFFICE_READ, label: 'Lihat office', description: 'Masuk ke office 3D dan melihat profilnya.' },
  { group: 'office', isCore: true, key: P.P_OFFICE_UPDATE, label: 'Ubah office', description: 'Mengubah nama, timezone, dan jam kerja office.' },
  { group: 'office', isCore: true, key: P.P_OFFICE_DELETE, label: 'Hapus office', description: 'Mengarsipkan / menghapus office.' },
  { group: 'members', isCore: true, key: P.P_MEMBER_READ, label: 'Lihat anggota', description: 'Melihat daftar anggota office.' },
  { group: 'members', isCore: true, key: P.P_MEMBER_MANAGE, label: 'Kelola anggota', description: 'Mengundang, membuat akun teman, mengubah role, dan mengeluarkan anggota.' },
  { group: 'members', isCore: true, key: P.P_ROLE_MANAGE, label: 'Kelola role', description: 'Mengubah matriks permission tiap role.' },
  { group: 'ai', isCore: true, key: P.P_AI_PROVIDER_READ, label: 'Lihat AI provider', description: 'Melihat daftar provider & model (tanpa API key).' },
  { group: 'ai', isCore: true, key: P.P_AI_PROVIDER_MANAGE, label: 'Kelola AI provider', description: 'Menambah kredensial, test connection, memilih model.' },
  { group: 'workforce', isCore: true, key: P.P_EMPLOYEE_READ, label: 'Lihat employee', description: 'Melihat AI employee, status, dan aktivitasnya.' },
  { group: 'workforce', isCore: true, key: P.P_EMPLOYEE_WRITE, label: 'Rekrut & ubah employee', description: 'Merekrut dan mengubah konfigurasi AI employee.' },
  { group: 'workforce', isCore: true, key: P.P_EMPLOYEE_DELETE, label: 'Hapus employee', description: 'Menghapus AI employee.' },
  { group: 'workforce', isCore: true, key: P.P_EMPLOYEE_INSTRUCT, label: 'Kirim instruksi', description: 'Mengirim instruksi ke AI employee.' },
  { group: 'workforce', isCore: true, key: P.P_TASK_READ, label: 'Lihat task', description: 'Melihat task dan riwayatnya.' },
  { group: 'workforce', isCore: true, key: P.P_TASK_CREATE, label: 'Assign task', description: 'Memberi task ke AI employee.' },
  { group: 'workforce', isCore: true, key: P.P_TASK_CANCEL, label: 'Batalkan task', description: 'Membatalkan task yang belum selesai.' },
  { group: 'discussion', isCore: true, key: P.P_DISCUSSION_READ, label: 'Baca diskusi', description: 'Membaca riwayat diskusi.' },
  { group: 'discussion', isCore: true, key: P.P_DISCUSSION_SEND, label: 'Ikut diskusi', description: 'Mengirim pesan di diskusi.' },
  { group: 'discussion', isCore: true, key: P.P_SUMMON_USE, label: 'Panggil & kumpulkan', description: 'Memanggil employee atau mengumpulkan tim.' },
  { group: 'files', isCore: true, key: P.P_FILE_UPLOAD, label: 'Upload file', description: 'Mengunggah file & avatar.' },
  { group: 'audit', isCore: true, key: P.P_ACTIVITY_READ, label: 'Lihat audit log', description: 'Melihat jejak aktivitas user di office.' },
];

/** Izin yang tidak boleh diubah dari matriks biasa (belum ada di proyek ini). */
export const EXPLICIT_ONLY_PERMISSIONS: string[] = [];

const ALL = PERMISSION_DEFINITIONS.map((d) => d.key);

/** Role default per office — di-seed saat office dibuat (pola company.service Musyan). */
export const DEFAULT_OFFICE_ROLES: { name: string; description: string; isDefault: boolean; permissions: string[] }[] = [
  { name: 'Owner', description: 'Pemilik office — akses penuh', isDefault: false, permissions: [P.P_WILDCARD] },
  {
    name: 'Manager', description: 'Mengelola tim & AI employee', isDefault: false,
    permissions: ALL.filter((k) => k !== P.P_OFFICE_DELETE && k !== P.P_ROLE_MANAGE),
  },
  {
    name: 'Member', description: 'Bekerja bersama AI employee', isDefault: true,
    permissions: [
      P.P_OFFICE_READ, P.P_MEMBER_READ, P.P_AI_PROVIDER_READ, P.P_EMPLOYEE_READ, P.P_EMPLOYEE_INSTRUCT,
      P.P_TASK_READ, P.P_TASK_CREATE, P.P_DISCUSSION_READ, P.P_DISCUSSION_SEND, P.P_SUMMON_USE, P.P_FILE_UPLOAD,
    ],
  },
  {
    name: 'Viewer', description: 'Hanya melihat', isDefault: false,
    permissions: [P.P_OFFICE_READ, P.P_EMPLOYEE_READ, P.P_TASK_READ, P.P_DISCUSSION_READ],
  },
];
