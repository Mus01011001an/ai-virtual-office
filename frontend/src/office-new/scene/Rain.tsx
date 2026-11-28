// Hujan di luar gedung: garis-garis tipis jatuh (satu InstancedMesh = 1 draw call). Tidak turun di dalam gedung.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FOOTPRINT } from '../world/layout';
import { GFX } from './quality';

const COUNT = GFX === 'low' ? 500 : GFX === 'medium' ? 900 : 1400;
const TOP = 14;
const AREA = { minX: -42, maxX: 52, minZ: -36, maxZ: 46 };
const inside = (x: number, z: number) => FOOTPRINT.some((b) => x > b.minX - 0.4 && x < b.maxX + 0.4 && z > b.minZ - 0.4 && z < b.maxZ + 0.4);

export function Rain() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const geo = useMemo(() => new THREE.BoxGeometry(0.012, 0.6, 0.012), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#c3d0e0', transparent: true, opacity: 0.32, depthWrite: false }), []);
  const drops = useMemo(() => {
    const d = new Float32Array(COUNT * 4); // x, y, z, speed
    const place = (i: number, y: number) => {
      let x = 0, z = 0;
      do { x = AREA.minX + Math.random() * (AREA.maxX - AREA.minX); z = AREA.minZ + Math.random() * (AREA.maxZ - AREA.minZ); } while (inside(x, z));
      d[i * 4] = x; d[i * 4 + 1] = y; d[i * 4 + 2] = z; d[i * 4 + 3] = 9 + Math.random() * 4;
    };
    for (let i = 0; i < COUNT; i++) place(i, Math.random() * TOP);
    return { d, place };
  }, []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  useEffect(() => { ref.current.frustumCulled = false; return () => { geo.dispose(); mat.dispose(); }; }, [geo, mat]);
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const { d, place } = drops;
    for (let i = 0; i < COUNT; i++) {
      let y = d[i * 4 + 1] - d[i * 4 + 3] * dt;
      if (y < 0) { place(i, TOP + y); y = d[i * 4 + 1]; }
      d[i * 4 + 1] = y;
      m.makeTranslation(d[i * 4], y + 0.3, d[i * 4 + 2]);
      ref.current.setMatrixAt(i, m);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mat, COUNT]} renderOrder={2} />;
}
