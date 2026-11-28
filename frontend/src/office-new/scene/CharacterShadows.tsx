// Bayangan kontak lembut di bawah semua orang (agen, staf, pemain): SATU InstancedMesh → 1 draw call.
// Pengganti ambient occlusion (N8AO crash di three r187): karakter "menapak" di lantai, tidak melayang.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useOffice } from '../store/useOffice';
import { AGENT_IDS } from '../core/types';
import { agentBodies, player, walkers } from '../world/runtime';
import { STILL_SPOTS } from './Npcs';
import { BLOB_MAT } from './fallback/kit';

const MAX = 96;
const S = 0.95;

export function CharacterShadows() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  useEffect(() => { ref.current.frustumCulled = false; }, []);
  useFrame(() => {
    const st = useOffice.getState();
    let i = 0;
    const put = (x: number, z: number, s = S) => {
      if (i >= MAX) return;
      m.makeScale(s, 1, s).setPosition(x, 0.03, z);
      ref.current.setMatrixAt(i++, m);
    };
    for (const id of AGENT_IDS) if (!st.agents[id].vacant) put(agentBodies[id].x, agentBodies[id].z);
    for (const w of walkers) put(w.x, w.z);
    for (const p of STILL_SPOTS) put(p.x, p.z);
    if (st.mode === 'life' && st.cameraStyle === 'third') put(player.x, player.z, S * Math.max(0.5, 1 - player.y * 0.4));
    ref.current.count = i;
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, BLOB_MAT, MAX]} renderOrder={1} />;
}
