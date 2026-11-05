# Virtual AI Office

Phase 1 — Frontend 3D office (`frontend/`). Rencana lengkap: [PLAN.md](PLAN.md).

## Jalankan

```bash
npm install                 # dependency CLI root (inquirer)
npm run install:all         # dependency tiap app (frontend/)
npm run dev                 # Dev CLI interaktif → Start Services → http://localhost:5173
npm run frontend:dev        # langsung jalankan frontend
npm run push                # pilih direktori → commit → push (bisa: npm run push "pesan commit")
npm run commit              # add all → commit → push
npm run git                 # menu Git (diff, log, pull, stash, dll)
```

## Struktur workspace

```
ai-virtual-office/
├─ frontend/        React + R3F 3D office (package.json sendiri)
├─ backend/         (Phase 2) NestJS API + WS
├─ worker/          (Phase 3) BullMQ agent runtime
├─ dev.mjs          Dev CLI (services, typecheck, git push)
├─ package.json     script root (npm --prefix <app>)
├─ PLAN.md          rencana implementasi
└─ helloworld.md    prompt awal
```

## Kontrol

| Input | Aksi |
|---|---|
| WASD / panah | Jalan · `Shift` lari · `Space` lompat |
| `V` / `1` `2` `3` | Ganti kamera: Mata (FPS) · Atas Kepala (TPS) · Isometric |
| Klik kanan + drag | Putar kamera (TPS/ISO) |
| Scroll | Zoom (TPS: zoom mentok → mode mata) |
| Klik layar (FPS) | Kunci mouse; klik agent/monitor di crosshair untuk interaksi |
| Klik lantai (ISO) | Jalan otomatis (pathfinding) |
| `E` / `F` | Profil agent terdekat / buka monitor workstation |
| `Tab` · `N` · `Esc` | Daftar tim · toggle nama · tutup panel |

## Struktur frontend

```
frontend/src
├─ office/       layout (sumber kebenaran), arsitektur & furnitur prosedural, collider, pathfinding A*, jam, monitor, lighting
├─ characters/   humanoid prosedural + pose, Agent (status → posisi/animasi), Player (Rapier character controller), NameTag
├─ camera/       CameraRig (fps/tps/iso), input keyboard
├─ state/        zustand store, types, demoTeam + demoEngine (DEMO MODE)
└─ hud/          TopBar, Minimap, EmployeePanel, Directory, Workstation, Modals
```

## Demo Mode

Backend belum ada, jadi office template "Tech HQ + tim demo" diisi 12 employee **simulasi** (badge `DEMO` di name tag, panel, monitor, dan status board).
Employee hasil "+ Rekrut" **tidak** disimulasikan — tetap Idle sampai AI Engine (Phase 3) terhubung.
