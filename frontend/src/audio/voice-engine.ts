export interface VoicePersona {
  pitch?: number;
  rate?: number;
  gender?: 'male' | 'female' | 'neutral';
  preferredVoice?: string;
}

class VoiceEngineManager {
  private voices: SpeechSynthesisVoice[] = [];
  private queue: Array<{ text: string; persona: VoicePersona; onStart?: () => void; onEnd?: () => void }> = [];
  private isProcessing = false;
  private enabled = true;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.loadVoices();
      window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.stopAll();
  }

  private loadVoices() {
    try {
      this.voices = window.speechSynthesis.getVoices();
    } catch {}
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (this.voices.length === 0 && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.loadVoices();
    }
    return this.voices;
  }

  /**
   * Menyuarakankan pesan dengan profil vokal spesifik agen
   */
  public speak(
    text: string,
    persona: VoicePersona = { pitch: 1.0, rate: 1.0, gender: 'neutral' },
    callbacks?: { onStart?: () => void; onEnd?: () => void }
  ) {
    if (!this.enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      callbacks?.onStart?.();
      callbacks?.onEnd?.();
      return;
    }

    // Bersihkan teks dari markdown formatting (e.g. asterisks, code blocks)
    const cleanText = text
      .replace(/```[\s\S]*?```/g, 'kode program terlampir')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*_~#>]/g, '')
      .slice(0, 300); // Batasi panjang kalimat agar tidak terlalu lama bicara

    this.queue.push({
      text: cleanText,
      persona,
      onStart: callbacks?.onStart,
      onEnd: callbacks?.onEnd,
    });

    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  public stopAll() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
      this.queue = [];
      this.isProcessing = false;
    }
  }

  private processQueue() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const item = this.queue.shift()!;
    const utterance = new SpeechSynthesisUtterance(item.text);

    utterance.pitch = Math.max(0.5, Math.min(2.0, item.persona.pitch || 1.0));
    utterance.rate = Math.max(0.7, Math.min(1.5, item.persona.rate || 1.0));

    const matchingVoice = this.findVoice(item.persona);
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onstart = () => {
      item.onStart?.();
    };

    utterance.onend = () => {
      item.onEnd?.();
      setTimeout(() => this.processQueue(), 150);
    };

    utterance.onerror = () => {
      item.onEnd?.();
      setTimeout(() => this.processQueue(), 150);
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      item.onEnd?.();
      this.processQueue();
    }
  }

  private findVoice(persona: VoicePersona): SpeechSynthesisVoice | null {
    if (this.voices.length === 0) this.loadVoices();
    if (this.voices.length === 0) return null;

    if (persona.preferredVoice) {
      const exact = this.voices.find((v) => v.name.includes(persona.preferredVoice!));
      if (exact) return exact;
    }

    // Cari suara bahasa Indonesia jika ada
    const idVoice = this.voices.find((v) => v.lang.startsWith('id'));
    if (idVoice) return idVoice;

    // Cari suara bahasa Inggris
    const enVoice = this.voices.find((v) => v.lang.startsWith('en'));
    if (enVoice) return enVoice;

    return this.voices.find((v) => v.default) || this.voices[0] || null;
  }
}

export const voiceEngine = new VoiceEngineManager();
