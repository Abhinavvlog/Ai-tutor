import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { createParser } from 'eventsource-parser';
import { globalAudioQueue, type TTSAudioResponse } from '@/services/audioQueue';
import { globalSpeechService, isLikelyTeacherEcho, stripTeacherEcho } from '@/services/speechRecognition';
import { normalizeTranscript } from '@/services/transcriptNormalizer';
import { getResumeDecision } from '@/services/resumeDecision';
import { appendSpokenTranscript, getUnplayedSegments } from '@/services/spokenTranscript';

export type Message = {
  id: string;
  role: 'student' | 'tutor';
  content: string;
  isStreaming?: boolean;
};

export type BoardEventAction = 
  | { type: 'WRITE_TEXT'; text: string; position: { x: number, y: number }; size: number; duration: number }
  | { type: 'DRAW_ARRAY'; values: string[]; position: { x: number, y: number }; spacing: number; duration: number }
  | { type: 'DRAW_LINKED_LIST'; values: string[]; position: { x: number, y: number }; spacing: number; duration: number }
  | { type: 'DRAW_STACK'; values: string[]; position: { x: number, y: number }; duration: number }
  | { type: 'DRAW_QUEUE'; values: string[]; position: { x: number, y: number }; spacing: number; duration: number }
  | { type: 'HIGHLIGHT'; targetId: string; duration: number }
  | { type: 'POINT_TO_BOARD'; targetPosition: { x: number, y: number }; duration: number }
  | { type: 'CLEAR_BOARD' };

export type BoardEvent = {
  id: string;
  action: BoardEventAction;
  isComplete: boolean;
  progress: number;
  startTime?: number;
};

export type Citation = {
  source_title: string;
  page: number;
  chunk_id: string;
};

export type LessonProgress = {
  conceptId: string;
  step: number;
  status: 'idle' | 'teaching' | 'interrupted' | 'resuming';
  lastSpokenSentence: string;
  completedSentences: string[];
  interruptedSentence: string | null;
};

export type SpeakerState = 'IDLE' | 'LISTENING' | 'STUDENT_SPEAKING' | 'THINKING' | 'TEACHER_SPEAKING';

type TutorStore = {
  sessionId: string | null;
  studentLanguage: 'en' | 'hi' | 'hinglish';
  messages: Message[];
  spokenTranscripts: Record<string, string>;
  board: BoardEvent[];
  citations: Citation[];
  selectedCitation: Citation | null;
  mastery: number;
  loading: boolean;
  error: string | null;
  
  // Voice & Audio state
  speakerState: SpeakerState;
  isListening: boolean;
  interimTranscript: string;
  rawTranscript: string;
  currentCaption: string;
  isPlayingAudio: boolean;
  audioLevel: number;
  micError: string | null;
  isSpeechSupported: boolean;
  hasInterrupted: boolean;
  resumeTeaching: boolean;
  awaitingResumeConfirmation: boolean;
  voiceModeActive: boolean;
  lessonProgress: LessonProgress;
  currentMove: string | null;
  currentExpression: string | null;
  boardEventCount: number;
  
  // Dev & Audio metrics
  ttsStatus: 'idle' | 'generating' | 'ready' | 'error';
  ttsError: string | null;
  timeToFirstToken: number | null;
  timeToFirstAudio: number | null;
  
  // Actions
  setSessionId: (id: string) => void;
  setStudentLanguage: (language: 'en' | 'hi' | 'hinglish') => void;
  startLesson: (conceptId: string) => Promise<void>;
  sendMessage: (text: string, conceptId: string, inputMode?: 'text' | 'voice', wasInterrupted?: boolean, mode?: 'chat' | 'lesson_start' | 'student_interruption') => Promise<void>;
  interruptTutor: () => void;
  startListening: (conceptId: string) => void;
  stopListening: () => void;
  clearBoard: () => void;
  setSelectedCitation: (citation: Citation | null) => void;
  clearMicError: () => void;
};

let activeAbortController: AbortController | null = null;
let currentConceptId: string = '';
let activeTutorMessageId: string | null = null;
let activeSpeechSegments: string[] = [];
let pausedTutorAnswer: { messageId: string; segments: string[] } | null = null;
let preservePausedTutorAnswer = false;

export function normalizeConceptId(id?: string): string {
  if (!id) return 'arrays_1';
  const clean = id.toLowerCase().replace(/-/g, '_').trim();
  if (['arrays', 'array', 'arrays_1', 'arrays1', 'intro_to_arrays', 'introduction_to_arrays'].includes(clean)) return 'arrays_1';
  if (['arrays_2', 'arrays2', 'array_operations', 'array_ops'].includes(clean)) return 'arrays_2';
  if (['linked_lists', 'linked_list', 'linkedlist', 'linkedlists', 'linked_lists_1', 'linked_lists1', 'singly_linked_lists'].includes(clean)) return 'linked_lists_1';
  if (['linked_lists_2', 'linked_lists2', 'doubly_linked_lists'].includes(clean)) return 'linked_lists_2';
  if (['stacks', 'stack', 'stacks_1', 'stacks1'].includes(clean)) return 'stacks_1';
  if (['queues', 'queue', 'queues_1', 'queues1'].includes(clean)) return 'queues_1';
  return clean;
}

function getStoredStudentLanguage(): 'en' | 'hi' | 'hinglish' {
  if (typeof window === 'undefined') return 'en';
  const language = window.localStorage.getItem('myguru-language');
  return language === 'hi' || language === 'hinglish' ? language : 'en';
}

export const useTutorStore = create<TutorStore>((set, get) => {
  // Set up AudioQueue callbacks
  globalAudioQueue.setCallbacks({
    onSentenceStart: (text: string, _index: number) => {
      const state = get();
      const prevCompleted = state.lessonProgress.lastSpokenSentence && state.lessonProgress.lastSpokenSentence !== text
        ? [...state.lessonProgress.completedSentences, state.lessonProgress.lastSpokenSentence]
        : state.lessonProgress.completedSentences;

      set({
        currentCaption: text,
        isPlayingAudio: true,
        speakerState: 'TEACHER_SPEAKING',
        ...(activeTutorMessageId ? {
          spokenTranscripts: {
            ...state.spokenTranscripts,
            [activeTutorMessageId]: appendSpokenTranscript(
              state.spokenTranscripts[activeTutorMessageId] ?? '',
              text,
            ),
          },
        } : {}),
        lessonProgress: {
          ...state.lessonProgress,
          status: 'teaching',
          lastSpokenSentence: text,
          completedSentences: prevCompleted,
        }
      });
    },
    onSentenceEnd: (_index: number) => {
      // Keep caption visible or let next sentence replace it
    },
    onQueueEmpty: () => {
      const state = get();
      set({
        isPlayingAudio: false,
        speakerState: state.isListening ? 'LISTENING' : 'IDLE',
        currentCaption: '',
        audioLevel: 0,
        ttsStatus: 'idle',
        resumeTeaching: false,
      });
      // In classroom continuous listening, ensure microphone remains active
      if (currentConceptId && !state.isListening) {
        get().startListening(currentConceptId);
      }
    },
    onAudioLevel: (level: number) => {
      set({ audioLevel: level });
    }
  });

  return {
    sessionId: null,
    studentLanguage: getStoredStudentLanguage(),
    messages: [],
    spokenTranscripts: {},
    board: [],
    citations: [],
    selectedCitation: null,
    mastery: 0,
    loading: false,
    error: null,

    speakerState: 'IDLE',
    isListening: false,
    interimTranscript: '',
    rawTranscript: '',
    currentCaption: '',
    isPlayingAudio: false,
    audioLevel: 0,
    micError: null,
    isSpeechSupported: globalSpeechService.isSupported(),
    hasInterrupted: false,
    resumeTeaching: false,
    awaitingResumeConfirmation: false,
    voiceModeActive: false,
    lessonProgress: {
      conceptId: '',
      step: 0,
      status: 'idle',
      lastSpokenSentence: '',
      completedSentences: [],
      interruptedSentence: null,
    },
    currentMove: null,
    currentExpression: null,
    boardEventCount: 0,

    ttsStatus: 'idle',
    ttsError: null,
    timeToFirstToken: null,
    timeToFirstAudio: null,

    setSessionId: (id) => {
      if (activeAbortController) {
        activeAbortController.abort();
        activeAbortController = null;
      }
      globalAudioQueue.interrupt();
      globalSpeechService.stop();
      activeTutorMessageId = null;
      activeSpeechSegments = [];
      pausedTutorAnswer = null;
      preservePausedTutorAnswer = false;
      set({
        sessionId: id,
        messages: [],
        spokenTranscripts: {},
        board: [],
        citations: [],
        selectedCitation: null,
        error: null,
        loading: false,
        speakerState: 'IDLE',
        currentCaption: '',
        interimTranscript: '',
        rawTranscript: '',
        isListening: false,
        isPlayingAudio: false,
        voiceModeActive: false,
        hasInterrupted: false,
        resumeTeaching: false,
        awaitingResumeConfirmation: false,
        lessonProgress: {
          conceptId: '',
          step: 0,
          status: 'idle',
          lastSpokenSentence: '',
          completedSentences: [],
          interruptedSentence: null,
        },
        currentMove: null,
        currentExpression: null,
        boardEventCount: 0,
        ttsStatus: 'idle',
        ttsError: null,
        timeToFirstToken: null,
        timeToFirstAudio: null,
      });
    },

    setStudentLanguage: (language) => {
      window.localStorage.setItem('myguru-language', language);
      set({ studentLanguage: language });
    },

    clearBoard: () => set({ board: [] }),
    setSelectedCitation: (citation) => set({ selectedCitation: citation }),
    clearMicError: () => set({ micError: null }),

    interruptTutor: () => {
      const state = get();
      // Capture the exact sentence being uttered when interrupted
      const interruptedSentence = state.currentCaption || state.lessonProgress.lastSpokenSentence;

      if (!preservePausedTutorAnswer && activeTutorMessageId && activeSpeechSegments.length > 0) {
        const firstUnplayedIndex = globalAudioQueue.getNextPlayIndex();
        const remainingSegments = getUnplayedSegments(activeSpeechSegments, firstUnplayedIndex);
        if (remainingSegments.length > 0) {
          pausedTutorAnswer = {
            messageId: activeTutorMessageId,
            segments: remainingSegments,
          };
        }
      }

      // Abort active fetch immediately (<100ms)
      if (activeAbortController) {
        activeAbortController.abort();
        activeAbortController = null;
      }

      // Stop audio playback and clear queue immediately (<100ms)
      globalAudioQueue.interrupt();

      set({
        loading: false,
        isPlayingAudio: false,
        speakerState: 'STUDENT_SPEAKING',
        currentCaption: '',
        hasInterrupted: true,
        resumeTeaching: true,
        awaitingResumeConfirmation: false,
        audioLevel: 0,
        ttsStatus: 'idle',
        lessonProgress: {
          ...state.lessonProgress,
          status: 'interrupted',
          interruptedSentence: interruptedSentence || null,
        },
        messages: state.messages.map((m) =>
          m.isStreaming ? { ...m, isStreaming: false } : m
        ),
      });
    },

    startListening: (conceptId: string) => {
      currentConceptId = conceptId;
      set({
        voiceModeActive: true,
        micError: null,
        interimTranscript: '',
        rawTranscript: '',
        speakerState: get().isPlayingAudio ? 'TEACHER_SPEAKING' : 'LISTENING',
      });

      // Connect teacher speech getter for acoustic echo filtering
      globalSpeechService.setIsTeacherSpeakingGetter(() => get().isPlayingAudio);
      globalSpeechService.setTeacherSpeechGetter(() => {
        const state = get();
        const lastTutorMsg = state.messages.filter(m => m.role === 'tutor').slice(-1)[0]?.content || '';
        return `${state.currentCaption} ${lastTutorMsg}`;
      });
      globalSpeechService.setContinuousMode(true);

      // Configure speech recognition callbacks
      globalSpeechService.setCallbacks({
        onSpeechStart: () => {
          // Interrupt immediately (<100ms) if genuine student speaks while tutor is speaking or streaming
          const state = get();
          const hasQueuedAudio = globalAudioQueue.getQueueSize() > 0;
          if (state.isPlayingAudio || state.loading || hasQueuedAudio || state.speakerState === 'TEACHER_SPEAKING') {
            console.log('[TutorStore] Student interruption detected! Stopping audio immediately (<100ms)...');
            state.interruptTutor();
          }
        },
        onInterimTranscript: (normalized: string, raw: string) => {
          set({
            interimTranscript: normalized,
            rawTranscript: raw,
            speakerState: 'STUDENT_SPEAKING',
          });
        },
        onFinalTranscript: (_normalized: string, raw: string) => {
          const state = get();
          set({
            interimTranscript: '',
            rawTranscript: raw,
            speakerState: 'THINKING',
          });

          // Safety guard: if teacher is speaking and transcript is echo, drop it
          const lastTutorMsg = state.messages.filter(m => m.role === 'tutor').slice(-1)[0]?.content || '';
          const fullTeacherText = `${state.currentCaption} ${lastTutorMsg}`;
          if ((state.isPlayingAudio || state.hasInterrupted) && isLikelyTeacherEcho(raw, fullTeacherText, true)) {
            console.log('[TutorStore] Suppressed echo transcript in onFinalTranscript:', raw);
            
            if (state.hasInterrupted && currentConceptId) {
              // We instantly stopped the teacher on noise, but it was just echo. Resume the lesson automatically!
              console.log('[TutorStore] False interruption by echo. Requesting continuation...');
              get().sendMessage(
                "Please continue from where you left off.", 
                currentConceptId, 
                'voice', 
                true, 
                'chat'
              );
            } else {
              set({ speakerState: 'TEACHER_SPEAKING' });
            }
            return;
          }

          // Remove any overlapping words from the teacher that the mic accidentally picked up
          const strippedRaw = stripTeacherEcho(raw, fullTeacherText);
          const finalNormalized = normalizeTranscript(strippedRaw);

          if (finalNormalized.trim() && currentConceptId) {
            const isInterruption = state.hasInterrupted || state.resumeTeaching;
            console.log(`[TutorStore] Dispatching student turn [${isInterruption ? 'INTERRUPTION' : 'NORMAL'}]: "${finalNormalized}"`);
            get().sendMessage(
              finalNormalized.trim(),
              currentConceptId,
              'voice',
              isInterruption,
              isInterruption ? 'student_interruption' : 'chat'
            );
          }
        },
        onError: (err) => {
          set({ micError: err, isListening: false, interimTranscript: '', rawTranscript: '' });
        },
        onListeningChange: (listening) => {
          set((s) => ({
            isListening: listening,
            speakerState: listening ? (s.isPlayingAudio ? 'TEACHER_SPEAKING' : 'LISTENING') : 'IDLE',
          }));
        }
      });

      globalSpeechService.start();
    },

    stopListening: () => {
      globalSpeechService.stop();
      set({ voiceModeActive: false, isListening: false, interimTranscript: '', rawTranscript: '' });
    },

    startLesson: async (conceptId: string) => {
      const canonicalConceptId = normalizeConceptId(conceptId);
      currentConceptId = canonicalConceptId;

      // Initialize lesson progress tracking
      set({
        lessonProgress: {
          conceptId: canonicalConceptId,
          step: 1,
          status: 'teaching',
          lastSpokenSentence: '',
          completedSentences: [],
          interruptedSentence: null,
        },
        resumeTeaching: false,
        hasInterrupted: false,
      });

      // 1. Immediately activate microphone for classroom simultaneous listening
      get().startListening(canonicalConceptId);

      // 2. Automatically trigger teaching using lesson_start mode
      await get().sendMessage('', canonicalConceptId, 'voice', false, 'lesson_start');
    },

    sendMessage: async (text, conceptId, inputMode = 'text', wasInterrupted = false, mode = 'chat') => {
      const {
        sessionId,
        studentLanguage,
        messages,
        hasInterrupted,
        resumeTeaching,
        isPlayingAudio,
        loading,
        awaitingResumeConfirmation,
      } = get();
      if (!sessionId) return;

      const wasActive = isPlayingAudio || loading;
      const hasQueuedAudio = globalAudioQueue.getQueueSize() > 0;
      const isInterruptedTurn = wasInterrupted || wasActive || hasQueuedAudio || hasInterrupted || resumeTeaching;
      const resumeDecision = awaitingResumeConfirmation ? getResumeDecision(text) : null;
      const resumeLesson = resumeDecision === 'continue';
      const interruptedSentence = get().lessonProgress.interruptedSentence;

      if (wasActive || hasQueuedAudio) {
        get().interruptTutor();
      }

      if (resumeLesson && pausedTutorAnswer) {
        const answerToResume = pausedTutorAnswer;
        pausedTutorAnswer = null;
        preservePausedTutorAnswer = false;
        activeTutorMessageId = answerToResume.messageId;
        activeSpeechSegments = [...answerToResume.segments];
        globalAudioQueue.interrupt();
        globalAudioQueue.resetSequence();
        set((state) => ({
          messages: [...state.messages, {
            id: Date.now().toString(),
            role: 'student',
            content: text,
          }],
          loading: false,
          error: null,
          currentCaption: '',
          isPlayingAudio: false,
          speakerState: 'THINKING',
          awaitingResumeConfirmation: false,
          hasInterrupted: false,
          resumeTeaching: true,
          lessonProgress: {
            ...state.lessonProgress,
            status: 'resuming',
            interruptedSentence: null,
          },
        }));

        answerToResume.segments.forEach((segment, index) => {
          const ttsPromise = supabase.functions
            .invoke<TTSAudioResponse>('tts', {
              body: { text: segment.trim(), language: studentLanguage },
            })
            .then(({ data, error }) => {
              if (error) throw error;
              if (!data?.audio_base64 || !data.mime_type || !data.sample_rate) {
                throw new Error('TTS returned an invalid audio response.');
              }
              return data;
            })
            .catch((err: Error) => {
              set({ ttsStatus: 'error', ttsError: err.message });
              throw err;
            });
          globalAudioQueue.enqueue(index, segment, ttsPromise);
        });
        return;
      }

      if (resumeDecision === 'decline') {
        pausedTutorAnswer = null;
        preservePausedTutorAnswer = false;
      }
      const studentMsgId = Date.now().toString();
      const tutorMsgId = (Date.now() + 1).toString();

      const newMessages = mode === 'lesson_start' 
        ? [
            ...messages.map((m) => m.isStreaming ? { ...m, isStreaming: false } : m),
            { id: tutorMsgId, role: 'tutor', content: '', isStreaming: true }
          ]
        : [
            ...messages.map((m) => m.isStreaming ? { ...m, isStreaming: false } : m),
            { id: studentMsgId, role: 'student', content: text },
            { id: tutorMsgId, role: 'tutor', content: '', isStreaming: true }
          ];

      set({
        messages: newMessages as any,
        spokenTranscripts: {
          ...get().spokenTranscripts,
          [tutorMsgId]: '',
        },
        loading: true,
        error: null,
        currentCaption: '',
        isPlayingAudio: false,
        voiceModeActive: true,
        awaitingResumeConfirmation: false,
        lessonProgress: resumeLesson
          ? { ...get().lessonProgress, status: 'resuming' }
          : get().lessonProgress,
        timeToFirstToken: null,
        timeToFirstAudio: null,
      });

      // Keep microphone active for continuous classroom interruption
      if (conceptId && !get().isListening) {
        get().startListening(conceptId);
      }

      const requestStartTime = Date.now();
      const requestId = `${conceptId || 'global'}-${Date.now().toString().slice(-4)}`;
      console.log(`[Perf] [Req:${requestId}] Sending ${mode} request to tutor-turn (interrupted: ${isInterruptedTurn})...`);
      
      const abortController = new AbortController();
      activeAbortController = abortController;
      activeTutorMessageId = tutorMsgId;
      activeSpeechSegments = [];
      preservePausedTutorAnswer = Boolean(pausedTutorAnswer);

      // Unlock browser audio context on user interaction
      globalAudioQueue.initContext();
      globalAudioQueue.resetSequence();

      try {
        let { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          console.log('[TutorStore] No active session found. Signing in anonymously...');
          const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
          if (authError) {
            throw new Error(`Authentication error: ${authError.message}`);
          }
          session = authData.session;
          if (!session?.access_token) {
            const { data: refreshed } = await supabase.auth.getSession();
            session = refreshed.session;
          }
        }

        if (!session?.access_token) {
          throw new Error('Could not establish an authenticated session. Please reload the page.');
        }

        const studentLang = studentLanguage;
        globalSpeechService.setLanguage(studentLang);

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tutor-turn`,
          {
            method: 'POST',
            signal: abortController.signal,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              session_id: sessionId,
              concept_id: conceptId,
              mode: mode,
              message: text,
              input_mode: inputMode,
              interrupted: isInterruptedTurn,
              interrupted_at: interruptedSentence || undefined,
              resume_lesson: resumeLesson,
              resume_decision: resumeDecision || undefined,
              language: studentLang,
              history: messages
                .filter((m) => m.content && m.content.trim())
                .slice(-8)
                .map((m) => ({
                  role: m.role === 'student' ? 'user' : 'model',
                  content: m.content.trim(),
                })),
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to send message: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let tutorText = '';

        const onParse = (event: any) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'token') {
              // Record time to first token
              if (get().timeToFirstToken === null) {
                const ttfToken = Date.now() - requestStartTime;
                console.log(`[Perf] [Req:${requestId}] First Gemini token received in ${ttfToken}ms`);
                set({ timeToFirstToken: ttfToken });
              }

              tutorText += data.text;
              set((state) => ({
                messages: state.messages.map((m) =>
                  m.id === tutorMsgId ? { ...m, content: tutorText } : m
                ),
              }));
            } else if (data.type === 'sentence') {
              // Send sentence immediately to TTS Edge Function
              const sentenceIndex = data.index ?? 0;
              const sentenceText = data.text;
              const chunkMs = Date.now() - requestStartTime;
              console.log(`[Perf] [Req:${requestId}] Sentence #${sentenceIndex} emitted at +${chunkMs}ms: "${sentenceText}"`);

              if (sentenceText && sentenceText.trim()) {
                activeSpeechSegments[sentenceIndex] = sentenceText.trim();
                set({ ttsStatus: 'generating' });
                const ttsPromise = (async (): Promise<TTSAudioResponse> => {
                  try {
                    const ttsRes = await fetch(
                      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts`,
                      {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${session?.access_token}`,
                          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                        },
                        body: JSON.stringify({
                          text: sentenceText.trim(),
                          language: studentLang,
                        }),
                      }
                    );

                    if (!ttsRes.ok) {
                      const errBody = await ttsRes.text();
                      set({ ttsStatus: 'error', ttsError: `TTS ${ttsRes.status}: ${errBody}` });
                      throw new Error(`TTS failed with status: ${ttsRes.status}`);
                    }

                    const ttsData = await ttsRes.json();
                    set({ ttsStatus: 'ready', ttsError: null });
                    // Measure time to first audio
                    if (get().timeToFirstAudio === null) {
                      const ttfAudio = Date.now() - requestStartTime;
                      console.log(`[Perf] [Req:${requestId}] First TTS audio ready in ${ttfAudio}ms`);
                      set({ timeToFirstAudio: ttfAudio });
                    }

                    return ttsData;
                  } catch (err: any) {
                    set({ ttsStatus: 'error', ttsError: err.message });
                    throw err;
                  }
                })();

                // Enqueue into AudioQueue for in-order playback
                globalAudioQueue.enqueue(sentenceIndex, sentenceText.trim(), ttsPromise);
              }
            } else if (data.type === 'board_action') {
              // Map from string tag to structured BoardEventAction
              let action: BoardEventAction;
              if (data.type === 'board_erase') {
                action = { type: 'CLEAR_BOARD' };
              } else if (data.type === 'board_array') {
                action = { type: 'DRAW_ARRAY', values: data.content.split(','), position: {x:0, y:0}, spacing: 0.2, duration: 2.0 };
              } else {
                action = { type: 'WRITE_TEXT', text: data.content, position: {x:0, y:0}, size: 0.1, duration: 2.0 };
              }
              
              set((state) => ({
                board: [
                  ...state.board,
                  { id: Date.now().toString(), action, isComplete: false, progress: 0 }
                ],
                boardEventCount: state.boardEventCount + 1,
              }));
            } else if (data.type === 'meta') {
              set({
                mastery: data.p_mastery,
                citations: data.citations || [],
                currentMove: data.move || null,
                currentExpression: data.expression || null,
              });
            } else if (data.type === 'error') {
              set((state) => ({
                error: data.message,
                loading: false,
                messages: state.messages.map((m) =>
                  m.id === tutorMsgId ? { ...m, isStreaming: false } : m
                ),
              }));
            } else if (data.type === 'done') {
              set((state) => ({
                messages: state.messages.map((m) =>
                  m.id === tutorMsgId ? { ...m, isStreaming: false } : m
                ),
                loading: false,
                resumeTeaching: false,
                hasInterrupted: false,
                awaitingResumeConfirmation: isInterruptedTurn && !resumeLesson && mode !== 'lesson_start',
                lessonProgress: {
                  ...state.lessonProgress,
                  step: state.lessonProgress.step + 1,
                  status: isInterruptedTurn && !resumeLesson ? 'interrupted' : 'teaching',
                  interruptedSentence: isInterruptedTurn && !resumeLesson
                    ? interruptedSentence
                    : null,
                },
              }));
            }
          } catch (e) {}
        };

        const parser = createParser({ onEvent: onParse });

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            parser.feed(decoder.decode(value, { stream: true }));
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('[TutorStore] Request aborted by user interruption.');
          return;
        }

        console.error(err);
        set((state) => ({
          error: err.message,
          loading: false,
          messages: state.messages.map((m) =>
            m.id === tutorMsgId ? { ...m, isStreaming: false } : m
          ),
        }));
      } finally {
        if (activeAbortController === abortController) {
          activeAbortController = null;
        }
      }
    },
  };
});
