import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ToneMapping, HueSaturation, BrightnessContrast } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useOffice } from '../store/useOffice';
import { Office } from './Office';
import { Agents } from './Agents';
import { Player } from './Player';
import { Npcs } from './Npcs';
import { CameraDirector, PRESETS } from './CameraDirector';
import { FOOTPRINT } from '../world/layout';
import { RENDER, RenderController } from './RenderController';
import { PERF_SHOT, PerfProbe } from './PerfProbe';
import { INSIDE, insideIntensity, insideLight } from './inside';
import { CharacterShadows } from './CharacterShadows';
import { OCC, patchScene } from './occlusion';
import { player } from '../world/runtime';
import { LIGHT_POOL, Q } from './quality';
import { perf, usePerf } from './perf';
import { skyFor } from './weather';
import { Rain } from './Rain';
import { sfx } from './sfx';

/** Warm room lights, like ceiling lamps: [x, z, intensity, distance]. */
// Few, wide lights: every point light costs something on every pixel.
const ROOM_LIGHTS: [number, number, number, number][] = [
  [-15, -10, 22, 12], [-6.2, -10, 18, 10], [2.5, -10, 22, 13], [15, -10, 20, 12],
  [-15, 1.2, 15, 11], [-15, 10, 20, 11], [-4, 5, 28, 15],
  [7.5, 6, 26, 14], [15, 6, 26, 14], [0, 12.5, 9, 6],
];

/** The sun/moon shadows only change when the building (or the time of day) does: draw them a few times, not every frame. */
function StaticShadows({ version }: { version: string }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    const timers = [300, 1500, 4000].map((t) => setTimeout(() => { gl.shadowMap.needsUpdate = true; }, t));
    return () => { timers.forEach(clearTimeout); gl.shadowMap.autoUpdate = true; };
  }, [gl, version]);
  return null;
}

/**
 * An invisible roof: it renders nothing but blocks the sun, so sunlight only reaches the
 * floor through the windows (and their blinds) — the warm striped light of a real office.
 */
function ShadowRoof() {
  // one plane per block of the building (main block and east wing), merged so it stays one draw call
  const geometry = useMemo(() => mergeGeometries(FOOTPRINT.map((b) => new THREE.PlaneGeometry(b.maxX - b.minX + 0.6, b.maxZ - b.minZ + 0.6)
    .rotateX(-Math.PI / 2).translate((b.minX + b.maxX) / 2, 3.02, (b.minZ + b.maxZ) / 2)))!, []);
  return (
    <mesh geometry={geometry} castShadow>
      <meshBasicMaterial colorWrite={false} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

/**
 * Mode ringan/sedang: hanya LIGHT_POOL lampu ruangan (jumlah tetap → shader tidak dikompilasi ulang) untuk 10 lampu.
 * Dipilih yang terdekat dari tempat kamera berdiri (di Overview: titik lantai yang dilihat), sedikit condong ke arah
 * pandang. Dulu dipilih dari titik ±8 m di depan pandangan → lampu di atas/belakang pemain "mati" begitu kamera
 * berpaling dan ruangan jadi gelap. Lampu yang sudah menyala diberi bonus jarak (tidak berkedip di antara dua lampu)
 * dan pergantian memudar (`FADE` detik), tidak meloncat.
 */
const FADE = 0.4;
function NearestLights({ inside }: { inside: boolean }) {
  const refs = useRef<(THREE.PointLight | null)[]>([]);
  const camera = useThree((s) => s.camera);
  const dir = useMemo(() => new THREE.Vector3(), []);
  // tiap slot lampu: indeks lampu ruangan yang dipegang + kekuatan 0..1 (memudar saat berganti)
  const slots = useMemo(() => Array.from({ length: LIGHT_POOL }, (_, n) => ({ room: n, k: 1 })), []);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    camera.getWorldDirection(dir);
    let ax: number, az: number;
    if (camera.position.y > 6 && dir.y < -0.05) {
      // Overview / shot dari atas: titik lantai yang dilihat
      const t = Math.min(60, camera.position.y / -dir.y);
      ax = camera.position.x + dir.x * t; az = camera.position.z + dir.z * t;
    } else {
      // di dalam gedung: tempat kamera berdiri, digeser 2,5 m ke arah pandang
      const h = Math.hypot(dir.x, dir.z) || 1;
      ax = camera.position.x + (dir.x / h) * 2.5; az = camera.position.z + (dir.z / h) * 2.5;
    }
    const held = new Set(slots.map((s) => s.room));
    const score = (k: number) => Math.hypot(ROOM_LIGHTS[k][0] - ax, ROOM_LIGHTS[k][1] - az) - (held.has(k) ? 2 : 0);
    const order = ROOM_LIGHTS.map((_, k) => k).sort((a, b) => score(a) - score(b));
    const wanted = new Set(order.slice(0, slots.length));
    const free = order.slice(0, slots.length).filter((k) => !held.has(k));
    slots.forEach((slot, n) => {
      if (wanted.has(slot.room)) slot.k = Math.min(1, slot.k + dt / FADE);
      else {
        slot.k = Math.max(0, slot.k - dt / FADE);
        if (slot.k === 0 && free.length) slot.room = free.shift()!;
      }
      const light = refs.current[n];
      if (!light) return;
      const [x, z, i, d] = ROOM_LIGHTS[slot.room];
      light.position.set(x, 2.7, z);
      light.intensity = (inside ? insideIntensity(i, 2.7) : i * 1.15) * slot.k;
      light.distance = inside ? d * INSIDE.reach : d * 1.15;
    });
  });
  return <>{Array.from({ length: LIGHT_POOL }, (_, n) => <pointLight key={n} ref={(l) => { refs.current[n] = l; }} decay={inside ? INSIDE.decay : 2} color="#ffcf98" />)}</>;
}

/** Tembus pandang: aktif di Walk in orang ketiga; material baru ditambal tiap detik. */
function Occlusion() {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const t = useRef(1);
  useFrame((_, dt) => {
    t.current += dt;
    if (t.current > 1) { t.current = 0; patchScene(scene); }
    const s = useOffice.getState();
    const on = s.mode === 'life' && s.cameraStyle === 'third' && !s.shot;
    OCC.uOccOn.value = on ? 1 : 0;
    if (on) {
      OCC.uOccCam.value.copy(camera.position);
      OCC.uOccTarget.value.set(player.x, 1.15 + player.y, player.z);
    }
  });
  return null;
}

/** Hitung draw call & segitiga satu frame utuh (termasuk efek pasca-proses) dan FPS, 2× per detik. */
function PerfMeter() {
  const gl = useThree((s) => s.gl);
  const acc = useRef({ frames: 0, t0: performance.now() });
  useEffect(() => { gl.info.autoReset = false; return () => { gl.info.autoReset = true; }; }, [gl]);
  useFrame(() => {
    // awal frame: angka gl.info = total frame sebelumnya, lalu mulai hitung lagi
    const calls = gl.info.render.calls, tris = gl.info.render.triangles;
    gl.info.reset();
    const a = acc.current;
    a.frames++;
    const now = performance.now();
    if (now - a.t0 >= 500) { perf.set({ fps: Math.round((a.frames * 1000) / (now - a.t0)), calls, tris }); a.frames = 0; a.t0 = now; }
  }, -1);
  return null;
}

/** Telinga = kamera: posisi & arah pandang untuk volume dan kiri/kanan efek suara. */
function SfxListener() {
  const camera = useThree((s) => s.camera);
  const d = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    camera.getWorldDirection(d);
    // Walk in: telinga di kepala pemain (zoom jauh / pandangan atas tetap mendengar langkah & suara di dekatnya)
    if (useOffice.getState().mode === 'life') sfx.setListener(player.x, 1.6 + player.y, player.z, d.x, d.z);
    else sfx.setListener(camera.position.x, camera.position.y, camera.position.z, d.x, d.z);
  });
  return null;
}

export function OfficeScene() {
  const select = useOffice((s) => s.select);
  const mode = useOffice((s) => s.mode);
  const inside = useOffice((s) => insideLight(s.mode, s.shot));
  const perfOn = usePerf().on;
  const weather = useOffice((s) => s.weather);
  const sky = useMemo(() => skyFor(weather), [weather]);
  const day = weather.time !== 'night';
  return (
    <Canvas
      shadows={{ type: THREE.PCFSoftShadowMap }}
      dpr={RENDER ? RENDER.dpr : Q.dpr}
      frameloop={RENDER || mode === 'hq' ? 'never' : 'always'}
      style={RENDER ? { position: 'fixed', left: 0, top: 0, width: RENDER.w, height: RENDER.h } : undefined}
      camera={{ position: PRESETS.overview.pos.toArray(), fov: 45, near: 0.1, far: 220 }}
      gl={{ antialias: false, toneMapping: THREE.NoToneMapping, stencil: false, preserveDrawingBuffer: !!RENDER }}
      onCreated={(state) => { if (import.meta.env.DEV) (window as unknown as { __r3f: unknown }).__r3f = state; }}
      onPointerMissed={() => { if (mode === 'overview') select(null); }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* evening: dark outside, the office lit warm from inside */}
      {/* langit & cahaya luar mengikuti cuaca/waktu (☰ → Weather & time); default malam */}
      <color attach="background" args={[sky.sky]} />
      <fog attach="fog" args={[sky.sky, sky.fog[0], sky.fog[1]]} />

      <hemisphereLight args={[sky.hemiSky, sky.hemiGround]} intensity={inside ? INSIDE.hemisphere * (day ? 1.25 : 1) : sky.hemi} />
      <ambientLight intensity={inside ? INSIDE.ambient : 0.1} color="#ffe2c2" />
      {/* moonlight */}
      <directionalLight
        position={sky.sun}
        intensity={sky.sunIntensity}
        color={sky.sunColor}
        castShadow
        shadow-mapSize={[Q.shadow, Q.shadow]}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={1}
        shadow-camera-far={110}
        shadow-bias={-0.0003}
        shadow-normalBias={0.03}
        shadow-radius={4}
      />
      <ShadowRoof />
      <CharacterShadows />
      <Occlusion />
      {/* inside, the lamps reach the corners too (see inside.ts) */}
      {LIGHT_POOL >= ROOM_LIGHTS.length
        ? ROOM_LIGHTS.map(([x, z, i, d], k) => (
          <pointLight key={k} position={[x, 2.7, z]} intensity={inside ? insideIntensity(i, 2.7) : i} distance={inside ? d * INSIDE.reach : d} decay={inside ? INSIDE.decay : 2} color="#ffcf98" />
        ))
        : <NearestLights inside={inside} />}

      {/* cahaya pantul asli: HDRI interior Poly Haven "lebombo" (CC0) — pantulan & isian lembut di semua bahan */}
      <Suspense fallback={null}><Environment files="/assets/hdri/lebombo_1k.hdr" environmentIntensity={inside ? (day ? 0.38 : 0.28) : sky.env} /></Suspense>

      <Office />
      <Suspense fallback={null}>
        <Agents />
        <Npcs />
        <Player />
      </Suspense>
      <CameraDirector />
      {RENDER && <RenderController />}
      {PERF_SHOT && <PerfProbe />}

      <StaticShadows version={weather.time} />
      {weather.rain && <Rain />}
      <SfxListener />
      {perfOn && <PerfMeter />}
      {/* tanpa depth of field: semua tajam (blur lensa membuat gambar kabur & terasa seperti miniatur/mainan) */}
      <EffectComposer multisampling={Q.msaa}>
        {/* AO: N8AO crash di three r187, SSAO berbintik → diganti bayangan kontak (fallback/kit.ts, CharacterShadows) */}
        {Q.bloom ? <Bloom intensity={0.28} luminanceThreshold={0.85} luminanceSmoothing={0.2} mipmapBlur /> : <></>}
        {/* inside: a muted, contrasty grade (the reference video), outside the brighter overview look */}
        <HueSaturation saturation={inside ? -0.1 : -0.04} />
        <BrightnessContrast brightness={inside ? -0.05 : 0.02} contrast={inside ? 0.12 : 0.08} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.26} darkness={inside ? 0.72 : 0.5} />
      </EffectComposer>
    </Canvas>
  );
}
