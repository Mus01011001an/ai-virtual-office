# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Virtual AI Office: a 3D office (React Three Fiber) where AI agents are employees whose visible behavior must reflect real backend execution state. The original product brief is `helloworld.md`. The phased plan and decisions are in `PLAN.md`; read it before starting a new phase.

Decisions already made by the user (see PLAN.md §13):
- "Sesi Baru" means a separate office instance (its own world, employees, members). It is not a room inside the same office.
- Build order is 3D office first. Phase 1, the frontend, is done. Next is Phase 2, the backend. **Read `BACKEND_PLAN.md` first**: NestJS + Prisma (PostgreSQL). The reference to follow is the Musyan workspace boilerplate in `musyan-workspace-reference/` (gitignored; it contains another project's `.env`, so never copy secrets from it). Use its code in `backend/src` and its docs in `.agents/backend/01…09_*.md` and `PRISMA_CI_CD_WORKFLOW.md`. Key patterns: better-auth `bearer()`, multi-tenant `Company`/`CompanyMember` (Office = Company), `@ActiveCompany`, `@Permission` + string permissions, multi-file `prisma/schema/`, SSE realtime. Never run destructive Prisma commands (`migrate reset`, `db push --force-reset`, DROP/TRUNCATE). The dev DB is the remote DB. Postgres and the S3-compatible MinIO are remote and already provisioned. Their secrets live only in `backend/.env`, which is gitignored; never copy them into docs.
- Run locally first. VPS or internet deployment comes later (PLAN.md §12b: deploy isolated under `/opt/avo` with compose project `avo`, and never touch existing services).
- 3D assets must be free, CC0 preferred. Record every asset in `frontend/public/assets/LICENSES.md`.
- The user communicates in Bahasa Indonesia. UI copy is Indonesian.

## Workspace layout & commands

The repo follows the user's `musyan-workspace` pattern. Each app is a top-level folder with its own `package.json`. The root holds only the dev CLI (`dev.mjs`) and `npm --prefix` scripts. There are no npm workspaces. New apps (`backend/`, `worker/`, `shared/`, `e2e-playwright/`) go at the root next to `frontend/`, and each new app gets matching root scripts.

```bash
npm install && npm run install:all   # root CLI deps (inquirer) + frontend deps
npm run frontend:dev                 # Vite dev server, http://localhost:5173
npm run frontend:build               # tsc -b && vite build
npm run typecheck                    # tsc --noEmit for frontend
npm run dev                          # interactive CLI: start services, typecheck, git tools
npm run push ["msg"]                 # pick directories → commit only those → push
npm run commit ["msg"]               # git add -A → commit → push
npm run git                          # git menu (diff/log/pull/stash/selective commit)
```

Backend (`backend/`, NestJS + Prisma, port 8010, Swagger at `/api/docs`) needs **Node 22** (`.nvmrc`; Prisma 7 rejects Node 23). The `npm run dev` CLI handles this automatically.

```bash
npm run backend:dev                  # nest start --watch (Node 22)
npm run typecheck:backend
npm run db:status | db:deploy | db:studio
```

Migrations: generate SQL with `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --script` into a new `prisma/migrations/<ts>_<name>/migration.sql`. Check it has no DROP/TRUNCATE, then apply it with `npx prisma migrate deploy`. Never use `migrate dev`/`reset`/`db push`: the dev DB is the shared remote DB.

There is no frontend test runner or linter configured yet. `npm run typecheck` is the correctness gate (strict TS with `noUnusedLocals` and `noUnusedParameters`).

In dev builds, `window.__avo = { runtime, store }` is exposed (see `frontend/src/main.tsx`). It is useful for scripted checks, for example teleporting the player with `__avo.runtime.player.x = …`, or switching camera with `__avo.store.getState().set({ cameraMode: 'iso' })`.

## Frontend architecture (`frontend/src`)

**Two kinds of state. Keep them separate.**
- `state/store.ts` (zustand, partially persisted to localStorage under `avo-office`) holds data that drives React re-renders: offices, employees, activity, tasks, UI flags, camera mode, and prefs. `enterOffice()` rebuilds the employee list and calls `resetRuntime()`.
- `state/runtime.ts` is a plain mutable object for per-frame data (player pose, camera yaw/pitch/dist, agent world positions, raycast registries, office time, glass collider handles). `useFrame` loops read and write it. Never put per-frame data in zustand.

**Layout is the single source of truth.** `office/layout.ts` defines zones, walls, desks (with seat and screen positions), furniture `ITEMS`, activity `SLOTS` (break, meeting, collab), clocks, and signs. Everything else is derived from it:
- `office/architecture.ts`: `buildStatic()` returns `{ main, upper }` merged geometries. `upper` (roof, atrium ceiling) is hidden in iso mode as a cutaway. `buildColliders()` returns Rapier cuboids. `groundObstacles()` returns 2D rects for pathfinding.
- `office/furniture.ts`: `SPECS` gives footprint, height, and whether an item collides. `buildItem()` emits primitives. The convention is that furniture "front" faces local +Z, and `r` is a quarter-turn count.
- `office/batch.ts`: the `Batcher` merges all static primitives per material key, so draw calls stay close to the number of materials. Material keys are entries in `MATS` (`office/materials.ts`), or `#rrggbb` strings created on demand by `matFor()`.
- `office/pathfinding.ts`: a 0.4 m grid A* with string-pulling, baked once at module load from `groundObstacles()`. It covers the ground floor only. Goals inside furniture (sofa seats) resolve to the nearest free cell, then step exactly onto the slot.

After adding or moving furniture or walls in `layout.ts`, all four of these update automatically. Desks and chairs are generated from `DESKS` into `ITEMS`.

**Agents.** `characters/Agent.tsx` maps `employee.status` (+ `slot`) to a target in `targetFor()`: a desk seat, a break/meeting/collab slot, or the exit (OFFLINE, hidden on arrival). It paths there and picks an animation pose with `poseFor()`. `Humanoid.tsx` is a procedural rig: `buildBody(appearance)` merges every part of a body segment (head, torso, each limb segment) into one vertex-colored geometry (cached per appearance), and all characters share one `BODY_MAT` (vertex colors + fresnel rim light), so a character is about 11 draw calls. The head is a single deformed sphere; facial features are placed just outside its surface, so re-check them if you change the head shape. Joint pivots must stay in sync with `poses.ts`. `poses.ts` returns joint angles; negative `rotation.x` swings a limb forward. Agent and monitor meshes are registered in `runtime.agentObjects` and `runtime.monitorObjects` with `userData.{kind, employeeId}`. `office/Interaction.tsx` handles all picking (it does not use R3F pointer events). The ray goes from screen center in FPS and from the mouse in TPS/ISO, and is wall-occluded via a Rapier raycast.

**Summon, gather & discussion.** `state/gather.ts` holds `summon(ids)`, `dismiss(ids?)`, `toggleGatherAll()` (G key / "Kumpulkan Tim" button) and `toggleSummon(id)` (Q key / "Panggil" in the profile and Tim panels). Summoned ids live in `store.summoned`. `office/Gather.tsx` (`GatherController`) writes a target per summoned agent into `runtime.gather`: the nearest free seat within 6 m (desk seats and sitting `SLOTS`, skipping seats owned by non-summoned employees), otherwise a standing semicircle in front of the player. It replans whenever the player moves more than 2.5 m, which is how they follow. `Agent.tsx` prefers `runtime.gather` over `targetFor()`, runs if the target is more than 5 m away, and on arrival turns to face the player. Summoning a demo employee calls `holdDemo()` (the engine skips it, its running task goes back to QUEUED, status becomes IN_MEETING). `releaseDemo()` hands it back. `state/discussion.ts` `sendMessage()` routes a message only to relevant people: those named, then those whose role or skills match topic keywords, then a single coordinator (the PM). Demo replies are templates, always tagged DEMO. Non-demo employees never get fake replies: a system note is posted and any task is queued. Work-style messages become QUEUED tasks for the primary responder. Speech bubbles are `store.bubbles` (`'…'` means typing) and render in `NameTag`. `hud/Discussion.tsx` is the chat panel (Enter focuses the input). When the AI engine lands, replace `demoReply()` with the backend call.

**Player & camera.** `characters/Player.tsx` uses a Rapier kinematic character controller. The controller is created in `useEffect`, not `useMemo`, because StrictMode would otherwise free it. Its visual is a separate group positioned from `runtime.player`. `camera/CameraRig.tsx` handles three modes (UI labels Mata/Bahu/Atas): `fps` (pointer-lock), `tps` (over-the-shoulder; with the persisted `mouseLook` pref (default on) it uses pointer-lock like a shooter, so mouse moves the camera with no button held and the player faces `cam.yaw`; with it off, RMB drag; zooming in fully switches to fps), and `iso` (fixed pitch; click floor to path). `usesPointerLock()` decides which modes lock. Lock state is mirrored to `runtime.pointerLocked` (per-frame) and `store.locked` (for HUD). While locked, `Interaction.tsx` picks from screen center and sets `hoveredId` (crosshair turns red); Alt or Esc releases the cursor. Movement is relative to `runtime.cam.yaw`, with facing = `(sin yaw, cos yaw)`. Frame order depends on mount order in `Scene.tsx`: Player runs before CameraRig. Do not use `useFrame` priorities, because they disable auto-render.

**Graphics quality.** `lib/quality.ts` defines `low`/`medium`/`high` presets (dpr range, shadow map size, post-processing, MSAA). The `quality` store pref drives `Scene.tsx` (Canvas is re-keyed on change), `office/Lighting.tsx`, and `office/Effects.tsx` (`@react-three/postprocessing`: bloom, Neutral tone mapping, saturation/contrast grade, vignette, SMAA/MSAA). drei `PerformanceMonitor` lowers dpr inside the preset's range when fps drops. The sun's shadow frustum follows the player (snapped to 4 m) so a small map stays sharp. Do not add n8ao: v2.0.1 crashes with three r187.

**HUD style.** The look is relaxed and friendly, not esports-style: rounded panels (`.panel` radius 20px, `.panel-soft` 16px), pill buttons, sentence-case labels, a warm amber accent (`#f4a259`, matching the office's warm LEDs), and the Plus Jakarta Sans font. Panels are solid, with no `backdrop-blur` (it costs GPU over the canvas). Theme tokens are in `index.css` `@theme` (`ink`, `bone`, `accent`, `mint`, `demo`, `line`). Shared primitives are in `hud/ui.tsx` (`Btn`, `IconBtn`, `PanelHead`, `Modal`, `Toggle`, `Segmented`, `Avatar`, `StatusPill`, `DemoBadge`). Reuse them rather than writing ad-hoc classes.

**Ambience.** The persisted `ambience` pref is `night` (the default, matching the luxe night-office reference design), `day`, or `auto` (follows office time). `Lighting.tsx` derives `dayFactor` from it. That factor drives the HDRI swap, LED/ring emissive strength, and the warm point lights at the ring chandeliers (those lights exist only when post-processing is on). Visual vocabulary: dark marble floor (procedural canvas texture in `Building.tsx`), `ledWarm`/`ledRing` emissive materials (picked up by bloom), `woodSlat` wavy ceiling and ring chandeliers (`architecture.ts` `buildCeilingAndRoof`), rugs with `glow: true` get floor LED borders, the `sculpture` furniture type, and `VideoWall` (`Props.tsx`, which draws charts from real store state). Keep the centre of the workspace free of planters.

**Time.** `office/TimeTicker.tsx` writes office-timezone time into `runtime.time` each frame via `lib/time.ts` (cached tz offset). Wall clocks, the digital sign, and `office/Lighting.tsx` (sun/night, HDRI swap, lamp emissive) all read it. `scheduleState()` encodes working hours and breaks.

**Name tags** (`characters/NameTag.tsx`) use drei `<Html>`. Opacity, occlusion (a Rapier ray that ignores `runtime.glassHandles` and the player collider), and the compact mode are set imperatively in `useFrame`.

**Canvas-texture screens** (desk monitors, status board, signs) use `lib/canvas.ts` `useCanvasTexture(w, h, draw, deps, intervalMs)`.

## Backend architecture (`backend/src`)

It follows the Musyan boilerplate (see BACKEND_PLAN.md §0). `lib/auth.ts` sets up better-auth with `bearer()` and a `customSession` that resolves `activeCompanyId`, `activeRole.permissions`, and `memberships`. Global guards run in this order: `AuthGuard` → `AppThrottlerGuard` → `RbacGuard` (`@Permission`) → `RequiresCompanyGuard` (`@RequiresCompany`). An office is a `Company`. Domain modules live in `office/`: `ai-providers` (encrypted keys, test connection via `GET /models`, `catalog`), `employees` (validates the provider/model against the catalog), `tasks` (Phase 2 only produces QUEUED/CANCELLED, never fake completion), `discussions`, and `realtime` (`OfficeEventsService` + `@Sse('office/stream')`, with the token passed in `?token=` via `SseTokenMiddleware`). Every query is scoped by `companyId`. Permission keys live in `common/constants/permissions.ts` and `system/role-permission/permission.definitions.ts`; the latter also holds the default roles Owner/Manager/Member/Viewer that are seeded per office. The S3 key prefix is `S3_PREFIX/` (the bucket is shared with other apps), and keys outside that prefix are rejected.

Frontend ↔ backend: `frontend/src/lib/api.ts` (Bearer token in localStorage, envelope unwrap) and `state/remote.ts` (auth, offices, recruit, tasks, AI providers, SSE → the same `Employee` fields). DEMO_TEAM offices still add the local demo fixtures and `demoEngine` on top of the server employees.

## Demo Mode rule (product requirement)

Offices created from template `demo-team` (`DEMO_TEAM` on the server) get 12 fixtures (`state/demoTeam.ts`, `isDemo: true`), animated by `state/demoEngine.ts`. Demo data must always be visibly labeled DEMO (name tag, panels, monitor, status board). Employees created via "+ Rekrut" (`isDemo: false`) must not be simulated. They stay IDLE until the real AI engine exists. Tabs that need backend data (AI Conversation, Files, Performance) show an explicit "pending backend" state, not fake data. When the backend lands, replace the demo engine with a data source that writes the same `Employee.status`/`slot`/`currentTool`/`progress` fields, so the 3D layer needs no changes.
