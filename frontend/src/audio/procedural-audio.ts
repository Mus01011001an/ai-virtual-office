/**
 * Procedural Audio Synthesizer Engine
 * Menghasilkan efek suara fisik kantor virtual secara algoritmik menggunakan Web Audio API.
 * Nol ketergantungan file eksternal (0 KB download), zero-latency, dan 100% reliable.
 */

export class ProceduralAudioEngine {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private enabled = true;

  public init(ctx: AudioContext, masterGain: GainNode) {
    this.ctx = ctx;
    this.sfxGain = ctx.createGain();
    this.sfxGain.connect(masterGain);
    this.sfxGain.gain.value = 0.6;
  }

  public setSfxVolume(vol: number) {
    if (this.sfxGain) {
      this.sfxGain.gain.value = Math.max(0, Math.min(1, vol));
    }
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  /**
   * Mensintesis suara ketikan tombol keyboard mekanik (Cherry MX style)
   * Menggunakan noise burst berdurasi 10ms yang dilewatkan melalui bandpass filter.
   */
  public playKeyboardClick(panner?: PannerNode | null) {
    if (!this.enabled || !this.ctx || !this.sfxGain) return;
    try {
      const now = this.ctx.currentTime;
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.012);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2200 + (Math.random() * 600 - 300);
      filter.Q.value = 4.0;

      const gain = this.ctx.createGain();
      const clickVol = 0.12 + Math.random() * 0.06;
      gain.gain.setValueAtTime(clickVol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);

      noise.connect(filter);
      filter.connect(gain);

      if (panner) {
        gain.connect(panner);
      } else {
        gain.connect(this.sfxGain);
      }

      noise.start(now);
      noise.stop(now + 0.015);
    } catch {}
  }

  /**
   * Mensintesis suara langkah kaki (footstep thud)
   */
  public playFootstep(panner?: PannerNode | null) {
    if (!this.enabled || !this.ctx || !this.sfxGain) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(110 + Math.random() * 20, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.05);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);

      if (panner) {
        gain.connect(panner);
      } else {
        gain.connect(this.sfxGain);
      }

      osc.start(now);
      osc.stop(now + 0.065);
    } catch {}
  }

  /**
   * Mensintesis lonceng notifikasi / approval alert (nada akustik dua frekuensi)
   */
  public playChime(type: 'meeting' | 'approval' | 'done') {
    if (!this.enabled || !this.ctx || !this.sfxGain) return;
    try {
      const now = this.ctx.currentTime;
      const freqs =
        type === 'meeting'
          ? [523.25, 659.25] // C5 & E5
          : type === 'approval'
          ? [880.0, 1174.66] // A5 & D6
          : [587.33, 880.0];  // D5 & A5

      freqs.forEach((freq, idx) => {
        if (!this.ctx || !this.sfxGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0.22, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 1.2);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 1.25);
      });
    } catch {}
  }
}

export const proceduralAudio = new ProceduralAudioEngine();
