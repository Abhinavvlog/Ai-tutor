import { normalizeTranscript } from './transcriptNormalizer';

export type SpeechRecognitionCallbacks = {
  onSpeechStart?: () => void;
  onInterimTranscript?: (normalized: string, raw: string) => void;
  onFinalTranscript?: (normalized: string, raw: string) => void;
  onError?: (errorMsg: string) => void;
  onListeningChange?: (isListening: boolean) => void;
};

type SpeechRecognitionType = any;

export function isLikelyTeacherEcho(
  studentTranscript: string,
  teacherSpokenText: string,
  isTeacherSpeaking: boolean = true
): boolean {
  if (!isTeacherSpeaking || !teacherSpokenText || !studentTranscript) return false;

  const cleanStudent = studentTranscript.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanTeacher = teacherSpokenText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  if (!cleanStudent || !cleanTeacher) return false;

  const studentWords = cleanStudent.split(' ').filter(w => w.length > 1);

  // Require a clear question or interruption cue while tutor audio is active.
  const interruptionWords = [
    'wait', 'why', 'what', 'how', 'stop', 'pause', 'ruko', 'suno', 'minute', 'second', 'hold', 'listen',
    'excuse', 'sorry', 'doubt', 'kya', 'kyun', 'kyu', 'kaise', 'kab', 'kahan', 'samjhao', 'batao', 'mujhe', 'lekin',
    'please', 'question', 'nahi', 'no', 'not', 'repeat', 'clear', 'again', 'matlab', 'meaning',
    'explain', 'understand', 'samajh', 'difference', 'example', 'udharan', 'help',
    'yes', 'yeah', 'yep', 'haan', 'han', 'ha', 'bilkul', 'okay', 'ok', 'sure'
  ];
  
  if (studentWords.length === 0) return true; // Single letter blips during teacher speech are echo/noise

  const teacherWordsSet = new Set(cleanTeacher.split(' ').filter(w => w.length > 1));
  let matchingWordsCount = 0;
  for (const word of studentWords) {
    if (teacherWordsSet.has(word)) {
      matchingWordsCount++;
    }
  }

  const overlapRatio = matchingWordsCount / studentWords.length;

  if (/[?؟]\s*$/.test(studentTranscript) && overlapRatio < 0.35) {
    return false;
  }
  
  let hasUniqueInterruptionWord = false;
  for (const word of studentWords) {
    if (interruptionWords.includes(word) && !teacherWordsSet.has(word)) {
      hasUniqueInterruptionWord = true;
      break;
    }
  }

  // A clear interruption cue is stronger evidence than transcript overlap.
  if (hasUniqueInterruptionWord) {
    return false;
  }

  // If the transcript is heavily overlapping with the teacher's text, it's almost certainly echo.
  if (overlapRatio >= 0.35) {
    return true;
  }

  // Unmatched partial transcripts are often the speaker audio misrecognized by Web Speech.
  // Do not stop the tutor without a clear question/doubt/stop cue.
  return true;
}

export function stripTeacherEcho(
  studentTranscript: string,
  teacherSpokenText: string
): string {
  if (!teacherSpokenText || !studentTranscript) return studentTranscript;

  const cleanTeacher = teacherSpokenText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleanTeacher) return studentTranscript;

  const teacherWordsSet = new Set(cleanTeacher.split(' ').filter(w => w.length > 1));
  const studentWords = studentTranscript.split(/\s+/);
  
  // Reconstruct the student transcript keeping only words the teacher DID NOT say, 
  // or keeping short words (like "a", "I") that might have been filtered out of the set.
  // We keep punctuation intact by splitting on whitespace but checking the word core.
  const strippedWords = studentWords.filter(word => {
    const cleanWord = word.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanWord.length <= 1) return true; 
    return !teacherWordsSet.has(cleanWord);
  });

  return strippedWords.join(' ').trim() || studentTranscript;
}

export class BrowserSpeechService {
  private recognition: SpeechRecognitionType | null = null;
  private aecStream: MediaStream | null = null;
  private isListening = false;
  private continuousMode = true;
  private silenceTimer: any = null;
  private finalTranscript = '';
  private interimTranscript = '';
  private speechDetected = false;
  private language: string = 'en-IN';
  private callbacks: SpeechRecognitionCallbacks = {};
  private isSubmitting = false;
  private getTeacherSpokenText: (() => string) | null = null;
  private getIsTeacherSpeaking: (() => boolean) | null = null;
  private lastTeacherSpeechTime: number = 0;

  constructor(callbacks?: SpeechRecognitionCallbacks) {
    if (callbacks) this.callbacks = callbacks;
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  public setCallbacks(callbacks: SpeechRecognitionCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public setContinuousMode(enabled: boolean) {
    this.continuousMode = enabled;
  }

  public setTeacherSpeechGetter(fn: () => string) {
    this.getTeacherSpokenText = fn;
  }

  public setIsTeacherSpeakingGetter(fn: () => boolean) {
    this.getIsTeacherSpeaking = fn;
  }

  public setLanguage(lang: 'en' | 'hi' | 'hinglish') {
    // English & Hinglish use en-IN for Indian English / colloquial Hinglish phonetics
    // Hindi uses hi-IN
    this.language = lang === 'hi' ? 'hi-IN' : 'en-IN';
    if (this.recognition) {
      this.recognition.lang = this.language;
    }
  }

  public async start() {
    if (this.isListening) return;
    if (typeof window === 'undefined') return;

    if (!this.aecStream) {
      try {
        this.aecStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1
          }
        });
      } catch (err) {
        console.warn('[SpeechRecognition] Failed to acquire AEC WebRTC stream for echo cancellation:', err);
      }
    }

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      this.callbacks.onError?.(
        'Speech recognition is not supported in this browser. Please use Chrome, Edge, or text input.'
      );
      return;
    }

    try {
      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.language;

      this.finalTranscript = '';
      this.interimTranscript = '';
      this.speechDetected = false;
      this.isSubmitting = false;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.callbacks.onListeningChange?.(true);
      };

      this.recognition.onresult = (event: any) => {
        if (this.isSubmitting || !this.isListening) return;

        // Clean, idempotent segment assembly to prevent duplicate phrases
        const finalSegments: string[] = [];
        let interimText = '';

        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          const part = res[0]?.transcript?.trim();
          if (!part) continue;

          if (res.isFinal) {
            finalSegments.push(part);
          } else {
            interimText += (interimText ? ' ' : '') + part;
          }
        }

        this.finalTranscript = finalSegments.join(' ');
        this.interimTranscript = interimText;

        const rawCombined = [this.finalTranscript, this.interimTranscript]
          .filter(Boolean)
          .join(' ')
          .trim();

        if (rawCombined.length > 0) {
          // Check for acoustic echo from speaker (with a 2.5s grace period for audio latency)
          const isTeacherSpeaking = this.getIsTeacherSpeaking?.() || false;
          if (isTeacherSpeaking) {
            this.lastTeacherSpeechTime = Date.now();
          }
          const isRecentTeacherSpeech = isTeacherSpeaking || (Date.now() - this.lastTeacherSpeechTime < 2500);
          const teacherText = this.getTeacherSpokenText?.() || '';
          
          if (isRecentTeacherSpeech && isLikelyTeacherEcho(rawCombined, teacherText, true)) {
            console.log('[SpeechRecognition] Suppressed teacher speaker echo:', rawCombined);
            return;
          }

          this.speechDetected = true;

          // Emit normalized and raw previews so user sees proper technical terms in real-time
          const displayNormalized = normalizeTranscript(rawCombined);
          this.callbacks.onInterimTranscript?.(displayNormalized, rawCombined);

          // Submit soon after speech ends while allowing the browser time to finalize recognition.
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
          }

          const silenceMs = this.finalTranscript.length > 0 ? 350 : 650;
          this.silenceTimer = setTimeout(() => {
            this.finalizeAndSend();
          }, silenceMs);
        }
      };

      this.recognition.onerror = (event: any) => {
        if (this.isSubmitting) return;
        console.warn('[SpeechRecognition] error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          this.callbacks.onError?.(
            'Microphone permission denied. Please allow microphone access in your browser settings.'
          );
          this.stop();
        } else if (event.error === 'no-speech') {
          // Normal silence in continuous listening, do not stop
          return;
        } else if (event.error === 'network') {
          this.callbacks.onError?.(
            'Network error occurred during speech recognition. Please check your connection.'
          );
          this.stop();
        } else {
          // For other transient errors (e.g. aborted), let onend restart if still listening
          if (!this.isListening) {
            this.callbacks.onError?.(`Speech recognition error: ${event.error}`);
            this.stop();
          }
        }
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          // In continuous classroom mode, automatically restart to keep microphone hot
          try {
            this.recognition?.start();
            return;
          } catch (e) {
            setTimeout(() => {
              if (this.isListening && this.recognition) {
                try {
                  this.recognition.start();
                } catch (_) {}
              }
            }, 60);
            return;
          }
        }

        if (!this.isSubmitting) {
          this.isListening = false;
          this.callbacks.onListeningChange?.(false);
        }
      };

      this.recognition.start();
    } catch (err: any) {
      console.error('[SpeechRecognition] start error:', err);
      this.callbacks.onError?.(`Failed to start microphone: ${err.message}`);
      this.isListening = false;
      this.callbacks.onListeningChange?.(false);
    }
  }

  public resetTurnState() {
    this.finalTranscript = '';
    this.interimTranscript = '';
    this.speechDetected = false;
    this.isSubmitting = false;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private restartSession() {
    if (!this.isListening || !this.recognition) return;
    try {
      // Soft abort clears event.results in browser and triggers onend to restart
      this.recognition.abort();
    } catch (_) {
      try {
        this.recognition.start();
      } catch (_) {}
    }
  }

  private finalizeAndSend() {
    if (this.isSubmitting) return;

    const rawText = [this.finalTranscript, this.interimTranscript]
      .filter(Boolean)
      .join(' ')
      .trim();

    if (!rawText || rawText.length === 0) {
      this.resetTurnState();
      return;
    }

    // Ignore single-letter acoustic blips unless it's "q" (queue)
    if (rawText.length === 1 && !/^[qQ]$/.test(rawText)) {
      this.resetTurnState();
      return;
    }

    const isTeacherSpeaking = this.getIsTeacherSpeaking?.() || false;
    const isRecentTeacherSpeech = isTeacherSpeaking || (Date.now() - this.lastTeacherSpeechTime < 2500);
    const teacherText = this.getTeacherSpokenText?.() || '';

    if (isRecentTeacherSpeech && isLikelyTeacherEcho(rawText, teacherText, true)) {
      console.log('[SpeechRecognition] Suppressed echo final submission:', rawText);
      this.resetTurnState();
      if (this.continuousMode) {
        this.restartSession();
      }
      return;
    }

    if (this.speechDetected) {
      this.callbacks.onSpeechStart?.();
    }

    this.isSubmitting = true;
    const normalizedText = normalizeTranscript(rawText);

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    // Dispatch callback to tutor store
    this.callbacks.onFinalTranscript?.(normalizedText, rawText);

    if (this.continuousMode) {
      // Keep listening in continuous classroom mode: reset buffers and restart clean session
      this.resetTurnState();
      this.restartSession();
    } else {
      this.stop();
    }
  }

  public stop() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    this.speechDetected = false;
    this.isListening = false;
    this.isSubmitting = false;

    if (this.recognition) {
      const rec = this.recognition;
      this.recognition = null;
      rec.onstart = null;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        if (typeof rec.abort === 'function') {
          rec.abort();
        } else if (typeof rec.stop === 'function') {
          rec.stop();
        }
      } catch (e) {}
    }
    this.callbacks.onListeningChange?.(false);
    
    // Do not aggressively release aecStream so we don't have to re-prompt or cause lag,
    // but if you wanted to fully close mic on stop:
    // if (this.aecStream) {
    //   this.aecStream.getTracks().forEach(t => t.stop());
    //   this.aecStream = null;
    // }
  }
}

export const globalSpeechService = new BrowserSpeechService();
