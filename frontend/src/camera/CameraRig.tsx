import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import * as THREE from 'three'
import { useOffice } from '../state/store'
import { runtime } from '../state/runtime'

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const ISO_PITCH = -0.88
const FOV = { fps: 78, tps: 68, iso: 38 }
const SMOOTH = { fps: 60, tps: 22, iso: 7 }
/** Offset bahu kanan saat mouse-look (gaya shooter third-person). */
const SHOULDER = 0.55

/** Mode yang memakai pointer-lock: fps selalu, tps bila mouseLook aktif. */
export const usesPointerLock = (mode = useOffice.getState().cameraMode) =>
  mode === 'fps' || (mode === 'tps' && useOffice.getState().mouseLook)

/**
 * 3 mode kamera:
 *  - fps : dari mata (pointer-lock, bebas lihat ke atas)
 *  - tps : di belakang bahu. Mouse-look (default): mouse langsung memutar kamera seperti game
 *          shooter, karakter menghadap arah kamera. Mode klasik: klik kanan + drag.
 *  - iso : overview isometrik (RMB drag rotasi, scroll zoom, klik lantai → jalan)
 */
export function CameraRig() {
  const { camera, gl } = useThree()
  const { world, rapier } = useRapier()
  const mode = useOffice((s) => s.cameraMode)
  const look = useRef(new THREE.Vector3(0, 1.5, 20))
  const camPos = useRef(new THREE.Vector3(0, 4, 34))
  const shoulder = useRef(0)
  const curDist = useRef(4.5)

  useEffect(() => {
    const el = gl.domElement
    const onMove = (e: MouseEvent) => {
      const st = useOffice.getState()
      const m = st.cameraMode
      const sens = 0.0022 * st.sensitivity
      const locked = document.pointerLockElement === el
      if ((locked && m !== 'iso') || (!locked && m !== 'fps' && runtime.rmbDown)) {
        // Lonjakan movementX saat lock baru aktif (bug Chrome) diabaikan.
        if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return
        runtime.cam.yaw -= e.movementX * sens
        if (m !== 'iso') runtime.cam.pitch = clamp(runtime.cam.pitch - e.movementY * sens, m === 'fps' ? -1.52 : -1.2, m === 'fps' ? 1.52 : 0.75)
      }
    }
    const onDown = (e: MouseEvent) => { if (e.button === 2) runtime.rmbDown = true }
    const onUp = (e: MouseEvent) => { if (e.button === 2) runtime.rmbDown = false }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const st = useOffice.getState()
      const d = clamp(e.deltaY, -100, 100) * 0.0035
      const c = runtime.cam
      if (st.cameraMode === 'tps') {
        c.dist = clamp(c.dist * (1 + d), 0.6, 14)
        if (c.dist < 1.1 && d < 0) { st.set({ cameraMode: 'fps' }); c.dist = 3 }
      } else if (st.cameraMode === 'fps') {
        if (d > 0) { st.set({ cameraMode: 'tps' }); c.dist = 3 }
      } else c.isoDist = clamp(c.isoDist * (1 + d), 10, 95)
    }
    const onCtx = (e: Event) => e.preventDefault()
    const onLock = () => {
      runtime.pointerLocked = document.pointerLockElement === el
      useOffice.getState().set({ locked: runtime.pointerLocked, ...(runtime.pointerLocked ? {} : { hoveredId: null }) })
    }
    window.addEventListener('mousemove', onMove)
    el.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('contextmenu', onCtx)
    document.addEventListener('pointerlockchange', onLock)
    return () => {
      window.removeEventListener('mousemove', onMove)
      el.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('contextmenu', onCtx)
      document.removeEventListener('pointerlockchange', onLock)
    }
  }, [gl])

  useEffect(() => {
    if (!usesPointerLock(mode) && document.pointerLockElement) document.exitPointerLock()
    if (mode === 'tps' && runtime.cam.pitch > 0.75) runtime.cam.pitch = -0.15
  }, [mode])

  const dir = useRef(new THREE.Vector3())
  const want = useRef(new THREE.Vector3())
  const wantLook = useRef(new THREE.Vector3())
  const pivot = useRef(new THREE.Vector3())
  const tmp = useRef(new THREE.Vector3())

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const p = runtime.player, c = runtime.cam
    const pitch = mode === 'iso' ? ISO_PITCH : c.pitch
    dir.current.set(Math.sin(c.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(c.yaw) * Math.cos(pitch))
    let snap = false
    if (mode === 'fps') {
      want.current.set(p.x, p.y + 1.62, p.z)
      wantLook.current.copy(want.current).add(dir.current)
      snap = true
    } else if (mode === 'tps') {
      const head = pivot.current.set(p.x, p.y + 1.6, p.z)
      // Geser ke bahu kanan bila mouse-look aktif (dengan cek dinding di samping).
      const sTarget = runtime.pointerLocked ? SHOULDER : 0
      shoulder.current += (sTarget - shoulder.current) * (1 - Math.exp(-8 * dt))
      if (shoulder.current > 0.01) {
        const right = tmp.current.set(-Math.cos(c.yaw), 0, Math.sin(c.yaw))
        let off = shoulder.current
        const sh = world.castRay(new rapier.Ray(head, right), off + 0.25, true, undefined, undefined, undefined, undefined,
          (col) => col.handle !== runtime.playerColliderHandle)
        if (sh) off = Math.max(0, Math.min(off, sh.timeOfImpact - 0.25))
        head.addScaledVector(right, off)
      }
      let dist = c.dist
      const back = tmp.current.copy(dir.current).negate()
      const hit = world.castRay(new rapier.Ray(head, back), dist + 0.3, true, undefined, undefined, undefined, undefined,
        (col) => col.handle !== runtime.playerColliderHandle)
      if (hit) dist = Math.max(0.3, Math.min(dist, hit.timeOfImpact - 0.25))
      // Mendekat (dinding) langsung, menjauh dihaluskan → tidak tembus dinding & tidak patah.
      curDist.current = dist < curDist.current ? dist : curDist.current + (dist - curDist.current) * (1 - Math.exp(-6 * dt))
      want.current.copy(head).addScaledVector(back, curDist.current)
      want.current.y = Math.max(want.current.y, p.y + 0.25)
      wantLook.current.copy(head).addScaledVector(dir.current, 4)
      // Mouse-look harus terasa instan seperti game; hanya jarak (zoom/tabrak dinding) yang dihaluskan.
      snap = runtime.pointerLocked
    } else {
      wantLook.current.set(p.x, p.y + 1, p.z)
      want.current.copy(wantLook.current).addScaledVector(dir.current, -c.isoDist)
    }
    const a = snap ? 1 : 1 - Math.exp(-SMOOTH[mode] * dt)
    camPos.current.lerp(want.current, a)
    look.current.lerp(wantLook.current, a)
    camera.position.copy(camPos.current)
    camera.lookAt(look.current)
    const cam = camera as THREE.PerspectiveCamera
    const f = cam.fov + (FOV[mode] - cam.fov) * (1 - Math.exp(-6 * dt))
    if (Math.abs(f - cam.fov) > 0.01) { cam.fov = f; cam.updateProjectionMatrix() }
  })

  return null
}
