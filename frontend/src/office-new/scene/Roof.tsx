// Atap gedung saat Walk in / 1st person (dari luar gedung terlihat beratap seperti aslinya). Di Overview atap
// tetap dibuka (cutaway, seperti video). Bila menghalangi pandangan ke pemain, efek tembus pandang (occlusion.ts) membolonginya.
import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FOOTPRINT } from '../world/layout';
import { tiles } from './fallback/textures';

export function Roof() {
  const geo = useMemo(() => mergeGeometries(FOOTPRINT.map((b) => {
    const w = b.maxX - b.minX + 0.5, d = b.maxZ - b.minZ + 0.5;
    const g = new THREE.BoxGeometry(w, 0.14, d).translate((b.minX + b.maxX) / 2, 3.18, (b.minZ + b.maxZ) / 2);
    // UV dalam meter supaya pola atap tidak melar
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 4, uv.getY(i) * d / 4);
    return g;
  }))!, []);
  const mat = useMemo(() => {
    const t = tiles('#4a4e55', 3).clone();
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ color: '#ffffff', map: t, roughness: 0.95 });
  }, []);
  return <mesh geometry={geo} material={mat} receiveShadow />;
}
