// Virtual Life Mode: the user's own avatar. WASD / Shift / Space / E / V, mouse look.
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useOffice } from '../store/useOffice';
import { AGENT_IDS, type AgentId } from '../core/types';
import { PROFILES } from '../core/agents';
import type { Pose } from './Avatar';
import { SyntyAvatar } from './SyntyAvatar';
import { collide, segmentHitsBox } from '../world/nav';
import { INTERACTABLES, WALLS, PLAYER_BOUNDS } from '../world/layout';
import { placePlayer, savePosition } from '../world/spawn';
import { sfx } from './sfx';
import { agentBodies, keys, look, nearby, player, touchMove, walkers } from '../world/runtime';
import { labelPortal } from './labels';
import { ZOOM, camZoom, topWeight } from './zoom';

// 2026-11-28: jalan 2,2 / lari 5 m/s — langkah klip Mixamo cocok dengan kecepatan (dulu 3,2 / 6,2: kaki meluncur)
const WALK = 2.2, RUN = 5.0, JUMP = 4.6, GRAVITY = 13, RADIUS = 0.32;
const camWalls = WALLS.filter((w) => w.kind !== 'low').map((w) => w.box);
/** Safari iPad/iPhone tidak punya Pointer Lock API (WebKit bug 216621): pakai kemudi mouse + sentuh. */
export const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const CAN_LOCK = !IS_IOS && typeof HTMLElement !== 'undefined' && 'requestPointerLock' in HTMLElement.prototype;
look.steer = !CAN_LOCK;
/** Furniture, walls — and people: the player can't walk through agents or staff either. */
const move = (x: number, z: number) => {
  const p = collide(x, z, RADIUS, undefined, PLAYER_BOUNDS);
  const push = (o: { x: number; z: number }) => {
    const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), min = RADIUS + 0.26;
    if (d > 0.001 && d < min) { p.x = o.x + (dx / d) * min; p.z = o.z + (dz / d) * min; }
  };
  for (const b of Object.values(agentBodies)) push(b);
  for (const w of walkers) push(w);
  return p;
};
const isTyping = () => {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
};

export function Player() {
  const mode = useOffice((s) => s.mode);
  const style = useOffice((s) => s.cameraStyle);
  const group = useRef<THREE.Group>(null!);
  const pose = useRef<Pose>({ mode: 'stand', talking: false });
  const { gl, camera } = useThree();
  const hintTick = useRef(0);
  const lockRef = useRef<() => void>(() => {});
  const saveT = useRef(0);
  const active = mode === 'life';

  // Masuk Walk in: lanjut di posisi terakhir (juga setelah refresh), atau di pintu masuk bila belum pernah.
  useEffect(() => {
    if (!active) return;
    placePlayer();
  }, [active]);

  // Keyboard, pointer lock and mouse look.
  useEffect(() => {
    if (!active) return;
    const st = useOffice.getState;
    const down = (e: KeyboardEvent) => {
      if (isTyping()) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', ' ', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      keys.add(k);
      if (k === 'v') {
        const next = st().cameraStyle === 'third' ? 'first' : 'third';
        st().setCameraStyle(next);
        // 1st person = mata pemain: kunci kursor di tengah (keydown dihitung sebagai gestur pengguna)
        if (next === 'first' && CAN_LOCK && !look.locked) lockPointer();
      }
      if (k === 'e') interact();
      // Esc hanya melepas kursor (browser) / menutup jendela yang terbuka; menu ada di tombol ☰ kanan atas.
      if (k === 'escape' && !look.locked) {
        const s = st();
        if (s.chatWith) s.openChat(null);
        else if (s.modal) s.openModal(null);
        else if (s.menuOpen) s.setMenu(false);
      }
    };
    const up = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const blur = () => keys.clear();
    const canvas = gl.domElement;
    const lockPointer = () => {
      if (!CAN_LOCK) return;
      try { (canvas.requestPointerLock() as unknown as Promise<void> | undefined)?.catch?.(() => { look.steer = true; }); } catch { look.steer = true; }
    };
    lockRef.current = lockPointer;
    const click = () => {
      const s = st();
      if (s.menuOpen || s.chatWith || s.modal) return;
      lockPointer();
    };
    const lockError = () => { look.steer = true; };
    // kemudi mouse (iPad): posisi kursor relatif tengah kanvas
    const hover = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const r = canvas.getBoundingClientRect();
      look.cx = THREE.MathUtils.clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      look.cy = THREE.MathUtils.clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
      look.hover = true;
    };
    const leave = () => { look.hover = false; };
    // sentuh: geser jari di layar = menoleh
    const touches = new Map<number, { x: number; y: number }>();
    const tdown = (e: PointerEvent) => { if (e.pointerType === 'touch') touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); };
    const tmove = (e: PointerEvent) => {
      const t = touches.get(e.pointerId);
      if (!t || e.pointerType !== 'touch') return;
      player.yaw -= (e.clientX - t.x) * 0.006;
      player.pitch = THREE.MathUtils.clamp(player.pitch - (e.clientY - t.y) * 0.006, -1.1, 0.9);
      t.x = e.clientX; t.y = e.clientY;
    };
    const tup = (e: PointerEvent) => { touches.delete(e.pointerId); };
    const lockChange = () => {
      const wasLocked = look.locked;
      look.locked = document.pointerLockElement === canvas;
      // dulu: lepas kunci (Esc) = menu Paused. Sekarang cukup kursor muncul; menu lewat ☰.
      void wasLocked;
    };
    let dragging = false;
    const mdown = (e: MouseEvent) => { if ((e.button === 0 || e.button === 2) && !(e as PointerEvent).pointerType?.startsWith('touch')) dragging = true; };
    const mup = () => { dragging = false; };
    const mmove = (e: MouseEvent) => {
      if (!look.locked && !dragging) return;
      const k = look.locked ? 0.0022 : 0.005;
      player.yaw -= e.movementX * k;
      player.pitch = THREE.MathUtils.clamp(player.pitch - e.movementY * k, -1.1, 0.9);
    };
    window.addEventListener('keydown', down);
    // Scroll = zoom: mentok dekat → orang pertama, mentok jauh → pandangan atas ala Dota. Hanya di atas kanvas 3D
    // (atau saat kursor terkunci), bukan saat menggulir panel.
    let edge = 0;
    const wheel = (e: WheelEvent) => {
      const s = st();
      if (s.mode !== 'life' || s.shot || isTyping()) return;
      if (e.target !== gl.domElement && !look.locked) return;
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      const z = s.zoom;
      if (dy > 0) { edge = 0; s.setZoom(z === 0 ? ZOOM.MIN_THIRD : z * Math.exp(dy * 0.0016)); return; }
      if (dy >= 0 || z === 0) return;
      // di jarak terdekat orang ketiga: perlu sedikit gulir lagi untuk masuk orang pertama (trackpad tidak kebablasan)
      if (z <= ZOOM.MIN_THIRD + 0.01) { edge += -dy; if (edge > 80) { edge = 0; s.setZoom(0); } return; }
      edge = 0;
      s.setZoom(Math.max(ZOOM.MIN_THIRD, z * Math.exp(dy * 0.0016)));
    };
    window.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    canvas.addEventListener('click', click);
    canvas.addEventListener('mousedown', mdown);
    window.addEventListener('mouseup', mup);
    window.addEventListener('mousemove', mmove);
    canvas.addEventListener('pointermove', hover);
    canvas.addEventListener('pointerleave', leave);
    canvas.addEventListener('pointerdown', tdown);
    window.addEventListener('pointermove', tmove);
    window.addEventListener('pointerup', tup);
    window.addEventListener('pointercancel', tup);
    document.addEventListener('pointerlockerror', lockError);
    document.addEventListener('pointerlockchange', lockChange);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('wheel', wheel);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      canvas.removeEventListener('click', click);
      canvas.removeEventListener('mousedown', mdown);
      window.removeEventListener('mouseup', mup);
      window.removeEventListener('mousemove', mmove);
      canvas.removeEventListener('pointermove', hover);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('pointerdown', tdown);
      window.removeEventListener('pointermove', tmove);
      window.removeEventListener('pointerup', tup);
      window.removeEventListener('pointercancel', tup);
      document.removeEventListener('pointerlockerror', lockError);
      look.hover = false;
      document.removeEventListener('pointerlockchange', lockChange);
      keys.clear();
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      useOffice.getState().setHint(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, gl]);

  function interact() {
    const s = useOffice.getState();
    if (player.seat) { standUp(); return; }
    if (s.chatWith || s.modal || s.menuOpen || !nearby.id) return;
    if (document.pointerLockElement) document.exitPointerLock();
    if (nearby.kind === 'agent') {
      s.openChat(nearby.id as AgentId);
      return;
    }
    const obj = INTERACTABLES.find((o) => o.id === nearby.id);
    if (!obj) return;
    if (obj.kind === 'computer' && obj.agent) s.select(obj.agent, 'tasks');
    if (obj.kind === 'whiteboard') s.openModal('whiteboard');
    if (obj.kind === 'meeting') s.openModal('meeting');
    if (obj.kind === 'manager') s.openModal('manager');
    if (obj.kind === 'reception') s.openModal('reception');
    if (obj.kind === 'seat' && obj.seat) {
      Object.assign(player, { seat: obj.seat, x: obj.seat.x, z: obj.seat.z, facing: obj.seat.rot, yaw: obj.seat.rot, y: 0, vy: 0 });
    }
  }

  useFrame((_, dtRaw) => {
    if (!active) return;
    const dt = Math.min(dtRaw, 0.05);
    const s = useOffice.getState();
    const frozen = !!(s.chatWith || s.modal || s.menuOpen) || isTyping();

    // Turning with arrow keys (handy without a mouse).
    if (!frozen) {
      if (keys.has('arrowleft')) player.yaw += 2.2 * dt;
      if (keys.has('arrowright')) player.yaw -= 2.2 * dt;
      // Kemudi mouse (iPad, tanpa Pointer Lock): kursor di luar zona tengah = kamera berputar ke arah kursor.
      if (look.steer && look.hover && !look.locked) {
        const dz = 0.22;
        const ax = Math.abs(look.cx), ay = Math.abs(look.cy);
        if (ax > dz) player.yaw -= Math.sign(look.cx) * Math.pow((ax - dz) / (1 - dz), 1.4) * 2.6 * dt;
        if (ay > dz) player.pitch = THREE.MathUtils.clamp(player.pitch - Math.sign(look.cy) * Math.pow((ay - dz) / (1 - dz), 1.4) * 1.6 * dt, -1.1, 0.9);
      }
    }

    const fwd = { x: Math.sin(player.yaw), z: Math.cos(player.yaw) };
    const right = { x: -Math.cos(player.yaw), z: Math.sin(player.yaw) };
    let mx = 0, mz = 0;
    if (!frozen) {
      if (keys.has('w') || keys.has('arrowup')) { mx += fwd.x; mz += fwd.z; }
      if (keys.has('s') || keys.has('arrowdown')) { mx -= fwd.x; mz -= fwd.z; }
      if (keys.has('d')) { mx += right.x; mz += right.z; }
      if (keys.has('a')) { mx -= right.x; mz -= right.z; }
      // joystick layar sentuh
      if (touchMove.x || touchMove.y) { mx += fwd.x * touchMove.y + right.x * touchMove.x; mz += fwd.z * touchMove.y + right.z * touchMove.x; }
    }
    if (player.seat && Math.hypot(mx, mz) > 0.01) standUp();
    const len = player.seat ? 0 : Math.hypot(mx, mz);
    player.running = keys.has('shift') || Math.hypot(touchMove.x, touchMove.y) > 0.92;
    player.moving = len > 0.01;
    if (player.moving) {
      const sp = (player.running ? RUN : WALK) * dt;
      const k = Math.min(1, len);
      const p = move(player.x + (mx / len) * sp * k, player.z + (mz / len) * sp * k);
      player.x = p.x;
      player.z = p.z;
      const targetFacing = Math.atan2(mx, mz);
      let d = ((targetFacing - player.facing + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (d < -Math.PI) d += Math.PI * 2;
      player.facing += d * (1 - Math.exp(-dt * 14));
    }

    // Jump
    const onGround = player.y <= 0.0001;
    if (!frozen && !player.seat && keys.has(' ') && onGround) { player.vy = JUMP; sfx.jump(player.x, player.z); }
    player.vy -= GRAVITY * dt;
    const wasAir = player.y > 0.0001, fallV = -player.vy;
    player.y = Math.max(0, player.y + player.vy * dt);
    if (player.y === 0 && player.vy < 0) player.vy = 0;
    if (wasAir && player.y === 0) sfx.land(player.x, player.z, fallV);
    // simpan posisi tiap ±1 dtk (refresh = lanjut di sini)
    saveT.current += dt;
    if (saveT.current > 1 && !player.seat) { saveT.current = 0; savePosition(); }

    pose.current.mode = player.seat ? 'sit' : player.y > 0.02 ? 'air' : player.moving ? (player.running ? 'run' : 'walk') : 'stand';
    pose.current.speed = player.running ? RUN : WALK;
    group.current.position.set(player.x, player.y, player.z);
    group.current.rotation.y = style === 'first' ? player.yaw : player.facing;

    // Camera — jarak zoom teredam menuju target (scroll), lalu bobot pandangan atas
    const zTarget = useOffice.getState().zoom;
    camZoom.dist += (Math.max(ZOOM.MIN_THIRD, zTarget) - camZoom.dist) * (1 - Math.exp(-dt * 9));
    camZoom.top = style === 'first' ? 0 : topWeight(camZoom.dist);
    const head = new THREE.Vector3(player.x, 1.58 + player.y, player.z);
    const cp = Math.cos(player.pitch), sp2 = Math.sin(player.pitch);
    const dir = new THREE.Vector3(Math.sin(player.yaw) * cp, sp2, Math.cos(player.yaw) * cp);
    let desiredPos: THREE.Vector3, desiredLook: THREE.Vector3;
    if (style === 'first') {
      desiredPos = head.clone().add(new THREE.Vector3(fwd.x * 0.12, 0.04, fwd.z * 0.12));
      desiredLook = desiredPos.clone().add(dir);
    } else {
      // zoom (scroll): dekat = di belakang bahu, di bawah plafon, menabrak dinding; jauh = naik & menunduk ke ±54°,
      // menatap pemain dari atas (pandangan atas ala Dota; plafon tersembunyi begitu kamera di atasnya)
      const top = camZoom.top;
      const pitch = THREE.MathUtils.lerp(player.pitch, ZOOM.TOP_PITCH, top);
      const vdir = new THREE.Vector3(Math.sin(player.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(player.yaw) * Math.cos(pitch));
      let dist = Math.max(ZOOM.MIN_THIRD, camZoom.dist);
      if (top < 0.25) {
        const back = head.clone().addScaledVector(vdir, -dist);
        const t = segmentHitsBox({ x: head.x, z: head.z }, { x: back.x, z: back.z }, camWalls);
        if (t < 1) dist = Math.max(0.6, dist * t - 0.25);
      }
      desiredPos = head.clone().addScaledVector(vdir, -dist).add(new THREE.Vector3(0, 0.35 * (1 - top), 0));
      desiredPos.y = Math.min(2.75 + top * 60, Math.max(0.35, desiredPos.y)); // dekat: tetap di bawah plafon
      desiredLook = head.clone().addScaledVector(vdir, 2).add(new THREE.Vector3(0, 0.1, 0))
        .lerp(new THREE.Vector3(player.x, 0.9 + player.y, player.z), top);
    }
    const rig = camera.userData.rig as { pos: THREE.Vector3; look: THREE.Vector3 } | undefined;
    if (rig) { rig.pos.copy(desiredPos); rig.look.copy(desiredLook); }

    // What is in reach?
    hintTick.current += dt;
    if (hintTick.current > 0.1) {
      hintTick.current = 0;
      let best: { kind: 'agent' | 'object'; id: string; d: number; label: string } | null = null;
      for (const id of AGENT_IDS) {
        if (useOffice.getState().agents[id].vacant) continue;
        const b = agentBodies[id];
        const d = Math.hypot(b.x - player.x, b.z - player.z);
        if (d < 2.1 && (!best || d < best.d)) best = { kind: 'agent', id, d, label: `Press E to talk to ${PROFILES[id].name} (${PROFILES[id].role})` };
      }
      for (const o of INTERACTABLES) {
        const d = Math.hypot(o.x - player.x, o.z - player.z);
        if (d < 1.8 && (!best || d < best.d - 0.4)) best = { kind: 'object', id: o.id, d, label: `Press E · ${o.label}${o.agent ? ` (${PROFILES[o.agent].name})` : ''}` };
      }
      nearby.kind = best?.kind ?? null;
      nearby.id = best?.id ?? null;
      s.setHint(frozen ? null : player.seat ? 'Press E to stand up' : best?.label ?? null);
    }
  });

  function standUp() {
    const seat = player.seat;
    if (!seat) return;
    player.seat = null;
    // Step out in front of the seat if there is room (sofa), otherwise behind it (table chairs).
    const out = [0.75, -0.75].map((d) => ({ x: seat.x + Math.sin(seat.rot) * d, z: seat.z + Math.cos(seat.rot) * d }))
      .map((c) => ({ c, p: move(c.x, c.z) }))
      .find(({ c, p }) => Math.hypot(c.x - p.x, c.z - p.z) < 0.05);
    const p = out ? out.p : move(seat.x, seat.z);
    player.x = p.x;
    player.z = p.z;
  }

  if (!active) return null;
  return (
    <group ref={group}>
      <SyntyAvatar model="SK_Chr_Business_Male_01" seed="player" pose={pose} visible={style === 'third'} />
      {style === 'third' && (
        <Html portal={labelPortal} position={[0, 2.25, 0]} center distanceFactor={7}>
          <div className="whitespace-nowrap rounded-full bg-sky-400/90 px-2.5 py-0.5 text-[11px] font-bold text-slate-950">YOU</div>
        </Html>
      )}
    </group>
  );
}
