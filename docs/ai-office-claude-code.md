# Office Baru — Menyambungkan Claude Code

Sejak 2026-11-27 Office Baru bekerja seperti video referensi: **otaknya Claude Code** di terminal Anda; office hanya
mendengar hook (0 token model, tanpa AI provider/API key). Sumber default Office Baru = *Claude Code (live hooks)*
bila sudah login; pilihan lain (AI team backend, Demo) di ⚙ dan diingat per browser (`localStorage avo-office-new-source`).

## Pasang (sekali per project)

1. Login di office (`/`), buka `/office-new/` → ⚙ → *Connect Claude Code* → **Copy install command**.
2. Jalankan di folder project. Perintahnya:
   `mkdir -p .claude && curl -fsSL <frontend>/office-new/claude-hook.mjs -o .claude/avo-office-hook.mjs && node .claude/avo-office-hook.mjs install --api <API_URL> --token <TOKEN>`
   Installer (`frontend/public/office-new/claude-hook.mjs install`, idempoten):
   - hook `SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, SubagentStop, Stop, Notification` →
     `.claude/settings.local.json` (berisi token, ditambahkan ke `.gitignore`);
   - perintah **`/office-setup`** → `.claude/commands/office-setup.md` (setara `/agent-office:setup` di video): Claude
     membaca project dan menulis sub-agent `.claude/agents/*.md`.
3. Jalankan `claude`, ketik `/office-setup`, lalu beri pekerjaan seperti biasa.

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
