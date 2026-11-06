import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { Humanoid } from './Humanoid'
import type { Appearance, RemoteUserData } from '../state/types'
import type { PoseName } from './poses'
import { spatialVoice } from '../audio/spatial-voice'
import { runtime } from '../state/runtime'

export function RemotePlayer({ data }: { data: RemoteUserData }) {
  const rootRef = useRef<THREE.Group>(null!)
  const poseRef = useRef<PoseName>('stand')

  // Target interpolasi posisi & rotasi
  const targetPos = useRef(new THREE.Vector3(data.x, data.y, data.z))
  const targetYaw = useRef(data.yaw)

  targetPos.current.set(data.x, data.y, data.z)
  targetYaw.current = data.yaw
  poseRef.current = data.anim === 'run' ? 'run' : data.anim === 'walk' ? 'walk' : 'stand'

  // Deterministic appearance berdasarkan userId
  const seed = useMemo(() => {
    let h = 0
    for (let i = 0; i < data.userId.length; i++) h = (h * 31 + data.userId.charCodeAt(i)) & 0xffffff
    return (h % 1000) / 100
  }, [data.userId])

  const appearance: Appearance = useMemo(
    () => ({
      skin: '#d4aa7d',
      hair: '#2c1e14',
      hairStyle: 1,
      top: data.role === 'OWNER' ? '#0284c7' : data.role === 'MANAGER' ? '#a855f7' : '#10b981',
      bottom: '#1e293b',
      shoes: '#0f172a',
      height: 1.0,
      glasses: false,
      jacket: true,
    }),
    [data.role],
  )

  useFrame((_, dt) => {
    if (!rootRef.current) return
    // Smooth lerping posisi dan rotasi
    rootRef.current.position.lerp(targetPos.current, Math.min(1, dt * 14))

    const curYaw = rootRef.current.rotation.y
    let diff = ((targetYaw.current - curYaw + Math.PI) % (Math.PI * 2)) - Math.PI
    if (diff < -Math.PI) diff += Math.PI * 2
    rootRef.current.rotation.y += diff * Math.min(1, dt * 10)

    // Perbarui 3D spatial audio untuk player ini
    spatialVoice.updateSpatialAudio(
      { x: runtime.player.x, z: runtime.player.z, yaw: runtime.player.yaw },
      [data],
    )
  })

  const roleColor =
    data.role === 'OWNER'
      ? 'bg-sky-500/80 text-white'
      : data.role === 'MANAGER'
      ? 'bg-purple-500/80 text-white'
      : 'bg-emerald-500/80 text-white'

  return (
    <group ref={rootRef} position={[data.x, data.y, data.z]} rotation-y={data.yaw}>
      <Humanoid appearance={appearance} poseRef={poseRef} seed={seed} />

      {/* 3D Roblox-Style Speech Halo Ring saat berbicara */}
      {data.isSpeaking && (
        <group position={[0, 2.05, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.26, 0.34, 24]} />
            <meshBasicMaterial color="#22c55e" side={THREE.DoubleSide} transparent opacity={0.85} />
          </mesh>
          <pointLight color="#22c55e" intensity={1.2} distance={2.5} />
        </group>
      )}

      {/* NameTag di atas kepala remote player */}
      <Html position={[0, 2.25, 0]} center distanceFactor={14}>
        <div className="flex flex-col items-center pointer-events-none select-none">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ink/90 backdrop-blur-md border border-white/15 shadow-xl text-white">
            <span
              className={`w-2 h-2 rounded-full ${
                data.role === 'OWNER' ? 'bg-sky-400' : 'bg-emerald-400'
              } animate-pulse`}
            />
            {data.isSpeaking && (
              <span className="text-[10px] text-emerald-400 animate-pulse font-bold">
                🎙️
              </span>
            )}
            <span className="text-[11px] font-bold tracking-tight">{data.name}</span>
            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${roleColor} uppercase tracking-wider`}>
              {data.role}
            </span>
          </div>
        </div>
      </Html>
    </group>
  )
}
