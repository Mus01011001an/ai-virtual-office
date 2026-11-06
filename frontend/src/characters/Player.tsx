import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, useRapier, type RapierCollider, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { isUiBlocking, useOffice } from '../state/store'
import { runtime } from '../state/runtime'
import { keys, isTyping } from '../camera/input'
import { CEO_APPEARANCE } from '../lib/appearance'
import { SPAWN } from '../office/layout'
import { Humanoid } from './Humanoid'
import { NameTag } from './NameTag'
import type { PoseName } from './poses'

const angDamp = (a: number, b: number, k: number, dt: number) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * (1 - Math.exp(-k * dt))
}

export function Player() {
  const body = useRef<RapierRigidBody>(null!)
  const col = useRef<RapierCollider>(null!)
  const visual = useRef<THREE.Group>(null!)
  const poseRef = useRef<PoseName>('stand')
  const vy = useRef(0)
  const { world } = useRapier()
  const mode = useOffice((s) => s.cameraMode)
  const showNames = useOffice((s) => s.showNames)
  const bubble = useOffice((s) => s.bubbles.me)

  const ctrlRef = useRef<ReturnType<typeof world.createCharacterController> | null>(null)
  useEffect(() => {
    const c = world.createCharacterController(0.02)
    c.enableAutostep(0.38, 0.15, true)
    c.enableSnapToGround(0.4)
    c.setMaxSlopeClimbAngle((48 * Math.PI) / 180)
    c.setMinSlopeSlideAngle((60 * Math.PI) / 180)
    c.setSlideEnabled(true)
    ctrlRef.current = c
    return () => { ctrlRef.current = null; world.removeCharacterController(c) }
  }, [world])
  useEffect(() => {
    const t = setTimeout(() => { if (col.current) runtime.playerColliderHandle = col.current.handle }, 0)
    return () => clearTimeout(t)
  }, [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const ctrl = ctrlRef.current
    if (!col.current || !body.current || !ctrl) return
    const p = runtime.player, cam = runtime.cam
    const m = useOffice.getState().cameraMode
    let ix = 0, iz = 0
    const can = !isUiBlocking() && !isTyping()
    if (can) {
      if (keys.has('KeyW') || keys.has('ArrowUp')) iz += 1
      if (keys.has('KeyS') || keys.has('ArrowDown')) iz -= 1
      if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1
      if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1

      // Injeksi Virtual Analog Joystick (Mobile Touch)
      if (runtime.virtualJoystick.x !== 0 || runtime.virtualJoystick.y !== 0) {
        ix += runtime.virtualJoystick.x
        iz += runtime.virtualJoystick.y
      }
    }

    // 1. Logika duduk pemain manusia di kursi
    if (p.sitting && p.seatedInfo) {
      // Jika menekan tombol gerak atau lompat saat duduk, berdiri otomatis
      if (can && (ix !== 0 || iz !== 0 || keys.has('Space'))) {
        p.sitting = false
        p.seatedInfo = null
      } else {
        // Tetap duduk di kursi
        p.x = p.seatedInfo.x
        p.y = p.seatedInfo.y
        p.z = p.seatedInfo.z
        p.moving = false
        p.running = false
        p.grounded = true
        vy.current = 0

        if (m === 'fps') {
          p.yaw = cam.yaw
        } else {
          p.yaw = angDamp(p.yaw, p.seatedInfo.yaw, 10, dt)
        }

        body.current.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z })
        poseRef.current = 'sitIdle'
        visual.current.position.set(p.x, p.y, p.z)
        visual.current.rotation.y = p.yaw
        return
      }
    }

    const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw)
    const rx = -Math.cos(cam.yaw), rz = Math.sin(cam.yaw)
    let mx = fx * iz + rx * ix, mz = fz * iz + rz * ix
    if (ix || iz) runtime.moveTarget = null
    else if (runtime.moveTarget) {
      const mt = runtime.moveTarget
      const wp = mt.path[mt.i]
      const dx = wp[0] - p.x, dz = wp[1] - p.z
      if (Math.hypot(dx, dz) < 0.25) { mt.i++; if (mt.i >= mt.path.length) runtime.moveTarget = null }
      else { mx = dx; mz = dz }
    }
    const len = Math.hypot(mx, mz)
    const moving = len > 0.001
    if (moving) { mx /= len; mz /= len }

    // Auto-sprint jika joystick didorong penuh (> 85%) atau tombol Shift ditekan
    const joyMagnitude = Math.hypot(runtime.virtualJoystick.x, runtime.virtualJoystick.y)
    const running = can && (keys.has('ShiftLeft') || keys.has('ShiftRight') || joyMagnitude > 0.85)
    const speed = running ? 6.2 : 3.4

    vy.current -= 22 * dt
    if (can && p.grounded && keys.has('Space')) vy.current = 7
    ctrl.computeColliderMovement(col.current, { x: mx * speed * dt, y: vy.current * dt, z: mz * speed * dt })
    const mv = ctrl.computedMovement()
    p.x += mv.x; p.y += mv.y; p.z += mv.z
    p.grounded = ctrl.computedGrounded()
    if (p.grounded && vy.current < 0) vy.current = 0
    if (p.y < -15) { p.x = SPAWN[0]; p.y = 1; p.z = SPAWN[1]; vy.current = 0 }
    body.current.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z })

    p.moving = moving; p.running = running
    if (m === 'fps') {
      p.yaw = cam.yaw
    } else if (moving) {
      // KARAKTER BERJALAN: Selalu hadapkan badan dan muka ke arah vektor gerak nyata!
      // Saat W: targetYaw = cam.yaw
      // Saat W+D: targetYaw = cam.yaw - 45 deg
      // Saat S: targetYaw = cam.yaw + 180 deg (menghadap ke arah pemain/kamera!)
      p.yaw = angDamp(p.yaw, Math.atan2(mx, mz), 14, dt)
    }
    // Saat diam di TPS/ISO: pertahankan p.yaw terakhir, jangan dipaksa ke cam.yaw!

    poseRef.current = p.sitting ? 'sitIdle' : moving ? (running ? 'run' : 'walk') : 'stand'
    visual.current.position.set(p.x, p.y, p.z)
    visual.current.rotation.y = p.yaw
  })

  return (
    <>
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[runtime.player.x, runtime.player.y, runtime.player.z]} enabledRotations={[false, false, false]}>
        <CapsuleCollider ref={col} args={[0.55, 0.3]} position={[0, 0.86, 0]} />
      </RigidBody>
      <group ref={visual} visible={mode !== 'fps'}>
        <Humanoid appearance={CEO_APPEARANCE} poseRef={poseRef} seed={1} />
        {(showNames || !!bubble) && mode !== 'fps' && <NameTag y={2.08} name="Kamu" role="CEO · Owner" badge="CEO" bubble={bubble} />}
      </group>
    </>
  )
}
