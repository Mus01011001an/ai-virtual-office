import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useOffice } from '../state/store'
import { audioManager } from '../audio/audio-manager'
import { proceduralAudio } from '../audio/procedural-audio'
import { runtime } from '../state/runtime'
import { DESKS } from './layout'

export function SpatialAudioController() {
  const { camera } = useThree()
  const employees = useOffice((s) => s.employees)
  const listenerRef = useRef<THREE.AudioListener | null>(null)
  const lastStepTime = useRef(0)
  const typingTimer = useRef(0)

  useEffect(() => {
    const listener = audioManager.getListener()
    camera.add(listener)
    listenerRef.current = listener

    return () => {
      camera.remove(listener)
    }
  }, [camera])

  useFrame((_, delta) => {
    // 1. Footstep sound saat CEO/Player berjalan
    const isMoving = runtime.player.moving && runtime.player.grounded
    const interval = runtime.player.running ? 310 : 440
    const now = performance.now()
    if (isMoving && now - lastStepTime.current > interval) {
      lastStepTime.current = now
      proceduralAudio.playFootstep()
    }

    // 2. Typing clicks generator saat ada agen aktif (WORKING / TOOL_EXECUTING)
    typingTimer.current += delta
    if (typingTimer.current > 0.12) {
      typingTimer.current = 0
      const activeAgents = employees.filter(
        (e) => e.status === 'WORKING' || e.status === 'TOOL_EXECUTING'
      )
      if (activeAgents.length > 0) {
        // Cek apakah kamera berada dekat dengan salah satu agen aktif
        for (const agent of activeAgents) {
          const desk = DESKS[agent.deskIndex % DESKS.length]
          if (desk) {
            const dx = camera.position.x - desk.seat[0]
            const dz = camera.position.z - desk.seat[1]
            const dist = Math.sqrt(dx * dx + dz * dz)
            if (dist < 10.0) {
              if (Math.random() > 0.4) {
                proceduralAudio.playKeyboardClick()
              }
              break; // Cukup trigger satu per siklus tick
            }
          }
        }
      }
    }
  })

  return null
}
