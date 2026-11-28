// "Karakter nggak boleh tembus barang": prop yang berdiri di lantai (kursi, tanaman, kardus, tong sampah, troli, …)
// didaftarkan sebagai penghalang begitu tampil — pemain tertahan (collide) dan jalur A* NPC/agen memutarinya.
// Kotak = jejak model yang benar-benar digambar, sedikit dikecilkan agar lorong sempit tetap bisa dilalui.
import * as THREE from 'three';
import { OBSTACLES, type Box } from './layout';
import { blockBox } from './nav';

/** Nama prop (pendek, tanpa SM_Prop_) yang menghalangi. Rug, lampu, barang di meja, dinding: tidak. */
export const SOLID = /^(Chair_|Stool|Bin|Trashbin|CardboardBox|Box_|Plant_|Tree_|Small_Hedge|WaterCooler|Fan_Pedistal|CoatRack|Table_|CoffeeTable|SwissBall|Printer|Photocopier|PaperShredder|Sign_Wetfloor|Janitor|Vacuum|Cart_|Whiteboard_02|Presentation_Chart|Camera_Tripod|Microphone_01|Fire_Extinguisher|Pallet|Concrete_Cube|Benchseat|Outdoor_Seat|Couch|ArcadeMachine|Jukebox|VendingMachine|Fishtank|Fridge|MiniFridge|Server_Cabinet|Cabinets|Kitchen_|TableTennis|TableFootball|PoolTable|Computer_Tower|Sculpture_Base|Bike|LampPost)/;

const seen = new Set<string>();
const v = new THREE.Vector3();

/** Daftarkan jejak lantai `local` (bbox model, ruang prop) yang ditempatkan oleh `group`. */
export function registerSolid(name: string, local: THREE.Box3, group: THREE.Object3D) {
  if (local.isEmpty() || local.min.y > 0.08 || local.max.y < 0.3) return;
  group.updateWorldMatrix(true, false);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity;
  for (const x of [local.min.x, local.max.x]) for (const z of [local.min.z, local.max.z]) {
    v.set(x, local.min.y, z).applyMatrix4(group.matrixWorld);
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z); minY = Math.min(minY, v.y);
  }
  if (minY > 0.08) return; // standing on a table / shelf, not the floor
  // shrink 15 % (chair legs splay wider than the body you bump into), keep at least 0.2 m
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const hw = Math.max(0.1, ((maxX - minX) / 2) * 0.85), hd = Math.max(0.1, ((maxZ - minZ) / 2) * 0.85);
  const key = `${name}@${cx.toFixed(2)},${cz.toFixed(2)}`;
  if (seen.has(key)) return; // remounts (HMR, mode switches) register once
  seen.add(key);
  const box: Box = { minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd };
  OBSTACLES.push(box);
  blockBox(box);
}
