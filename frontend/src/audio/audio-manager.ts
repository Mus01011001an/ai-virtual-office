import * as THREE from 'three';
import { proceduralAudio } from './procedural-audio';

class AudioManagerSingleton {
  private ctx: AudioContext | null = null;
  private listener: THREE.AudioListener | null = null;
  private masterGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private unlocked = false;

  public getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = 0.8;

      this.voiceGain = this.ctx.createGain();
      this.voiceGain.connect(this.masterGain);
      this.voiceGain.gain.value = 0.9;

      proceduralAudio.init(this.ctx, this.masterGain);
      this.setupAutoUnlock();
    }
    return this.ctx;
  }

  public getListener(): THREE.AudioListener {
    if (!this.listener) {
      this.listener = new THREE.AudioListener();
    }
    return this.listener;
  }

  public setMasterVolume(vol: number) {
    this.getContext();
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, vol));
    }
  }

  public setVoiceVolume(vol: number) {
    this.getContext();
    if (this.voiceGain) {
      this.voiceGain.gain.value = Math.max(0, Math.min(1, vol));
    }
  }

  public setMuted(muted: boolean) {
    this.getContext();
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : 0.8;
    }
    proceduralAudio.setEnabled(!muted);
  }

  private setupAutoUnlock() {
    if (this.unlocked) return;
    const unlock = () => {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().then(() => {
          this.unlocked = true;
          window.removeEventListener('pointerdown', unlock);
          window.removeEventListener('keydown', unlock);
        }).catch(() => {});
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  /**
   * Membuat Positional Audio Panner terisolasi untuk objek 3D
   */
  public createPannerNode(): PannerNode | null {
    const ctx = this.getContext();
    if (!ctx) return null;
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 2.0;
    panner.maxDistance = 35.0;
    panner.rolloffFactor = 1.2;
    panner.coneInnerAngle = 360;
    panner.connect(this.masterGain!);
    return panner;
  }
}

export const audioManager = new AudioManagerSingleton();
