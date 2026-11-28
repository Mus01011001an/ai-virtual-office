// Model furnitur buatan Blender (tools/office-new/blender/furniture.py → public/office-new/kit/furniture.glb):
// kursi kerja/direktur/rapat dan meja. Dimuat sekali sebelum office tampil; kit memakainya bila tersedia, kalau gagal
// kembali ke bentuk kotak lama.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const models = new Map<string, THREE.Object3D>();

export async function loadKitModels() {
  try {
    const gltf = await new GLTFLoader().loadAsync('/office-new/kit/furniture.glb');
    gltf.scene.updateMatrixWorld(true);
    for (const child of gltf.scene.children) models.set(child.name, child);
  } catch { /* tanpa model: kit memakai bentuk kotak */ }
}

/** Salinan model dengan material diganti sesuai nama material Blender (Fabric, Leather, Wood, Metal, …). */
export function kitModel(name: string, materialFor: (blenderName: string) => THREE.Material): THREE.Group | null {
  const src = models.get(name);
  if (!src) return null;
  const g = new THREE.Group();
  src.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const mesh = new THREE.Mesh(m.geometry, materialFor(mats[0].name));
    mesh.applyMatrix4(m.matrixWorld);
    g.add(mesh);
  });
  return g;
}
