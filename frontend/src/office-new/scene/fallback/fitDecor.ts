// CC0 kit: area tabrak tanaman & dekorasi lantai mengikuti model yang benar-benar digambar. Ukuran di layout.ts dibuat
// untuk model Synty; kit sering lebih kecil, sehingga muncul "dinding tak terlihat" (mis. alas patung lobi 1,7 m).
import * as THREE from 'three';
import { DECOR_BOXES } from '../../world/layout';
import { fallbackProp } from './kit';
import { fullPropName } from '../assets';

const PAD = 0.04;
const FAR = 1e9;
let done = false;

export function fitDecorToKit() {
  if (done) return;
  done = true;
  const bb = new THREE.Box3(), part = new THREE.Box3();
  for (const e of DECOR_BOXES) {
    const o = fallbackProp(fullPropName(e.name), '01');
    o.updateMatrixWorld(true);
    bb.makeEmpty();
    o.traverse((m) => {
      const mesh = m as THREE.Mesh;
      if (!mesh.isMesh || (mesh.material as THREE.Material).name === 'Blob') return;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      bb.union(part.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld));
    });
    // Tidak ada yang digambar / hanya setipis karpet → tidak menghalangi.
    if (bb.isEmpty() || bb.max.y < 0.05) { Object.assign(e.box, { minX: FAR, maxX: FAR, minZ: FAR, maxZ: FAR }); continue; }
    const c = Math.cos(e.rot), s = Math.sin(e.rot);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const x of [bb.min.x, bb.max.x]) for (const z of [bb.min.z, bb.max.z]) {
      const wx = e.x + x * c + z * s, wz = e.z - x * s + z * c;
      minX = Math.min(minX, wx); maxX = Math.max(maxX, wx); minZ = Math.min(minZ, wz); maxZ = Math.max(maxZ, wz);
    }
    Object.assign(e.box, { minX: minX - PAD, maxX: maxX + PAD, minZ: minZ - PAD, maxZ: maxZ + PAD });
  }
}
