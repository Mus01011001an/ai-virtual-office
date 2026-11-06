import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useMemo } from 'react'
import * as THREE from 'three'

function FloatingCyberPlatform() {
  const ringRef = useRef<THREE.Group>(null)
  const agentRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (ringRef.current) {
      ringRef.current.rotation.y = t * 0.35
      ringRef.current.rotation.x = Math.sin(t * 0.2) * 0.1
    }
    if (agentRef.current) {
      agentRef.current.position.y = 1.2 + Math.sin(t * 1.8) * 0.15
      agentRef.current.rotation.y = t * 0.5
    }
  })

  // Partikel cyber dust
  const particleCount = 120
  const particles = useMemo(() => {
    const pos = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 18
      pos[i * 3 + 1] = Math.random() * 8
      pos[i * 3 + 2] = (Math.random() - 0.5) * 18
    }
    return pos
  }, [])

  return (
    <group position={[0, -0.5, 0]}>
      {/* Floating Island Base */}
      <mesh position={[0, -0.3, 0]} receiveShadow>
        <boxGeometry args={[10, 0.6, 10]} />
        <meshStandardMaterial color="#0c0e17" roughness={0.6} metalness={0.4} />
      </mesh>

      {/* Cyber Grid Lines on Platform */}
      <gridHelper args={[10, 10, '#00f5d4', '#1f2438']} position={[0, 0.02, 0]} />

      {/* Neon Edge Frame */}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[10.1, 0.05, 10.1]} />
        <meshBasicMaterial color="#00f5d4" wireframe />
      </mesh>

      {/* Mini Office Voxel Buildings / Servers */}
      <group position={[-2.8, 0, -2.8]}>
        <mesh position={[0, 1.2, 0]}>
          <boxGeometry args={[1.2, 2.4, 1.2]} />
          <meshStandardMaterial color="#1a1e2e" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.2, 0.62]}>
          <planeGeometry args={[0.9, 2.0]} />
          <meshBasicMaterial color="#00f5d4" opacity={0.3} transparent />
        </mesh>
      </group>

      <group position={[2.8, 0, -2.8]}>
        <mesh position={[0, 0.9, 0]}>
          <boxGeometry args={[1.2, 1.8, 1.2]} />
          <meshStandardMaterial color="#1a1e2e" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.9, 0.62]}>
          <planeGeometry args={[0.9, 1.4]} />
          <meshBasicMaterial color="#ff007f" opacity={0.3} transparent />
        </mesh>
      </group>

      {/* Mini Workstations */}
      {[-1.5, 1.5].map((x, i) => (
        <group key={i} position={[x, 0, 1.5]}>
          {/* Desk */}
          <mesh position={[0, 0.45, 0]}>
            <boxGeometry args={[1.6, 0.1, 0.8]} />
            <meshStandardMaterial color="#252a3d" />
          </mesh>
          {/* Holographic Monitor */}
          <mesh position={[0, 0.85, -0.15]}>
            <boxGeometry args={[0.8, 0.5, 0.05]} />
            <meshStandardMaterial color="#00f5d4" emissive="#00f5d4" emissiveIntensity={0.6} />
          </mesh>
        </group>
      ))}

      {/* Central Holographic Agent */}
      <group ref={agentRef} position={[0, 1.2, -0.5]}>
        {/* Core */}
        <mesh>
          <octahedronGeometry args={[0.45, 0]} />
          <meshStandardMaterial
            color="#ffd166"
            emissive="#f4a259"
            emissiveIntensity={0.8}
            wireframe
          />
        </mesh>
        {/* Glowing Head */}
        <mesh position={[0, 0.55, 0]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color="#00f5d4" emissive="#00f5d4" emissiveIntensity={1} />
        </mesh>
      </group>

      {/* Spinning Cyber Ring */}
      <group ref={ringRef} position={[0, 0.8, -0.5]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.5, 0.03, 16, 64]} />
          <meshBasicMaterial color="#00f5d4" wireframe />
        </mesh>
        <mesh rotation={[Math.PI / 3, Math.PI / 4, 0]}>
          <torusGeometry args={[2.8, 0.02, 16, 64]} />
          <meshBasicMaterial color="#ff007f" wireframe />
        </mesh>
      </group>

      {/* Floating Cyber Dust Particles */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[particles, 3]}
          />
        </bufferGeometry>
        <pointsMaterial size={0.06} color="#00f5d4" transparent opacity={0.6} sizeAttenuation />
      </points>
    </group>
  )
}

function OrbitingCameraRig() {
  useFrame((state) => {
    const t = state.clock.getElapsedTime() * 0.12
    const radius = 11.5
    state.camera.position.x = Math.sin(t) * radius + 1
    state.camera.position.z = Math.cos(t) * radius + 1
    state.camera.position.y = 6.5 + Math.sin(t * 0.5) * 0.8
    state.camera.lookAt(0, 1.0, 0)
  })
  return null
}

export function GameTitleScene() {
  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      <Canvas
        camera={{ position: [9, 7, 9], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={['#07080d']} />
        <fog attach="fog" args={['#07080d', 10, 26]} />

        {/* Ambient & Directional Cyber Lights */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 15, 8]} intensity={1.4} color="#ffffff" />
        <pointLight position={[-6, 4, -6]} intensity={2.0} color="#00f5d4" distance={15} />
        <pointLight position={[6, 4, 6]} intensity={2.5} color="#ff007f" distance={15} />
        <pointLight position={[0, 3, 0]} intensity={1.8} color="#ffd166" distance={10} />

        <FloatingCyberPlatform />
        <OrbitingCameraRig />
      </Canvas>
    </div>
  )
}

