import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { PerformanceMonitor } from '@react-three/drei'
import { useShallow } from 'zustand/react/shallow'
import * as THREE from 'three'
import { useOffice } from './state/store'
import { QUALITY } from './lib/quality'
import { Building, Colliders } from './office/Building'
import { Lighting } from './office/Lighting'
import { Effects } from './office/Effects'
import { TimeTicker } from './office/TimeTicker'
import { Clocks, DeskScreens, ServerLeds, Signs, StatusBoard, VideoWall } from './office/Props'
import { Whiteboard } from './office/Whiteboard'
import { Interaction } from './office/Interaction'
import { GatherController } from './office/Gather'
import { ScheduleController } from './office/ScheduleController'
import { SpatialAudioController } from './office/SpatialAudioController'
import { Player } from './characters/Player'
import { Agent } from './characters/Agent'
import { RemotePlayer } from './characters/RemotePlayer'
import { CameraRig } from './camera/CameraRig'

function Agents() {
  const ids = useOffice(useShallow((s) => s.employees.map((e) => e.id)))
  return <>{ids.map((id) => <Agent key={id} id={id} />)}</>
}

function RemotePlayers() {
  const remoteUsers = useOffice((s) => s.remoteUsers)
  return <>{remoteUsers.map((u) => <RemotePlayer key={u.userId} data={u} />)}</>
}

export function Scene({ officeKey }: { officeKey: string }) {
  const quality = useOffice((s) => s.quality)
  const q = QUALITY[quality]
  // Resolusi adaptif: turun otomatis saat fps drop, naik lagi saat lega.
  const [factor, setFactor] = useState(1)
  const dpr = Math.min(window.devicePixelRatio, q.dpr[0] + (q.dpr[1] - q.dpr[0]) * factor)
  return (
    <Canvas
      key={officeKey + quality}
      shadows={q.shadows ? 'percentage' : false}
      dpr={dpr}
      camera={{ fov: 62, near: 0.1, far: 700, position: [0, 4, 34] }}
      gl={{ antialias: !q.post, powerPreference: 'high-performance', stencil: false, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.05 }}
    >
      <PerformanceMonitor bounds={() => [48, 58]} flipflops={4} onChange={({ factor: f }) => setFactor(Math.round(f * 10) / 10)} />
      <Suspense fallback={null}>
        <Physics gravity={[0, -9.81, 0]} timeStep={1 / 60}>
          <TimeTicker />
          <Lighting />
          <Building />
          <Colliders />
          <Player />
          <RemotePlayers />
          <Agents />
          <DeskScreens />
          <Clocks />
          <Signs />
          <StatusBoard />
          <VideoWall />
          <Whiteboard />
          <ServerLeds />
          <Interaction />
          <GatherController />
          <ScheduleController />
          <SpatialAudioController />
          <CameraRig />
        </Physics>
        {q.post && <Effects quality={quality} />}
      </Suspense>
    </Canvas>
  )
}
