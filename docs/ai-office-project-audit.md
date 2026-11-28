# AI Office — Audit Project (2026-11-27)

Ringkasan kondisi repo `ai-virtual-office` sebelum Office Baru dibangun. Detail arsitektur lama: `CLAUDE.md`, `PLAN.md`, `BACKEND_PLAN.md`.

## Stack

| Bagian | Teknologi | Jalankan |
|---|---|---|
| `frontend/` | React 19, R3F 9, drei 10, Rapier, postprocessing, zustand 5, Tailwind 4, Vite 8, three r187 | `npm run frontend:dev` → :5173 |
| `backend/` | NestJS + Prisma 7 (PostgreSQL remote), better-auth `bearer()`, SSE | `npm run backend:dev` → :8010, Swagger `/api/docs` (Node 22) |
| Gate | `npm run typecheck` (strict, `noUnusedLocals`) | tidak ada test runner frontend |

## Office lama (tidak diubah)

- **Entry**: `frontend/index.html` → `src/main.tsx` → `src/App.tsx`. Tidak ada router; seluruh app = office lama (route `/`).
- **3D**: `office/layout.ts` (sumber kebenaran), `architecture.ts`/`furniture.ts`/`batch.ts` (geometri prosedural),
  `characters/Agent.tsx` + `Humanoid.tsx` (karakter blocky), `camera/CameraRig.tsx` (FPS/TPS/ISO), Rapier player.
- **State**: `state/store.ts` (zustand, persist `avo-office`), `state/runtime.ts` (per-frame), `state/remote.ts` (API + SSE).
- **HUD**: `hud/*` gaya blocky ceria (Fredoka, amber `#f4a259`), bahasa Indonesia.

## Backend yang dipakai ulang

| Kebutuhan Office Baru | Sudah ada | Path |
|---|---|---|
| Login & token | better-auth bearer, token di `localStorage` (`lib/api.ts getToken`) | `backend/src/lib/auth.ts` |
| Office aktif | `customSession.activeCompanyId`, `POST /auth/switch-company` | `system/` |
| Daftar agen | `GET /office/employees` (status, currentTask, currentTool, progress, role, skills, appearance) | `office/employees` |
| Beri tugas | `POST /office/employees/:id/tasks` → otomatis `AgentRuntimeService.processTask` | `office/tasks` |
| Eksekusi agen nyata | loop ≤6 langkah, tool call, approval gate, brain context | `office/ai-engine/agent-runtime.service.ts` |
| Delegasi manager → tim | tool `delegate_task` (source `delegation:N`) | `office/ai-engine/tools` |
| Realtime | SSE `GET /office/stream?token=` — `employee.updated`, `task.event`, `activity.created`, `approval.requested/decided`, `discussion.message`, `brain.entry` | `office/realtime` |
| Persetujuan | `GET /office/approvals`, `POST :id/approve|reject` | `office/approvals` |
| Riwayat agen | `GET /office/employees/:id/activity`, `GET /office/tasks/:id/events` | |
| Jawaban AI bebas | `POST /office/ai-engine/generate {employeeId,prompt}` | `office/ai-engine` |

Status employee (enum `EmployeeStatus`): `IDLE WORKING THINKING TOOL_EXECUTING WAITING ON_BREAK IN_MEETING COLLABORATING OFFLINE`.
Task: `QUEUED EXECUTING WAITING COMPLETED FAILED CANCELLED`.

## Yang belum ada (dibangun untuk Office Baru)

1. **Ingest hook Claude Code** — tidak ada endpoint untuk event `PreToolUse`/`SubagentStop`/dst. → modul baru
   `office/claude-code` (in-memory ring buffer per office + SSE `claude.event`, tanpa tabel baru).
2. **Halaman/route kedua** — Vite hanya punya satu entry → entry kedua `frontend/office-new/index.html`.

## Database

Tidak ada perubahan schema. Office Baru hanya membaca/menulis lewat endpoint yang sudah ada; event Claude Code
disimpan di memori (hilang saat backend restart — disengaja, sama seperti plugin referensi).

## Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Office lama rusak | Office Baru di folder & entry HTML terpisah (`src/office-new/`); file lama tidak disentuh selain `vite.config.ts` (input build) |
| n8ao crash di three r187 | N8AO dari referensi dibuang |
| Aset Synty tidak ada | fallback prosedural CC0 + deteksi otomatis bila model Synty dipasang |
| Bundle besar | Office Baru chunk terpisah; office lama tidak memuatnya |
