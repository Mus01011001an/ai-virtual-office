import { groundObstacles } from './architecture'
import { BOUNDS, type V2 } from './layout'

/** Grid A* + string-pulling di lantai dasar (pengganti NavMesh yang ringan & deterministik). */
const CELL = 0.4
const INFLATE = 0.3
const W = Math.ceil((BOUNDS.x1 - BOUNDS.x0) / CELL)
const H = Math.ceil((BOUNDS.z1 - BOUNDS.z0) / CELL)
const grid = new Uint8Array(W * H)

const toCell = (x: number, z: number): [number, number] => [
  Math.min(W - 1, Math.max(0, Math.floor((x - BOUNDS.x0) / CELL))),
  Math.min(H - 1, Math.max(0, Math.floor((z - BOUNDS.z0) / CELL))),
]
const toWorld = (cx: number, cz: number): V2 => [BOUNDS.x0 + (cx + 0.5) * CELL, BOUNDS.z0 + (cz + 0.5) * CELL]

;(function bake() {
  for (const r of groundObstacles()) {
    const [ax, az] = toCell(r.x0 - INFLATE, r.z0 - INFLATE)
    const [bx, bz] = toCell(r.x1 + INFLATE, r.z1 + INFLATE)
    for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) grid[z * W + x] = 1
  }
  for (let x = 0; x < W; x++) { grid[x] = 1; grid[(H - 1) * W + x] = 1 }
  for (let z = 0; z < H; z++) { grid[z * W] = 1; grid[z * W + W - 1] = 1 }
})()

export const isFree = (x: number, z: number) => { const [cx, cz] = toCell(x, z); return grid[cz * W + cx] === 0 }

function nearestFree(cx: number, cz: number): [number, number] {
  if (!grid[cz * W + cx]) return [cx, cz]
  for (let r = 1; r < 30; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue
    const x = cx + dx, z = cz + dz
    if (x >= 0 && z >= 0 && x < W && z < H && !grid[z * W + x]) return [x, z]
  }
  return [cx, cz]
}

function lineFree(ax: number, az: number, bx: number, bz: number) {
  let x = ax, z = az
  const dx = Math.abs(bx - ax), dz = Math.abs(bz - az), sx = ax < bx ? 1 : -1, sz = az < bz ? 1 : -1
  let err = dx - dz
  for (;;) {
    if (grid[z * W + x]) return false
    if (x === bx && z === bz) return true
    const e2 = 2 * err
    if (e2 > -dz) { err -= dz; x += sx }
    if (e2 < dx) { err += dx; z += sz }
  }
}

// binary heap kecil
class Heap {
  private a: number[] = []; private f: Float32Array
  constructor(f: Float32Array) { this.f = f }
  get size() { return this.a.length }
  push(i: number) { const a = this.a; a.push(i); let k = a.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (this.f[a[p]] <= this.f[a[k]]) break; [a[p], a[k]] = [a[k], a[p]]; k = p } }
  pop() {
    const a = this.a, top = a[0], last = a.pop()!
    if (a.length) { a[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < a.length && this.f[a[l]] < this.f[a[m]]) m = l; if (r < a.length && this.f[a[r]] < this.f[a[m]]) m = r; if (m === k) break; [a[m], a[k]] = [a[k], a[m]]; k = m } }
    return top
  }
}

const gScore = new Float32Array(W * H)
const fScore = new Float32Array(W * H)
const came = new Int32Array(W * H)
const closed = new Uint8Array(W * H)
const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]]

/** Path dunia dari a ke b. Titik terakhir = b persis (boleh di dalam furnitur, mis. kursi sofa). */
export function findPath(a: V2, b: V2): V2[] {
  const [sx, sz] = nearestFree(...toCell(a[0], a[1]))
  const [gx, gz] = nearestFree(...toCell(b[0], b[1]))
  const start = sz * W + sx, goal = gz * W + gx
  if (start === goal) return [b]
  gScore.fill(Infinity); closed.fill(0); came.fill(-1)
  const h = (i: number) => { const x = i % W, z = (i / W) | 0; const dx = Math.abs(x - gx), dz = Math.abs(z - gz); return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz) }
  gScore[start] = 0; fScore[start] = h(start)
  const open = new Heap(fScore); open.push(start)
  let found = false
  while (open.size) {
    const cur = open.pop()
    if (cur === goal) { found = true; break }
    if (closed[cur]) continue
    closed[cur] = 1
    const cx = cur % W, cz = (cur / W) | 0
    for (const [dx, dz, cost] of NB) {
      const nx = cx + dx, nz = cz + dz
      if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue
      const ni = nz * W + nx
      if (grid[ni] || closed[ni]) continue
      if (dx && dz && (grid[cz * W + nx] || grid[nz * W + cx])) continue
      const g = gScore[cur] + cost
      if (g < gScore[ni]) { gScore[ni] = g; fScore[ni] = g + h(ni); came[ni] = cur; open.push(ni) }
    }
  }
  if (!found) return [b]
  const cells: number[] = []
  for (let c = goal; c !== -1; c = came[c]) cells.push(c)
  cells.reverse()
  // string pulling
  const pts: number[] = [cells[0]]
  let anchor = cells[0]
  for (let i = 2; i < cells.length; i++) {
    const p = cells[i]
    if (!lineFree(anchor % W, (anchor / W) | 0, p % W, (p / W) | 0)) { anchor = cells[i - 1]; pts.push(anchor) }
  }
  pts.push(goal)
  const out = pts.slice(1).map((c) => toWorld(c % W, (c / W) | 0))
  out.push(b)
  return out
}
