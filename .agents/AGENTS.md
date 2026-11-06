## 🎯 **SYSTEM PROMPT / CUSTOM INSTRUCTIONS: AI VIRTUAL OFFICE**

**[CRITICAL RULE: MANDATORY ULTRA-DETAILED ARCHITECTURE, DEEP CODEBASE EXPLORATION & CONTINUOUS KNOWLEDGE EVOLUTION]**

Mulai sekarang dan seterusnya, setiap kali USER meminta fitur baru, perbaikan bug kompleks, atau *refactoring*, Anda **DIWAJIBKAN** untuk masuk ke **Planning Mode**, membaca file nyata di seluruh pilar codebase (`./backend`, `./frontend`, `./infra` / scripts), dan menghasilkan *Implementation Plan* yang **sangat ekstensif, mendalam, visual, dan komprehensif (MINIMAL 1000 BARIS)** sebelum menulis satu baris kode pun.

---

### 🔍 **ATURAN WAJIB EKSPLORASI & GROUNDING MULTI-DIREKTORI (NO HALLUCINATION):**
Sebelum menulis satu kata pun di dalam Implementation Plan, Anda **DIWAJIBKAN** melakukan investigasi mendalam terhadap 3 pilar direktori utama proyek:
1. **Pilar Backend (`./backend`)**:
   - Wajib memeriksa controller, service, DTO validator (`class-validator`), Prisma Multi-Schema (`prisma/schema/*.prisma`), Guards (`RBACGuard`, `RequiresCompanyGuard`, `SuperAdminGuard`), Session Auth (`BetterAuth`), SSE stream (`OfficeEventsService`), dan S3/MinIO client.
2. **Pilar Frontend (`./frontend`)**:
   - Wajib memeriksa Three.js Canvas (`Scene.tsx`), State Management Zustand (`state/store.ts`, `state/runtime.ts`), Network Client (`lib/api.ts`), HUD Overlays (`hud/*.tsx`), Camera Rig (`camera/CameraRig.tsx`), Character Systems (`characters/*.tsx`), dan Office 3D Engine (`office/*.tsx`).
3. **Pilar Deployment & Server Infra (`./deploy.sh`, Remote Server `musyan@192.168.64.10`)**:
   - Wajib memeriksa Nginx server block (`/etc/nginx/conf.d/`), Cloudflare Tunnel (`/etc/cloudflared/config.yml`), PostgreSQL container (`postgres` on port 8155), PM2 ecosystem/services, dan single-command rsync deployment script.

---

### 🧠 **ATURAN KNOWLEDGE BASE EVOLUSI MANDIRI (CONTINUOUS SELF-EVOLVING AGENT):**
- File instruksi `.agents/AGENTS.md` dan memori repository ini **wajib terus berkembang dan diperbarui secara berkala** mengikuti kompleksitas, fitur baru, dan pelajaran arsitektural yang didapat (misal: pattern Prisma multi-schema, isolasi session `activeCompanyId`, SSE reconnection resilience, Three.js instanced meshes, dll).
- Setiap kali arsitektur baru selesai dibangun, perbarui aturan panduan di `.agents/AGENTS.md` agar standar kualitas masa depan semakin tinggi.

---

### 📐 **STANDAR KUALITAS IMPLEMENTATION PLAN (SENIOR / STAFF PRINCIPAL ENGINEER LEVEL):**

1. **Panjang & Detail Ekstrem (WAJIB MINIMAL 1000 BARIS / 1000 LINES)**:
   - Ini adalah instruksi mutlak tanpa pengecualian. Jangan pernah membuat plan yang singkat, umum, atau *surface-level*.
   - Plan Anda **HARUS mencapai atau melampaui 1000 baris**. 
   - Bedah setiap file nyata, setiap baris algoritma, berikan pseudocode panjang, skema database, payload contracts, dan arsitektur visual untuk memenuhi syarat ini.

2. **Visual Architecture & Flow Diagrams (Wajib Mermaid.js)**:
   - **High-Level System Architecture Diagram** (`graph TD` / `graph LR`): Memetakan hubungan antar Frontend (3D Canvas + HUD), Backend (NestJS API), Cloudflare Tunnel, Nginx Reverse Proxy, PostgreSQL, S3/MinIO, dan PM2 Process Manager.
   - **End-to-End Sequence Diagram** (`sequenceDiagram` dengan `autonumber`): Menggambarkan alur eksekusi request-response dari User -> Frontend Canvas -> BetterAuth Token -> Nginx -> NestJS Controller -> Service -> PostgreSQL / S3 -> SSE Event Stream -> 3D Agents Movement / HUD State.
   - **State Transition Diagram** (`stateDiagram-v2`): Menggambarkan state machine dari entitas data (misal: *Task Created -> Assigned -> In Progress -> Tool Execution -> Completed / Failed*, atau Employee *Idle -> Walking -> Working -> In Meeting -> Offline*).

3. **Deep Root Cause Analysis dengan Bukti Data & Logika**:
   - Analisis mendalam arsitektur dan konfigurasi saat ini.
   - Bedah sistem lama (database server luar yang lambat/tidak stabil) vs perbaikan baru (PostgreSQL lokal terisolasi di host production).
   - Sertakan analisis data riil, struktur tabel database, dan query penjelas.

4. **Matriks Status & Lifecycle Table**:
   - Buat tabel matriks status yang komprehensif memetakan:
     * Status Logis
     * Flag / Kolom Database (misal: `EmployeeStatus`, `TaskStatus`, relasi foreign key)
     * Kondisi Realtime / Physical 3D Office (koordinat x, y, z, pose animasi)
     * Tampilan Label Badge & Warna di UI/HUD
     * Penjelasan fungsional yang mudah dipahami manusia.

5. **Multi-Tenancy & Multi-Layer Security Architecture**:
   - Jabarkan bagaimana keamanan data dan isolasi antar organisasi/kantor (*companyId*) dijamin di setiap layer:
     * **Lapis 1:** Controller Guard & Session Token Level (`RequiresCompanyGuard`, `activeCompanyId`)
     * **Lapis 2:** Database Foreign Key & Index Constraint Level (`@@index([companyId])`)
     * **Lapis 3:** SSE Broadcast Channel & Realtime Isolation Level (`office:${companyId}`)

6. **Data Structures, Prisma Schemas & Database Migration**:
   - Tuliskan skema Prisma lengkap (`schema/*.prisma`), DDL PostgreSQL / pgvector, tipe data kolom, constraint `ON DELETE CASCADE`, serta indeks performa.
   - Tuliskan query SQL mentah (`$queryRaw`) secara eksplisit.

7. **Payload Data Contracts & API Specifications**:
   - Definisikan secara eksplisit seluruh HTTP endpoint (Method, Path, Headers, Request Body, Response Format).
   - Sertakan contoh payload JSON request & response untuk integrasi antar-sistem (seperti Auth, Office, Task, Employee, SSE stream).

8. **Exhaustive Edge Cases & Mitigation Matrix**:
   - Buat tabel analisis risiko dengan minimal **5 skenario edge cases** (misal: koneksi SSH/rsync putus di tengah transfer, SSE connection drop saat 3D rendering, database pool exhaustion, Cloudflare tunnel restart latency, Cross-tenant data leakage) beserta solusi mitigasi teknisnya.

9. **Step-by-Step Execution Phases & Code Blueprints**:
   - Pecah implementasi menjadi fase terstruktur (*Phase 1: Infrastructure & DB, Phase 2: Nginx & Cloudflare, Phase 3: Frontend & Backend Builds, Phase 4: Atomic 1-Script Rsync Deploy, Phase 5: Verification*).
   - Di setiap fase, sebutkan file target dengan link markdown klik-able (misal: [`src/main.ts`](file:///absolute/path/to/file)), jelaskan perubahan detail, dan tuliskan blueprint kode implementasinya.

10. **Verification, Regression & Massive Testing Plan**:
    - Tuliskan perintah spesifik yang dapat dieksekusi di terminal (misal: `npm run build`, `deploy.sh status`, testing endpoint via `curl`, query validasi database via `psql`).
    - Buat *Manual QA Checklist* untuk validasi antarmuka 3D Canvas, HUD, dan user experience secara menyeluruh.

---

### 🧩 **ATURAN MUTLAK: MODULARITY FIRST (INTINYA HARUS MODULAR, HINDARI KODE MONOLITIK):**
1. **Filosofi Inti: Arsitektur Modular di Seluruh Pilar**:
   - Setiap file di seluruh pilar direktori (`./backend`, `./frontend`, `./scripts`) **DIWAJIBKAN** menerapkan *Separation of Concerns* dan prinsip *Single Responsibility*.
   - **Dilarang Keras Gaya Monolitik**: Pisahkan logika visual 3D, state networking, dan HUD UI.
2. **Pedoman Dekomposisi Menjadi Sub-Unit Mandiri**:
   - Custom Hooks Terisolasi (`frontend/src/state/`, `frontend/src/lib/`)
   - Sub-Komponen HUD UI Terdedikasi (`frontend/src/hud/`)
   - 3D Modular Meshes (`frontend/src/office/`, `frontend/src/characters/`)
   - Backend Modular NestJS (`backend/src/office/`, `backend/src/system/`, `backend/src/health/`)

---

### ⛔ **ATURAN EKSEKUSI & APPROVAL:**
- **DILARANG KERAS** menulis kode implementasi sebelum membuat Implementation Plan yang memenuhi standar di atas dan mencapai panjang minimal 1000 baris.
- Setelah Implementation Plan dibuat di artifact `implementation_plan.md`, **STOP dan tunggu persetujuan (*approval*) dari USER** sebelum memulai eksekusi.
- Setelah eksekusi kode selesai, **WAJIB** memvalidasi integritas tipe data TypeScript (`npm run typecheck` atau `npm run build`), memverifikasi HTTP response live dari domain target (`https://office.musyan.my.id` dan `https://office-api.musyan.my.id/api/v1/health`), dan menguji persistensi database lokal server.

---

### 🏛️ **STANDAR ARSITEKTUR & PROTOKOL TERUJI (PHASE 3, PHASE 4, PHASE 5 & PHASE 6 LESSONS LEARNED):**
1. **Prisma Multi-Schema Migration Protocol**:
   - Skema Prisma terbagi dalam beberapa file di `prisma/schema/*.prisma`. Saat menambahkan entitas baru (seperti `Artifact`, `UsageRecord`, `StandupReport`), relasi balik di `system.prisma` (`Company`) dan `ai.prisma` (`AiProvider`) wajib disinkronkan.
   - Biner Prisma di Debian 13 ARM64 kompatibel penuh dengan macOS ARM64 lokal. Migrasi skema dapat langsung di-deploy melalui `./deploy.sh migrate` atau eksekusi DDL via `psql`.
2. **OpenAI-Compatible Proxy Resilience**:
   - Selalu sertakan `stream: false` secara eksplisit pada payload inferensi ke endpoint OpenAI-compatible / 9router.
   - Sediakan fallback text parser untuk menangani baris SSE stream `data: {...}` jika proxy/gateway merespons dalam mode streaming chunked.
3. **S3/MinIO Storage & Presigned URLs Isolation**:
   - S3 Storage terisolasi di bawah namespace `virtual-office/artifacts/${companyId}/${employeeId}/` dan `virtual-office/artifacts/${companyId}/meetings/`.
   - Hindari mengekspos kredensial S3; gunakan fungsi presigned URL `getPresignedReadUrl(key, expiresIn)` untuk akses unduh aman dari antarmuka web.
4. **Modularity Pattern pada Workstation HUD**:
   - Tab kompleks pada Workstation didekomposisi ke direktori terdedikasi `frontend/src/hud/workstation/` (`AiConversationTab.tsx`, `FilesTab.tsx`, `PerformanceTab.tsx`, `FilePreviewModal.tsx`) agar tetap ringan, mudah dirawat, dan mematuhi Single Responsibility Principle.
5. **Dynamic 3D Canvas Texture & Blinking Cursor**:
   - Manfaatkan parameter `intervalMs` pada custom hook `useCanvasTexture` saat agent berstatus aktif (`WORKING`, `THINKING`, `TOOL_EXECUTING`) untuk merender kursor terminal berkedip `█` dan indikator tool real-time tanpa memicu siklus re-render React Tree.
6. **Autonomous Multi-Agent Turn-Taking & Consensus Loop (Phase 5)**:
   - Dynamic Turn-Taking Router (`planTurn`) menetapkan persona secara deterministik dan adaptif: putaran pertama selalu `PROPOSE` (Lead/Product), putaran tengah bergantian `CRITIQUE` / `QUESTION` (QA/Critic) dan `SUPPORT` (Engineer/Designer), dan putaran akhir melakukan konvergensi `SYNTHESIZE`.
   - Whiteboard state disimpan dalam JSONB (`whiteboardData`) dan disinkronkan secara real-time via SSE event `whiteboard.updated`.
   - Saat meeting di-`conclude`, Minutes of Meeting (MoM) diarsip otomatis ke MinIO S3, dicatat sebagai `artifact`, dan action items diekstraksi menjadi `Task` nyata yang langsung diproses oleh `AgentRuntimeService`.
7. **Autonomous Office Shift, Daily Standup & Multiplayer Presence (Phase 6)**:
   - Backend Cron Ticker (`ScheduleService` via `@nestjs/schedule`) mengevaluasi status shift per menit berdasarkan timezone organisasi dan transisi alami: jam kantor buka 09:00, coffee break 10:30 & 15:30, istirahat siang 12:00, dan pulang kantor 18:00 (menavigasi ke Pantry atau `EXIT_POINT`).
   - Daily Standup Ceremony (`StandupService`) mengumpulkan agen secara otonom di Collaboration Pods (`SLOTS.collab`), menyintesis laporan 3-part (*Yesterday, Today, Blockers*) melalui LLM, dan membukukannya ke tabel `standup_report`.
   - In-memory Presence Cache dengan TTL heartbeat 15 detik (`PresenceService`) menampung koordinat posisi dan pose animasi para user manusia, disiarkan via event SSE `presence.update`, dan dirender sebagai avatar 3D halus (`<RemotePlayer />`) dengan interpolasi lerp 60 FPS.
8. **Isolated Code Execution Sandbox & Subprocess Whitelisting (Phase 7)**:
   - Eksekusi JavaScript terisolasi ketat menggunakan context `node:vm` dengan `codeGeneration: { strings: false, wasm: false }`, timeout 5000ms, dan pencegahan akses modul eksternal/filesystem.
   - Eksekusi Python 3 subproses menggunakan `spawn` dengan pembersihan menyeluruh terhadap `process.env` (environment variables stripped) sehingga `DATABASE_URL`, `BETTER_AUTH_SECRET`, dan token S3/MinIO tidak dapat diakses atau dibocorkan oleh kode AI.
   - Pemanfaatan buffer output terbatas (64KB) mencegah serangan memory exhaustion atau flooding log.
9. **Human-In-The-Loop (HITL) Risk Evaluation & Task Pause-Resume Protocol (Phase 7)**:
   - Penilaian risiko otomatis (`evaluateToolRisk`) memisahkan operasi ke 4 tingkat risiko (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
   - Tindakan destruktif (mutasi database, eksekusi modul sistem) secara otomatis menahan task ke status `WAITING` dan menerbitkan `ApprovalRequest` ke CEO/Pimpinan via HUD dan webhook.
   - Saat pimpinan menyetujui (`approve`), sistem mengeksekusi tool dan secara aman melanjutkan siklus inferensi agent tanpa mengulang tugas dari awal.
10. **Multi-Channel Webhooks Dispatcher & Inbound GitHub Bridge (Phase 7)**:
    - Integrasi outbound multi-saluran ke Telegram Bot API (HTML), Discord (rich embeds), Slack (Block Kit), dan Generic HTTP (HMAC-SHA256 signature).
    - Secret webhook disimpan secara terenkripsi menggunakan AES-256-GCM via `secret-box.ts`.
    - Inbound GitHub Webhook endpoint ditandai dengan decorator `@Public()` dari `@thallesp/nestjs-better-auth` untuk memfasilitasi penerimaan payload publik tanpa token sesi pengguna, dan memicu event `integration.event` ke seluruh antarmuka 3D real-time.
11. **3D Spatial Audio & Zero-Latency Procedural Sound FX (Phase 8)**:
    - Integrasi `THREE.AudioListener` yang terikat pada `CameraRig` dan `THREE.PositionalAudio` / `PannerNode` dengan model `HRTF` dan attenuasi `inverse distance`.
    - Suara ketikan keyboard mekanik disintesis secara algoritmik (0 KB file eksternal) menggunakan noise burst terfilter bandpass pada frekuensi 2.200 Hz dari meja agen yang berstatus `WORKING` / `TOOL_EXECUTING`.
    - Suara langkah kaki (`footsteps`) disintesis dengan frequency drop oscillator (110 Hz ke 35 Hz dalam 50 ms) sinkron dengan pergerakan player di Three.js canvas.
12. **CEO Push-to-Talk Voice Dictation & Speech Recognition (Phase 8)**:
    - Fitur Push-to-Talk berbasis hotkey `KeyV` atau toggle Mic di TopBar memanfaatkan Web Speech API (`webkitSpeechRecognition`) bilingual (Bahasa Indonesia & Inggris).
    - Teks transkripsi suara secara instan terhubung ke obrolan rapat (`Discussion.tsx`) dan pembuatan tugas tanpa perlu mengetik manual.
13. **Agent Voice Persona & Speech Queue Management (Phase 8)**:
    - Profil vokal disimpan dalam kolom `voiceProfile` (JSONB) pada tabel `employee` untuk mengatur pitch, speech rate, dan karakter gender per karyawan.
    - Antrean bicara FIFO pada `voice-engine.ts` mencegah tabrakan audio (*cacophony*) saat banyak agen berbicara bersamaan.
14. **Defensive SSE Realtime State Merging & Component Resilience**:
    - Backend SSE stream sering mengirim payload mutasi delta parsial (misal: hanya `{ id, status, currentTask }`).
    - Mapper frontend (`toEmployee`) dilarang keras menimpa entitas di Zustand store jika data parsial. Gunakan pattern `patchOrUpsertEmployee` (shallow merge properti terdefinisi) untuk mengamankan atribut kritis seperti `name`, `role`, dan `appearance`.
    - Komponen UI presentasional seperti `<Avatar />` wajib memiliki defensive fallbacks terhadap nilai `undefined` atau string kosong (`(typeof name === 'string' && name.trim()) || '?'`) sebelum memanggil metode pemotong string (`slice()`).
    - Wrap seluruh root aplikasi dengan `ErrorBoundary` terpusat untuk mengisolasi kegagalan render komponen tanpa mencabut unmount seluruh pohon DOM 3D canvas.
15. **Cross-Platform iPadOS & Touch Interaction Resilience**:
    - iPadOS WebKit tidak mendukung Pointer Lock API W3C (`requestPointerLock()` diabaikan atau gagal).
    - `CameraRig` wajib mendukung dual-mode look: pointer-locked mouselook di desktop, dan drag-to-look non-locked berbasis `PointerEvent` (`isDragging = (isPointerDown && (buttons === 1 || pointerType === 'touch')) || rmbDown`) di iPad, Magic Keyboard trackpad, mouse Bluetooth, dan touchscreen.
    - Interaksi klik 3D (`Interaction.tsx`) wajib membedakan gesture tap vs drag menggunakan ambang batas Euclidean distance (< 8px) dan hold time (< 450ms). Jika gestur melewati batas tersebut, event dianggap sebagai kontrol kamera/orbit, bukan seleksi objek/karyawan.
16. **Virtual Analog Joystick & Mobile Touch Controls**:
    - Kontrol mobile 3D menggunakan analog virtual polar di kiri bawah (`VirtualJoystick.tsx`) yang menuliskan vektor normalisasi $(nx, ny)$ ke `runtime.virtualJoystick`.
    - `Player.tsx` membaca `runtime.virtualJoystick` secara langsung dalam loop `useFrame` Rapier character controller.
    - Deadzone matematis 8% mencegah jitter, dan magnitude > 85% otomatis memicu sprint (6.2 m/s vs 3.4 m/s walk).
    - Tombol aksi cepat mobile (Lompat & Siklus Kamera) ditempatkan di kanan bawah.
17. **Anti-Collision Layout & Multi-Device Responsive Architecture**:
    - Mode portrait di layar mobile (< 1024px) memicu `OrientationWarning.tsx` dengan animasi rotasi HP 3D CSS dan opsi bypass.
    - TopBar menyederhanakan tombol sekunder ke dalam menu popover `⋯` pada layar < 1200px agar tidak menabrak jam kantor dan tidak membungkus baris baru.
    - Minimap otomatis menciut menjadi tombol melayang `[🗺️ Peta]` saat panel samping terbuka pada viewport bertinggi < 720px.
    - Dialog kompleks seperti Workstation menerapkan tab horizontal scrollable dan fluid modal height `calc(100dvh - 20px)`.
18. **Enterprise Lockdown & Designated Multi-Company Provisioning (Phase 9)**:
    - Form login awal dikunci secara ketat hanya untuk administrator (`AuthCard`), menghilangkan tombol/tab registrasi publik.
    - Provisioning company baru (`CompanyService.create`) mendukung penyematan designated client SuperAdmin (`owner: { name, email, password }`) tanpa mengusir sesi aktif administrator platform yang sedang bertugas.
19. **Granular Role-Based Access Control (RBAC) & Member Invitation (Phase 9)**:
    - Pembuatan akun anggota baru (`/system/memberships/create-account`) mendukung seleksi izin granular per kategori (Office, Workforce, Task, Discussion, AI, File, Audit).
    - Ketika admin memilih izin khusus, backend secara otomatis memproduksi `Role` kustom terisolasi (`Custom: <Nama Anggota>`) untuk mencegah anggota bertindak sembarangan.
20. **Model Context Protocol (MCP) Multi-Tenant Tool Bridge (Phase 9)**:
    - Ekosistem MCP dikelola melalui tabel `mcp_server` terisolasi per company dengan transport SSE/HTTP.
    - `ToolRegistryService` secara dinamis menggabungkan tools built-in dengan tools MCP aktif (`mcp__<server>__<tool>`), mendistribusikan kapabilitas eksternal ke seluruh AI employee di kantor secara transparan.
21. **Antigravity-Style Virtual File Tree & Brain Studio (Phase 9)**:
    - Profil agent didekomposisi dari string tunggal menjadi berkas virtual terstruktur di tabel `agent_file` (`PERSONA.md`, `RULES.md`, `skills/*.md`, `KNOWLEDGE.md`, `config.json`).
    - Compiler prompt hierarkis menyatukan berkas-berkas tersebut ke dalam tag XML `<identity>`, `<guidelines>`, `<skills>`, `<knowledge>`, dan `<episodic_memory>`.
22. **Realtime Token Context Gauge & Permanent Episodic Memory (Phase 9)**:
    - Metrik context window (`AgentMemoryService.getContextStatus`) mengevaluasi kapasitas token aktif terhadap batas model (128.000 tokens) dengan indikator visual level risiko (`LOW`, `MODERATE`, `HIGH`, `CRITICAL`).
    - Mekanisme kompresi memori (`compactSession`) merangkum seluruh tugas yang diselesaikan, artefak, dan keputusan ke dalam `agent_session_memory` serta menggabungkannya ke `accumulatedSummary` sebelum menaikkan nomor sesi aktif, menjamin agen tidak akan pernah lupa riwayat masa lalu meskipun sesi kerja direset.
23. **Advanced Character Kinematics & Directional Vector Heading (Phase 10)**:
    - Di mode orang ketiga (TPS), orientasi hadap visual karakter dilarang keras dipaksa terkunci ke arah pandang kamera (`cam.yaw`) saat bergerak aktif.
    - Model 3D karakter wajib mengarah ke $\operatorname{atan2}(mx, mz)$ dengan interpolasi modular `angDamp` ($k=14$).
    - Tombol diagonal (`W+A`, `W+D`, `S+A`, `S+D`) mengarahkan badan ke sudut diagonal pergerakan ($\pm 45^\circ$), dan tombol mundur (`S`) secara natural memutar badan $180^\circ$ menghadap ke arah pandang kamera/pemain.
24. **Temporal Date-Partitioned Conversation Journaling (Phase 10)**:
    - Jejak kognitif agen AI pada Workstation dipartisi dinamis berbasis tanggal kalender ISO (`YYYY-MM-DD`) ke dalam struktur hierarkis folder (`AiConversationTab.tsx`).
    - Setiap folder harian menyajikan kartu ringkasan aktivitas (jumlah instruksi CEO, eksekusi tools, diskusi tim) dan memuat percakapan harian secara kronologis natural.
25. **Interactive Seating Mechanics & Dynamic Swivel Chairs (Phase 10)**:
    - Deteksi kedekatan seluruh kursi kantor (`ALL_SEATS` < 1.35m) memberikan kemampuan interaktif bagi pemain manusia untuk duduk (`[E] Duduk`) dengan pose santai `sitIdle` dan berdiri otomatis saat menekan `E` atau tombol gerak WASD / Space.
    - Kursi kantor didekomposisi dari baking statis menjadi komponen dinamis `<SwivelChairs />` (kaki bintang 5 statis + bantalan dudukan dinamis).
    - Bantalan atas kursi secara otomatis memutar sudut rotasinya mengikuti *yaw* agen atau pemain yang mendudukinya, menyelaraskan orientasi kursi saat agen dipanggil berkumpul (*Gather*) mendengarkan arahan CEO tanpa *clipping*.
26. **Chronological Activity Feed Discipline (Phase 10)**:
    - Panel samping karyawan (`EmployeePanel.tsx`) menyajikan aktivitas dalam urutan kronologis natural murni (pesan lama di atas, entri baru di paling bawah) tanpa pemanggilan `.reverse()`, dilengkapi *auto-scroll to bottom* saat aktivitas bertambah secara real-time.
27. **Username-Based Authentication & Transparent Friend Provisioning (Phase 11)**:
    - Login kredensial mendukung username alfanumerik tanpa kewajiban email.
    - Jika email tidak diisi saat mengundang rekan/teman baru, backend secara otomatis membuat virtual domain email internal (`${username}@office.local`), menjamin BetterAuth tetap bekerja sempurna tanpa mengekspos kompleksitas email ke pemain.
28. **Game-Style Escape Key (<kbd>Esc</kbd>) Pause Menu Architecture (Phase 11)**:
    - Penanganan tombol Escape bertingkat: menekan <kbd>Esc</kbd> menutup modal/workstation yang sedang aktif terlebih dahulu.
    - Saat seluruh panel tertutup, menekan <kbd>Esc</kbd> memunculkan Game Pause Menu (`EscapeMenu.tsx`) bergaya game RPG/cyberpunk yang menyatukan menu Ganti Office, Undang Teman, MCP Tools, Spatial Voice, Jadwal, Pengaturan Grafis, dan Logout sehingga tampilan layar tetap bersih dan minimalis.
29. **Context Compaction Session Isolation (Phase 11)**:
    - `AgentMemoryService.getContextStatus` membatasi agregasi penggunaan token hanya pada data yang dibuat pada atau setelah `sessionStartDate` (diambil dari `createdAt` entri `AgentSessionMemory` terakhir).
    - Merangkum sesi secara instan mengarsipkan pencapaian ke memori episodik permanen dan mengembalikan gauge konteks ke 1% (status LOW hijau) tanpa menghilangkan riwayat kerja masa lalu.
30. **Interactive Unix-Style Workstation Terminal (Phase 11)**:
    - Tab Terminal pada Workstation (`TerminalTab.tsx`) menyediakan command prompt interaktif `$ ` dengan riwayat navigasi panah atas/bawah, command router (`help`, `status`, `files`, `cat`, `clear`), serta eksekusi kode aman (`py <code>`, `js <code>`) via `SecureRunnerService`.
31. **Roblox-Style 3D Proximity Realtime Voice Chat & WebRTC Signaling (Phase 11)**:
    - P2P audio streaming memanfaatkan `RTCPeerConnection` dengan signaling yang disalurkan melalui SSE dan endpoint relay (`POST /office/presence/voice-signal`).
    - Atenuasi spasial 3D fisik: volume suara meluruh secara linear $\max(0, 1 - d/\text{voiceRadius})$ dengan radius yang dapat disesuaikan (3m–30m), serta stereo panning berdasarkan sudut pandang pemain.
    - Avatar menampilkan indikator visual berupa halo hijau bercahaya berdenyut di atas kepala saat pemain sedang aktif berbicara.
32. **Bidirectional IDE MCP Server Hub (Phase 11)**:
    - Backend menyediakan endpoint MCP Server bawaan di `/office/mcp/server/sse` dan `/office/mcp/server/messages` yang mengimplementasikan protokol JSON-RPC 2.0 `tools/list` dan `tools/call`.
    - Memfasilitasi IDE eksternal (Google Antigravity, Cursor IDE, Codex CLI, OpenCode) untuk memeriksa agen kantor, membaca virtual files Brain Studio, dan mendelegasikan tugas kode langsung dari IDE.
33. **3D Cyberpunk Game Title Screen & World Save Slots (Phase 11)**:
    - Layar awal login mengintegrasikan Three.js Canvas terisolasi (`GameTitleScene.tsx`) dengan kamera orbit, floating cyber platform, neon grid, voxel servers, dan partikel cyber dust.
    - Ruang-ruang kantor disajikan dengan format "World Save Slots" / "Level Select" bergaya arcade.
34. **Human-Like Conversational Persona, Multi-Message Burst & Markdown Engine (Phase 11)**:
    - Standardisasi gaya komunikasi seluruh agen: dilarang berbahasa bot kaku ("Sebagai asisten AI..."), beralih ke persona rekan kerja tech startup di Indonesia yang hangat, cerdas, santai, solutif, dan ringkas.
    - Batasan balon obrolan ramping: maksimal 1–3 kalimat pendek per pesan (~140–180 karakter) pada 3D canvas `NameTag.tsx` (`max-w-[230px]`) dan HUD obrolan.
    - Multi-Message Sequential Burst Engine: penggunaan delimiter `---` diinstruksikan pada prompt LLM dan didukung oleh `splitIntoHumanMessages()` di `DiscussionService` dan `DebateOrchestratorService`. Backend memancarkan sub-pesan bertahap via SSE dengan jeda mengetik alami (1000ms–2000ms) dan visual typing indicator `• • •`.
    - Zero-Dependency Markdown Formatter Engine (`MarkdownView.tsx`): parsing berbasis AST/regex murni tanpa dependensi eksternal npm, aman dari XSS (tanpa `dangerouslySetInnerHTML`), mendukung bold, italic, inline code, code blocks, bullet/numbered lists, quotes, dan link adaptif.
    - Universal Seeding Hook: `EmployeeService.create` secara deterministik langsung memicu `seedDefaultBundle` dan `compilePrompt` untuk setiap karyawan baru yang direkrut, menjamin agen baru memiliki kepribadian manusiawi sejak detik pertama.






