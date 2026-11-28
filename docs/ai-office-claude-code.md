# Office Baru — Menyambungkan Claude Code

Sejak 2026-11-27 Office Baru bekerja seperti video referensi: **otaknya Claude Code** di terminal Anda; office hanya
mendengar hook (0 token model, tanpa AI provider/API key). Sumber default Office Baru = *Claude Code (live hooks)*
bila sudah login; pilihan lain (AI team backend, Demo) di ☰ dan diingat per browser (`localStorage avo-office-new-source`).

## Pasang (sekali per project)

1. Login di office (`/`), buka `/office-new/` → ☰ → *Connect Claude Code* → **Copy install command**.
2. Jalankan di folder project. Perintahnya:
   `mkdir -p .claude && curl -fsSL <frontend>/office-new/claude-hook.mjs -o .claude/avo-office-hook.mjs && node .claude/avo-office-hook.mjs install --api <API_URL> --token <TOKEN>`
   Installer (`frontend/public/office-new/claude-hook.mjs install`, idempoten):
   - hook `SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, SubagentStop, Stop, Notification` →
     `.claude/settings.local.json` (berisi token, ditambahkan ke `.gitignore`);
   - perintah **`/office-setup`** → `.claude/commands/office-setup.md` (setara `/agent-office:setup` di video): Claude
     membaca project dan menulis sub-agent `.claude/agents/*.md`.
3. Jalankan `claude`, ketik `/office-setup`, lalu beri pekerjaan seperti biasa.

## Dua arah: tugas & chat dari office (sejak 2026-11-28)

Office bisa memberi perintah ke Claude Code di komputer pemilik — tanpa API key, memakai akun Claude yang login di
`claude` komputer itu (Pro/Max untuk pemakaian sendiri/tim; produk untuk perusahaan lain wajib API key Console).

1. Di folder project yang sudah dipasang hook: `node .claude/avo-office-hook.mjs listen` (biarkan menyala).
   Token & API diambil dari `.claude/settings.local.json`. Opsi: `--team` (semua anggota office boleh memberi tugas;
   default hanya pemilik token), `--mode <permission-mode>` (default `acceptEdits`), `--allow "<allowedTools>"`
   (default npm run/test, npx tsc, git status/diff/log, ls), `--model`, `--claude <path>`.
2. Office: ☰ → *Connect Claude Code* langkah 4 menampilkan status runner; panel **New task** dan **Assign task**
   aktif selama runner online; chat ke karyawan (E / klik) dijawab Claude sebagai karyawan itu.

Alur: office `POST /office/claude-code/commands` `{kind: task|chat, text, to?, toName?}` → antrean di memori per office
(maks 20) → runner long-poll `GET /runner/next` (±25 dtk, sekaligus heartbeat) → `claude -p <prompt> --output-format
json --permission-mode … --allowedTools … [--resume <sesi>]` di folder project → `POST /commands/:id/result`
(`result` terakhir Claude) → SSE `claude.reply`. Aktivitasnya tetap tampil lewat hook biasa (karyawan berjalan,
tool call). Satu sesi Claude dipakai terus (Claude ingat percakapan office) sampai runner dihentikan; sesi yang tak bisa
dilanjutkan → sesi baru otomatis.

| Endpoint (`/office/claude-code`) | Siapa | Isi |
|---|---|---|
| `GET runner` | anggota office | `{online, busy, host, mine, allowTeam, queued}` |
| `GET commands` | anggota office | 30 perintah terakhir |
| `POST commands` | `employee.instruction:send` + pemilik runner (atau `--team`) | 503 bila runner offline, 403 bila bukan pemilik |
| `GET runner/next`, `POST runner/ping`, `POST runner/bye`, `POST commands/:id/result` | runner (token pemilik) | ping tiap 20 dtk selama `claude -p` bekerja; offline setelah 45 dtk tanpa kabar |

SSE: `claude.command` (antre/jalan), `claude.reply` (selesai/gagal), `claude.runner` (online/offline/sibuk → browser
mengambil ulang `GET runner`). Office: chat menunggu jawaban hingga 4 menit (lalu "masih dikerjakan", jawaban datang
sebagai pesan baru); hasil tugas masuk **Team channel** dari manajer + log *Done/Failed*. Prompt runner diawali
`[Agent Office]`; office menampilkan teks permintaannya saja.

### Runner sebagai layanan macOS (selalu menyala)

`~/Library/LaunchAgents/com.musyan.agent-office-runner.plist` (dipasang 2026-11-28 di Mac mini untuk folder
`ai-virtual-office`, office Testing): `node <project>/.claude/avo-office-hook.mjs listen`, `WorkingDirectory` = folder
project, `PATH` berisi folder `node`/`claude` (nvm), `RunAtLoad` + `KeepAlive`, log `~/Library/Logs/agent-office-runner.log`.
Nyala saat pengguna login; `claude` memakai login di Keychain.

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.musyan.agent-office-runner.plist   # nyalakan
launchctl bootout gui/$(id -u)/com.musyan.agent-office-runner                                  # matikan
tail -f ~/Library/Logs/agent-office-runner.log                                                 # lihat aktivitas
```

Token kedaluwarsa (log: "Ditolak office"): jalankan ulang perintah install dari Office Baru di folder project.

Catatan: antrean di memori (restart backend = antrean kosong, runner menyambung lagi sendiri). Claude bisa mengedit
file & menjalankan perintah yang diizinkan di folder itu — jalankan runner hanya di folder project yang memang boleh
diubah.

## Yang dikirim hook (stdin Claude Code → `POST /office/claude-code/events`)

| Event | Tambahan dari script |
|---|---|
| `SessionStart`, `UserPromptSubmit` | `team` (`.claude/agents/*.md` → `name`), `skills` (`.claude/skills/*/SKILL.md` project + `~/.claude/skills`, maks 9) |
| `PostToolUse(Failure)`, `SubagentStop`, `Stop` | `tokens` = jumlah token sejak prompt terakhir (ekor transcript ≤4 MB, dedup per pesan) |
| `Stop` | `last_message` = kalimat terakhir Claude (untuk *WAITING FOR YOUR OK*) |
| `Notification` | `message` (mis. Claude minta izin) |

`tool_response` dan `transcript_path` tidak dikirim. Timeout 1 dtk, selalu exit 0 (Claude tidak melambat).

## Tampilan

- **Overview / Walk in** (video 1): sesi utama = Manager (Michael), sub-agent duduk di kursi sesuai peran; belum ada
  `.claude/agents` → tim default **Michael · Emma · Jake · Ryan**. Tool call live, error = merah, `Done ✅`.
- **Agent HQ** (video 2): "CLAUDE · 1 agent · N skills", satu meja per skill. Skill tidur sampai Claude memanggil tool
  `Skill`; tool call berikutnya tampil di layar skill itu dan di *Tool calls · live log*; tile TIME / TOOL CALLS /
  SKILLS OPEN / TOKENS; *WAITING FOR YOUR OK* bila `Notification` atau jawaban terakhir meminta persetujuan
  (dijawab di terminal). Tanpa skill → satu meja "claude".

## Gunanya AI provider & API key

Hanya untuk sumber **AI team (backend)**: AI employee yang dijalankan server AVO (tanpa terminal, terjadwal, untuk
klien). Mode Claude Code tidak memakainya.
