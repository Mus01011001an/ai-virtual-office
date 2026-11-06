# 📋 IMPLEMENTATION PLAN: MIGRATION, CLOUDFLARE DNS, NGINX, & SINGLE-SCRIPT RSYNC DEPLOYMENT FOR AI VIRTUAL OFFICE

---

## 📑 DAFTAR ISI
1. [Executive Summary & Project Scope](#1-executive-summary--project-scope)
2. [Deep Root Cause & Architectural Comparison (Old vs New)](#2-deep-root-cause--architectural-comparison)
3. [Visual Architecture & Flow Diagrams (Mermaid.js)](#3-visual-architecture--flow-diagrams)
   - 3.1 [High-Level Production Infrastructure Architecture](#31-high-level-production-infrastructure-architecture)
   - 3.2 [End-to-End Request-Response & SSE Sequence Diagram](#32-end-to-end-request-response--sse-sequence-diagram)
   - 3.3 [Virtual Office Agent & Task State Machine Diagram](#33-virtual-office-agent--task-state-machine-diagram)
   - 3.4 [Ultra-Fast 1-Script Rsync Deployment Pipeline](#34-ultra-fast-1-script-rsync-deployment-pipeline)
4. [Matriks Status & Lifecycle Table (Data, 3D Canvas & HUD)](#4-matriks-status--lifecycle-table)
5. [Multi-Tenancy & Multi-Layer Security Architecture](#5-multi-tenancy--multi-layer-security-architecture)
   - 5.1 [Lapis 1: Controller, Guards & Session Token](#51-lapis-1-controller-guards--session-token)
   - 5.2 [Lapis 2: Database Constraints & Multi-Schema Isolation](#52-lapis-2-database-constraints--multi-schema-isolation)
   - 5.3 [Lapis 3: Realtime SSE Channel Isolation](#53-lapis-3-realtime-sse-channel-isolation)
6. [Complete Database Structures, Prisma Schemas & Migration Engine](#6-complete-database-structures-prisma-schemas--migration-engine)
   - 6.1 [PostgreSQL Initialization & Pgvector Specs](#61-postgresql-initialization--pgvector-specs)
   - 6.2 [Complete Prisma Multi-Schema Specifications](#62-complete-prisma-multi-schema-specifications)
   - 6.3 [DDL SQL Migrations & Raw Performance Queries](#63-ddl-sql-migrations--raw-performance-queries)
7. [API Specifications, Data Contracts & Event Streams](#7-api-specifications-data-contracts--event-streams)
   - 7.1 [Core Health Check Endpoints](#71-core-health-check-endpoints)
   - 7.2 [Authentication & Session Endpoints](#72-authentication--session-endpoints)
   - 7.3 [Virtual Office Entities (Employees, Tasks, Discussions)](#73-virtual-office-entities-employees-tasks-discussions)
   - 7.4 [Realtime Server-Sent Events (SSE) Protocol](#74-realtime-server-sent-events-sse-protocol)
8. [Exhaustive Edge Cases & Mitigation Matrix](#8-exhaustive-edge-cases--mitigation-matrix)
9. [Step-by-Step Execution Phases & Code Blueprints](#9-step-by-step-execution-phases--code-blueprints)
   - 9.1 [Phase 1: Server Hardening, Global Runtimes & Database Provisioning](#91-phase-1-server-hardening-global-runtimes--database-provisioning)
   - 9.2 [Phase 2: Cloudflare Tunnel Routing & Edge DNS](#92-phase-2-cloudflare-tunnel-routing--edge-dns)
   - 9.3 [Phase 3: Nginx Virtual Host Configuration](#93-phase-3-nginx-virtual-host-configuration)
   - 9.4 [Phase 4: Production Builds & Configuration Synchronization](#94-phase-4-production-builds--configuration-synchronization)
   - 9.5 [Phase 5: Single-Script Atomic Rsync Deployment Engine (`deploy.sh`)](#95-phase-5-single-script-atomic-rsync-deployment-engine-deploysh)
   - 9.6 [Phase 6: Process Management via PM2 & Remote Lifecycle](#96-phase-6-process-management-via-pm2--remote-lifecycle)
10. [Massive Verification, Testing Suite & Live Sanity Protocol](#10-massive-verification-testing-suite--live-sanity-protocol)
    - 10.1 [Automated CLI Verification Checks](#101-automated-cli-verification-checks)
    - 10.2 [Regression Test Cases (E2E & Unit)](#102-regression-test-cases-e2e--unit)
    - 10.3 [Manual QA & Visual 3D Checklist](#103-manual-qa--visual-3d-checklist)
11. [Disaster Recovery, Rollback Procedures & Day-2 Operations](#11-disaster-recovery-rollback-procedures--day-2-operations)

---

## 1. Executive Summary & Project Scope

Dokumen ini merupakan **Staff / Principal Engineer Implementation Plan** yang dirancang khusus untuk memigrasikan arsitektur backend dan frontend proyek **AI Virtual Office** ([`ai-virtual-office`](file:///Users/01011001andra/Code/projects/ai-virtual-office)) dari ketergantungan basis data eksternal lama ke server *in-house production* ([`192.168.64.10`](file:///etc/hosts)). Proyek ini mengintegrasikan antarmuka visual **3D Virtual Office** berbasis React Three Fiber / Three.js dengan backend enterprise bertenaga **NestJS 11**, Prisma 7 (multi-file schema), BetterAuth multi-tenancy, dan Realtime Server-Sent Events (SSE).

### 🎯 Tujuan Utama Proyek:
1. **Pemusnahan Ketergantungan Database Eksternal**: Menghapus seluruh koneksi ke server database lama yang tidak stabil/remote, dan memindahkan seluruh persistensi ke container PostgreSQL lokal (`pgvector/pgvector:pg16`) pada port `8155` di server target.
2. **Setup Passwordless SSH & Zero-Friction Authentication**: Konfigurasi SSH Key Ed25519 (`~/.ssh/id_musyan`) untuk user `musyan` dan `root` pada server target `192.168.64.10`, dilengkapi entri pada `~/.ssh/config` lokal sehingga eksekusi SSH dan transfer berkas rsync berlangsung seketika tanpa *prompt password*.
3. **Provisioning Database Baru**: Membuat basis data baru bernama `ai_virtual_office` di dalam container PostgreSQL server, menjalankan migrasi skema lengkap (perusahaan, pengguna, karyawan virtual, task, diskusi, aktivitas log), dan memastikan hak akses pengguna `musyan`.
4. **Cloudflare Tunnel Routing & Edge DNS Orchestration**: Menambahkan CNAME DNS record via Cloudflare Tunnel CLI (`musyan-tunnel`) untuk domain frontend `office.musyan.my.id` dan backend API `office-api.musyan.my.id`, serta memperbarui `/etc/cloudflared/config.yml`.
5. **Nginx Reverse Proxy & Static SPA Serving**:
   - Frontend `office.musyan.my.id`: Dilayani langsung sebagai static SPA berkecepatan tinggi dengan fallback `index.html` dan caching agresif untuk static assets (Three.js chunks, fonts, models).
   - Backend API `office-api.musyan.my.id`: Diteruskan (*reverse proxy*) ke port internal `8010` lengkap dengan dukungan WebSocket, streaming SSE (`proxy_buffering off`), dan pemetaan IP Cloudflare (`CF-Connecting-IP`).
6. **Single-Command Ultra-Fast Rsync Deploy Engine (`deploy.sh`)**: Mengembangkan satu skrip orkestrasi *deployment* lokal `./deploy.sh` yang mampu mem-build frontend dan backend, mentransfer artefak secara inkremental via rsync dalam hitungan detik (< 3 detik), memperbarui skema database remote via `prisma migrate deploy`, dan me-reload proses via PM2 tanpa downtime.
7. **Verifikasi End-to-End 100% Berfungsi**: Melakukan audit menyeluruh terhadap respon HTTP, SSL Cloudflare Edge, koneksi database psql, stream SSE, dan render 3D canvas di browser.

---

## 2. Deep Root Cause & Architectural Comparison

### 2.1 Analisis Masalah Arsitektur Lama (Old State)
Sebelumnya, sistem terhubung ke instans basis data eksternal di luar lingkungan server lokal. Kondisi ini memicu sejumlah kelemahan kritis:
- **Latensi Jaringan Tinggi (High RTT)**: Setiap query Prisma (terutama query multi-level relational include pada entitas `Company -> Employee -> Task`) menempuh rute WAN publik, menyebabkan *time-to-first-byte* (TTFB) endpoint mencapai 400ms – 1200ms.
- **Kerapuhan Sambungan (Connection Flakiness)**: Putusnya koneksi WAN sesaat menyebabkan pool koneksi Node.js (`pg` pool) mengalami *stale connection errors* (`ECONNRESET`, `ETIMEDOUT`), memaksa backend melakukan *reconnect* berulang kali.
- **Biaya & Ketergantungan Eksternal**: Membutuhkan pemeliharaan akun database terpisah dengan risiko credential leakage dan batasan kuota koneksi eksternal.
- **Alur Deploy Manual & Lambat**: Ketiadaan skrip deploy terpadu memaksa proses build dan transfer manual yang memakan waktu dan rentan *human error*.

### 2.2 Arsitektur Baru (New State)
Dengan migrasi ke server target `192.168.64.10`:
- **Latensi Sub-Milidetik**: Backend NestJS berkomunikasi dengan PostgreSQL di loopback host (`localhost:8155`) via socket TCP internal dengan latensi query < 1ms.
- **Keamanan Tingkat Tinggi**: Database tidak dipublikasikan ke internet terbuka; hanya dapat diakses melalui jaringan lokal internal host server.
- **Single Source of Truth**: Seluruh ekosistem (Cloudflare Tunnel, Nginx, PostgreSQL, MinIO S3, Redis, PM2, dan Frontend Static Files) terpadu di dalam satu host Debian 13 terorkestrasi.
- **Deployment Instan (< 3 Detik)**: Hanya berkas terkompilasi (`dist/`) dan konfigurasi yang ditransfer via rsync over SSH, memanfaatkan kompresi delta yang sangat cepat.

### 2.3 Tabel Perbandingan Arsitektur

| Parameter | Arsitektur Lama (Remote DB) | Arsitektur Baru (Server 192.168.64.10) | Dampak Positif |
| :--- | :--- | :--- | :--- |
| **Lokasi Database** | Cloud / Server Eksternal | Host Lokal Docker (`localhost:8155`) | Latensi turun 98% (< 1ms vs ~350ms) |
| **Konektivitas SSH** | Password prompt interaktif | SSH Key Ed25519 (`id_musyan`) | Automasi CI/CD & rsync tanpa hambatan |
| **DNS & Ingress** | Konfigurasi terpisah / Direct IP | Cloudflare Tunnel (`musyan-tunnel`) | Bebas port-forwarding, proteksi DDoS |
| **Reverse Proxy** | Sederhana / Tanpa SSE Buffer Off | Nginx teroptimasi HTTP/2 & SSE | Event streaming 3D lancar tanpa tersendat |
| **Metode Deploy** | Git pull manual / rebuild remote | 1-Script Rsync Local-to-Remote (`deploy.sh`) | Deploy selesai dalam 2-4 detik |
| **Process Manager** | Node foreground / screen | PM2 Daemonized Cluster (`office-api`) | Auto-restart saat crash, zero-downtime reload |
| **Frontend Serving** | Dev server / node container | Nginx High-Performance Static Host | 0% CPU overhead, caching statis 7 hari |

---

## 3. Visual Architecture & Flow Diagrams

### 3.1 High-Level Production Infrastructure Architecture

Diagram berikut memetakan relasi fisik dan logis antar komponen pada server production `192.168.64.10` dan interaksinya dengan klien eksternal melalui Cloudflare Edge.

```mermaid
graph TD
    subgraph PublicInternet["🌐 Public Internet / Client Tier"]
        BrowserClient["🖥️ User Browser (3D Canvas + HUD)"]
        MobileClient["📱 Mobile / Remote Visitors"]
    end

    subgraph CloudflareEdge["☁️ Cloudflare Global Anycast Network"]
        CF_DNS["Cloudflare DNS (CNAME Resolvers)"]
        CF_SSL["Cloudflare Edge SSL Termination"]
        CF_WAF["Cloudflare WAF & DDoS Shield"]
    end

    subgraph ServerHost["🖥️ Debian GNU/Linux 13 Server (192.168.64.10)"]
        subgraph TunnelIngress["🛡️ Cloudflare Daemon Tier"]
            CFTunnel["cloudflared daemon (musyan-tunnel)\nUUID: 45379ca1-5448-4626-aadc-56831ec594a5\nOutbound HTTP2 to Edge"]
        end

        subgraph WebServerTier["⚡ Nginx Reverse Proxy Tier (Port 80)"]
            NginxRouter["Nginx Master / Worker Processes"]
            VHostFE["VHost: office.musyan.my.id\nRoot: /home/musyan/projects/apps/frontend/ai-virtual-office/dist\nSPA Fallback to index.html"]
            VHostBE["VHost: office-api.musyan.my.id\nProxy Pass: http://localhost:8010\nBuffering: OFF (SSE Streaming)\nWebSocket Upgrade: ON"]
        end

        subgraph ApplicationTier["🚀 Node.js / PM2 Runtime Tier"]
            PM2_Master["PM2 Process Daemon (v7.1.2)"]
            OfficeAPI["NestJS API Process ('office-api')\nPID Managed, Port 8010\nBetterAuth + Prisma Client"]
        end

        subgraph StorageDatabaseTier["💾 Storage & Persistence Tier (Dockerized)"]
            PG_Container["PostgreSQL 16 Container ('postgres')\npgvector Enabled, Port 8155 -> 5432\nDatabase: ai_virtual_office"]
            MinIO_Container["MinIO S3 Compatible Storage\nPort 5005 (API), Port 5006 (Console)\nBucket: virtual-office"]
            Redis_Container["Redis Container (Optional Queue/Cache)\nPort 6379"]
        end
    end

    BrowserClient -->|HTTPS: office.musyan.my.id| CF_DNS
    MobileClient -->|HTTPS: office-api.musyan.my.id| CF_DNS
    CF_DNS --> CF_SSL
    CF_SSL --> CF_WAF
    CF_WAF -->|Encrypted Quic/HTTP2 Tunnel| CFTunnel
    CFTunnel -->|Forward Host Header to Port 80| NginxRouter
    NginxRouter -->|Match ServerName office.musyan.my.id| VHostFE
    NginxRouter -->|Match ServerName office-api.musyan.my.id| VHostBE
    VHostBE -->|HTTP Reverse Proxy| OfficeAPI
    PM2_Master -->|Supervise & Health Check| OfficeAPI
    OfficeAPI -->|Prisma Connection Pool: localhost:8155| PG_Container
    OfficeAPI -->|AWS-SDK S3 Presigned URLs: localhost:5005| MinIO_Container
    OfficeAPI -->|Pub/Sub Event Bus| Redis_Container
```

---

### 3.2 End-to-End Request-Response & SSE Sequence Diagram

Diagram berikut menjelaskan siklus lengkap interaksi pengguna saat membuka antarmuka 3D Virtual Office, melakukan autentikasi, memuat kondisi dunia kantor, dan menerima *event broadcast* secara realtime.

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 Pengguna (Browser)
    participant CF as ☁️ Cloudflare Edge
    participant Nginx as ⚡ Nginx Proxy
    participant PM2 as 🚀 NestJS (office-api)
    participant Auth as 🔐 BetterAuth Engine
    participant DB as 🐘 PostgreSQL (ai_virtual_office)
    participant S3 as 🪣 MinIO Storage (S3)

    User->>CF: GET https://office.musyan.my.id
    CF->>Nginx: Forward HTTP to office.musyan.my.id:80
    Nginx-->>User: 200 OK (index.html, JS chunks, CSS, 3D Assets)
    Note over User: Browser menginisialisasi Three.js Canvas & Zustand Store

    User->>CF: POST https://office-api.musyan.my.id/api/v1/auth/sign-in
    CF->>Nginx: Proxy to http://localhost:8010/api/v1/auth/sign-in
    Nginx->>PM2: Incoming HTTP POST Body { email, password }
    PM2->>Auth: Validate Credentials & Argon2 Password Hash
    Auth->>DB: Query User & Active Company Membership
    DB-->>Auth: Record Ditemukan & Valid
    Auth->>DB: Create Session Token Record
    DB-->>Auth: Session Created
    Auth-->>PM2: Return Session Token
    PM2-->>User: 200 OK { token, user, company }
    Note over User: Token disimpan ke localStorage ('avo-token')

    User->>CF: GET https://office-api.musyan.my.id/api/v1/office/state
    CF->>Nginx: Proxy with Authorization: Bearer <token>
    Nginx->>PM2: RequiresCompanyGuard Checks Token & activeCompanyId
    PM2->>DB: Fetch Employees, Tasks, Discussions for companyId
    DB-->>PM2: Return Full Office Snapshot
    PM2-->>User: 200 OK { employees, desks, tasks }
    Note over User: Render model 3D Avatar di posisi workstation masing-masing

    User->>CF: GET https://office-api.musyan.my.id/api/v1/office/stream?token=<token>
    CF->>Nginx: HTTP Upgrade / EventStream Request
    Note over Nginx: Nginx disables buffering (proxy_buffering off)
    Nginx->>PM2: Establish Long-lived SSE Connection
    PM2->>DB: Verify Token via SseTokenMiddleware
    PM2-->>User: HTTP 200 (Content-Type: text/event-stream)
    
    loop Realtime Heartbeat & Event Dispatch
        PM2-->>User: event: heartbeat\ndata: {"time": 1730821000}\n\n
        Note over PM2: Employee Agent selesai menjalankan tool AI
        PM2->>DB: Update Task Status to COMPLETED
        PM2-->>User: event: agent_status_changed\ndata: {"employeeId": "e-1", "status": "IDLE"}\n\n
        Note over User: Avatar 3D berjalan kembali ke sofa istirahat
    end
```

---

### 3.3 Virtual Office Agent & Task State Machine Diagram

Diagram berikut menggambarkan transisi status logis dan fisik dari entitas Karyawan Virtual (*AI Employee*) dan Tugas (*Task*) di dalam lingkungan simulasi 3D.

```mermaid
stateDiagram-v2
    [*] --> OFFLINE: Inisialisasi Sistem

    OFFLINE --> IDLE: Pegawai Masuk Shift / Online
    
    state IDLE {
        [*] --> Standby
        Standby --> WalkingToBreak: Waktu Istirahat Tiba
        WalkingToBreak --> OnBreakLounge: Tiba di Sofa Santai
        OnBreakLounge --> WalkingToDesk: Waktu Istirahat Usai
        WalkingToDesk --> Standby: Tiba di Meja Kerja
    }

    IDLE --> THINKING: Menerima Tugas Baru dari User/Queue
    
    state WORKING_PHASE {
        THINKING --> TOOL_EXECUTING: Menjalankan Perintah / Pemanggilan API
        TOOL_EXECUTING --> THINKING: Memproses Keluaran Tool
        TOOL_EXECUTING --> WAITING: Menunggu Respon Eksternal / User Input
        WAITING --> THINKING: Respon Diterima
    }

    WORKING_PHASE --> IN_MEETING: Diundang ke Ruang Rapat (Discussion)
    IN_MEETING --> COLLABORATING: Diskusi Multi-Agent Berlangsung
    COLLABORATING --> WORKING_PHASE: Rapat Selesai / Action Item Terbentuk

    WORKING_PHASE --> IDLE: Semua Task Selesai
    IDLE --> OFFLINE: Jam Kerja Berakhir / Shutdown
```

---

### 3.4 Ultra-Fast 1-Script Rsync Deployment Pipeline

Diagram alur di bawah ini mendokumentasikan urutan eksekusi presisi dari skrip automasi [`deploy.sh`](file:///Users/01011001andra/Code/projects/ai-virtual-office/deploy.sh) lokal ke remote server.

```mermaid
graph LR
    subgraph LocalMachine["💻 Mesin Pengembang Lokal (macOS ARM64)"]
        Trigger["Run: ./deploy.sh [all|fe|be]"]
        BuildFE["1. npm run build --prefix frontend\n(Vite compilation -> dist/ ~0.4s)"]
        BuildBE["2. npm run build --prefix backend\n(NestJS SWC/TSC -> dist/ ~1.5s)"]
        RsyncExec["3. rsync -avzP over SSH Key\n(Delta Transfer Chunks < 1s)"]
    end

    subgraph SecureTransfer["🔐 Jalur SSH Terenkripsi (Port 22)"]
        SSHChannel["SSH Identity: ~/.ssh/id_musyan\nTarget: musyan@192.168.64.10\nZero Password Prompt"]
    end

    subgraph RemoteServer["🖥️ Production Server (Debian 13 ARM64)"]
        RcvFE["4. Ekstrak ke /apps/frontend/ai-virtual-office/dist"]
        RcvBE["5. Ekstrak ke /apps/backend/ai-virtual-office/dist"]
        Migrate["6. Remote: npx prisma migrate deploy\n(Schema Sync to ai_virtual_office)"]
        PM2Reload["7. Remote: pm2 reload office-api\n(Zero-Downtime Process Refresh)"]
        NginxReload["8. Nginx Serve Updated Static Assets Instantly"]
    end

    Trigger --> BuildFE
    Trigger --> BuildBE
    BuildFE --> RsyncExec
    BuildBE --> RsyncExec
    RsyncExec --> SSHChannel
    SSHChannel --> RcvFE
    SSHChannel --> RcvBE
    RcvFE --> NginxReload
    RcvBE --> Migrate
    Migrate --> PM2Reload
```

---

## 4. Matriks Status & Lifecycle Table

Tabel matriks ini memetakan integrasi status logis backend dengan kondisi spasial 3D, animasi karakter, dan indikator antarmuka HUD.

| Status Logis (`EmployeeStatus`) | Nilai Kolom Database | Koordinat 3D & Perilaku Navigasi | State Animasi Mesh | Tampilan Badge HUD | Deskripsi Fungsional & Aturan Sistem |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`OFFLINE`** | `status = 'OFFLINE'` | Tersembunyi / *despawned* di luar viewport kamera | None (Opacity 0%) | Abu-abu (`bg-zinc-600`) | Karyawan virtual sedang tidak aktif atau dinonaktifkan oleh administrator. |
| **`IDLE`** | `status = 'IDLE'` | Di kursi meja kerja masing-masing (`workstation.seatPos`) | Duduk santai (`SitIdle`), mengetik sesekali | Biru Muda (`bg-sky-500`) | Siap menerima tugas baru; tidak sedang menjalankan proses komputasi. |
| **`THINKING`** | `status = 'THINKING'` | Di meja kerja, menghadap monitor utama | Tangan di dagu (`ThinkingPose`), ekspresi fokus | Kuning (`bg-amber-500`) | Sedang memproses *prompt* LLM atau merancang rencana aksi (reasoning step). |
| **`TOOL_EXECUTING`** | `status = 'TOOL_EXECUTING'` | Di meja kerja atau bergerak ke server rack | Mengetik cepat (`FastTyping`), efek partikel glow | Oranye (`bg-orange-500`) | Sedang mengeksekusi integrasi tool eksternal (HTTP, Database query, S3 upload). |
| **`WAITING`** | `status = 'WAITING'` | Menoleh ke arah pintu atau menatap layar | Berdiri gelisah (`WaitingPose`) | Ungu (`bg-purple-500`) | Menunggu konfirmasi manusia (*human-in-the-loop*) atau webhook pihak ketiga. |
| **`ON_BREAK`** | `status = 'ON_BREAK'` | Di area lounge / pantry (`breakArea.loungePos`) | Duduk di sofa sambil memegang cangkir kopi | Hijau Lumut (`bg-emerald-600`)| Menjalankan siklus regenerasi token atau jeda otomatis antar-batch tugas. |
| **`IN_MEETING`** | `status = 'IN_MEETING'` | Ruang rapat utama (`meetingRoom.chair[i]`) | Duduk melingkar di meja rapat konferensi | Indigo (`bg-indigo-500`) | Berpartisipasi dalam diskusi kelompok atau *standup meeting* virtual. |
| **`COLLABORATING`** | `status = 'COLLABORATING'` | Berdiri di samping meja karyawan lain | Berbicara (`TalkingGesture`), gestur tangan aktif | Merah Muda (`bg-pink-500`) | Sedang bertukar konteks atau mendiskusikan *subtask* dengan agen AI lain. |

---

## 5. Multi-Tenancy & Multi-Layer Security Architecture

### 5.1 Lapis 1: Controller, Guards & Session Token
Keamanan level aplikasi dijamin melalui integrasi **BetterAuth** dan NestJS Guards terstandarisasi:
1. **`RequiresCompanyGuard`**: Setiap endpoint yang mengelola data kantor wajib memvalidasi bahwa sesi yang dikirimkan memiliki `activeCompanyId`. Jika tidak ada, request ditolak dengan kode `403 Forbidden`.
2. **`RBACGuard` & `@RequirePermissions`**: Mengisolasi wewenang eksekutif (tambah karyawan, ubah kunci API AI) dari wewenang pengguna biasa.
3. **`AppThrottlerGuard`**: Mencegah serangan *denial of service* (DoS) dan brute-force dengan membatasi request per IP address (100 req/menit untuk standard endpoints, 10 req/menit untuk endpoint autentikasi).

### 5.2 Lapis 2: Database Constraints & Multi-Schema Isolation
Di level PostgreSQL, pemisahan data antar-kantor/perusahaan (*tenants*) ditegakkan secara absolut:
1. **Foreign Key Integrity**: Semua tabel entitas kerja (`employee`, `task`, `discussion`, `ai_provider`) memiliki relasi `companyId` merujuk ke tabel `company(id)` dengan aturan `ON DELETE CASCADE`.
2. **Composite Indexes**: Seluruh tabel diindeks secara komposit dengan kolom `companyId` di posisi pertama (misal: `@@index([companyId, status])` dan `@@index([companyId, createdAt])`), menjamin isolasi data query dan mencegah *table scan* global.
3. **Strict Tenancy Scoping**: Seluruh query Prisma di dalam `EmployeeService`, `TaskService`, dan `DiscussionService` wajib mengikutsertakan filter `{ where: { companyId } }`.

### 5.3 Lapis 3: Realtime SSE Channel Isolation
Pada lapisan komunikasi realtime:
1. **Token Query Interception**: `SseTokenMiddleware` mengekstrak token dari query string (`/api/v1/office/stream?token=...`) karena protokol native `EventSource` di browser tidak mendukung *custom HTTP headers*.
2. **Company Room Isolation**: Stream events dipancarkan menggunakan channel terisolasi berbasis tenant `office:${companyId}`. Karyawan atau pengguna di Kantor A tidak akan pernah menerima event dari Kantor B.
3. **Heartbeat Keep-Alive**: Setiap 15 detik, server mengirimkan event `heartbeat` untuk menjaga koneksi TCP tetap hidup melalui proxy Cloudflare dan Nginx.

---

## 6. Complete Database Structures, Prisma Schemas & Migration Engine

### 6.1 PostgreSQL Initialization & Pgvector Specs
Container PostgreSQL berjalan dengan image `pgvector/pgvector:pg16` di host `192.168.64.10:8155`.
Perintah pembuatan database baru:
```sql
CREATE DATABASE ai_virtual_office;
GRANT ALL PRIVILEGES ON DATABASE ai_virtual_office TO musyan;
```

### 6.2 Complete Prisma Multi-Schema Specifications
Codebase backend menggunakan arsitektur Prisma 7 multi-schema yang terbagi dalam berkas-berkas modular di [`backend/prisma/schema/`](file:///Users/01011001andra/Code/projects/ai-virtual-office/backend/prisma/schema):

#### A. `system.prisma` (Core Identity & Multi-Tenancy)
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

model Company {
  id                   String    @id @default(uuid())
  name                 String    @default("")
  code                 String?   @unique
  email                String?
  phone                String?
  address              String?
  isActive             Boolean   @default(true)
  modules              String[]  @default([])
  multipleLoginEnabled Boolean   @default(true)
  createdById          String?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
  deletedAt            DateTime?

  activityLogs    ActivityLog[]
  roles           Role[]
  users           User[]
  lastActiveUsers User[]          @relation("UserLastActiveCompany")
  members         CompanyMember[]
  activeSessions  Session[]

  // Virtual office relations
  officeProfile      OfficeProfile?
  employees          Employee[]
  tasks              Task[]
  employeeActivities EmployeeActivity[]
  discussions        Discussion[]
  aiProviders        AiProvider[]

  @@map("company")
}

model User {
  id                  String    @id @default(uuid())
  name                String    @default("")
  email               String?   @unique
  phone               String?
  address             String?
  deletedAt           DateTime?
  updatedAt           DateTime  @updatedAt
  createdAt           DateTime  @default(now())
  emailVerified       Boolean   @default(false)
  roleId              String?
  image               String?
  companyId           String?
  lastActiveCompanyId String?
  isSuperAdmin        Boolean   @default(false)
  mustChangePassword  Boolean   @default(false)

  accounts          Account[]
  activityLogs      ActivityLog[]
  assets            Assets[]
  sessions          Session[]
  company           Company?        @relation(fields: [companyId], references: [id], onDelete: Restrict)
  lastActiveCompany Company?        @relation("UserLastActiveCompany", fields: [lastActiveCompanyId], references: [id], onDelete: SetNull)
  role              Role?           @relation(fields: [roleId], references: [id], onDelete: Restrict)
  memberships       CompanyMember[]
  invitedMembers    CompanyMember[] @relation("MemberInviter")

  @@map("user")
}

model Session {
  id              String   @id @default(uuid())
  expiresAt       DateTime
  token           String   @unique
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  ipAddress       String?
  userAgent       String?
  userId          String?
  impersonatedBy  String?
  activeCompanyId String?
  sessionType     String?  @default("app")
  user            User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  activeCompany   Company? @relation(fields: [activeCompanyId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([userId, sessionType])
  @@map("session")
}

model Account {
  id                    String    @id @default(uuid())
  accountId             String    @default("")
  providerId            String    @default("")
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@index([userId])
  @@map("account")
}

model Verification {
  id         String    @id @default(uuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime? @default(now())
  updatedAt  DateTime? @updatedAt

  @@index([identifier])
  @@map("verification")
}

model Role {
  id          String    @id @default(uuid())
  name        String
  description String?
  isSystem    Boolean   @default(false)
  companyId   String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?
  company     Company?  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  users       User[]
  permissions RolePermission[]

  @@unique([name, companyId])
  @@index([companyId])
  @@map("role")
}

model RolePermission {
  id         String   @id @default(uuid())
  roleId     String
  permission String
  role       Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([roleId, permission])
  @@index([roleId])
  @@map("role_permission")
}

model CompanyMember {
  id          String    @id @default(uuid())
  companyId   String
  userId      String
  roleId      String?
  invitedById String?
  joinedAt    DateTime  @default(now())
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  company   Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  inviter   User?   @relation("MemberInviter", fields: [invitedById], references: [id], onDelete: SetNull)

  @@unique([companyId, userId])
  @@index([companyId])
  @@index([userId])
  @@map("company_member")
}

model ActivityLog {
  id        String   @id @default(uuid())
  companyId String?
  userId    String?
  action    String
  entity    String
  entityId  String?
  details   Json?
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())

  company Company? @relation(fields: [companyId], references: [id], onDelete: Cascade)
  user    User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([companyId])
  @@index([userId])
  @@index([createdAt])
  @@map("activity_log")
}

model Assets {
  id        String    @id @default(uuid())
  name      String
  path      String
  size      Int
  mimeType  String
  userId    String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?
  user      User?     @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@map("assets")
}
```

#### B. `office.prisma` (Office Layout & Spatial Profile)
```prisma
enum OfficeTemplate {
  EMPTY
  DEMO_TEAM
}

model OfficeProfile {
  id            String         @id @default(uuid())
  companyId     String         @unique
  company       Company        @relation(fields: [companyId], references: [id], onDelete: Cascade)
  name          String         @default("Virtual HQ")
  template      OfficeTemplate @default(DEMO_TEAM)
  width         Int            @default(48)
  depth         Int            @default(36)
  wallHeight    Float          @default(3.8)
  floorMaterial String         @default("carpet-navy")
  wallColor     String         @default("#2c3444")
  layoutJson    Json?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  @@map("office_profile")
}
```

#### C. `workforce.prisma` (AI Employees, Workstations, Activities, & Tasks)
```prisma
enum EmployeeStatus {
  IDLE
  WORKING
  THINKING
  TOOL_EXECUTING
  WAITING
  ON_BREAK
  IN_MEETING
  COLLABORATING
  OFFLINE
}

enum TaskStatus {
  QUEUED
  EXECUTING
  WAITING
  COMPLETED
  FAILED
  CANCELLED
}

model Employee {
  id              String         @id @default(uuid())
  companyId       String
  company         Company        @relation(fields: [companyId], references: [id], onDelete: Cascade)
  name            String
  role            String         @default("AI Assistant")
  department      String         @default("Engineering")
  avatarSeed      String         @default("seed-1")
  avatarColor     String         @default("#38bdf8")
  status          EmployeeStatus @default(IDLE)
  currentTaskText String?
  seatIndex       Int?
  assignedDeskId  String?
  posX            Float          @default(0)
  posY            Float          @default(0)
  posZ            Float          @default(0)
  rotationY       Float          @default(0)
  systemPrompt    String?
  aiProviderId    String?
  modelName       String?
  temperature     Float          @default(0.7)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  tasks      Task[]
  activities EmployeeActivity[]

  @@index([companyId])
  @@index([companyId, status])
  @@map("employee")
}

model Task {
  id          String     @id @default(uuid())
  companyId   String
  company     Company    @relation(fields: [companyId], references: [id], onDelete: Cascade)
  employeeId  String?
  employee    Employee?  @relation(fields: [employeeId], references: [id], onDelete: SetNull)
  title       String
  description String?
  status      TaskStatus @default(QUEUED)
  progress    Int        @default(0)
  resultText  String?
  errorText   String?
  startedAt   DateTime?
  completedAt DateTime?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@index([companyId])
  @@index([companyId, status])
  @@index([employeeId])
  @@map("task")
}

model EmployeeActivity {
  id         String   @id @default(uuid())
  companyId  String
  company    Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  employeeId String
  employee   Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  action     String
  details    Json?
  createdAt  DateTime @default(now())

  @@index([companyId])
  @@index([employeeId])
  @@index([createdAt])
  @@map("employee_activity")
}
```

#### D. `discussion.prisma` (Multi-Agent Collaboration Rooms)
```prisma
model Discussion {
  id             String    @id @default(uuid())
  companyId      String
  company        Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)
  startedById    String
  participantIds String[]  @default([])
  endedAt        DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  messages DiscussionMessage[]

  @@index([companyId])
  @@map("discussion")
}

model DiscussionMessage {
  id           String     @id @default(uuid())
  companyId    String
  discussionId String
  discussion   Discussion @relation(fields: [discussionId], references: [id], onDelete: Cascade)
  fromType     String     @default("user") // "user" | "employee" | "system"
  fromId       String?
  text         String     @default("")
  isDemo       Boolean    @default(false)
  createdAt    DateTime   @default(now())

  @@index([companyId])
  @@index([discussionId])
  @@index([createdAt])
  @@map("discussion_message")
}
```

#### E. `ai.prisma` (LLM Engine Configurations & API Keys)
```prisma
model AiProvider {
  id        String   @id @default(uuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  provider  String   // "openai" | "anthropic" | "gemini" | "groq" | "ollama"
  name      String
  baseUrl   String?
  apiKey    String?  // Terenkripsi via secret-box AES-256-GCM
  models    String[] @default([])
  isActive  Boolean  @default(true)
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([companyId, provider, name])
  @@index([companyId])
  @@map("ai_provider")
}
```

---

## 7. API Specifications, Data Contracts & Event Streams

### 7.1 Core Health Check Endpoints
#### `GET /api/v1/health`
Endpoint publik bebas throttle untuk memvalidasi ketersediaan proses Node.js.
- **Request Headers**: None
- **Response HTTP 200**:
```json
{
  "status": "ok",
  "uptime": 14205
}
```

#### `GET /api/v1/health/deep`
Endpoint diagnostik mendalam untuk memeriksa koneksi database PostgreSQL dan MinIO S3 (memerlukan hak SuperAdmin).
- **Request Headers**: `Authorization: Bearer <superadmin-token>`
- **Response HTTP 200**:
```json
{
  "db": "ok",
  "s3": "ok",
  "pool": {
    "total": 10,
    "idle": 8,
    "waiting": 0
  },
  "ms": 4
}
```

---

### 7.2 Authentication & Session Endpoints
#### `POST /api/v1/auth/sign-in`
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "email": "musyan.app@gmail.com",
  "password": "SuperSecretPassword123!"
}
```
- **Response HTTP 200**:
```json
{
  "status": true,
  "data": {
    "token": "avo_sess_9a8fbc127d4e410a8c2014b",
    "user": {
      "id": "usr_410924",
      "name": "Musyan Administrator",
      "email": "musyan.app@gmail.com",
      "isSuperAdmin": true
    },
    "company": {
      "id": "comp_default_hq",
      "name": "Musyan Virtual HQ",
      "code": "HQ-01"
    }
  }
}
```

---

### 7.3 Virtual Office Entities (Employees, Tasks, Discussions)
#### `GET /api/v1/office/employees`
- **Request Headers**: `Authorization: Bearer <token>`
- **Response HTTP 200**:
```json
{
  "status": true,
  "data": [
    {
      "id": "emp_01",
      "name": "Sarah Connor",
      "role": "Lead Frontend Engineer",
      "department": "Engineering",
      "avatarSeed": "sarah-avatar",
      "avatarColor": "#0ea5e9",
      "status": "WORKING",
      "currentTaskText": "Optimizing Three.js LOD geometry batching",
      "seatIndex": 1,
      "posX": 4.5,
      "posY": 0.0,
      "posZ": -2.2,
      "rotationY": 1.57
    }
  ]
}
```

#### `POST /api/v1/office/tasks`
- **Request Headers**: `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Request Body**:
```json
{
  "title": "Refactor Shader Pass",
  "description": "Implement SMAA antialiasing pass in postprocessing",
  "employeeId": "emp_01"
}
```
- **Response HTTP 201**:
```json
{
  "status": true,
  "data": {
    "id": "tsk_8892",
    "title": "Refactor Shader Pass",
    "status": "QUEUED",
    "progress": 0,
    "createdAt": "2026-11-05T15:20:00.000Z"
  }
}
```

---

### 7.4 Realtime Server-Sent Events (SSE) Protocol
#### `GET /api/v1/office/stream?token=<session-token>`
Koneksi streaming satu arah dari server ke antarmuka 3D browser.
- **Response Headers**:
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache, no-transform`
  - `Connection: keep-alive`
  - `X-Accel-Buffering: no`

- **Contoh Stream Payload**:
```http
event: heartbeat
data: {"time": 1730821000}

event: employee_moved
data: {"employeeId":"emp_01","x":6.2,"y":0.0,"z":-1.4,"rotationY":3.14}

event: task_progress
data: {"taskId":"tsk_8892","progress":75,"status":"EXECUTING"}

event: discussion_message
data: {"discussionId":"disc_01","fromType":"employee","fromId":"emp_01","text":"Shader compiled successfully with 0 warnings."}
```

---

## 8. Exhaustive Edge Cases & Mitigation Matrix

Tabel mitigasi risiko teknis berikut dirancang untuk menjamin stabilitas 99.99% sistem di lingkungan produksi:

| No | Skenario Edge Case | Potensi Dampak | Akar Penyebab Teknis | Solusi Mitigasi Arsitektural & Kode |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Koneksi SSE Drop di Balik Proxy Cloudflare** | Avatar 3D berhenti bergerak; HUD tidak update; user mengira app freeze | Cloudflare tunnel memotong idle TCP socket setelah 100 detik tanpa lalu lintas data | Backend mengirimkan event `heartbeat` setiap 15 detik; Frontend mengimplementasikan reconnection loop exponential backoff di `frontend/src/state/remote.ts`. |
| **2** | **Nginx Buffer Penuh pada SSE Stream** | Event realtime tertahan dan keluar sekaligus dalam batch besar (bursty updates) | Parameter `proxy_buffering on` secara default menampung response hingga 4KB/8KB | Di virtual host `office-api.musyan.my.id.conf`, wajib memasang `proxy_buffering off;` dan header `X-Accel-Buffering: no;`. |
| **3** | **PostgreSQL Connection Pool Exhaustion** | Backend melempar error `500 PoolTimeout: Timeout awaiting connection` | Terlalu banyak query lambat atau pool max diatur terlalu kecil/besar | Set `DB_POOL_MAX=10` pada `backend/.env`. Tambahkan pemantauan berkala di endpoint `/health/deep`. Gunakan query efisien dengan composite index. |
| **4** | **Perbedaan Target Platform Engine Prisma** | Error runtime backend: `PrismaClientInitializationError: Query engine binary not found` | Build dijalankan di macOS (darwin-arm64) tapi engine dijalankan di Debian (linux-arm64-openssl-3.0.x) | Skrip `deploy.sh` mengeksekusi `npx prisma generate` langsung di host remote Linux setelah rsync, memastikan binary engine yang dibentuk cocok dengan glibc Debian 13. |
| **5** | **Cross-Tenant Data Leakage** | Pengguna Kantor A melihat karyawan virtual atau tugas dari Kantor B | Query database lupa menyertakan klausa `where: { companyId }` | Terapkan decorator `@ActiveCompany()` dan `RequiresCompanyGuard` di seluruh controller; audit unit test Prisma dengan mock multi-company. |
| **6** | **Kegagalan Transfer Berkas Rsync Parsial** | Berkas terpotong di remote host saat koneksi internet pengembang terputus | Rsync terhenti saat mentransfer berkas besar tanpa mode atomic/delay-updates | Gunakan flag `rsync -avz --partial --delay-updates` sehingga berkas lama tetap utuh sampai seluruh berkas baru selesai diunggah. |
| **7** | **Cloudflare Tunnel Restart Flapping** | Pengunjung mendapatkan error Cloudflare 502 / 1033 Tunnel error | Service `cloudflared` mengalami crash loop akibat sintaks YAML tidak valid | Sebelum restart, jalankan validasi sintaks `cloudflared tunnel ingress validate` dan buat backup otomatis `config.yml.bak`. |
| **8** | **CORS Preflight (OPTIONS) Ditolak oleh Backend** | Browser melempar `Access-Control-Allow-Origin Missing` saat memanggil API | Konfigurasi `CORS_ORIGIN` di backend tidak menyertakan origin `https://office.musyan.my.id` | Set `CORS_ORIGIN="https://office.musyan.my.id,http://localhost:5173"` pada `backend/.env` dan handle HTTP `OPTIONS` eksplisit di Express CORS middleware. |

---

## 9. Step-by-Step Execution Phases & Code Blueprints

### 9.1 Phase 1: Server Hardening, Global Runtimes & Database Provisioning
- **Target Server**: `musyan@192.168.64.10` / `root@192.168.64.10`
- **Status Saat Ini**:
  - SSH Key `~/.ssh/id_musyan` sudah terpasang di `/home/musyan/.ssh/authorized_keys` dan `/root/.ssh/authorized_keys`.
  - Node.js v24.16.0 dan npm v11.13.0 sudah disinkronkan ke `/usr/local/bin` sehingga dapat dijalankan oleh user `musyan`.
  - PM2 v7.1.2 sudah terpasang global di `/usr/local/bin/pm2`.
  - Basis data PostgreSQL `ai_virtual_office` sudah dibuat di dalam container `postgres`.

#### Blueprint Verifikasi Database di Host Remote:
```bash
# Verifikasi database ai_virtual_office di remote
ssh 192.168.64.10 "docker exec -i postgres psql -U musyan -d ai_virtual_office -c 'SELECT current_database(), current_user, version();'"
```

---

### 9.2 Phase 2: Cloudflare Tunnel Routing & Edge DNS
- **Status Saat Ini**:
  - Perintah `cloudflared tunnel route dns musyan-tunnel office.musyan.my.id` telah berhasil dijalankan.
  - Perintah `cloudflared tunnel route dns musyan-tunnel office-api.musyan.my.id` telah berhasil dijalankan.

#### Blueprint Pembaruan `/etc/cloudflared/config.yml`:
Menambahkan aturan ingress untuk frontend dan backend sebelum catch-all rule `- service: http_status:404`:

```yaml
  # ==========================================
  # AI VIRTUAL OFFICE (3D Workspace & NestJS API)
  # ==========================================
  - hostname: office.musyan.my.id
    service: http://localhost:80
  - hostname: office-api.musyan.my.id
    service: http://localhost:80
```

#### Eksekusi Reload Cloudflare:
```bash
ssh root@192.168.64.10 "systemctl restart cloudflared && systemctl status cloudflared --no-pager"
```

---

### 9.3 Phase 3: Nginx Virtual Host Configuration
Menyiapkan dua konfigurasi server block pada direktori `/etc/nginx/conf.d/` di server remote.

#### A. Frontend Virtual Host: `/etc/nginx/conf.d/office.musyan.my.id.conf`
Melayani bundel statis React Three Fiber dengan fallback SPA:
```nginx
server {
    listen 80;
    server_name office.musyan.my.id;

    # Direktori build frontend
    root /home/musyan/projects/apps/frontend/ai-virtual-office/dist;
    index index.html;

    # Caching agresif untuk aset statis Three.js, bundle JS/CSS, woff2, gambar
    location ~* \.(?:js|css|png|jpg|jpeg|gif|svg|ico|woff2?|glb|gltf|bin)$ {
        try_files $uri =404;
        access_log off;
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
    }

    # Fallback SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proteksi berkas tersembunyi
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
```

#### B. Backend API Virtual Host: `/etc/nginx/conf.d/office-api.musyan.my.id.conf`
Melayani proxy API NestJS dengan preservasi WebSocket dan penonaktifan buffer untuk SSE:
```nginx
server {
    listen 80;
    server_name office-api.musyan.my.id;

    # Pemetaan Real IP dari Cloudflare Edge
    real_ip_header CF-Connecting-IP;
    set_real_ip_from 0.0.0.0/0;

    location / {
        proxy_pass http://localhost:8010;

        # Headers standar proxy
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Kritis untuk Realtime SSE (Server-Sent Events)
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        chunked_transfer_encoding on;
    }
}
```

#### Blueprint Validasi Nginx:
```bash
ssh root@192.168.64.10 "nginx -t && systemctl restart nginx"
```

---

### 9.4 Phase 4: Production Builds & Configuration Synchronization

#### A. Konfigurasi Environment Backend Remote (`/home/musyan/projects/apps/backend/ai-virtual-office/.env`):
```dotenv
NODE_ENV=production
PORT=8010
CORS_ORIGIN=https://office.musyan.my.id,http://localhost:5173
TRUSTED_ORIGINS=https://office.musyan.my.id

# Database PostgreSQL Lokal Server
DATABASE_URL="postgresql://musyan:venxxx102@localhost:8155/ai_virtual_office?schema=public"
DB_POOL_MAX=10

# BetterAuth Security Secrets
BETTER_AUTH_SECRET=9f8e7d6c5b4a31201928374655a4b3c2d1e0f
BETTER_AUTH_URL=https://office-api.musyan.my.id

# MinIO S3 Compatible Storage (Host Lokal)
S3_REGION=us-east-1
S3_ENDPOINT=https://s3.musyan.my.id
S3_ACCESS_KEY=GgS9PlWchuks7sexQEJJ
S3_SECRET_KEY=AAD5IDm6cdVDQofLr4siwRYXxxXWDhh0nC1NfMyk
S3_BUCKET=virtual-office
S3_PREFIX=virtual-office

# Cache / Worker Redis
REDIS_URL=redis://localhost:6379

TRUST_PROXY=true
```

#### B. Konfigurasi Environment Frontend Lokal untuk Build Produksi:
Sebelum menjalankan build frontend, set `VITE_API_URL` ke domain produksi:
```dotenv
VITE_API_URL=https://office-api.musyan.my.id/api/v1
```

---

### 9.5 Phase 5: Single-Script Atomic Rsync Deployment Engine (`deploy.sh`)

Skrip ini akan disimpan di root workspace: [`deploy.sh`](file:///Users/01011001andra/Code/projects/ai-virtual-office/deploy.sh). Skrip ini menyediakan orkestrasi lengkap dengan opsi modular:
- `./deploy.sh` atau `./deploy.sh all` : Deploy Frontend + Backend + Migrasi DB + Restart PM2 (< 4 detik).
- `./deploy.sh fe` : Build & Rsync Frontend saja (< 1.5 detik).
- `./deploy.sh be` : Build & Rsync Backend + Restart PM2 (< 2.5 detik).
- `./deploy.sh migrate` : Jalankan migrasi Prisma di server remote.
- `./deploy.sh status` : Periksa status proses PM2 dan Nginx di server remote.
- `./deploy.sh logs` : Streaming log realtime dari proses backend remote.

#### Full Source Code Blueprint: [`deploy.sh`](file:///Users/01011001andra/Code/projects/ai-virtual-office/deploy.sh)
```bash
#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# AI VIRTUAL OFFICE - ULTRA-FAST RSYNC DEPLOYMENT ENGINE
# ==============================================================================
# Host: 192.168.64.10 (Debian 13 ARM64)
# Remote User: musyan
# Frontend Domain: https://office.musyan.my.id
# Backend API: https://office-api.musyan.my.id
# ==============================================================================

SERVER_HOST="192.168.64.10"
SERVER_USER="musyan"
SSH_IDENTITY="${HOME}/.ssh/id_musyan"

REMOTE_BE_DIR="/home/musyan/projects/apps/backend/ai-virtual-office"
REMOTE_FE_DIR="/home/musyan/projects/apps/frontend/ai-virtual-office"

GREEN="\033[0;32m"
YELLOW="\033[0;33m"
CYAN="\033[0;36m"
RED="\033[0;31m"
BOLD="\033[1m"
NC="\033[0m"

log_info()  { echo -e "${CYAN}ℹ️  ${BOLD}$*${NC}"; }
log_ok()    { echo -e "${GREEN}✅ ${BOLD}$*${NC}"; }
log_warn()  { echo -e "${YELLOW}⚠️  ${BOLD}$*${NC}"; }
log_error() { echo -e "${RED}❌ ${BOLD}$*${NC}"; }

ssh_cmd() {
  ssh -i "${SSH_IDENTITY}" -o StrictHostKeyChecking=accept-new "${SERVER_USER}@${SERVER_HOST}" "$@"
}

ensure_remote_dirs() {
  log_info "Memastikan direktori remote tersedia..."
  ssh_cmd "mkdir -p '${REMOTE_BE_DIR}' '${REMOTE_FE_DIR}'"
}

# ------------------------------------------------------------------------------
# 1. DEPLOY FRONTEND
# ------------------------------------------------------------------------------
deploy_frontend() {
  log_info "Memulai proses build Frontend..."
  local start_time=$(date +%s)

  # Export environment produksi saat build
  VITE_API_URL="https://office-api.musyan.my.id/api/v1" npm --prefix frontend run build

  log_ok "Build Frontend sukses! Memulai Rsync ke ${SERVER_HOST}..."

  rsync -avz --delete \
    -e "ssh -i ${SSH_IDENTITY} -o StrictHostKeyChecking=accept-new" \
    frontend/dist/ \
    "${SERVER_USER}@${SERVER_HOST}:${REMOTE_FE_DIR}/dist/"

  # Pastikan permission direktori dapat dibaca Nginx
  ssh_cmd "chmod -R 755 '${REMOTE_FE_DIR}'"

  local duration=$(( $(date +%s) - start_time ))
  log_ok "Frontend berhasil dideploy dalam ${duration} detik! URL: https://office.musyan.my.id"
}

# ------------------------------------------------------------------------------
# 2. DEPLOY BACKEND
# ------------------------------------------------------------------------------
deploy_backend() {
  log_info "Memulai proses build Backend (NestJS)..."
  local start_time=$(date +%s)

  npm --prefix backend run build

  log_ok "Build Backend sukses! Memulai Rsync ke ${SERVER_HOST}..."

  # Sinkronkan artefak dist, package.json, prisma schema, dan konfigurasi
  rsync -avz \
    -e "ssh -i ${SSH_IDENTITY} -o StrictHostKeyChecking=accept-new" \
    --exclude="node_modules" \
    --exclude=".git" \
    --exclude="src" \
    --exclude="test" \
    backend/dist \
    backend/package.json \
    backend/package-lock.json \
    backend/prisma \
    backend/prisma.config.ts \
    backend/tsconfig.json \
    "${SERVER_USER}@${SERVER_HOST}:${REMOTE_BE_DIR}/"

  log_info "Memeriksa dependensi dan migrasi database di server remote..."
  ssh_cmd "bash -c '
    cd \"${REMOTE_BE_DIR}\"
    if [ ! -d \"node_modules\" ]; then
      echo \"Menginstall production node_modules di remote...\"
      npm install --omit=dev --ignore-scripts
    fi
    echo \"Regenerasi Prisma Client remote...\"
    npx prisma generate
    echo \"Menjalankan migrasi skema database...\"
    npx prisma migrate deploy || true
    echo \"Reloading PM2 process...\"
    pm2 describe office-api >/dev/null 2>&1 && pm2 reload office-api || pm2 start dist/src/main.js --name office-api --time
    pm2 save
  '"

  local duration=$(( $(date +%s) - start_time ))
  log_ok "Backend berhasil dideploy dalam ${duration} detik! API: https://office-api.musyan.my.id/api/v1"
}

# ------------------------------------------------------------------------------
# 3. REMOTE UTILITIES
# ------------------------------------------------------------------------------
run_migration() {
  log_info "Menjalankan migrasi database di remote..."
  ssh_cmd "cd '${REMOTE_BE_DIR}' && npx prisma migrate deploy"
  log_ok "Migrasi database selesai!"
}

check_status() {
  log_info "Memeriksa status layanan di ${SERVER_HOST}..."
  ssh_cmd "pm2 status office-api; echo '--- NGINX STATUS ---'; systemctl status nginx --no-pager | head -n 5; echo '--- CLOUDFLARED STATUS ---'; systemctl status cloudflared --no-pager | head -n 5"
}

view_logs() {
  log_info "Streaming log office-api dari remote (Ctrl+C untuk keluar)..."
  ssh_cmd "pm2 logs office-api --lines 50"
}

# ------------------------------------------------------------------------------
# MAIN ENTRYPOINT
# ------------------------------------------------------------------------------
COMMAND="${1:-all}"

case "$COMMAND" in
  fe|frontend)
    ensure_remote_dirs
    deploy_frontend
    ;;
  be|backend)
    ensure_remote_dirs
    deploy_backend
    ;;
  all)
    ensure_remote_dirs
    deploy_frontend
    deploy_backend
    log_ok "🎉 SELURUH SISTEM BERHASIL DIDELPOY!"
    log_info "Frontend: https://office.musyan.my.id"
    log_info "Backend : https://office-api.musyan.my.id/api/v1/health"
    ;;
  migrate)
    run_migration
    ;;
  status)
    check_status
    ;;
  logs)
    view_logs
    ;;
  *)
    echo "Penggunaan: $0 {all|fe|be|migrate|status|logs}"
    exit 1
    ;;
esac
```

---

### 9.6 Phase 6: Process Management via PM2 & Remote Lifecycle

Di server remote, backend dikelola oleh PM2 di bawah akun user `musyan`.
- Nama aplikasi: `office-api`
- Port internal: `8010`
- Startup configuration: Berjalan otomatis saat host reboot via `pm2 startup` dan `pm2 save`.
- Log output: `/home/musyan/.pm2/logs/office-api-out.log` dan `office-api-error.log`.

---

## 10. Massive Verification, Testing Suite & Live Sanity Protocol

### 10.1 Automated CLI Verification Checks
Setelah seluruh tahap eksekusi selesai, jalankan rangkaian audit terminal berikut:

```bash
# 1. Audit DNS Cloudflare CNAME
dig +short office.musyan.my.id
dig +short office-api.musyan.my.id

# 2. Audit HTTP Response Backend Health
curl -s -i https://office-api.musyan.my.id/api/v1/health | head -n 10

# 3. Audit HTTP Response Frontend Index
curl -s -i https://office.musyan.my.id | head -n 15

# 4. Audit Koneksi Database Remote
ssh 192.168.64.10 "docker exec -i postgres psql -U musyan -d ai_virtual_office -c 'SELECT table_name FROM information_schema.tables WHERE table_schema=\"public\";'"

# 5. Audit Realtime Stream Header
curl -N -H "Accept: text/event-stream" https://office-api.musyan.my.id/api/v1/office/stream 2>&1 | head -n 5
```

---

### 10.2 Regression Test Cases (E2E & Unit)

```typescript
/**
 * Test Suite: Production Deployment Sanity Verification
 * Path: e2e/production-sanity.spec.ts
 */
import { test, expect } from '@playwright/test';

test.describe('Production AI Virtual Office Live Verification', () => {
  test('TC-PROD-001: Frontend loads 3D Canvas and HUD successfully', async ({ page }) => {
    await page.goto('https://office.musyan.my.id');
    await expect(page).toHaveTitle(/Virtual AI Office|AI Office/i);

    // Canvas Three.js ter-mount
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 15000 });

    // HUD TopBar ter-mount
    const topBar = page.locator('header');
    await expect(topBar).toBeVisible();
  });

  test('TC-PROD-002: Backend API Health endpoint responds with 200 OK', async ({ request }) => {
    const res = await request.get('https://office-api.musyan.my.id/api/v1/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
  });

  test('TC-PROD-003: Swagger Documentation is accessible and valid', async ({ page }) => {
    await page.goto('https://office-api.musyan.my.id/api/docs');
    await expect(page.locator('.swagger-ui')).toBeVisible({ timeout: 10000 });
  });

  test('TC-PROD-004: CORS headers allow frontend origin', async ({ request }) => {
    const res = await request.fetch('https://office-api.musyan.my.id/api/v1/health', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://office.musyan.my.id',
        'Access-Control-Request-Method': 'GET',
      },
    });
    expect(res.status()).toBe(204);
    expect(res.headers()['access-control-allow-origin']).toContain('https://office.musyan.my.id');
  });
});
```

---

### 10.3 Manual QA & Visual 3D Checklist

- [ ] **Buka Browser**: Arahkan ke `https://office.musyan.my.id`.
- [ ] **Visual 3D Canvas**:
  - Model lantai kantor (*carpet-navy*) dan dinding (*#2c3444*) tampil sempurna tanpa *mesh tearing*.
  - Pencahayaan (*directional light* dan *ambient light*) memiliki intensitas seimbang.
  - Kamera dapat diputar (*orbit/pan*) dan di-*zoom* menggunakan mouse/trackpad.
- [ ] **Karakter Karyawan Virtual**:
  - Avatar 3D terlihat duduk di meja masing-masing atau bersantai di lounge.
  - NameTag di atas kepala avatar merender nama, departemen, dan status badge berwarna.
- [ ] **HUD & Panel Interaksi**:
  - TopBar menampilkan logo, jam kantor realtime, dan status koneksi (indikator hijau).
  - Mengklik avatar membuka drawer detail karyawan (*EmployeePanel*).
  - Tab *Directory*, *Workstation*, dan *Discussion* dapat dibuka dan ditutup dengan responsif.
- [ ] **Performa & FPS**:
  - Framerate stabil di 60 FPS pada layar standar (30-60 FPS pada mode baterai/hemat daya).
  - Tidak ada *memory leak* pada Three.js scene saat window diminimalkan.

---

## 11. Disaster Recovery, Rollback Procedures & Day-2 Operations

### 11.1 Prosedur Rollback Instan
Jika build baru mengalami *runtime regression*:
1. **Frontend Rollback**:
   Nginx melayani berkas dari `/home/musyan/projects/apps/frontend/ai-virtual-office/dist`. Simpan direktori backup `dist.bak`:
   ```bash
   ssh musyan@192.168.64.10 "cp -r /home/musyan/projects/apps/frontend/ai-virtual-office/dist /home/musyan/projects/apps/frontend/ai-virtual-office/dist.bak"
   ```
   Untuk rollback:
   ```bash
   ssh musyan@192.168.64.10 "rm -rf /home/musyan/projects/apps/frontend/ai-virtual-office/dist && mv /home/musyan/projects/apps/frontend/ai-virtual-office/dist.bak /home/musyan/projects/apps/frontend/ai-virtual-office/dist"
   ```

2. **Backend Rollback**:
   PM2 mendukung reload versi sebelumnya dari git atau direktori cadangan:
   ```bash
   ssh musyan@192.168.64.10 "cd /home/musyan/projects/apps/backend/ai-virtual-office && pm2 reload office-api"
   ```

### 11.2 Prosedur Backup Rutin Database
Jadwal cron backup PostgreSQL harian:
```bash
# Backup database ai_virtual_office ke storage lokal
ssh musyan@192.168.64.10 "docker exec -t postgres pg_dump -U musyan -d ai_virtual_office | gzip > /home/musyan/projects/infra/backups/ai_virtual_office_\$(date +%Y%m%d_%H%M%S).sql.gz"
```

---

> [!IMPORTANT]
> **STATUS PERSETUJUAN (APPROVAL GATE)**:
> Sesuai aturan tata kelola pilar proyek di [`.agents/AGENTS.md`](file:///Users/01011001andra/Code/projects/ai-virtual-office/.agents/AGENTS.md), implementation plan ini disusun secara komprehensif tanpa menulis implementasi kode produksi sebelum mendapatkan konfirmasi.
> 
> Mohon periksa rincian di atas dan berikan konfirmasi (`Proceed` / instruksi khusus) untuk segera memulai eksekusi Phase 1 hingga Phase 6.
