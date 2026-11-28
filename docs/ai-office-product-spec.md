# Office Baru — Spesifikasi Produk

Rekonstruksi produk di [ai-office-reference-analysis.md](ai-office-reference-analysis.md). Office lama (`/`) tetap apa adanya.

## Konsep

Gedung kantor 3D malam hari (10 ruangan, ±35 staf NPC) tempat **5 agen AI** terlihat bekerja. Semua yang dilakukan
agen berasal dari eksekusi nyata: AI employee backend AVO **atau** sesi Claude Code (hooks). Pengguna mengawasi dari
atas (Overview), masuk ke gedung (Walk in), atau membuka **Agent HQ** untuk log tool call.

## Route & entry

| Route | Isi |
|---|---|
| `/` | **Diarahkan ke `/office-new/`** (sejak 2026-11-27, office lama disembunyikan; skrip kecil di `frontend/index.html`) |
| `/?legacy` | Office lama (kode utuh, tidak ditautkan dari mana pun; untuk admin: Katalog AI, provider, anggota) |
| `/office-new/` | Office Baru. Query: `?source=avo\|claude-code\|demo`, `?cc0` (paksa kit CC0), `?debug=props`. Dev: https://office.musyan.my.id/office-new/ |

Login memakai token yang sama dengan office lama (`localStorage avo-token`, office aktif = `activeCompanyId` sesi).
**Fokus Claude (2026-11-27):** UI hanya memakai sumber **Claude Code**. Pintu masuk Office Baru sendiri (`ui/Gate.tsx`):
belum login → *Sign in*; tanpa office aktif atau `?offices` → *Your offices* (Open / Create, office baru dibuat dengan
`experience: 'new'`). ⚙ berisi nama office, *Switch office*, *Sign out*, *Connect Claude Code*. Sumber AI team / Demo
tidak tampil di UI — hanya lewat `?source=avo` / `?source=demo` (admin/uji).
Tanpa login → layar *Sign in* Office Baru.

### Memilih Kantor lama / Kantor baru (sejak 2026-11-27)

Tiap office punya **jenis kantor** (`classic` | `new`), disimpan sebagai flag `office-new` di `Company.modules`
(kolom lama, tanpa perubahan schema; `backend/src/system/company/office-experience.ts`).

| Tempat | Perilaku |
|---|---|
| Daftar kantor (`/`, `hud/Overlay.tsx`) | Tombol hijau = masuk sesuai jenis office ("Masuk" / "Masuk · baru"); tautan *Buka di Kantor baru/lama →* membuka jenis lainnya tanpa mengubah jenis office |
| **+ Buat kantor** (`hud/Modals.tsx`, dulu "+ Kantor baru") | Field *Jenis kantor*: **Kantor baru** (default) atau Kantor lama; Kantor baru langsung membuka `/office-new/` (template demo disembunyikan — Office Baru punya Demo sendiri di ⚙) |
| Office Baru ⚙ | Nama office aktif + *← All offices* (kembali ke daftar) |
| Office Baru *Agent activity* | **+ AI** → daftar Katalog AI → *Hire* (`POST /office/agent-catalog/:id/hire`) |

API: `POST /system/companies {experience}`, `PATCH /system/companies/current {experience}` (izin office.update),
`GET /auth/workspaces` → `experience`. Buka Office Baru dari daftar = `POST /auth/switch-company` lalu ke `/office-new/`.

## Sumber agen (⚙ → Agent source)

| Sumber | Data | Aksi |
|---|---|---|
| **Claude Code (live hooks)** — default (seperti video) | `POST /office/claude-code/events` dari `frontend/public/office-new/claude-hook.mjs` → SSE `claude.event` | hanya mengamati (0 token); tugas diberikan di terminal; setup lihat [ai-office-claude-code.md](ai-office-claude-code.md) |
| **AI team (backend)** | `GET /office/employees`, `/office/tasks`, SSE `office/stream` | New task → task ke manager (delegasi nyata `delegate_task`); tugas langsung per agen; chat; butuh AI provider + API key |
| **Demo team** | `SimulationAdapter` referensi | semua berlabel DEMO |

Kursi: 5 (Manager, Research, Developer, Designer, QA). AI backend dipetakan menurut peran (`seatTeam`, regex peran);
AI ke-6 dst. tidak punya avatar tetapi aktivitasnya tetap masuk log bila diberi kursi lewat pengaturan berikutnya.

## Layar

1. **Overview** — kamera isometrik + chip ruangan; HUD kiri (statistik, project, *New task for the team*, *Agent
   activity*, *Task timeline*, *Recent activity*), kanan (*Agent communication* / panel agen terpilih).
2. **Walk in** — mulai di trotoar depan pintu (satpam, pintu otomatis), resepsionis menyapa & `E` → panel Reception;
   WASD/Shift/Space/E/V/Esc; dekati agen → `[E] to talk to …` → chat window (chip cepat + input + mic); E di kursi
   meeting untuk duduk. Atap tampil, objek penghalang kamera tembus pandang. iPad: kemudi mouse + joystick (tanpa Pointer Lock).
3. **Agent HQ** — ruang gelap. Sumber Claude Code: "CLAUDE · 1 agent · N skills", satu meja per skill
   (`.claude/skills`), skill bangun saat dipanggil, kartu prompt, tile TIME/TOOL CALLS/SKILLS OPEN/TOKENS, live log,
   *WAITING FOR YOUR OK* (jawab di terminal). Sumber AI team: satu meja per agen + tombol OK/Reject approval backend.

## Alur kerja utama (backend)

1. User menulis tugas → **Start** → task untuk manager (`POST /office/employees/:id/tasks`).
2. Tim kickoff di ruang rapat ±9 dtk (dipicu event nyata *project dimulai*), lalu kembali ke meja.
3. `AgentRuntimeService` menjalankan manager; `delegate_task` membuat task untuk rekan → pesan
   `Manager → Nama: judul` di *Agent communication*, agen berjalan ke meja, status Working.
4. Tiap `employee.updated` (THINKING/TOOL_EXECUTING/WAITING) dan `activity.created` (tool, error, done) tampil live:
   pill status, progress bar, log, gelembung, monitor.
5. Task selesai → `Done: … ✅`; gagal → pill merah *Error* + baris merah; approval → *WAITING FOR YOUR OK* (HQ).
6. Project 100 % saat task root + semua delegasi selesai.

## Bertanya ke agen

Chip cepat (*What are you doing now? / Any problems? / How far along are you? / What's next?*) dijawab dari state live
(task, progress, tool, antrean, error terakhir) — tanpa token. Pertanyaan bebas → `POST /office/ai-engine/generate`
dengan status live agen sebagai konteks (model agen itu sendiri); bila model belum terhubung, jawaban state.

## Bahasa UI

Label HUD mengikuti referensi (Inggris) agar identik dengan video; jawaban agen mengikuti bahasa pertanyaan
(Indonesia/Inggris). Pengecualian sadar dari aturan "UI Indonesia" di `CLAUDE.md`, khusus `/office-new/`.

## Di luar cakupan / belum

- Aset Synty & animasi Mixamo asli (berbayar/login) → kit CC0; pipeline drop-in tersedia (lihat arsitektur §5).
- Lebih dari 5 kursi agen (referensi juga 5).
- Riwayat event Claude Code permanen (buffer memori 400 event/office, hilang saat backend restart).

## HUD minimalis — layar bersih (2026-11-27)

Default: hanya **top bar mini** dan **dock ikon** di kiri; 3D office memenuhi layar.

| Elemen | Isi | Akses |
|---|---|---|
| Pil status | logo · titik live (hijau/kuning/merah) · `bekerja/total` agen · DEMO | selalu |
| Mode | ikon Overview / Walk in / Agent HQ (label hanya yang aktif) | klik |
| Rooms (Overview) | daftar ruangan untuk terbang kamera | klik 📍 |
| 1st/3rd (Walk in) | satu tombol | klik / `V` |
| Dock kiri | New task (`N`), Team (`T`), Tasks & progress (`P`), Team channel (`C`), Recent activity (`L`) — satu panel terbuka, tutup dengan ✕ / Esc / klik ikon lagi; badge: agen bekerja (merah bila ada error), pesan baru | klik / tombol |
| Toast | pesan tim terbaru 4 dtk di bawah dock (klik → buka Team channel) | otomatis |
| ⚙ | office, Switch office, Sign out, Connect Claude Code, camera shots, baca balasan | klik |
| Sembunyikan UI | `H` atau ikon mata: semua HUD & label 3D hilang, tersisa tombol samar "👁 H" (crosshair, petunjuk E, joystick sentuh tetap) | `H` |
| Petunjuk kontrol walk-in | tampil 8 dtk saat masuk, lalu jadi tombol *Controls* | klik |

Kode: `ui/TopBar.tsx`, `ui/Dock.tsx`, `ui/common.tsx` (`Icon`, `Section.onClose`), `store/useOffice.ts` (`panel`, `uiHidden`).
Alasan: panel statistik, komunikasi, dan timeline yang selalu terbuka menutupi ±45 % layar dan mengganggu.
