import { post } from '../lib/api'
import { RemoteUserData } from '../state/types'

interface PeerConnectionBundle {
  pc: RTCPeerConnection
  stream?: MediaStream
  gainNode?: GainNode
  pannerNode?: StereoPannerNode
  sourceNode?: MediaStreamAudioSourceNode
}

class SpatialVoiceManager {
  private audioCtx: AudioContext | null = null
  private localStream: MediaStream | null = null
  private analyser: AnalyserNode | null = null
  private dataArray: Uint8Array<ArrayBuffer> | null = null
  private peers = new Map<string, PeerConnectionBundle>()

  public isMuted = false
  public isMicActive = false
  public voiceRadius = 10.0 // Default 10 meter (configurable 3m - 30m)

  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  }

  private initAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      this.audioCtx = new AudioCtx()
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {})
    }
  }

  /** Mulai streaming mikrofon lokal */
  async startMicrophone(): Promise<boolean> {
    try {
      this.initAudioContext()
      if (this.localStream) return true

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      this.localStream = stream
      this.isMicActive = true
      this.isMuted = false

      // Analyser untuk VAD (Voice Activity Detection)
      if (this.audioCtx) {
        const source = this.audioCtx.createMediaStreamSource(stream)
        this.analyser = this.audioCtx.createAnalyser()
        this.analyser.fftSize = 256
        source.connect(this.analyser)
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount)
      }

      return true
    } catch (err) {
      console.warn('Gagal mengakses mikrofon:', err)
      this.isMicActive = false
      return false
    }
  }

  /** Stop mikrofon */
  stopMicrophone() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop())
      this.localStream = null
    }
    this.isMicActive = false
    this.analyser = null
  }

  /** Toggle mute */
  toggleMute(): boolean {
    this.isMuted = !this.isMuted
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted
      })
    }
    return this.isMuted
  }

  /** Cek apakah user lokal sedang aktif berbicara */
  isSpeakingLocal(): boolean {
    if (!this.isMicActive || this.isMuted || !this.analyser || !this.dataArray) {
      return false
    }
    this.analyser.getByteFrequencyData(this.dataArray)
    let sum = 0
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i]
    }
    const avg = sum / this.dataArray.length
    return avg > 18 // Threshold volume suara aktif
  }

  /** Set radius suara proximity */
  setVoiceRadius(meters: number) {
    this.voiceRadius = Math.max(3, Math.min(30, meters))
  }

  /** Kirim sinyal WebRTC (SDP / ICE) ke backend via REST relay */
  private async sendVoiceSignal(toUserId: string | undefined, signal: any) {
    try {
      await post('/office/presence/voice-signal', { toUserId, signal })
    } catch (err) {
      console.warn('Voice signal error:', err)
    }
  }

  /** Handler sinyal masuk dari SSE */
  async handleIncomingSignal(fromUserId: string, signal: any) {
    this.initAudioContext()

    if (signal.type === 'offer') {
      const pc = this.getOrCreatePeer(fromUserId)
      await pc.setRemoteDescription(new RTCSessionDescription(signal))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await this.sendVoiceSignal(fromUserId, answer)
    } else if (signal.type === 'answer') {
      const bundle = this.peers.get(fromUserId)
      if (bundle) {
        await bundle.pc.setRemoteDescription(new RTCSessionDescription(signal))
      }
    } else if (signal.candidate) {
      const bundle = this.peers.get(fromUserId)
      if (bundle) {
        try {
          await bundle.pc.addIceCandidate(new RTCIceCandidate(signal.candidate))
        } catch (e) {
          console.warn('Ice candidate error:', e)
        }
      }
    }
  }

  /** Buat atau ambil RTCPeerConnection untuk peer tertentu */
  private getOrCreatePeer(remoteUserId: string): RTCPeerConnection {
    const existing = this.peers.get(remoteUserId)
    if (existing) return existing.pc

    const pc = new RTCPeerConnection(this.rtcConfig)
    const bundle: PeerConnectionBundle = { pc }
    this.peers.set(remoteUserId, bundle)

    // Tambahkan audio track lokal jika mic aktif
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!)
      })
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendVoiceSignal(remoteUserId, { candidate: event.candidate })
      }
    }

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0]
      bundle.stream = remoteStream

      if (this.audioCtx) {
        // Buat Web Audio Spatial Audio Pipeline: Source -> StereoPanner -> Gain -> Destination
        const source = this.audioCtx.createMediaStreamSource(remoteStream)
        const panner = this.audioCtx.createStereoPanner()
        const gain = this.audioCtx.createGain()
        gain.gain.setValueAtTime(0, this.audioCtx.currentTime)

        source.connect(panner)
        panner.connect(gain)
        gain.connect(this.audioCtx.destination)

        bundle.sourceNode = source
        bundle.pannerNode = panner
        bundle.gainNode = gain
      }
    }

    return pc
  }

  /** Inisiasi koneksi ke peer baru */
  async connectToPeer(remoteUserId: string) {
    const pc = this.getOrCreatePeer(remoteUserId)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await this.sendVoiceSignal(remoteUserId, offer)
  }

  /**
   * Perbarui 3D Spatial Attenuation suara setiap frame / tick
   * Sesuai jarak Euclidean: gain = max(0, 1 - d / voiceRadius)
   */
  updateSpatialAudio(
    myPos: { x: number; z: number; yaw: number },
    remotes: RemoteUserData[],
  ) {
    if (!this.audioCtx) return

    for (const remote of remotes) {
      const bundle = this.peers.get(remote.userId)
      if (!bundle || !bundle.gainNode) continue

      const dx = remote.x - myPos.x
      const dz = remote.z - myPos.z
      const dist = Math.hypot(dx, dz)

      let targetGain = 0
      if (dist <= this.voiceRadius) {
        // Linear falloff volume suara mendekati tepi radius
        targetGain = Math.max(0, 1 - dist / this.voiceRadius)
      }

      bundle.gainNode.gain.setValueAtTime(targetGain, this.audioCtx.currentTime)

      // Pan kiri / kanan berdasarkan sudut relatif pandangan kamera
      if (bundle.pannerNode && dist > 0.1) {
        const angle = Math.atan2(dz, dx) - myPos.yaw
        const panValue = Math.max(-1, Math.min(1, Math.sin(angle)))
        bundle.pannerNode.pan.setValueAtTime(panValue, this.audioCtx.currentTime)
      }
    }
  }

  /** Bersihkan peer yang sudah offline */
  cleanupPeers(activeUserIds: string[]) {
    const activeSet = new Set(activeUserIds)
    for (const [userId, bundle] of this.peers.entries()) {
      if (!activeSet.has(userId)) {
        bundle.pc.close()
        this.peers.delete(userId)
      }
    }
  }
}

export const spatialVoice = new SpatialVoiceManager()

