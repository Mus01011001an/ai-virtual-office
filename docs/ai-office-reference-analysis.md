# AI Office — Analisis Video Referensi

Sumber kebenaran untuk Office Baru (`/office-new/`). Screenshot ada di [`ai-office-reference/`](ai-office-reference/),
nama file = `v<video>-<detik>-<isi>.jpg`.

| Kode | Video | Durasi | Isi |
|---|---|---|---|
| **v1** | [Build Your Own 3D AI Office for Claude Code](https://youtu.be/4DEnolsWK-4) (Bekhruz AI) | 7:58 | Plugin `GENERAL009/Agent-Office` versi **premium**: gedung 3D, manager + sub-agent Claude Code nyata, panel live |
| **v2** | [I Built an AI Office You Can Walk Into](https://youtu.be/iMZom5Fg9tk) (Bekhruz AI) | 9:20 | "Office 2.0": 10 ruangan, 40 orang, 5 agen, walk-in, plus layar **Agent HQ** (1 agen Claude, 6 skill) |

Cara akses: video diputar di browser, transkrip diambil dari panel *Transcript* YouTube, frame ditangkap per detik
(daftar di bawah). Deskripsi v1 menunjuk repo publik **MIT** `github.com/GENERAL009/Agent-Office`; source
`premium-app/` (React 19 + R3F 9 + zustand + Tailwind 4 — stack yang sama dengan project ini) dipelajari dan
dipakai sebagai dasar implementasi (lihat [ai-office-architecture.md](ai-office-architecture.md)).

## 1. Konsep produk

- **Kantor 3D tempat agen AI terlihat bekerja.** Saat Claude Code membagi tugas ke sub-agent, biasanya yang terlihat
  hanya "dinding teks" di terminal (v1 1:00, `v1-0062`). Di office, tiap agen punya meja, nama, karakter; tiap
  `Read`/`Edit`/`Bash` muncul live; gagal = status merah (v1 1:12, `v1-0076`).
- **Office tidak memakai token model** — hanya mendengar *hooks* Claude Code ke server lokal (v1 1:21).
- **Walk-in**: WASD, dekati agen, tekan **E**, tanya "sedang apa" → jawaban dari task live agen itu
  (v1 6:53, `v1-0418`; v2 4:58, `v2-0298`, `v2-0309`, `v2-0313`).
- **Manager membagi kerja**: Michael (sesi utama Claude) merencanakan, memberi 3 task paralel
  (Emma backend, Jake frontend, Olivia QA), lalu memeriksa hasil gabungan (v1 6:13–6:46, `v1-0384`, `v1-0397`).
- **Office 2.0** (v2): agen pergi ke ruang rapat untuk *kickoff* lalu kembali ke meja (v2 2:57, `v2-0186`); 35 staf
  NPC berkeliling (cleaner 6 titik berulang `v2-0240`, satpam di pintu, resepsionis tetap di meja).
- **Agent HQ** (v2 5:48–7:51): tampilan terpisah untuk 1 agen Claude dengan 6 skill. Skill tidur (zZ) sampai
  dipakai; log tiap tool call nyata; berhenti dengan status **WAITING FOR YOUR OK** (persetujuan manusia).

## 2. Gedung & tata ruang (v2 1:01, `v2-0066-floorplan-10-rooms`)

```
 ┌──────────┬────────┬────────┬──────┬──────────┐
 │ Meeting  │Manager │ Studio │Server│ Game room│   ← baris belakang (kaca ke koridor)
 ├──────────┴────────┴────────┴──────┴──────────┤
 │                   Koridor                     │
 ├──────────┬──────────────┬──────────────────────┤
terrace│ Kitchen  │    Lounge    │   Workspace (cubicle)│
(barat)├──────────┤        ┌──┬──┤   3 baris meja       │
 │Reception │        │WC│WC│                      │
 └─entrance─┴────────┴──┴──┴──────────────────────┘
        depan: kanopi "AGENT OFFICE", bike rack, bangku, lampu jalan, pinus
```

| # | Ruang | Detail yang terlihat | Screenshot |
|---|---|---|---|
| 1 | Reception | meja lengkung kayu, papan "RECEPTIONIST", feature wall kayu slat, tulisan "AGENT OFFICE · AI TEAM · ALWAYS ON", lampu gantung kerucut | `v2-0003`, `v2-0075` |
| 2 | Workspace | karpet merah bata bermotif, cubicle panel teal + rangka krem, meja "berantakan" (monitor, cangkir, kabel, foto), dispenser air, blinds | `v2-0084`, `v2-0178` |
| 3 | Meeting room | meja panjang, kursi kulit hitam, TV dinding "MEETING ROOM · Free", laptop, kopi, donat, whiteboard beroda | `v2-0093`, `v2-0186`, `v2-0318` |
| 4 | Manager office | dinding merah tua, rak buku putih, trofi emas, globe, papan "PROFITS/STOCKS", mini golf hijau, mesin tik, telepon | `v2-0102`, `v2-0196`, `v1-0013` |
| 5 | Studio | green/white screen, 2 kamera tripod, 2 kursi wawancara, mikrofon | `v2-0110` |
| 6 | Server room | rak server, kabel biru/merah di cable tray, lantai hijau tua, router | `v2-0117` |
| 7 | Game room | ping-pong, bean bag, bunting warna-warni, kipas langit-langit, kulkas mini | `v2-0129` |
| 8 | Kitchen | kabinet putih, kulkas hitam, mesin kopi, blender, toaster | `v2-0137` |
| 9 | Lounge | 2 meja biliar, sofa, karpet merah, foosball, arcade | `v2-0145`, `v2-0273` |
| 10 | Restrooms | pria/wanita, cermin, bilik "OUT OF ORDER" | `v2-0047` |
| + | Terrace & depan | pergola, meja bulat, kursi; kanopi bernama kantor, bike rack, bangku, lampu jalan | `v2-0157`, `v2-0166`, `v2-0262` |

**Peta mini** (kanan bawah, `v2-0075`…`v2-0145`): panel gelap radius ±10 px, kotak ruangan bergaris putih tipis,
ruang aktif diisi **coral `#d9735a`**, area luar hijau tua transparan. Agen = cincin berwarna peran (`v2-0205`, `v2-0222`).

## 3. Bahasa visual

- **Gaya**: low-poly *flat shaded* ala Synty POLYGON (aset berbayar, lihat §8). Proporsi manusia normal (bukan chibi).
- **Waktu**: selalu malam (v2 0:49). Langit/background `#0b1222`, pinus gelap, lampu ruangan hangat `#ffcf98`.
- **Material**: kayu herringbone, karpet merah bata `≈#7a2e22`, dinding krem/coklat hangat, panel cubicle teal `≈#2f5a5c`.
- **Atap**: hilang saat dilihat dari atas (cutaway), kembali saat masuk (v2 4:33, `v2-0273`).
- **Kaca** di mana-mana — terlihat ke ruangan saat lewat koridor (`v2-0283`).
- **Pintu** terbuka otomatis hanya bila pemain berjalan *menuju* pintu (v2 4:21).

### Token UI (dari screenshot + source premium-app)

| Token | Nilai | Dipakai |
|---|---|---|
| panel | `rgb(14 17 26 / .86)` + blur 14 px, border `rgb(255 255 255 / .08)`, radius 16 px | semua panel |
| teks | `#e9edf5`, muted `#8b93a7` | |
| aksen | `#7c9cff` (tombol Start/Send indigo) | `v1-0339`, `v2-0309` |
| status | idle `#8b93a7`, thinking `#fbbf24`, working `#22c55e`, completed `#38bdf8`, error `#ef4444`, paused `#a78bfa` | pill status `v1-0384` |
| warna agen | manager `#f59e0b`, research `#22c55e`, developer `#3b82f6`, designer `#ec4899`, qa `#a855f7` | avatar bulat inisial |
| font | Inter (UI), JetBrains Mono (jam, log, kbd) | |
| label section | uppercase, letter-spacing lebar, 11–12 px, muted | "AGENT ACTIVITY", "TASK TIMELINE" |

## 4. HUD Overview (v1, `v1-0339`, `v1-0070`, `v1-0384`, `v1-0397`)

- **Top bar**: pill "CLAUDE CODE ● connected" (hijau), segmented **Overview | Walk in**, baris chip ruangan
  (Meeting room, Manager office, Lounge, Kitchen, Cyber Security, …) untuk terbang kamera, tombol **🎬 Shots**, ⚙.
- **Kolom kiri** (lebar ±330 px, kartu bertumpuk):
  1. Statistik: *Completed tasks* angka besar, *Project progress* %.
  2. Kartu project: judul + status (IDLE / RUNNING) + progress bar.
  3. **New task for the team**: textarea + tombol **▶ Start** + teks status ("Project in progress…").
  4. **Agent activity**: baris per agen = avatar bulat inisial (warna agen), *Nama · Peran*, pill status
     (● Working hijau / ● Idle abu / ● Error merah), baris task saat ini, progress bar warna agen.
  5. **Task timeline** ("0/3 done"), "Tasks appear here once the manager splits the project."
  6. **Recent activity**: `04:46:09 PM  Michael  Bash failed: Exit code 1` (jam mono, nama berwarna).
- **Kolom kanan** (360 px): **Agent communication** + "● team channel"; tiap pesan kartu: `Dari → Ke` (nama
  berwarna), jam mono kanan, isi ("Emma, Add priority to API", "Done: … ✅").
- **Agen terpilih** → panel detail menggantikan komunikasi.

## 5. Walk-in (v2 4:17–5:22, v1 6:52)

- Bar kontrol bawah (pill gelap kecil): `W A S D walk · Shift run · Space jump · E interact · V 1st/3rd person ·
  click → mouse look · drag also works · Esc menu` (`v2-0298`).
- Prompt interaksi tengah bawah: `[E] to talk to Max (Developer Agent)`; label agen melayang: `● Emma · Working`.
- **Chat window** (`v2-0309`): kartu gelap ±340 px, avatar bulat inisial, nama, pill "● Thinking", peran, tombol ×,
  teks pembuka "Say hi to Olivia. Ask what they're working on, any blockers, or what's next.", chip cepat
  *What are you doing now? · Any problems? · How far along are you? · What's next?*, tombol mic, input
  "Message Olivia…", tombol **Send** indigo.
- **Jawaban dari state nyata** (`v2-0313`): "No active task (Thinking). 1 task(s) queued, waiting for the previous step."
- Duduk di kursi meeting dengan E, E lagi untuk berdiri (`v2-0318`). Monitor agen menampilkan *Sprint board*
  (To do / In progress / Done).

## 6. Alur multi-agen (v1 6:05–6:46)

1. User memberi tugas → **Manager** (status Thinking) memecah jadi task.
2. Pesan team channel: `Michael → Emma: Emma, Add priority to API` (dan seterusnya).
3. Agen jalan ke meja, status **Working**, progress bar bergerak, tool call muncul sebagai log & gelembung.
4. Selesai: `Jake → Michael: Done: Show priority colored badge ✅`, badge "DONE Jake ✅" (`v1-0397`).
5. Manager memeriksa gabungan (tes 60/60), project 100%.
6. Error (exit code ≠ 0) → pill **Error** merah + baris merah di Recent activity (`v1-0076`).

## 7. Agent HQ (v2 5:48–7:51)

- Ruang gelap, 6 meja (2 baris × 3), makhluk kapsul lucu dengan warna skill, "zZ" saat tidur (`v2-0352`).
- Tiap meja punya **layar melayang**: NAMA SKILL besar, sub-peran, pill status (ASLEEP / WORKING / READY /
  WAITING FOR OK), 2 baris log (`› open skill · quill ✓`) — border bawah warna skill (`v2-0402`).
- Atas tengah: bola **CLAUDE** coral dalam wireframe, "1 agent · 6 skills".
- Kanan atas: tile **TIME 00:36**, **TOOL CALLS 12**, **SKILLS OPEN 2/6**, **TOKENS 774.1k** (`v2-0458`).
- Kiri atas: "AGENT HQ" + pill merah "● REPLAY · REC OCT 29".
- Panel **TOOL CALLS · LIVE LOG** (mono, baris bernomor `07 Bash · list folder`, baris terbaru di-highlight) (`v2-0432`).
- **Memory check** (`v2-0418`): Brand rules / Lessons = EMPTY → agen memakai default, tidak mengarang.
- Selesai: skill **RELAY** berhenti dengan stempel merah **WAITING FOR YOUR OK** (`v2-0458`, `v2-0470`).

## 8. Aset (batasan teknis)

| Referensi | Status | Office Baru |
|---|---|---|
| Synty POLYGON Office (berbayar, ±$25–50) — 18 karakter, 773 prop | tidak bisa dibeli/didistribusi oleh agen | **fallback CC0 prosedural** (dibuat di kode, flat-shaded) + pipeline Blender drop-in bila pack dibeli |
| 11 animasi Mixamo (login Adobe) | tidak bisa login | pose prosedural (jalan, lari, duduk, mengetik, bicara) |

Keputusan user 2026-11-27: *mulai CC0, ganti nanti*. Lihat [ai-office-architecture.md §5](ai-office-architecture.md).

## 9. Frame yang ditangkap

v1: `0006` overview isometrik · `0013` Michael manager · `0062` dinding teks vs panel · `0070` agent communication ·
`0076` error merah · `0334` hasil build · `0339` kolom kiri HUD · `0346` tim default · `0384`/`0392` agen working ·
`0397` done · `0401` hasil tes · `0418` walk-in tanya Emma.
v2: `0003` reception · `0047` WC · `0056` office 1.0 · `0066` denah · `0075` reception+minimap · `0084` cubicle ·
`0093` meeting · `0102` manager · `0110` studio · `0117` server · `0129` game · `0137` kitchen · `0145` lounge ·
`0157` terrace · `0166` depan · `0178` workspace atas · `0186` kickoff · `0196` Olivia · `0205` Leo · `0222` Max ·
`0240` rute cleaner · `0262` jalan · `0273` cutaway atap · `0283` kaca · `0298` prompt E · `0304` FPS ·
`0309` chat · `0313` jawaban · `0318` duduk · `0352`…`0470` Agent HQ.
