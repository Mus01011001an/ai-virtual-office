// Agent HQ (referensi v2 5:48–7:51): ruang gelap, satu meja per skill Claude (sumber Claude Code) atau per agen
// (AI team / demo). Makhluk kapsul tidur (zZ) sampai skill/agennya benar-benar bekerja; layar melayang berisi
// status + baris log terakhir. Data = event nyata (hq/claudeHq.ts) atau store office.
import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useOffice } from '../store/useOffice';
import { AGENT_IDS } from '../core/types';
import { hqState, HQ_LABEL, type HqState } from './hqState';
import { useHqClaude, type SkillState } from './claudeHq';
import { Q } from '../scene/quality';

/** Satu meja HQ. */
export interface DeskData { id: string; name: string; sub: string; color: string; state: HqState; lines: string[] }

/** Warna skill seperti referensi: hijau, kuning, ungu, merah, oranye, cyan. */
const SKILL_COLORS = ['#4ade80', '#facc15', '#a78bfa', '#f87171', '#fb923c', '#67e8f9', '#f472b6', '#60a5fa', '#a3e635'];
const SKILL_STATE: Record<SkillState, HqState> = { asleep: 'asleep', working: 'working', ready: 'ready', waiting: 'waiting' };

/** Meja yang tampil: skill Claude untuk sumber Claude Code, selain itu agen berkursi. */
export function useDesks(): DeskData[] {
  const source = useOffice((s) => s.source);
  const agents = useOffice((s) => s.agents);
  const logs = useOffice((s) => s.logs);
  const skills = useHqClaude((s) => s.skills);
  return useMemo(() => {
    if (source === 'claude-code') {
      if (skills.length) {
        return skills.slice(0, 9).map((k, i) => ({
          id: k.id, name: k.id, sub: k.description || 'skill', color: SKILL_COLORS[i % SKILL_COLORS.length], state: SKILL_STATE[k.state], lines: k.lines,
        }));
      }
      // Tanpa skill: Claude bekerja sendiri di satu meja.
      const m = agents.manager;
      return [{ id: 'claude', name: 'claude', sub: 'main session', color: '#e8896a', state: hqState(m), lines: logs.filter((l) => l.agentId === 'manager').slice(-2).map((l) => l.text) }];
    }
    return AGENT_IDS.map((id) => agents[id]).filter((a) => !a.vacant).map((a) => ({
      id: a.id, name: a.name, sub: a.role, color: a.color, state: hqState(a),
      lines: logs.filter((l) => l.agentId === a.id).slice(-2).map((l) => `${l.text}${l.kind === 'result' ? ' ✓' : ''}`),
    }));
  }, [source, agents, logs, skills]);
}

/** Grid 3 kolom (seperti referensi: 2 baris × 3), baris di tengah ruangan. */
function deskPositions(n: number): [number, number][] {
  const rows = Math.max(1, Math.ceil(n / 3));
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / 3), inRow = Math.min(3, n - r * 3), c = i % 3;
    out.push([(c - (inRow - 1) / 2) * 3.2, (r - (rows - 1) / 2) * 3.2]);
  }
  return out;
}

function Creature({ desk }: { desk: DeskData }) {
  const g = useRef<THREE.Group>(null!);
  const asleep = desk.state === 'asleep';
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!g.current) return;
    g.current.position.y = asleep ? 0 : desk.state === 'working' ? Math.abs(Math.sin(t * 6)) * 0.04 : 0;
    g.current.rotation.x = asleep ? 0.55 : 0;
    g.current.rotation.z = asleep ? Math.sin(t * 0.8) * 0.05 : desk.state === 'working' ? Math.sin(t * 3) * 0.04 : 0;
  });
  return (
    <group position={[0, 0.45, 0.55]}>
      <group ref={g}>
        <mesh position={[0, 0.28, 0]} castShadow>
          <capsuleGeometry args={[0.2, 0.22, 6, 14]} />
          <meshStandardMaterial color={desk.color} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.66, 0.02]} castShadow>
          <sphereGeometry args={[0.2, 18, 14]} />
          <meshStandardMaterial color="#d9d4ca" roughness={0.7} />
        </mesh>
        {!asleep && [-0.07, 0.07].map((x) => (
          <mesh key={x} position={[x, 0.68, 0.19]}>
            <sphereGeometry args={[0.025, 8, 6]} />
            <meshBasicMaterial color="#111" />
          </mesh>
        ))}
      </group>
      {asleep && (
        <Html position={[0.25, 1.05, 0]} center className="pointer-events-none select-none font-mono text-[15px] font-bold leading-none text-white/70">
          z<br /><span className="ml-2">Z</span>
        </Html>
      )}
    </group>
  );
}

function Card({ desk }: { desk: DeskData }) {
  const st = desk.state;
  const waiting = st === 'waiting';
  const asleep = st === 'asleep';
  const accent = waiting ? '#ef5a4f' : asleep ? 'rgba(255,255,255,0.12)' : desk.color;
  return (
    <Html position={[0, 1.95, -0.2]} rotation={[-0.55, 0, 0]} center transform distanceFactor={3.2} className="pointer-events-none select-none">
      <div className="relative w-[300px] rounded-[10px] px-4 pb-3 pt-3 font-mono text-[#e9edf5]"
        style={{ background: 'rgba(12,12,16,0.92)', border: `1.5px solid ${accent}`, boxShadow: `0 3px 0 ${asleep ? desk.color + '55' : accent}`, opacity: asleep ? 0.72 : 1 }}>
        <div className="flex items-center justify-between">
          <div className="font-sans text-[26px] font-extrabold tracking-wide" style={{ color: asleep ? '#9aa0ab' : desk.color }}>{desk.name.toUpperCase()}</div>
          <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-widest"
            style={{ borderColor: waiting ? '#ef5a4f' : asleep ? 'rgba(255,255,255,0.3)' : desk.color, color: waiting ? '#ef5a4f' : asleep ? '#c2c7d0' : desk.color }}>
            {HQ_LABEL[st]}
          </span>
        </div>
        <div className="-mt-1 mb-2 truncate text-[11px] text-white/45">{desk.sub.toLowerCase()}</div>
        <div className="space-y-0.5 text-[11.5px] text-white/70">
          {desk.lines.length ? desk.lines.map((l, i) => <div key={i} className="truncate">› {l}</div>) : (
            <><div>tools: name · one line</div><div>instructions: not opened</div></>
          )}
        </div>
        {waiting && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-6 whitespace-nowrap rounded-md border-2 border-[#ef5a4f] bg-black/70 px-3 py-1 font-sans text-[22px] font-extrabold tracking-wide text-[#ef5a4f]">
            WAITING FOR YOUR OK
          </div>
        )}
      </div>
    </Html>
  );
}

function Desk({ desk, pos }: { desk: DeskData; pos: [number, number] }) {
  const active = desk.state !== 'asleep';
  return (
    <group position={[pos[0], 0, pos[1]]}>
      <mesh position={[0, 0.72, 0.55]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 0.06, 0.85]} />
        <meshStandardMaterial color="#5a3a26" roughness={0.8} />
      </mesh>
      {[[-0.85, 0.2], [0.85, 0.2], [-0.85, 0.9], [0.85, 0.9]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.36, z]}><boxGeometry args={[0.06, 0.72, 0.06]} /><meshStandardMaterial color="#2a1b12" /></mesh>
      ))}
      <mesh position={[0.1, 0.77, 0.75]}><boxGeometry args={[0.42, 0.02, 0.28]} /><meshStandardMaterial color="#1c1d21" /></mesh>
      <mesh position={[0.1, 0.9, 0.62]} rotation-x={-0.25}><boxGeometry args={[0.42, 0.26, 0.02]} /><meshStandardMaterial color="#1c1d21" emissive={active ? desk.color : '#000'} emissiveIntensity={active ? 0.35 : 0} /></mesh>
      <mesh position={[0.62, 0.8, 0.8]}><cylinderGeometry args={[0.045, 0.04, 0.12, 10]} /><meshStandardMaterial color="#efe9dd" /></mesh>
      <Creature desk={desk} />
      <Card desk={desk} />
      {active && <pointLight position={[0, 1.9, 1.2]} intensity={0.9} distance={2.6} color={desk.state === 'waiting' ? '#ef5a4f' : desk.color} />}
      {active && (
        <mesh position={[0, 0.01, 0.4]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[1.2, 1.28, 48]} />
          <meshBasicMaterial color={desk.state === 'waiting' ? '#ef5a4f' : desk.color} transparent opacity={0.55} />
        </mesh>
      )}
    </group>
  );
}

function Orb() {
  const wire = useRef<THREE.Mesh>(null!);
  useFrame((_, dt) => { if (wire.current) { wire.current.rotation.y += dt * 0.25; wire.current.rotation.x += dt * 0.1; } });
  return (
    <group position={[0, 4.4, -4.2]}>
      <mesh><sphereGeometry args={[0.55, 32, 24]} /><meshStandardMaterial color="#e8896a" emissive="#e8896a" emissiveIntensity={0.55} /></mesh>
      <mesh ref={wire}><icosahedronGeometry args={[0.95, 1]} /><meshBasicMaterial color="#e8896a" wireframe transparent opacity={0.35} /></mesh>
      <mesh rotation-x={Math.PI / 2.2}><torusGeometry args={[1.15, 0.015, 8, 64]} /><meshBasicMaterial color="#e8896a" transparent opacity={0.6} /></mesh>
    </group>
  );
}

function Room() {
  const slats = useMemo(() => Array.from({ length: 44 }, (_, i) => -11 + i * 0.5), []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[30, 20]} /><meshStandardMaterial color="#1a120d" roughness={0.95} /></mesh>
      <mesh position={[0, 3, -5.5]}><planeGeometry args={[30, 6]} /><meshStandardMaterial color="#2a1a12" /></mesh>
      {slats.map((x) => <mesh key={x} position={[x, 3, -5.45]}><boxGeometry args={[0.04, 6, 0.04]} /><meshStandardMaterial color="#3a261a" /></mesh>)}
      <mesh position={[0, 0.05, 0]}><boxGeometry args={[11, 0.1, 0.12]} /><meshStandardMaterial color="#e8896a" emissive="#e8896a" emissiveIntensity={0.4} /></mesh>
      {[[-5.6, -2.6], [5.6, -2.6]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.25, 0.2, 0.5, 10]} /><meshStandardMaterial color="#2a2a2e" /></mesh>
          {[0, 1, 2, 3, 4].map((k) => <mesh key={k} position={[Math.sin(k) * 0.15, 0.85, Math.cos(k) * 0.15]} rotation={[Math.cos(k) * 0.4, k, Math.sin(k) * 0.4]}><coneGeometry args={[0.12, 0.8, 5]} /><meshStandardMaterial color="#2f6a34" flatShading /></mesh>)}
        </group>
      ))}
    </group>
  );
}

export function HqScene({ active = true }: { active?: boolean }) {
  const desks = useDesks();
  const pos = deskPositions(desks.length);
  return (
    <Canvas frameloop={active ? 'always' : 'never'} shadows dpr={Q.dpr} camera={{ position: [0, 7.4, 7.6], fov: 42, near: 0.1, far: 80 }} onCreated={({ camera }) => camera.lookAt(0, 0.6, -0.4)}>
      <color attach="background" args={['#0b0806']} />
      <fog attach="fog" args={['#0b0806', 12, 26]} />
      <ambientLight intensity={0.18} color="#ffd9b8" />
      <spotLight position={[0, 9, 4]} angle={0.7} penumbra={0.8} intensity={30} color="#ffcf98" castShadow />
      <Room />
      <Orb />
      {desks.map((d, i) => <Desk key={d.id} desk={d} pos={pos[i]} />)}
      <EffectComposer multisampling={Q.msaa}>
        {Q.bloom ? <Bloom intensity={0.35} luminanceThreshold={0.85} mipmapBlur /> : <></>}
        <Vignette darkness={0.6} offset={0.25} />
      </EffectComposer>
    </Canvas>
  );
}
