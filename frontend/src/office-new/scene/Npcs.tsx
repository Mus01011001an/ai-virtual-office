// Orang di office yang bukan agen AI: hanya yang memberi informasi (resepsionis). Figuran dihapus 2026-11-28.
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SyntyAvatar, type Wearable } from './SyntyAvatar';
import type { Gesture, Pose, PoseMode } from './Avatar';
import type { Palette } from './assets';
import { RECEPTIONIST, type Spot } from '../world/layout';
import { collide, findPath, type P } from '../world/nav';
import { personAhead, player, walkers } from '../world/runtime';
import { Q } from './quality';
import { Html } from '@react-three/drei';
import { useOffice } from '../store/useOffice';
import { labelPortal } from './labels';

interface Still { kind: 'still'; model: string; palette?: Palette; at: Spot; mode: PoseMode; talking?: boolean; gesture?: Gesture; wear?: Wearable[]; /** sapaan saat pemain mendekat (walk-in) */ greet?: string }
interface Walker { kind: 'walk'; model: string; palette?: Palette; wear?: Wearable[]; stops: { at: Spot; wait: number; gesture?: Gesture; talking?: boolean }[] }
type Npc = Still | Walker;

// Disetujui pemilik 2026-11-28: tidak ada lagi staf figuran (mengetik, ngobrol, main game, jalan-jalan, satpam,
// cleaner). NPC hanya yang memberi informasi tentang office/ruang — saat ini resepsionis (E: info office).
const STAFF: Npc[] = [
  { kind: 'still', model: 'SK_Chr_Business_Female_02', at: RECEPTIONIST, mode: 'type', wear: ['Earpiece', 'Nametag'], greet: 'Welcome to the office! 👋' },
];

const angleLerp = (a: number, b: number, k: number) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
};

function StillNpc({ npc, index }: { npc: Still; index: number }) {
  const pose = useRef<Pose>({ mode: npc.mode, talking: !!npc.talking, gesture: npc.gesture ?? null });
  return (
    <group position={[npc.at.x, 0, npc.at.z]} rotation={[0, npc.at.rot, 0]}>
      <SyntyAvatar model={npc.model} palette={npc.palette} seed={`npc-${index}`} pose={pose} wear={npc.wear} />
      {npc.greet && <Greeting text={npc.greet} at={npc.at} pose={pose} />}
    </group>
  );
}

/** Gelembung sapaan di atas resepsionis saat pemain (walk-in) berada < 7 m; ia juga "berbicara". */
function Greeting({ text, at, pose }: { text: string; at: Spot; pose: { current: Pose } }) {
  const el = useRef<HTMLDivElement>(null);
  useFrame(() => {
    const near = useOffice.getState().mode === 'life' && Math.hypot(player.x - at.x, player.z - at.z) < 7;
    pose.current.talking = near;
    pose.current.mode = near ? 'stand' : 'type';
    if (el.current) el.current.style.opacity = near ? '1' : '0';
  });
  return (
    <Html portal={labelPortal} position={[0, 2.15, 0]} center distanceFactor={7} zIndexRange={[20, 0]}>
      <div ref={el} className="pointer-events-none whitespace-nowrap rounded-2xl bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-900 shadow-lg transition-opacity duration-300" style={{ opacity: 0 }}>
        {text}<span className="ml-1.5 text-slate-500">· press E</span>
      </div>
    </Html>
  );
}

function WalkingNpc({ npc }: { npc: Walker }) {
  const group = useRef<THREE.Group>(null!);
  const pose = useRef<Pose>({ mode: 'stand', talking: false, gesture: null });
  const st = useRef({ x: npc.stops[0].at.x, z: npc.stops[0].at.z, rot: npc.stops[0].at.rot, leg: 0, path: [] as P[], wait: npc.stops[0].wait, blockedT: 0 });
  useEffect(() => {
    group.current.position.set(st.current.x, 0, st.current.z);
    const me = st.current;
    walkers.add(me);
    return () => { walkers.delete(me); };
  }, []);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const s = st.current;
    if (s.wait > 0) {
      s.wait -= dt;
      const stop = npc.stops[s.leg];
      s.rot = angleLerp(s.rot, stop.at.rot, 1 - Math.exp(-dt * 6));
      pose.current = { mode: 'stand', talking: !!stop.talking, gesture: stop.gesture ?? null };
      if (s.wait <= 0) {
        s.leg = (s.leg + 1) % npc.stops.length;
        s.path = findPath({ x: s.x, z: s.z }, npc.stops[s.leg].at);
      }
    } else if (s.path.length) {
      const next = s.path[0];
      const dx = next.x - s.x, dz = next.z - s.z, dist = Math.hypot(dx, dz);
      let ux = dx / (dist || 1), uz = dz / (dist || 1);
      let step = 1.25 * dt;
      // someone right in front: stop and let them pass; if they stay, step around them to the right
      const other = personAhead(s, s.x, s.z, dx, dz);
      let around = false;
      if (other) {
        s.blockedT += dt;
        if (s.blockedT < 1.2) step = 0;
        else { around = true; const rx = -uz, rz = ux; ux += rx * 0.9; uz += rz * 0.9; const l = Math.hypot(ux, uz); ux /= l; uz /= l; }
      } else s.blockedT = 0;
      if (step === 0) {
        pose.current = { mode: 'stand', talking: false, gesture: null };
      } else if (!around && dist <= step) {
        s.x = next.x; s.z = next.z;
        s.path.shift();
        if (!s.path.length) s.wait = npc.stops[s.leg].wait;
      } else {
        const p = around ? collide(s.x + ux * step, s.z + uz * step, 0.25) : { x: s.x + ux * step, z: s.z + uz * step };
        s.x = p.x; s.z = p.z;
        s.rot = angleLerp(s.rot, Math.atan2(ux, uz), 1 - Math.exp(-dt * 10));
      }
      if (step > 0) pose.current = { mode: 'walk', talking: false, gesture: null, speed: 1.25 };
    } else {
      s.wait = npc.stops[s.leg].wait;
    }
    group.current.position.set(s.x, 0, s.z);
    group.current.rotation.y = s.rot;
  });
  return (
    <group ref={group}>
      <SyntyAvatar model={npc.model} palette={npc.palette} pose={pose} wear={npc.wear} />
    </group>
  );
}

export function Npcs() {
  return (
    <>
      {STAFF.map((n, i) => (!SHOWN[i] ? null : n.kind === 'still' ? <StillNpc key={i} index={i} npc={n} /> : <WalkingNpc key={i} npc={n} />))}
    </>
  );
}


/** Grafis Low: separuh staf saja; resepsionis, satpam, cleaner, dan staf yang berjalan tetap ada. */
const SHOWN: boolean[] = STAFF.map((n, i) => Q.allStaff || n.kind === 'walk' || (n.kind === 'still' && !!n.greet) || /Security|Cleaner/.test(n.model) || i % 2 === 0);

/** Posisi staf yang diam dan tampil (untuk bayangan kontak karakter). */
export const STILL_SPOTS: { x: number; z: number }[] = STAFF.filter((n, i): n is Still => n.kind === 'still' && SHOWN[i]).map((n) => n.at);
