// Merges the static Synty props under it into a few big meshes (one per material), so the GPU gets
// tens of draw calls instead of thousands. Anything clickable, animated (userData.noBatch) or hidden is left alone.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type R3FObject = THREE.Object3D & { __r3f?: { handlers?: Record<string, unknown> } };

/** Leave a mesh out if it is not part of a prop, is hidden, or sits under something clickable or animated. */
function batchable(mesh: THREE.Mesh, root: THREE.Object3D) {
  let inProp = false;
  for (let o: THREE.Object3D | null = mesh; o && o !== root; o = o.parent) {
    if (!o.visible || o.userData.noBatch) return false;
    const h = (o as R3FObject).__r3f?.handlers;
    if (h && Object.keys(h).length) return false;
    if (o.userData.prop) inProp = true;
  }
  return inProp;
}

/** ?legacy turns merging off, to measure the office the way it first ran (for the Ep7 video). */
const LEGACY = new URLSearchParams(location.search).has('legacy');
/** Ukuran area batch (meter). */
// 30 m: gedung (50 × 30 m) = ±4 sel → lebih sedikit draw call; di Walk in tetap hanya 1–2 sel yang terlihat
const CELL = 30;
const _c = new THREE.Vector3();

export function StaticBatch({ children }: { children: ReactNode }) {
  const root = useRef<THREE.Group>(null!);
  const [merged, setMerged] = useState<THREE.Mesh[]>([]);

  useEffect(() => {
    if (LEGACY) return;
    const hidden: THREE.Mesh[] = [];
    const detached: [THREE.Mesh, THREE.Object3D][] = [];
    const made: THREE.Mesh[] = [];
    // Wait two frames so every suspended child has been attached.
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        const g = root.current;
        g.updateMatrixWorld(true);
        const inv = g.matrixWorld.clone().invert();
        const buckets = new Map<string, { mat: THREE.Material; cast: boolean; receive: boolean; geos: THREE.BufferGeometry[]; meshes: THREE.Mesh[] }>();
        g.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || (m as THREE.SkinnedMesh).isSkinnedMesh || Array.isArray(m.material)) return;
          if (!batchable(m, g) || m.matrixWorld.determinant() <= 0) return;
          const attrs = Object.keys(m.geometry.attributes).sort().join();
          // Dipecah per area 20×20 m: tiap gabungan punya batas kecil sehingga three.js melewati area di luar
          // pandangan kamera (frustum culling). Satu gabungan raksasa = seluruh gedung selalu digambar.
          if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
          _c.copy(m.geometry.boundingSphere!.center).applyMatrix4(m.matrixWorld);
          const cell = `${Math.floor(_c.x / CELL)},${Math.floor(_c.z / CELL)}`;
          const key = `${m.material.uuid}|${attrs}|${m.geometry.index ? 'i' : 'n'}|${m.castShadow}|${m.receiveShadow}|${cell}`;
          let b = buckets.get(key);
          if (!b) buckets.set(key, (b = { mat: m.material, cast: m.castShadow, receive: m.receiveShadow, geos: [], meshes: [] }));
          b.geos.push(m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)));
          b.meshes.push(m);
        });
        for (const b of buckets.values()) {
          if (b.meshes.length < 2) { b.geos.forEach((x) => x.dispose()); continue; }
          const geo = mergeGeometries(b.geos, false);
          b.geos.forEach((x) => x.dispose());
          if (!geo) continue;
          geo.computeBoundingSphere();
          const mesh = new THREE.Mesh(geo, b.mat);
          mesh.castShadow = b.cast;
          mesh.receiveShadow = b.receive;
          mesh.matrixAutoUpdate = false;
          mesh.userData.batch = true;
          made.push(mesh);
          // Mesh di dalam objek <primitive> (bukan milik React) dilepas dari scene graph: three tidak perlu lagi
          // menghitung matrix-nya tiap frame (ribuan objek → CPU lega, terutama di iPad). Mesh milik React disembunyikan.
          for (const m of b.meshes) {
            if (!(m as R3FObject).__r3f && m.parent) { detached.push([m, m.parent]); m.parent.remove(m); }
            else { m.visible = false; hidden.push(m); }
          }
        }
        setMerged(made);
      });
    });
    return () => {
      cancelAnimationFrame(raf);
      hidden.forEach((m) => { m.visible = true; });
      detached.forEach(([m, parent]) => parent.add(m));
      made.forEach((m) => m.geometry.dispose());
      setMerged([]);
    };
  }, []);

  return (
    <group ref={root}>
      {children}
      {merged.map((m) => <primitive key={m.uuid} object={m} />)}
    </group>
  );
}
