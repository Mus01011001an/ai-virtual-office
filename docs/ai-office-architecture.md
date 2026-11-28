# Office Baru — Arsitektur

Spesifikasi: [ai-office-product-spec.md](ai-office-product-spec.md). Referensi: [ai-office-reference-analysis.md](ai-office-reference-analysis.md).

## 1. Dasar kode

Office Baru dibangun di atas source `premium-app/` dari repo referensi **`GENERAL009/Agent-Office` (MIT)** — aplikasi
yang dipakai di video itu sendiri, dengan stack sama (React 19, R3F 9, drei, zustand, Tailwind 4). Lisensi disertakan
di `frontend/src/office-new/LICENSE.agent-office.txt` dan `tools/office-new/LICENSE.agent-office.txt`.
Yang diubah dari referensi: sumber data (adapter AVO + transport hook), kit aset CC0, Agent HQ, `motion` → shim CSS,
N8AO dibuang, URL model.

## 2. Isolasi dari office lama

| | Office lama | Office Baru |
|---|---|---|
| HTML entry | `frontend/index.html` | `frontend/office-new/index.html` (Vite multi-page, `vite.config.ts` → `rollupOptions.input`) |
| Kode | `frontend/src/{office,characters,hud,state,…}` | `frontend/src/office-new/**` (tidak meng-import kode office lama selain `src/lib/api.ts`) |
| Style | `src/index.css` (Fredoka, amber) | `src/office-new/index.css` (Inter/JetBrains Mono, token panel gelap) |
| State | `state/store.ts` (persist `avo-office`) | `office-new/store/useOffice.ts` (tanpa persist) |
| Bundle | `main-*.js` | `officeNew-*.js` + chunk terpisah |

**Sejak 2026-11-27 office lama disembunyikan:** `frontend/index.html` mengarahkan `/` ke `/office-new/` kecuali `?legacy`;
login & pilih office ada di `office-new/ui/Gate.tsx` (`resolveGate()` di `main.tsx`: token → `/auth/me` → office aktif).
File office lama yang disentuh: `vite.config.ts` (input build), `index.html` (redirect) dan **pintu masuk** pilihan jenis kantor (permintaan user
2026-11-27): `hud/Overlay.tsx` (kartu kantor: dua pintu), `hud/Modals.tsx` (*Jenis kantor*, tombol jadi "+ Buat kantor"),
`state/remote.ts` (`experience`, `openOfficeNew()`), `state/types.ts` (`Office.experience`). 3D/HUD office lama tidak berubah.
Backend: `system/company/office-experience.ts`, DTO create/update company, `auth.service.getMyWorkspaces` (+`experience`).
Deploy nginx: `/office-new/` dilayani oleh `office-new/index.html` (try_files `$uri/` sudah menanganinya).

## 3. Struktur `frontend/src/office-new`

```
main.tsx            probeAssets() → App
App.tsx             Overview/Walk in (OfficeScene) + Agent HQ (HqScene), keduanya tetap ter-mount
core/
  types.ts agents.ts adapter.ts     model domain & kontrak AgentDataAdapter (referensi)
  avo/api.ts                        token & fetch dari lib/api.ts, officeStream() SSE
  avo/BackendAdapter.ts             AI employee backend → agen/kursi/task/log/pesan
  avo/claudeTransport.ts            hook Claude Code via backend → PluginAdapter
  plugin/PluginAdapter.ts team.ts   logika hook → kursi (referensi; + HookTransport)
  simulation/*                      tim demo (DEMO)
store/useOffice.ts  zustand: agents/tasks/projects/messages/logs + mode, source, roster, approvals
world/              layout (10 ruangan, dinding, kursi), nav A*, runtime per-frame
scene/              Office/Fitout/Furniture/Agents/Npcs/Player/CameraDirector (referensi)
  assets.tsx        <Prop>: Synty glTF bila ada, selain itu kit CC0
  assetMode.ts      deteksi /office-new/models/office_props.gltf
  fallback/kit.ts   ±550 nama prop Synty → geometri prosedural (regex), material dibagi untuk StaticBatch
  fallback/textures.ts  kanvas: herringbone, karpet, ubin, bata, papan tanda, layar
  SyntyAvatar.tsx   rig Synty bila ada, selain itu Avatar prosedural dengan warna per karakter
hq/                 Agent HQ: HqScene (3D, useDesks: skill Claude atau agen), HqHud (tile, prompt, live log, approval),
                    claudeHq.ts (state skill dari hook: Skill tool → bangun, Notification/Stop → WAITING FOR YOUR OK), hqState
ui/                 TopBar, Dashboard, CommsPanel, AgentPanel, ChatWindow, LifeHud, Modals, motion shim, ClaudeHookHelp
```

## 4. Aliran data

```
Backend AVO                                   Office Baru
AgentRuntimeService ──emit──► SSE office/stream ──► BackendAdapter ──► store ──► 3D (Agents: status→posisi/pose)
 employee.updated / task.event /                      │                       └─► HUD (Dashboard, Comms, HQ)
 activity.created / approval.*                        └─ POST /office/employees/:id/tasks (New task, assign)
                                                         POST /office/ai-engine/generate (chat bebas)
Claude Code hooks ─► .claude/avo-office-hook.mjs (dari public/office-new/claude-hook.mjs) ─► POST /office/claude-code/events
                     ClaudeCodeService (ring 400/office) ─► SSE claude.event ─► claudeTransport ─► PluginAdapter
```

Pemetaan status backend → agen (`agentState`): `WORKING/TOOL_EXECUTING`→working, `THINKING`→thinking,
`WAITING`→paused (HQ: WAITING FOR OK), `ON_BREAK`→coffee, `IN_MEETING/COLLABORATING`→meeting, lainnya idle.
Task: `QUEUED/EXECUTING/WAITING/COMPLETED/FAILED|CANCELLED` → `queued/running/paused/completed/error`.
Task dengan `source` `delegation:N` yang muncul saat project berjalan masuk ke project itu (manager memecah kerja).

### Backend baru: `backend/src/office/claude-code/`

| Endpoint | Izin | Isi |
|---|---|---|
| `POST /office/claude-code/events` | `employee.instruction:send` | JSON stdin hook (objek/array ≤50) → normalisasi → SSE `claude.event` |
| `GET /office/claude-code/events?since=` | `employee.read` | buffer terbaru (dipakai saat office dibuka, 10 menit terakhir) |
| `GET /office/claude-code/team` | `employee.read` | tim dari `.claude/agents/*.md` (dikirim hook saat SessionStart) |

Tidak ada tabel/migrasi. `OfficeEventType` ditambah `'claude.event'`.

## 5. Aset

- **Default (CC0, buatan sendiri):** `scene/fallback/kit.ts` — dinding 2.5 m (blank/trim/baseboard/brick, jendela,
  pintu, kaca, blinds), lantai 2.5×2.5 bertekstur, plafon, furnitur, papan tanda, lampu gantung kerucut, cubicle teal,
  dll. Karakter: `Avatar.tsx` prosedural referensi. Pose prosedural (jalan, lari, duduk, mengetik, bicara).
- **Drop-in Synty (berbayar):** beli *POLYGON Office* + (opsional) 11 klip Mixamo, lalu
  `npm run office-new:assets -- ~/Downloads/POLYGON_Office_SourceFiles.zip --mixamo ~/Downloads/mixamo`.
  `tools/office-new/premium/build.mjs` menjalankan Blender (`/Applications/Blender.app`, terpasang 2026-11-27, v5.3)
  dengan `synty_to_gltf.py`/`mixamo_to_synty.py` → `frontend/public/office-new/models/` (gitignored). Office otomatis
  memakai model itu; `?cc0` memaksa kit CC0. Belum diuji dengan pack asli (pack belum dibeli).
- **Deteksi:** `frontend/public/office-new/models.json` (di-commit, `{"premium": false}`) dibaca saat start; build Synty
  menulisnya `true`. glTF hanya dicek bila manifest `true` → build biasa tanpa request 404. Jangan commit `true` tanpa model.

## 6. Performa

`StaticBatch` (referensi) menggabung semua prop statis per material — kit CC0 memakai cache material (`mat()`)
sehingga draw call tetap rendah. Scene yang tidak terlihat (office saat HQ, HQ saat office) memakai
`frameloop="never"`.

## 7. Known issues

- Label HUD berbahasa Inggris (sengaja, identik referensi); jawaban agen mengikuti bahasa pertanyaan.
- Maksimal 5 agen berkursi (seperti referensi); AI ke-6 dst. tidak tampil sebagai avatar.
- Kickoff di ruang rapat ±9 dtk adalah visualisasi event nyata "project dimulai", bukan status backend.
- Event Claude Code tidak persisten (memori backend).
- Peringatan dev React "synchronously unmount a root" dari label drei `<Html>` bisa muncul saat scene pertama dimuat (dev-only, tidak crash).

## 8. Hasil uji (2026-11-27, lokal: frontend :5173, backend :8011 — :8010 dipakai backend lain)

| Uji | Hasil |
|---|---|
| Typecheck frontend & backend, `vite build` dua entry | lulus |
| Office lama `/` setelah perubahan | login & daftar office normal |
| Demo: overview, project, walk-in, chat, Agent HQ, ganti mode | lulus, tanpa error baru saat ganti mode |
| Live AI team (office "Testing", 1 AI): New task → kickoff → QUEUED → EXECUTING (Thinking 23 %) → FAILED | alur & tampilan benar; task gagal karena provider menolak model (HTTP 403 dari provider, konfigurasi DB dev) |
| Chat live: chip cepat → jawaban state; pertanyaan bebas → `POST /office/ai-engine/generate` | benar; saat provider gagal (400) jatuh ke jawaban state |
| Claude Code: event hook mentah → `POST /office/claude-code/events` (202) → SSE → tim Michael/Emma/Jake/Olivia, delegasi, tool call, error merah, `SubagentStop` Done ✅, `Stop` → project 100 % | lulus (event uji berlabel "TES PIPELINE") |
| Pipeline Synty/Mixamo via Blender | hanya cek sintaks — belum ada pack |
| Pilihan jenis kantor (lokal + dev) | daftar kantor tampil dua pintu; *Buka di Kantor baru* → `/office-new/` office "Testing" LIVE; modal *Jenis kantor* tampil; dev API menolak `experience` tak valid (400) & `/auth/workspaces` mengembalikan `experience` — pembuatan office sungguhan belum diuji (agar tidak membuat data) |
| + AI (Katalog) | modal tampil; 8 template default berstatus *No model connected yet* — provider global belum diisi admin |

Perbaikan dari uji live: log "Task:" ganda (QUEUED dari respons POST + SSE), laporan gagal/selesai manager kini ke user
(bukan ke dirinya sendiri), task gagal tidak dihitung kemajuan, respons POST tidak lagi menurunkan status bila SSE datang lebih dulu.

## 9. Deploy dev

`./deploy.sh all` (atau `fe` / `be`) dari root repo → VM dev `192.168.64.10`: frontend `dist/` (termasuk
`dist/office-new/`) ke nginx `office.musyan.my.id`, backend ke pm2 `office-api` (`office-api.musyan.my.id`).
Nginx tidak perlu diubah: `try_files $uri $uri/ /index.html` melayani `/office-new/` dari `dist/office-new/index.html`.
Deploy 2026-11-27: `/office-new/` 200, `/` tetap office lama, `GET /office/claude-code/team` 401 tanpa token (route aktif),
tanpa migrasi baru. Office Baru di domain dev: **https://office.musyan.my.id/office-new/** (login dulu di `/` agar sumber = AI team).

## 10. Sama dengan video: Claude Code sebagai otak (2026-11-27)

- Default sumber = Claude Code (`store/useOffice.ts`, `SOURCE_KEY`). Tanpa `.claude/agents` → tim default
  `backend/frontend/devops` = Michael · Emma · Jake · Ryan (`claudeTransport.DEFAULT_TEAM`, nama dari `team.ts`).
- Tim & skill ikut dikirim tiap `UserPromptSubmit`, jadi kursi berubah begitu `/office-setup` selesai (PluginAdapter `lastTeam`).
- Hook script disajikan frontend: `frontend/public/office-new/claude-hook.mjs` (mode `install` + mode hook);
  backend menyimpan `skills`, `tokens`, `message`, `last_message` di event (`ClaudeCodeService.normalize`), `GET /office/claude-code/team` → `{team, skills}`.
- Uji: installer di folder uji (idempoten, `.gitignore`), payload ditangkap server lokal (token 3085 dari transcript
  contoh, dedup per pesan), alur Quill → Relay → *WAITING FOR YOUR OK* lewat event uji di localhost & HQ dicek visual;
  deploy dev OK. Belum diuji dengan sesi Claude Code sungguhan di project Anda.

## 11. Walk-in, karakter & performa (2026-11-27)

**Karakter blocky (ala Roblox, grafis office lama).** `scene/BlockyAvatar.tsx` memakai geometri & pose
`characters/Humanoid.tsx` / `characters/poses.ts` (office lama, hanya ditambah `export`), tetapi sebagai **satu
SkinnedMesh per orang** (11 tulang, 1 draw call; versi lama ±11, avatar prosedural ±15). Tampilan per peran dari nama
model Synty + variasi per orang (`SyntyAvatar.blockyLook`, seed). Mode Synty (pack dibeli) tetap memakai rig Synty.

**Performa (draw call per frame, desktop 1280×720, tim demo):**

| Tampilan | Sebelum | Sesudah | Video |
|---|---|---|---|
| Overview | 1.083 | 225 | 174 |
| Walk in 3rd person | 1.030 | 153 | — |
| Walk in 1st person | 510 | 144 | — |

Caranya: karakter SkinnedMesh; prop kit CC0 digabung per material (`kit.mergeByMaterial`) dan warna polos dipindah ke
vertex color sehingga ratusan warna = beberapa material (`plainMaterial`); plafon walk-in punya `StaticBatch` sendiri;
mesh yang sudah digabung dilepas dari scene graph (ribuan objek → CPU lega). N8AO tetap crash di three r187 (diuji),
SSAO berbintik → ambient occlusion diganti **bayangan kontak**: blob di bawah furnitur (ikut batch) + satu
`InstancedMesh` untuk semua karakter (`CharacterShadows.tsx`). Lantai kayu: tekstur PBR CC0 `wood_floor_worn`.

**Walk-in seperti video:** mulai di trotoar depan pintu utama (`PLAYER_SPAWN`, area jalan `PLAYER_BOUNDS`, jalur pohon
dikosongkan), dua satpam, pintu terbuka saat didekati, **resepsionis** menyapa (gelembung + berdiri) dan `E` membuka
panel *Reception* (siapa yang ada, status & lokasi live, *Take me there*). **Atap** tampil di Walk in / 1st person
(`Roof.tsx`; Overview tetap cutaway). **Tembus pandang** (`occlusion.ts`): di 3rd person, fragmen di antara kamera dan
pemain (kerucut) dibuang berpola dither 4×4 di shader — berlaku untuk mesh batch & karakter; lantai/kaca/bayangan dikecualikan.

**Kontrol:** desktop — klik atau `V` ke 1st person mengunci kursor (Pointer Lock) + crosshair `+` (kuning bila ada yang
bisa di-`E`). **iPad/iPhone: Safari tidak punya Pointer Lock** (WebKit bug 216621) → kursor tidak bisa dikunci di tengah;
gantinya kamera **mengikuti posisi mouse** (di luar zona tengah = menoleh), geser jari = menoleh, joystick + tombol E/lompat/
kamera di layar (`ui/TouchControls.tsx`). Dev: `window.__officeRuntime` (player, look) untuk uji skrip.

## 12. Known issue diperbaiki: layar biru seperti "select all" (2026-11-27)

Menyeret kamera (mouse atau jari, terutama di iPad) ikut memicu seleksi teks browser sehingga seluruh layar terblok
biru, ditambah kilatan biru *tap highlight* Safari. Perbaikan di `office-new/index.css` (`user-select: none`,
`-webkit-touch-callout: none`, `-webkit-tap-highlight-color: transparent`, `touch-action: none` pada kanvas,
`::selection` transparan; kolom isian tetap bisa diseleksi), cadangan JS di `main.tsx` (`selectstart`/`contextmenu`
dibatalkan di luar kolom isian), dan viewport tanpa zoom ganda (`office-new/index.html`).

## 13. Render hanya yang terlihat + mode ringan (2026-11-27)

Ukuran per frame (tim demo, 1280×720) — segitiga adalah penyebab utama berat di iPad:

| | Overview | Walk in (reception) | Walk in (workspace) |
|---|---|---|---|
| Sebelum | 225 draw · **1.101.883** segitiga | 113 · 361.231 | — |
| Penuh (`?full`) | 314 · 310.975 | 148 · 131.833 | 135 · 165.081 |
| Ringan (otomatis iPad/HP, `?lite`) | 218 · 249.023 | 130 · 123.293 | 112 · 134.237 |

- **Karakter ringan**: `setBlockyLowDetail()` (characters/Humanoid.tsx) — sudut membulat 1 segmen, kepala 2, bola/kapsul
  kasar; bentuk sama, ±18 rb → ±3 rb segitiga per orang.
- **Hanya yang terlihat**: `StaticBatch` memecah gabungan per area 20×20 m sehingga frustum culling three.js melewati
  area di luar pandangan (dulu satu gabungan = seluruh gedung selalu digambar). Karakter (SkinnedMesh) juga di-cull.
- **Mode ringan** (`scene/quality.ts`: iPad/iPhone, ≤4 core / ≤4 GB, atau `?lite`; `?full` memaksa penuh): resolusi 1×,
  tanpa MSAA & bloom, peta bayangan 2048, hanya **4 lampu ruangan terdekat titik pandang** (`NearestLights`, jumlah
  tetap → tanpa kompilasi ulang shader; lampu per piksel 12 → 6), daun pintu disembunyikan di Overview, separuh staf diam
  (resepsionis, satpam, cleaner, staf berjalan tetap).
- **Panel tanpa `backdrop-filter`**: blur di atas kanvas WebGL sangat mahal di Safari iPad.

## 14. Menu Graphics (2026-11-27)

⚙ → **Graphics**: `Auto` (default) · `Low` · `Medium` · `High`, disimpan per perangkat (`localStorage avo-office-new-gfx`);
memilih level menyimpan lalu memuat ulang office (resolusi, bayangan, daftar staf dibangun saat mulai). `?lite` / `?full`
memaksa Low / High untuk uji. Sumber: `scene/quality.ts` (`Q`), dipakai `OfficeScene`, `HqScene`, `Npcs`, `Office` (pintu).

| | Low | Medium | High |
|---|---|---|---|
| Resolusi (dpr) | 1× | ≤1.25× | ≤1.5× |
| Anti-aliasing (MSAA) | — | — | 2× |
| Bloom (glow) | — | ✓ | ✓ |
| Peta bayangan | 2048 | 2048 | 4096 |
| Lampu ruangan per piksel | 4 terdekat | 6 terdekat | 10 |
| Staf diam | separuh | semua | semua |
| Pintu di Overview | disembunyikan | tampil | tampil |

`Auto` = Low di iPad/iPhone & perangkat ≤4 core / ≤4 GB, High di komputer (menu menampilkan "Auto → …").

## 15. Area tabrak dekorasi = model yang tampil (2026-11-27)

Bug: "tiang ungu" di resepsi menghalangi jalan. Penyebab: ukuran tabrak `FLOOR_DECOR`/`PLANTS` (`world/layout.ts`)
adalah ukuran model Synty, sedangkan kit CC0 menggambar banyak prop lebih kecil — `Sculpture_Base_01` (tabrak 1,7×1,7 m)
dan `Sculpture_02` jadi kotak ungu 10 cm, sisanya dinding tak terlihat (mis. `Powerbox_01` 0,8×1,0 vs 0,23×0,68).

- `layout.ts` `DECOR_BOXES`: footprint tanaman besar + `FLOOR_DECOR`; objek `Box` yang sama ada di `OBSTACLES`.
- `scene/fallback/fitDecor.ts` `fitDecorToKit()` (dipanggil `Office.tsx` `Decor`, hanya bila `!asset.premium`): ukur
  bbox model kit (tanpa bayangan `Blob`), putar sesuai `rot`, tulis ke box (+4 cm). Model kosong / setipis karpet → tidak
  menghalangi. Grid A* NPC (`nav.ts`) tetap memakai ukuran Synty (lebih besar = NPC tetap menghindar, aman).
- Kit: alas patung lobi (1,2×0,31 m, batu terang) + patung perunggu cincin, dipindah ke pojok jendela lobi (−12,4; 14,1)
  karena di posisi lama alasnya menutup pintu lounge (x −10, z 11,6–13,4); ember janitor; rak `Shelf_01..07` memakai
  lebar, papan & tinggi model Synty (`SHELF_SPEC`, sama dengan `Furniture.tsx` `SHELF`) sehingga isi rak duduk di papan
  (dulu `Shelf_07` 1,2 m dengan buku melayang hingga 3 m).
- Synty (premium): ukuran di `layout.ts` tetap dipakai apa adanya.

## 16. Lebih nyata, tidak seperti mainan (2026-11-28)

Dibandingkan frame demi frame dengan video 2 (walk-in 4:17–5:22): video gelap-hangat dengan plafon gelap, lensa lebar,
sekat cubicle tinggi, dinding resepsi panel kayu. Office Baru sebelumnya terang rata, plafon putih penuh lampu, lensa 45°.

| Area | Perubahan | File |
|---|---|---|
| Kamera walk-in | FOV 64° (1st) / 56° (3rd), kembali 45° di overview | `scene/CameraDirector.tsx` |
| Cahaya dalam | fill lebih redup (`INSIDE` ambient 0.28, hemisphere 0.5, decay 1.35) → genangan cahaya hangat, sudut gelap | `scene/inside.ts` |
| Grade dalam | saturasi −0.14, kontras +0.14, vignette 0.62 (overview tetap) | `scene/OfficeScene.tsx` |
| Plafon | warna greige/coklat gelap, lampu panel redup & hanya tiap 2 ubin | `fallback/kit.ts`, `Fitout.tsx` CEILING |
| Workspace | sekat cubicle 1,2 → 1,38 m, panel teal `#5a7a7a`, karpet maroon `#5e2620` motif kotak halus, sticky note tegak kecil di panel (dulu lempeng kuning datar), papan gabus di atas meja | `fallback/kit.ts`, `fallback/textures.ts`, `Furniture.tsx` |
| Resepsi | konter kayu L (Desk_06) dengan konter tamu 0,93 m, kursi kulit sandaran tinggi (Chair_08), lantai herringbone beige, dinding `#cbbfab` | `fallback/kit.ts` |
| Panel kayu dinding | `FeatureWall_*` sebelumnya terkubur di dalam tembok (tembok kit tebal 0,15) → digeser ke muka tembok | `Office.tsx`, `Fitout.tsx` |

Penghalang pintu: selain patung, `Plant_06` di depan pintu koridor→workspace timur (19,35; −0,4) dipindah ke (19,35; 1,0).
Uji jalan lurus melewati 18 pintu (`nav.collide`, radius 0,3) — semua lolos.

Karakter tetap blocky ala Roblox (permintaan pemilik). Tech stack sama dengan referensi (React Three Fiber + three);
pembeda terbesar yang tersisa = aset Synty POLYGON Office (berbayar, drop-in §5).

## 17. Lima hal dari reel "animasi 3D bikinan Claude" (2026-11-28)

Reel (Instagram @jipraks, 48 dtk) menunjukkan 5 perubahan: gerak motion capture Mixamo, kamera seperti lensa asli,
tekstur & cahaya Poly Haven, karakter tidak tembus barang, efek suara tepat momennya. Semua diterapkan:

1. **Gerak Mixamo** — `tools/office-new/mocap/build-mocap.mjs <glb Mixamo>` me-retarget klip `idle/walk/run` ke 11 tulang
   rig blocky (rotasi global sumber × koreksi arah istirahat; lengan T-pose → lengan turun) →
   `scene/mocap/clips.json` (38 KB, 30 fps, plus fase injakan kaki). Sumber: `Xbot.glb` repo three.js r170 (rekaman
   Mixamo; glb tidak di-commit). `BlockyAvatar` memadukan klip (bobot teredam, tanpa loncatan) untuk jalan/lari/diam;
   duduk, mengetik, bicara, gestur tetap prosedural. Klip diputar secepat gerak sebenarnya (`Pose.speed`:
   NPC 1,25, agen 1,5×speed, pemain 2,2/5,0 m/s) agar kaki tidak meluncur.
2. **Lensa asli** (`scene/lens.ts`) — depth of field di Walk in & rekaman kamera (Medium/High): fokus ke pemain (orang
   ketiga) atau autofokus ke benda di tengah layar (orang pertama, uji sinar ke kotak tabrak + orang); goyang tangan
   halus + ayunan kepala seirama langkah. Composer di-`key` per mode (melepas DOF di composer yang sama → GL
   INVALID_OPERATION, layar beku).
3. **Poly Haven** (CC0, `public/assets`) — HDRI interior `lebombo_1k.hdr` untuk cahaya pantul; bahan `pbr()` di
   `fallback/kit.ts`: kain `fabric_pattern_07` (sofa, kursi kantor, beanbag, panel cubicle), kulit `brown_leather`
   (kursi rapat/tamu), kayu `wood_table_001` (meja, konter, rak, panel kayu), dinding `beige_wall_001`, plafon
   `ceiling_interior`, serat karpet `dirty_carpet` (normal/kekasaran di atas motif kita). Warna asli dinetralkan
   (`detailTexture`) lalu diwarnai palet office; UV diproyeksikan per meter (`boxUV`) agar tidak melar. Grafis Low:
   warna polos (hemat memori iPad).
4. **Tidak tembus** — `world/solids.ts`: prop lantai (kursi, tanaman, kardus, troli, tong, meja kecil, …) didaftarkan
   saat tampil → `OBSTACLES` (pemain) + sel grid A* (`nav.blockBox`). Orang juga padat: pemain terdorong keluar dari
   agen/staf; staf & agen berhenti saat ada orang di depan (`runtime.personAhead`), lalu memutar ke kanan setelah
   ±1 dtk.
5. **Suara** (`scene/sfx.ts`, Web Audio sintetis, tanpa file) — langkah tepat saat kaki menapak di rekaman (bunyi
   karpet/kayu/ubin/luar sesuai lantai), ketikan keyboard, kursi diduduki, denting cangkir saat minum, pintu buka/tutup,
   bunyi tugas selesai & pesan tim. Volume menurun dengan jarak ke kamera (senyap > 14 m), kiri/kanan sesuai arah
   pandang. ⚙ → *Sound effects* (disimpan per perangkat, aktif setelah klik/ketik pertama).
