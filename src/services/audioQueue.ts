import { detectContentLanguage } from './languageDetector';
import { getBestVoiceForLanguage } from './voiceManager';

export type AudioQueueCallbacks = {
  onSentenceStart?: (text: string, index: number) => void;
  onSentenceEnd?: (index: number) => void;
  onQueueEmpty?: () => void;
  onAudioLevel?: (level: number) => void;
};

export type TTSAudioResponse = {
  audio_base64: string;
  mime_type: string;
  sample_rate: number;
};

function decodeBase64(base64Data: string): string {
  if (typeof atob === 'function') {
    return atob(base64Data);
  }
  const BufferClass = (globalThis as any).Buffer;
  if (BufferClass) {
    return BufferClass.from(base64Data, 'base64').toString('binary');
  }
  return '';
}

export function base64ToAudioBuffer(
  audioCtx: AudioContext,
  base64Data: string,
  mimeType: string,
  sampleRate: number = 24000
): Promise<AudioBuffer> {
  const binaryString = decodeBase64(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const lowerMime = (mimeType || '').toLowerCase();

  // Raw 16-bit PCM (e.g. audio/L16 or audio/pcm)
  if (lowerMime.includes('l16') || lowerMime.includes('pcm')) {
    const sampleCount = Math.floor(bytes.byteLength / 2);
    const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const audioBuffer = audioCtx.createBuffer(1, sampleCount, sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      channelData[i] = dataView.getInt16(i * 2, true) / 32768.0;
    }
    return Promise.resolve(audioBuffer);
  } else {
    // Other formats (e.g. WAV, MP3) decoded natively
    return audioCtx.decodeAudioData(bytes.buffer.slice(0));
  }
}

type QueueItem = {
  index: number;
  text: string;
  buffer?: AudioBuffer;
  ready: boolean;
};

export class AudioQueue {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private queue: Map<number, QueueItem> = new Map();
  private nextPlayIndex = 0;
  private isPlaying = false;
  private currentEpoch = 0;
  private callbacks: AudioQueueCallbacks = {};
  private animationFrameId: number | null = null;

  constructor(callbacks?: AudioQueueCallbacks) {
    if (callbacks) this.callbacks = callbacks;
  }

  public setCallbacks(callbacks: AudioQueueCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public getEpoch(): number {
    return this.currentEpoch;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getQueueSize(): number {
    return this.queue.size;
  }

  public getNextPlayIndex(): number {
    return this.nextPlayIndex;
  }

  public getAudioContext(): AudioContext | null {
    return this.audioCtx;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return null;

    if (!this.audioCtx) {
      this.audioCtx = new AudioCtxClass();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.connect(this.audioCtx.destination);
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    return this.audioCtx;
  }

  public resetSequence() {
    this.queue.clear();
    this.nextPlayIndex = 0;
  }

  public enqueue(
    index: number,
    text: string,
    audioPromise: Promise<TTSAudioResponse | AudioBuffer>
  ) {
    const epoch = this.currentEpoch;
    this.queue.set(index, { index, text, ready: false });

    audioPromise
      .then(async (result) => {
        // Discard if interrupted while loading
        if (epoch !== this.currentEpoch) {
          return;
        }

        let buffer: AudioBuffer;
        if ('audio_base64' in result) {
          const ctx = this.initContext();
          if (!ctx) return;
          buffer = await base64ToAudioBuffer(ctx, result.audio_base64, result.mime_type, result.sample_rate);
        } else {
          buffer = result;
        }

        if (epoch !== this.currentEpoch) {
          return;
        }

        const item = this.queue.get(index);
        if (item) {
          item.buffer = buffer;
          item.ready = true;
          this.processQueue();
        }
      })
      .catch((err) => {
        console.warn(`[AudioQueue] Failed to load audio for sentence ${index}:`, err);
        // Mark failed sentence ready without buffer so queue doesn't deadlock
        if (epoch === this.currentEpoch) {
          const item = this.queue.get(index);
          if (item) {
            item.ready = true;
            this.processQueue();
          }
        }
      });
  }

  private processQueue() {
    if (this.isPlaying) return;

    const currentItem = this.queue.get(this.nextPlayIndex);
    if (!currentItem || !currentItem.ready) {
      // Check if queue is completely drained
      if (this.queue.size === 0 && !this.isPlaying) {
        this.callbacks.onQueueEmpty?.();
      }
      return;
    }

    this.queue.delete(this.nextPlayIndex);
    const currentIndex = this.nextPlayIndex;

    // If buffer failed or empty, fallback to browser SpeechSynthesis with proper locale so speech is never dropped
    if (!currentItem.buffer) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && currentItem.text.trim()) {
        try {
          const lang = detectContentLanguage(currentItem.text);
          const utterance = new SpeechSynthesisUtterance(currentItem.text);
          const { voice, locale } = getBestVoiceForLanguage(lang);

          if (voice) {
            utterance.voice = voice;
          }
          utterance.lang = locale;
          utterance.rate = 1.0;
          this.isPlaying = true;
          this.callbacks.onSentenceStart?.(currentItem.text, currentIndex);

          utterance.onend = () => {
            this.isPlaying = false;
            this.callbacks.onSentenceEnd?.(currentIndex);
            this.nextPlayIndex++;
            this.processQueue();
          };
          utterance.onerror = () => {
            this.isPlaying = false;
            this.callbacks.onSentenceEnd?.(currentIndex);
            this.nextPlayIndex++;
            this.processQueue();
          };
          window.speechSynthesis.speak(utterance);
          return;
        } catch (_) {}
      }

      this.nextPlayIndex++;
      this.callbacks.onSentenceStart?.(currentItem.text, currentIndex);
      this.callbacks.onSentenceEnd?.(currentIndex);
      this.processQueue();
      return;
    }

    const ctx = this.initContext();
    if (!ctx) {
      this.nextPlayIndex++;
      this.processQueue();
      return;
    }

    try {
      const source = ctx.createBufferSource();
      source.buffer = currentItem.buffer;
      // Slightly increase playback rate for a more energetic and natural teacher pace
      source.playbackRate.value = 1.12;
      
      if (this.analyser) {
        source.connect(this.analyser);
      } else {
        source.connect(ctx.destination);
      }

      this.currentSource = source;
      this.isPlaying = true;

      this.callbacks.onSentenceStart?.(currentItem.text, currentIndex);
      this.startAnalyserLoop();

      source.onended = () => {
        if (this.currentSource === source) {
          this.currentSource = null;
          this.isPlaying = false;
          this.stopAnalyserLoop();
          this.callbacks.onSentenceEnd?.(currentIndex);
          this.nextPlayIndex++;
          this.processQueue();
        }
      };

      source.start(0);
    } catch (err) {
      console.error('[AudioQueue] Playback error:', err);
      this.isPlaying = false;
      this.nextPlayIndex++;
      this.processQueue();
    }
  }

  private startAnalyserLoop() {
    if (!this.analyser || typeof window === 'undefined' || !window.requestAnimationFrame) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const update = () => {
      if (!this.isPlaying || !this.analyser) return;
      this.analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / (dataArray.length * 255.0);
      this.callbacks.onAudioLevel?.(avg);

      this.animationFrameId = window.requestAnimationFrame(update);
    };

    this.animationFrameId = window.requestAnimationFrame(update);
  }

  private stopAnalyserLoop() {
    if (this.animationFrameId !== null && typeof window !== 'undefined' && window.cancelAnimationFrame) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.callbacks.onAudioLevel?.(0);
  }

  public interrupt() {
    this.currentEpoch++;
    this.queue.clear();
    this.nextPlayIndex = 0;

    if (this.currentSource) {
      try {
        this.currentSource.onended = null;
        this.currentSource.stop();
      } catch (e) {}
      this.currentSource = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }

    this.isPlaying = false;
    this.stopAnalyserLoop();
    this.callbacks.onQueueEmpty?.();
  }
}

export const globalAudioQueue = new AudioQueue();
