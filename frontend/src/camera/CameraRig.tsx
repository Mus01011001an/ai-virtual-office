import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import * as THREE from 'three'
import { isUiBlocking, useOffice } from '../state/store'
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
 * Deteksi apakah perangkat adalah iPad, iPhone, atau layar sentuh
 */
export const isTouchOrIPad = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
    'ontouchstart' in window
  )
}

/**
 * 3 mode kamera:
 *  - fps : dari mata (pointer-lock di desktop, drag-to-look di iPad/touch)
 *  - tps : di belakang bahu (mouse-look bila terkunci, drag-to-look bila tidak terkunci)
 *  - iso : overview isometrik (drag rotasi, scroll / pinch zoom)
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
    let isPointerDown = false
    let lastClientX = 0
    let lastClientY = 0
    let initialPinchDist = 0

    const onPointerDown = (e: PointerEvent) => {
      if (isUiBlocking()) return
      if (e.button === 2) {
        runtime.rmbDown = true
      }
      if (e.button === 0 || e.pointerType === 'touch') {
        isPointerDown = true
        lastClientX = e.clientX
        lastClientY = e.clientY
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      const st = useOffice.getState()
      const m = st.cameraMode
      const sens = 0.0022 * st.sensitivity
      const locked = document.pointerLockElement === el

      // Kasus 1: Pointer Lock aktif (Desktop mouselook klasik)
      if (locked && m !== 'iso') {
        if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return
        runtime.cam.yaw -= e.movementX * sens
        runtime.cam.pitch = clamp(
          runtime.cam.pitch - e.movementY * sens,
          m === 'fps' ? -1.52 : -1.2,
          m === 'fps' ? 1.52 : 0.75
        )
        return
      }

      // Kasus 2: Non-locked Drag Mode (iPad Trackpad, iPad Mouse, Touch, atau RMB Drag)
      const isDragging = (isPointerDown && (e.buttons === 1 || e.pointerType === 'touch')) || runtime.rmbDown

      if (isDragging) {
        const dx = e.clientX - lastClientX
        const dy = e.clientY - lastClientY
        lastClientX = e.clientX
        lastClientY = e.clientY

        if (Math.abs(dx) > 120 || Math.abs(dy) > 120) return

        runtime.cam.yaw -= dx * sens
        if (m !== 'iso') {
          runtime.cam.pitch = clamp(
            runtime.cam.pitch - dy * sens,
            m === 'fps' ? -1.52 : -1.2,
            m === 'fps' ? 1.52 : 0.75
          )
        }
      } else {
        lastClientX = e.clientX
        lastClientY = e.clientY
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      if (e.button === 2) runtime.rmbDown = false
      if (e.button === 0 || e.pointerType === 'touch') {
        isPointerDown = false
      }
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const st = useOffice.getState()
      const d = clamp(e.deltaY, -100, 100) * 0.0035
      const c = runtime.cam
      if (st.cameraMode === 'tps') {
        c.dist = clamp(c.dist * (1 + d), 0.6, 14)
        if (c.dist < 1.1 && d < 0) {
          st.set({ cameraMode: 'fps' })
          c.dist = 3
        }
      } else if (st.cameraMode === 'fps') {
        if (d > 0) {
          st.set({ cameraMode: 'tps' })
          c.dist = 3
        }
      } else {
        c.isoDist = clamp(c.isoDist * (1 + d), 10, 95)
      }
    }

    const onCtx = (e: Event) => e.preventDefault()

    const onLock = () => {
      runtime.pointerLocked = document.pointerLockElement === el
      useOffice.getState().set({
        locked: runtime.pointerLocked,
        ...(runtime.pointerLocked ? {} : { hoveredId: null }),
      })
    }

    // Touch handlers for iPad touchscreen pinch zoom
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        initialPinchDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialPinchDist > 0) {
        e.preventDefault()
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
        const diff = (initialPinchDist - currentDist) * 0.015
        initialPinchDist = currentDist

        const st = useOffice.getState()
        const c = runtime.cam
        if (st.cameraMode === 'tps') {
          c.dist = clamp(c.dist * (1 + diff), 0.6, 14)
        } else if (st.cameraMode === 'iso') {
          c.isoDist = clamp(c.isoDist * (1 + diff), 10, 95)
        }
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        initialPinchDist = 0
      }
    }

    el.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('contextmenu', onCtx)
    document.addEventListener('pointerlockchange', onLock)
    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('contextmenu', onCtx)
      document.removeEventListener('pointerlockchange', onLock)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
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
