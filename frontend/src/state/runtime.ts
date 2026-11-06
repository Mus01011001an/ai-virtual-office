import type * as THREE from 'three'

export interface SeatInfo {
  id: string
  x: number
  y: number
  z: number
  yaw: number
  label: string
}

/** State mutable per-frame (tidak memicu re-render React). */
export const runtime = {
  player: {
    x: 0,
    y: 0,
    z: 26,
    yaw: Math.PI,
    moving: false,
    running: false,
    grounded: true,
    sitting: false,
    seatedInfo: null as null | SeatInfo,
  },
  nearbySeat: null as null | SeatInfo,
  cam: { yaw: Math.PI, pitch: -0.12, dist: 4.5, isoDist: 40 },
  pointerLocked: false,
  rmbDown: false,
  /** Virtual Analog Joystick vector untuk mobile touch controls: x in [-1, 1], y in [-1, 1] */
  virtualJoystick: { x: 0, y: 0 },
  agents: new Map<string, { x: number; y: number; z: number; yaw: number; visible: boolean }>(),
  agentObjects: new Map<string, THREE.Object3D>(),
  monitorObjects: new Map<string, THREE.Object3D>(),
  glassHandles: new Set<number>(),
  playerColliderHandle: -1,
  moveTarget: null as null | { path: [number, number][]; i: number; dest: [number, number] },
  time: { h: 9, m: 0, s: 0, ms: 0, weekday: 1, dayFactor: 1 },
  /** posisi kumpul per employee yang dipanggil (dihitung GatherController) */
  gather: new Map<string, { x: number; z: number; y: number; sit: boolean }>(),
}

export function resetRuntime() {
  Object.assign(runtime.player, {
    x: 0,
    y: 0,
    z: 26,
    yaw: Math.PI,
    moving: false,
    running: false,
    grounded: true,
    sitting: false,
    seatedInfo: null,
  })
  runtime.nearbySeat = null
  Object.assign(runtime.cam, { yaw: Math.PI, pitch: -0.12 })
  runtime.virtualJoystick = { x: 0, y: 0 }
  runtime.agents.clear()
  runtime.agentObjects.clear()
  runtime.monitorObjects.clear()
  runtime.moveTarget = null
  runtime.glassHandles.clear()
  runtime.gather.clear()
}
