import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { MatKey } from './materials'

type Vec3 = [number, number, number]

/**
 * Static batcher: semua primitif furnitur/arsitektur digabung per material
 * → draw call ≈ jumlah material, bukan jumlah objek.
 */
export class Batcher {
  private parts = new Map<MatKey, THREE.BufferGeometry[]>()
  private stack: THREE.Matrix4[] = [new THREE.Matrix4()]
  private tmp = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private e = new THREE.Euler()

  push(x: number, y: number, z: number, yaw = 0) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), this.q.setFromEuler(this.e.set(0, yaw, 0)), new THREE.Vector3(1, 1, 1))
    this.stack.push(this.top().clone().multiply(m))
  }
  pop() { if (this.stack.length > 1) this.stack.pop() }
  private top() { return this.stack[this.stack.length - 1] }

  add(mat: MatKey, g: THREE.BufferGeometry, pos: Vec3, rot: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]) {
    this.tmp.compose(new THREE.Vector3(...pos), this.q.setFromEuler(this.e.set(...rot)), new THREE.Vector3(...scale))
    const geo = g
    geo.applyMatrix4(this.top().clone().multiply(this.tmp))
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2))
    const list = this.parts.get(mat) ?? []
    list.push(geo)
    this.parts.set(mat, list)
  }

  box(mat: MatKey, w: number, h: number, d: number, x: number, y: number, z: number, rotY = 0) {
    this.add(mat, new THREE.BoxGeometry(w, h, d), [x, y, z], [0, rotY, 0])
  }
  /** box dengan alas di y (bukan pusat) */
  boxB(mat: MatKey, w: number, h: number, d: number, x: number, y: number, z: number) {
    this.box(mat, w, h, d, x, y + h / 2, z)
  }
  cyl(mat: MatKey, rt: number, rb: number, h: number, x: number, y: number, z: number, seg = 16, rot: Vec3 = [0, 0, 0]) {
    this.add(mat, new THREE.CylinderGeometry(rt, rb, h, seg), [x, y, z], rot)
  }
  sphere(mat: MatKey, r: number, x: number, y: number, z: number, scale: Vec3 = [1, 1, 1], detail = 1) {
    this.add(mat, new THREE.IcosahedronGeometry(r, detail), [x, y, z], [0, 0, 0], scale)
  }
  plane(mat: MatKey, w: number, h: number, pos: Vec3, rot: Vec3) {
    this.add(mat, new THREE.PlaneGeometry(w, h), pos, rot)
  }

  build(): { key: MatKey; geometry: THREE.BufferGeometry }[] {
    const out: { key: MatKey; geometry: THREE.BufferGeometry }[] = []
    for (const [key, list] of this.parts) {
      const allIndexed = list.every((g) => g.index)
      const norm = allIndexed ? list : list.map((g) => (g.index ? g.toNonIndexed() : g))
      const merged = mergeGeometries(norm, false)
      if (merged) { merged.computeBoundingSphere(); out.push({ key, geometry: merged }) }
      norm.forEach((g) => g.dispose())
    }
    return out
  }
}
