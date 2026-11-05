import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import * as THREE from 'three'
import { isUiBlocking, useOffice } from '../state/store'
import { runtime } from '../state/runtime'
import { findPath } from './pathfinding'
import { MEZZ_Y } from './layout'
import { usesPointerLock } from '../camera/CameraRig'

const raycaster = new THREE.Raycaster()
const ndc = new THREE.Vector2()
const markerGeo = new THREE.RingGeometry(0.25, 0.38, 32).rotateX(-Math.PI / 2)

function findTag(o: THREE.Object3D | null): { kind: string; employeeId: string } | null {
  while (o) { if (o.userData?.employeeId) return o.userData as { kind: string; employeeId: string }; o = o.parent }
  return null
}

/** Klik/hover/proximity terpadu untuk semua mode kamera. */
export function Interaction() {
  const { camera, gl } = useThree()
  const { world, rapier } = useRapier()
  const marker = useRef<THREE.Mesh>(null!)
  const nextProx = useRef(0)
  const nextAim = useRef(0)
  const pickRef = useRef<(x: number, y: number) => { kind: string; employeeId: string } | null>(() => null)

  useEffect(() => {
    const el = gl.domElement
    const pick = (pickRef.current = (cx: number, cy: number) => {
      ndc.set(cx, cy)
      raycaster.setFromCamera(ndc, camera)
      const targets = [...runtime.agentObjects.values(), ...runtime.monitorObjects.values()].filter((o) => o.visible)
      const hits = raycaster.intersectObjects(targets, true)
      if (!hits.length) return null
      const h = hits[0]
      const wall = world.castRay(new rapier.Ray(raycaster.ray.origin, raycaster.ray.direction), h.distance, true, undefined, undefined, undefined, undefined,
        (c) => !runtime.glassHandles.has(c.handle) && c.handle !== runtime.playerColliderHandle)
      if (wall && wall.timeOfImpact < h.distance - 0.3) return null
      return findTag(h.object)
    })
    const toNdc = (e: MouseEvent): [number, number] => {
      const r = el.getBoundingClientRect()
      return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1]
    }
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0 || isUiBlocking()) return
      const st = useOffice.getState()
      const mode = st.cameraMode
      const locked = document.pointerLockElement === el
      if (usesPointerLock(mode) && !locked) { el.requestPointerLock()?.catch?.(() => {}); return }
      const [x, y] = locked ? [0, 0] : toNdc(e)
      const tag = pick(x, y)
      if (tag) {
        if (document.pointerLockElement) document.exitPointerLock()
        if (tag.kind === 'monitor') st.set({ workstationId: tag.employeeId, selectedId: tag.employeeId })
        else st.set({ selectedId: tag.employeeId })
        return
      }
      if (mode === 'iso') {
        ndc.set(x, y); raycaster.setFromCamera(ndc, camera)
        const p = runtime.player
        const onMezz = p.y > 2
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), onMezz ? -MEZZ_Y : 0)
        const pt = raycaster.ray.intersectPlane(plane, new THREE.Vector3())
        if (!pt) return
        const path: [number, number][] = onMezz ? [[pt.x, pt.z]] : findPath([p.x, p.z], [pt.x, pt.z])
        runtime.moveTarget = { path, i: 0, dest: [pt.x, pt.z] }
      }
    }
    let last = 0
    const onMove = (e: MouseEvent) => {
      const st = useOffice.getState()
      if (document.pointerLockElement === el || st.cameraMode === 'fps' || runtime.rmbDown) return
      const now = performance.now()
      if (now - last < 70) return
      last = now
      const [x, y] = toNdc(e)
      const tag = pick(x, y)
      const id = tag?.employeeId ?? null
      el.style.cursor = tag ? 'pointer' : st.cameraMode === 'iso' ? 'crosshair' : 'default'
      if (st.hoveredId !== id) st.set({ hoveredId: id })
    }
    el.addEventListener('mousedown', onDown)
    el.addEventListener('mousemove', onMove)
    return () => { el.removeEventListener('mousedown', onDown); el.removeEventListener('mousemove', onMove) }
  }, [camera, gl, world, rapier])

  useFrame((state) => {
    const mt = runtime.moveTarget
    marker.current.visible = !!mt
    if (mt) {
      marker.current.position.set(mt.dest[0], (runtime.player.y > 2 ? MEZZ_Y : 0) + 0.03, mt.dest[1])
      marker.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 6) * 0.08)
    }
    const t = state.clock.elapsedTime
    // Saat mouse terkunci: target = apa yang ada di tengah crosshair.
    if (runtime.pointerLocked && t > nextAim.current) {
      nextAim.current = t + 0.1
      const id = pickRef.current(0, 0)?.employeeId ?? null
      const st = useOffice.getState()
      if (st.hoveredId !== id) st.set({ hoveredId: id })
    }
    if (t < nextProx.current) return
    nextProx.current = t + 0.15
    const p = runtime.player
    let best: string | null = null, bd = 2.6
    for (const [id, a] of runtime.agents) {
      if (!a.visible || Math.abs(a.y - p.y) > 1.5) continue
      const d = Math.hypot(a.x - p.x, a.z - p.z)
      if (d < bd) { bd = d; best = id }
    }
    const st = useOffice.getState()
    if (st.nearbyId !== best) st.set({ nearbyId: best })
  })

  return (
    <mesh ref={marker} geometry={markerGeo} visible={false}>
      <meshBasicMaterial color="#ff4655" transparent opacity={0.9} depthWrite={false} />
    </mesh>
  )
}
