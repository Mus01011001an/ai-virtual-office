export interface SpeechRecognitionCallbacks {
  onInterimResult?: (transcript: string) => void;
  onFinalResult?: (transcript: string) => void;
  onError?: (error: string) => void;
  onStateChange?: (isListening: boolean) => void;
}

export class SpeechRecognitionEngine {
  private recognition: any = null;
  private isListening = false;
  private callbacks: SpeechRecognitionCallbacks = {};
  private finalTranscript = '';

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        try {
          this.recognition = new SpeechRecognitionClass();
          this.recognition.continuous = true;
          this.recognition.interimResults = true;
          this.recognition.lang = 'id-ID';
          this.setupListeners();
        } catch {}
      }
    }
  }

  public isSupported(): boolean {
    return !!this.recognition;
  }

  public setCallbacks(cb: SpeechRecognitionCallbacks) {
    this.callbacks = cb;
  }

  private setupListeners() {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.callbacks.onStateChange?.(true);
    };

    this.recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          this.finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (interim) {
        this.callbacks.onInterimResult?.(interim);
      }
      if (this.finalTranscript) {
        this.callbacks.onFinalResult?.(this.finalTranscript.trim());
      }
    };

    this.recognition.onerror = (event: any) => {
      this.callbacks.onError?.(event.error || 'Speech recognition error');
      this.stop();
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.callbacks.onStateChange?.(false);
    };
  }

  public start() {
    if (!this.recognition || this.isListening) return;
    this.finalTranscript = '';
    try {
      this.recognition.start();
    } catch (e: any) {
      this.callbacks.onError?.(e.message);
    }
  }

  public stop() {
    if (!this.recognition || !this.isListening) return;
    try {
      this.recognition.stop();
    } catch {}
    this.isListening = false;
  }
}

export const speechRecognizer = new SpeechRecognitionEngine();
