# Virtual AI Office — Implementation Plan

Sumber: `helloworld.md` + tambahan requirement user:
- Mode kamera bisa diganti: **First-person (dari mata)** ↔ **Third-person (di atas/belakang kepala, ala Roblox)** ↔ **Isometric/Top-down**.
- **Multiplayer**: orang lain bisa login (pakai credential yang diberikan owner) dan masuk ke office yang sama, saling terlihat.
- **Tombol "Sesi Baru"** → menambah **room baru** di office.
- Ruangan **BESAR**, langit-langit tinggi (bisa lihat ke atas), **jam dinding** yang hidup.
- **Nama di atas kepala** tiap AI agent (dan tiap user).

Status repo: kosong (hanya `helloworld.md`), belum git → greenfield.

---

## 1. Tech Stack

| Layer | Pilihan |
|---|---|
| Monorepo | Folder per app + root Dev CLI (pola musyan-workspace, `npm --prefix`) |
| Frontend | React 18 + TypeScript + Vite, TailwindCSS, shadcn/ui, Zustand, TanStack Query, React Router |
| 3D | three.js, React Three Fiber, Drei, `@react-three/rapier` (physics + character controller), `recast-navigation` (NavMesh NPC), `@react-three/postprocessing` |
| Backend API | NestJS (REST + WebSocket Gateway via Socket.IO + Redis adapter) |
| Worker | NestJS standalone app + BullMQ (AI worker, tool worker, scheduler) |
| DB | PostgreSQL 16 + Prisma |
| Cache/Queue/Presence | Redis 7 |
| Object storage | MinIO (S3-compatible) |
| Sandbox tool | Docker container per eksekusi (dockerode), network/FS dibatasi |
| Validasi shared | Zod schema di `packages/shared` (dipakai FE + BE) |
| Test | Vitest, Jest (Nest), Playwright (E2E) |
| Dev infra | docker-compose (postgres, redis, minio) |

## 2. Struktur Repo (pola musyan-workspace)

Tiap app = folder di root dengan `package.json` sendiri; root hanya berisi CLI (`dev.mjs`) dan script `npm --prefix`.

```
ai-virtual-office/
├─ frontend/        # React + R3F (3D office + dashboard)        ← Phase 1 (selesai)
├─ backend/         # NestJS REST + WS gateway + Prisma           ← Phase 2
├─ worker/          # BullMQ workers (agent runtime, tools, scheduler) ← Phase 3
├─ shared/          # types, zod schemas, kontrak event WS (dipakai FE+BE)
├─ skills/          # SKILL.md bawaan (DevOps, FE, BE, QA, General)
├─ e2e-playwright/  # E2E skenario A–G
├─ docs/            # architecture, ERD, API spec, security model
├─ scripts/         # script ops
├─ docker-compose.yml
├─ dev.mjs          # Dev CLI (services, typecheck, git)
└─ package.json     # npm run dev | push | commit | git
```

## 3. Arsitektur Sistem

```
Browser (web) ──REST──▶ api ──▶ Postgres
   │  ▲                  │ ──▶ Redis (BullMQ, presence, pub/sub)
   │  └──── Socket.IO ◀──┤
   │                     ▼
   │                 BullMQ queues
   │                     ▼
   │                  worker ──▶ AI Providers (server-side only)
   │                     │   ──▶ Tool sandbox (Docker)
   │                     └── publish event ke Redis ──▶ api gateway ──▶ browser
```

- HTTP handler tidak pernah menjalankan AI task panjang → enqueue ke BullMQ.
- Worker publish event (`task.*`, `agent.status`, `tool.output`, `ai.token`) ke Redis pub/sub → gateway broadcast ke room Socket.IO `office:{officeId}` dan `employee:{id}`.
- Status employee = **derived** dari state eksekusi (bukan animasi acak). Satu sumber kebenaran: tabel `agent_sessions` + `employees.status` yang hanya di-update oleh runtime/scheduler.
- Crash recovery: job BullMQ dengan `attempts`, heartbeat worker di Redis; job orphan → status `FAILED`/`QUEUED` ulang, tidak pernah `COMPLETED` palsu.

## 4. Multi-Tenant, Login & Multiplayer (REQUIREMENT BARU)

### 4.1 Model akses
- `User` bisa menjadi member di beberapa `Office` (office = company).
- Role per office: **OWNER (CEO)**, **MANAGER** (assign task, approve), **MEMBER** (lihat + kirim instruksi ke agent tertentu), **VIEWER/GUEST** (jalan-jalan & melihat saja).
- Owner bisa:
  1. **Buat akun langsung** (username + password sementara) → kasih credential ke teman, wajib ganti password saat login pertama.
  2. **Invite link** (token sekali pakai, expiry, role terpasang).
  3. Cabut akses / ubah role kapan saja.
- Auth: email/username + password (argon2), JWT access (15 m) + refresh token httpOnly cookie, RBAC guard di REST & WS.

### 4.2 Presence realtime
- Saat masuk office → join Socket.IO room `office:{id}`.
- Client kirim transform avatar (`pos`, `rotY`, `anim`, `cameraMode`) 15 Hz; server throttle + broadcast; client interpolasi (buffer 100 ms) supaya halus.
- Presence disimpan di Redis (TTL heartbeat) → daftar "Who's online" + mini-map.
- Avatar user lain tampil dengan **nama + badge role** di atas kepala (warna beda dari AI agent).
- Fitur sosial ringan: chat teks proximity / global, emote (wave), "follow user".
- Konflik aksi (2 orang assign task ke agent yang sama) ditangani di backend via transaksi + optimistic version.

## 5. Sesi Baru = Office Terpisah (DIPUTUSKAN)

Klik **"+ Sesi Baru"** → membuat **instance office baru yang terpisah** (gedung/world 3D sendiri).
1. Form: nama office, template layout (Startup kecil / Tech HQ besar / kosong), timezone & jam kerja, salin agent dari office lain (opsional).
2. Backend membuat `office` baru + layout default + desk; pembuat otomatis OWNER.
3. Tiap office terisolasi: agent, task, skill assignment, provider credential (bisa share dari akun), member, chat, Socket.IO room `office:{id}` sendiri.
4. **Office switcher** di HUD/dashboard + "lobby" pemilihan office setelah login (kartu: nama, jumlah agent, siapa online).
5. Pindah office = transisi "keluar pintu → loading → masuk pintu office lain".
6. Office bisa di-archive/hapus (soft-delete), duplikasi (clone layout + agent tanpa history).
7. Akses member per office: teman bisa diundang ke office A saja, tidak ke office B.

## 6. Lingkungan 3D

### 6.1 Skala & layout (BESAR)
- Lobby/atrium utama **tinggi ±12–15 m (2–3 lantai)**, skylight kaca, mezzanine/balkon lantai 2 yang bisa dinaiki tangga.
- Open workspace luas (≥ 40×30 m), jendela besar floor-to-ceiling, view kota (skybox HDRI).
- Area: Entrance, Reception, CEO Office, Open Workspace, Meeting Room, Break Room, Kitchen, Server/DevOps Room (rak server dengan LED berkedip sesuai load worker nyata), Collaboration area, Rest area, outdoor terrace (opsional). Layout modular (grid room) supaya bisa diperluas.
- Langit-langit detail (lampu gantung, ducting, panel akustik) karena user bisa melihat ke atas.
- Gaya: modern professional, warm lighting, low-poly-clean (bukan kartun).

### 6.2 Jam dinding
- Jam analog 3D di tiap room + **jam besar** di atrium + jam digital di reception.
- Waktu = server time ⊕ timezone company (sync offset via WS saat connect).
- Jarum detik bergerak halus; indikator kecil: "Lunch in 23 min", "Office closes 18:00".
- Lighting mengikuti jam (siang terang, sore warm, malam lampu kantor nyala, di luar jam kerja redup).

### 6.3 Kamera (REQUIREMENT BARU) — toggle tombol `V` / tombol UI
| Mode | Perilaku |
|---|---|
| **First-person** | Kamera di mata avatar, pointer-lock, mouse look bebas termasuk ke atas (pitch ±89°), head-bob halus, crosshair untuk klik interaksi |
| **Third-person (Roblox)** | Kamera orbit di belakang/atas kepala, klik kanan drag untuk rotasi, scroll zoom; zoom in penuh → otomatis jadi first-person (seperti Roblox), anti-clip ke dinding (raycast) |
| **Isometric / Overview** | Kamera atas miring, pan/zoom, klik lantai → avatar jalan ke sana (pathfinding) |
- Transisi antar-mode di-lerp (tidak patah).
- Movement: WASD/Arrow, Shift lari, Space lompat, E interaksi; collision via Rapier capsule controller.
- Preferensi mode disimpan per user.

### 6.4 Karakter
- Avatar modular low-poly (rigged GLB, satu skeleton, variasi warna baju/rambut/aksesori dari seed employee ID → unik & deterministik).
- Animasi: idle, walk, run, sit, typing, thinking (tangan di dagu + "..."), break (minum kopi), waiting (lihat jam), meeting (gesture), offline (jalan keluar).
- **Name tag di atas kepala** (Drei `<Html>`/`<Text>` billboard):
  - Nama (besar), Role (kecil), dot status berwarna, ikon tool yang sedang jalan (mis. 🐳 `docker ps`), progress bar task tipis.
  - Fade berdasarkan jarak, occlusion di balik dinding, LOD (jauh → hanya nama).
- Monitor di desk menampilkan **render tekstur live** (canvas texture) dari activity/terminal nyata.

### 6.5 Aset 3D gratis (DIPUTUSKAN)
Prioritas lisensi CC0 (bebas, tanpa atribusi). Lisensi tiap file dicatat di `frontend/public/assets/LICENSES.md`.
| Kebutuhan | Sumber |
|---|---|
| Karakter rigged + animasi (idle/walk/sit/type) | Quaternius (Ultimate Modular Characters / Universal Animation Library), KayKit |
| Furnitur kantor, komputer, dekorasi | Kenney (Furniture Kit), Quaternius, KayKit, Poly Pizza (filter CC0) |
| Model semi-realistis (tanaman, kursi, lampu) | Poly Haven (CC0) |
| Tekstur PBR (lantai kayu, beton, kaca, karpet) | ambientCG, Poly Haven (CC0) |
| HDRI langit/kota untuk jendela | Poly Haven (CC0) |
| Struktur bangunan (dinding, atrium, tangga, mezzanine) | Dibuat sendiri (procedural geometry di R3F) supaya skalanya pas & ringan |
- Pipeline: `gltf-transform` (Draco/Meshopt + KTX2) → aset kecil & cepat.
- Konsistensi gaya: palet warna & material diseragamkan (override material) agar aset dari sumber berbeda tidak terlihat campur aduk.

### 6.6 Performa
- Instancing untuk meja/kursi/tanaman, KTX2 + Draco untuk aset, LOD, frustum culling, baked lightmap untuk statis, shadow hanya directional utama.
- Target 60 fps di laptop M1 dengan 30 agent + 10 user online.

## 7. Backend Domain

### 7.1 AI Provider abstraction (`packages/ai-providers`)
```ts
interface AIProvider {
  id: string;
  generateResponse(req: ChatRequest): Promise<ChatResponse>;
  streamResponse(req: ChatRequest): AsyncIterable<StreamChunk>;
  executeToolCall(call: ToolCall): Promise<ToolResult>; // normalisasi format tool-call per provider
  getAvailableModels(): Promise<ModelInfo[]>;
  validateCredentials(): Promise<boolean>;
  getUsage(res: ChatResponse): Usage;
  getModelCapabilities(model: string): Capabilities;
}
```
- Adapter: Anthropic, Google Gemini, OpenAI, DeepSeek, OpenRouter, OpenAI-compatible generic. Registry plugin-based.
- Credential: AES-256-GCM (master key dari env/KMS), hanya didekripsi di worker; FE hanya lihat `sk-...last4`.
- Retry (exponential backoff + jitter), timeout, rate limit per credential (Redis token bucket), circuit breaker → status employee `WAITING`/`FAILED` (Scenario G).
- Pricing table per model → `usage_records` (token, cost).

### 7.2 Skills
- Format `SKILL.md` (frontmatter: name, version, description, permissions, tools, dependencies) + reference files.
- Import dari folder lokal / git repo; versioning (`skill_versions`).
- **Skill selection**: deskripsi skill di-embed / keyword match + LLM router ringan → hanya skill relevan yang dimuat ke context.

### 7.3 Tools
- Registry: terminal/shell, file ops, git, GitHub, HTTP, web search, Postgres query (read-only default), Docker, SSH, browser (Playwright), custom.
- Tiap tool: zod input schema, handler, permission, timeout, risk level (`safe` / `sensitive` / `destructive`).
- Eksekusi shell/docker/ssh di **container sandbox**; allowlist command per employee; destructive → buat `approval` dan task `WAITING` sampai di-approve OWNER/MANAGER.
- Semua eksekusi → `tool_executions` + `audit_logs`; stdout/stderr di-stream ke terminal workstation.

### 7.4 Agent runtime (`packages/agent-runtime`)
Load config → pilih skill → load tool terotorisasi → build context → **plan** → loop eksekusi (model ↔ tool) → log tiap step → stream event → simpan artifact (MinIO) → `COMPLETED`/`FAILED`.
- Budget: max steps, max tokens, max cost, max durasi, max kedalaman delegasi (default 2), deteksi loop delegasi.
- Instruksi tambahan CEO saat jalan → di-inject ke step berikutnya.
- Safe-pause checkpoint di antara step (untuk break).

### 7.5 Task lifecycle
`CREATED → QUEUED → ASSIGNED → ACCEPTED → PLANNING → EXECUTING ⇄ WAITING → REVIEW → COMPLETED` + `FAILED | CANCELLED | PAUSED | BLOCKED`. State machine eksplisit; tiap transisi = row `task_events` dalam transaksi.

### 7.6 Schedule
- Scheduler job tiap menit (BullMQ repeatable): hitung status jadwal per employee (timezone company, override individual, holiday, overtime).
- Masuk break → stop terima task baru, tunggu checkpoint aman → `ON_BREAK` → event `agent.move{target: break_room}`.
- Di luar jam kerja → `OFF_DUTY` (karakter jalan keluar), task antre sampai buka.

### 7.7 Multi-agent collaboration
- PM agent memecah project → subtasks + dependencies (DAG); runtime menjalankan sesuai DAG.
- Shared context per project/sesi; pesan agent-to-agent (`agent_messages`); event `COLLABORATING` → karakter berkumpul di collab area / room sesi.

## 8. Database (Prisma) — entitas

Dari prompt: `users, companies(offices), departments, employees, employee_skills, skills, skill_versions, ai_providers, ai_models, credentials, employee_tools, tools, employee_schedules, break_schedules, office_locations, desks, tasks, task_assignments, task_dependencies, task_events, agent_sessions, agent_messages, agent_execution_steps, tool_executions, approvals, artifacts, usage_records, audit_logs, office_events`

**Tambahan:**
- `office_members` (userId, officeId, role, mustChangePassword)
- `invitations` (token hash, role, expiresAt, usedAt)
- `refresh_tokens`
- `offices` (= companies; nama, template, timezone, status ACTIVE/ARCHIVED, createdBy)
- `rooms` (officeId, type, gridX, gridY, rotation, theme)
- `user_preferences` (cameraMode, avatarConfig, theme)
- Kolom `is_demo` di entitas utama untuk membedakan data demo.
- Log besar (step, tool output) di tabel terpisah / MinIO, bukan di `employees`. Index pada `(employeeId, createdAt)`, `(taskId, createdAt)`, soft delete `deletedAt`.

## 9. API (ringkas)

REST `/api/v1`:
- `auth/*` (login, refresh, logout, change-password, accept-invite)
- `offices/:id/members`, `offices/:id/invitations`
- `offices` (CRUD, archive, duplicate) → tombol Sesi Baru
- `rooms`, `desks`, `layout`
- `employees` (CRUD, duplicate, disable), `employees/:id/{skills,tools,schedule,activity,performance}`
- `skills` (CRUD, import, versions), `tools`, `providers` (CRUD credential, test, models)
- `tasks` (CRUD, assign, pause, cancel, retry, instruct), `approvals` (approve/reject)
- `analytics/*`, `audit-logs`, `settings`

WS events (Socket.IO, namespace `/office`):
- Client→Server: `presence:update`, `chat:send`, `emote`
- Server→Client: `presence:snapshot|join|leave|update`, `agent:status`, `agent:move`, `task:event`, `tool:output`, `ai:stream`, `approval:new`, `office:updated`, `clock:sync`

Spec lengkap → OpenAPI auto-generate dari NestJS (`/docs`).

## 10. Frontend Pages

1. **3D Office** (default setelah login) — HUD: mode kamera, mini-map, online users, jam, tombol **+ Sesi Baru**, notifikasi approval.
2. Dashboard CEO, 3. Employees, 4. Tasks (kanban + list), 5. Offices (daftar sesi/office), 6. Skills, 7. AI Providers, 8. Tools, 9. Analytics, 10. Members & Invites, 11. Settings (schedule, timezone, holidays).
- **Workstation modal** (klik monitor / tekan E dekat agent): Overview, Terminal (xterm.js, output nyata), Activity, AI Conversation, Tasks, Files, Performance + input instruksi tambahan.
- Dark/light mode, responsive (dashboard), 3D desktop-first.

## 11. Security

JWT + RBAC (office role) di REST & WS, credential terenkripsi, tool authorization, approval untuk destructive, sandbox container, isolasi SSH key (hanya di worker, mount per eksekusi), audit log, rate limit (API + login brute-force), budget token/cost per employee & per office, timeout & cancel, CORS/CSRF, helmet. Guest/Viewer tidak bisa lihat isi credential, system prompt, atau secret.

## 12. Roadmap Eksekusi (DIPUTUSKAN: 3D office dulu, lokal dulu)

| Phase | Isi | Output yang bisa dicoba |
|---|---|---|
| **1. Office 3D (frontend)** | Root workspace + `frontend/`; gedung besar + atrium + langit-langit detail, aset CC0, karakter + name tag, 3 mode kamera (FPS/TPS Roblox/Isometric), Rapier collision, NavMesh, jam dinding, lighting ikut jam, klik agent → panel | Buka `localhost`, jalan-jalan di office |
| **2. Foundation backend** | docker-compose lokal (Postgres/Redis/MinIO), Prisma schema, auth + RBAC, multi-office + office switcher, CRUD employee/skill/task/provider, 3D baca data nyata dari API | Login, buat office & employee → muncul di 3D (Scenario A, B) |
| **3. AI Engine** | Adapter (Anthropic dulu → Gemini/OpenAI/DeepSeek/OpenRouter), agent runtime, skill loader, tool registry + sandbox Docker, BullMQ, state machine task, WS streaming → karakter bergerak sesuai status nyata | Assign task → agent benar-benar kerja (Scenario C, D, G) |
| **4. Workstation** | Monitor live texture, modal 7 tab, xterm, conversation viewer, files/artifacts, instruksi tambahan | Inspect kerja agent |
| **5. Multiplayer** | Presence realtime, avatar user lain + name tag, chat/emote, members & invite per office | Teman login (di LAN dulu) & masuk office |
| **6. Workforce Sim** | Schedule & break, OFF_DUTY, movement otonom, meeting, kolaborasi + delegasi DAG | Scenario E, F |
| **7. Enterprise** | Dashboard CEO, analytics, cost/usage, approval UI, audit log, optimasi, E2E Playwright A–G | Acceptance criteria lengkap |
| **8. Online (nanti)** | Deploy ke VPS (bagian 12b) + Cloudflare Tunnel/Tailscale/HTTPS | Akses dari internet |

**Status Phase 1: SELESAI (frontend 3D)** — lihat README.md.

Catatan Phase 1: karena backend belum ada, status agent di 3D diisi **Demo Mode** (badge "DEMO" terlihat jelas, data dari `demo-fixtures.ts`), lalu diganti data nyata di Phase 2–3 — sesuai rule "bedakan demo vs data nyata".

## 12b. Deployment ke VPS (terisolasi, tidak mengganggu yang sudah jalan)

Target: `musyan@192.168.64.10`.

1. **Pre-flight (read-only)**: catat OS, RAM/CPU/disk, service yang jalan (`systemctl`, `docker ps`, `ss -tlnp`), port terpakai, versi docker/node. Hasil → `docs/vps-inventory.md`.
2. **Isolasi**:
   - Semua file di `/opt/avo/` (tidak menyentuh direktori lain).
   - Docker Compose project name `avo` → container/volume/network berprefix `avo_*`, network sendiri.
   - Port hanya yang kosong (mis. 18080 web, 18081 api); Postgres/Redis/MinIO **tidak** di-expose ke host.
   - Tidak `apt upgrade`, tidak ubah config service lain; nginx/firewall yang ada tidak diedit tanpa izin.
   - Kalau Docker belum ada → install (satu-satunya perubahan sistem, minta konfirmasi dulu).
3. **Alur dev**: kode di Mac → `rsync`/git push → `docker compose -p avo up -d --build` di VPS.
4. **Sandbox tool agent**: container terpisah `avo_sandbox_*`, tanpa akses ke Docker socket host & tanpa akses ke service lain di VPS.
5. **Akses teman**: VM `192.168.64.x` = jaringan lokal Mac → untuk akses dari internet pakai Cloudflare Tunnel / Tailscale, atau VPS publik.
6. **Rollback**: `docker compose -p avo down -v && rm -rf /opt/avo` → VPS kembali seperti semula.

## 13. Keputusan (final)

1. Sesi baru → **office terpisah**.
2. Aset → **gratis (CC0)**, pilih yang paling bagus (bagian 6.5).
3. Jalan → **lokal dulu**, internet nanti (Phase 8).
4. Urutan → **Office 3D dulu**.
