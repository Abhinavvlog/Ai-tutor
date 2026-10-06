import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import type { AvatarCanvasProps, AvatarDebugData } from './AvatarCanvas';
import { useTutorStore } from '@/store/tutorStore';

// Lazy-load 3D Canvas per SPEC.md
const AvatarCanvas = lazy(() =>
  import('./AvatarCanvas').then((mod) => ({ default: mod.AvatarCanvas }))
);

function checkWebGLSupport(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (_) {
    return false;
  }
}

export type TeacherStageProps = AvatarCanvasProps & {
  currentCaption?: string;
  interimTranscript?: string;
  rawTranscript?: string;
  resumeTeaching?: boolean;
  lessonProgress?: {
    conceptId: string;
    step: number;
    status: 'teaching' | 'interrupted' | 'resuming' | 'completed' | 'idle';
    lastSpokenSentence: string;
    completedSentences: string[];
    interruptedSentence?: string | null;
  } | null;
};

export const TeacherStage: React.FC<TeacherStageProps> = ({
  isListening,
  isPlayingAudio,
  audioLevel,
  loading,
  hasInterrupted,
  move,
  expression,
  boardEventCount,
  currentCaption,
  interimTranscript,
  rawTranscript,
  resumeTeaching,
  lessonProgress,
}) => {
  const [hasWebGL, setHasWebGL] = useState(true);
  const stageRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      stageRef.current?.requestFullscreen().catch((err: any) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };
  const [showDebug, setShowDebug] = useState(false);
  const { ttsStatus, ttsError } = useTutorStore();

  const [debugData, setDebugData] = useState<AvatarDebugData>({
    modelType: 'loading',
    currentState: 'idle',
    vowels: { aa: 0, oh: 0, ou: 0, ee: 0, ih: 0 },
    blink: 0,
  });

  useEffect(() => {
    setHasWebGL(checkWebGLSupport());
  }, []);

  return (
    <div 
      ref={stageRef} 
      className={`${isFullscreen ? 'w-screen h-screen fixed inset-0 z-50' : 'h-[35%] lg:h-auto lg:w-[45%] border-r'} bg-slate-900 border-slate-700/60 flex flex-col items-center justify-between relative p-3 md:p-4 text-white overflow-hidden shadow-inner`}
    >
      {/* Top Status Bar */}
      <div className="w-full flex justify-between items-center text-xs text-slate-400 z-10 shrink-0">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-slate-300">MyGuru AI Teacher</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-teal-400 border border-slate-700">
            {hasWebGL ? (debugData.modelType === 'vrm' ? '3D VRM Teacher' : '3D Stage') : '2D Mode'}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {isPlayingAudio && (
            <span className="flex items-center text-[var(--color-highlight)] animate-pulse font-semibold">
              <span className="w-2 h-2 rounded-full bg-[var(--color-highlight)] mr-1.5 inline-block"></span>
              Speaking
            </span>
          )}
          {isListening && (
            <span className="flex items-center text-red-400 animate-pulse font-semibold">
              <span className="w-2 h-2 rounded-full bg-red-400 mr-1.5 inline-block"></span>
              Listening...
            </span>
          )}
          {loading && !isPlayingAudio && (
            <span className="flex items-center text-sky-400 animate-pulse font-semibold">
              <span className="w-2 h-2 rounded-full bg-sky-400 mr-1.5 inline-block"></span>
              Thinking...
            </span>
          )}
        </div>
      </div>

      {/* 3D Scene / 2D Fallback Stage */}
      <div className="flex-1 w-full relative flex items-center justify-center min-h-[160px] overflow-hidden my-1">
        {/* Live Debug Indicators HUD Overlay */}
        {!showDebug ? (
          <>
          <button
            onClick={() => setShowDebug(true)}
            className="absolute top-2 left-2 z-20 pointer-events-auto bg-black/20 hover:bg-black/50 text-white/50 hover:text-white p-1.5 rounded-md text-xs font-mono transition-colors"
            title="Show Debug HUD"
          >
            HUD
          </button>
        <button
          onClick={toggleFullscreen}
          className="absolute top-2 right-2 z-20 pointer-events-auto bg-black/20 hover:bg-black/50 text-white/50 hover:text-white px-2 py-1.5 rounded-md text-xs font-mono transition-colors"
          title="Toggle Fullscreen"
        >
          {isFullscreen ? 'Exit Fullscreen' : '⛶ Fullscreen'}
        </button>
        </>
        ) : (
          <div className="absolute top-2 left-2 z-20 pointer-events-auto bg-slate-950/85 backdrop-blur-md border border-slate-700/80 rounded-md p-2 text-[10px] sm:text-xs font-mono text-slate-300 shadow-xl max-w-[240px] sm:max-w-[270px]">
            <div className="flex items-center justify-between font-bold border-b border-slate-800 pb-1 mb-1.5">
              <span className="text-teal-400 flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping mr-1.5"></span>
                STAGE DEBUG HUD
              </span>
              <button
                onClick={() => setShowDebug(false)}
                className="text-[10px] text-slate-400 hover:text-white px-1 py-0.5 rounded bg-slate-800"
              >
                Hide
              </button>
            </div>

            <div className="space-y-1.5">
              {/* Avatar State Badges */}
              <div>
                <div className="flex justify-between text-[10px] text-slate-400 uppercase font-semibold">
                  <span>Avatar State:</span>
                  <span className={debugData.modelType === 'vrm' ? 'text-teal-400' : 'text-red-400'}>{debugData.modelType}</span>
                </div>
                <div className="grid grid-cols-4 gap-1 mt-0.5 text-center text-[10px]">
                  <span className={`px-1 py-0.5 rounded border transition-all ${
                    debugData.currentState === 'idle'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500 font-bold shadow-sm'
                      : 'bg-slate-800/80 text-slate-500 border-slate-700'
                  }`}>idle</span>
                  <span className={`px-1 py-0.5 rounded border transition-all ${
                    debugData.currentState === 'listening'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500 font-bold shadow-sm'
                      : 'bg-slate-800/80 text-slate-500 border-slate-700'
                  }`}>listening</span>
                  <span className={`px-1 py-0.5 rounded border transition-all ${
                    debugData.currentState === 'thinking'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500 font-bold shadow-sm'
                      : 'bg-slate-800/80 text-slate-500 border-slate-700'
                  }`}>thinking</span>
                  <span className={`px-1 py-0.5 rounded border transition-all ${
                    debugData.currentState === 'speaking'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500 font-bold shadow-sm'
                      : 'bg-slate-800/80 text-slate-500 border-slate-700'
                  }`}>speaking</span>
                </div>
              </div>

              {/* TTS Status */}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">TTS Status:</span>
                <span className={`font-semibold ${
                  ttsStatus === 'generating' ? 'text-amber-400 animate-pulse' :
                  ttsStatus === 'ready' ? 'text-emerald-400' :
                  ttsStatus === 'error' ? 'text-rose-400' : 'text-slate-400'
                }`}>
                  {ttsStatus}
                </span>
              </div>
              {ttsError && (
                <div className="text-[9px] text-rose-400 truncate max-w-[230px]" title={ttsError}>
                  {ttsError}
                </div>
              )}

              {/* AudioQueue Status */}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">AudioQueue:</span>
                <span className={isPlayingAudio ? 'text-amber-300 font-semibold' : 'text-slate-400'}>
                  {isPlayingAudio ? 'PLAYING' : 'IDLE'}
                </span>
              </div>

              {/* Analyser RMS & Live Level Meter */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Analyser RMS:</span>
                  <span className="font-bold text-teal-300">{(audioLevel || 0).toFixed(4)}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1 border border-slate-700">
                  <div
                    className="h-full bg-gradient-to-r from-teal-400 to-amber-400 transition-all duration-75"
                    style={{ width: `${Math.min(100, Math.round((audioLevel || 0) * 300))}%` }}
                  />
                </div>
              </div>

              {/* Live Lip-Sync Formants */}
              <div className="text-[10px] text-slate-400">
                <span>Vowels: </span>
                <span className="text-slate-200">
                  aa:{(debugData.vowels.aa || 0).toFixed(2)} oh:{(debugData.vowels.oh || 0).toFixed(2)}
                </span>
              </div>

              {/* Active Model Indicator */}
              <div className="text-[10px] text-slate-400 pt-0.5 border-t border-slate-800/80 flex items-center justify-between">
                <span>Model:</span>
                <span className="text-teal-300 font-medium">
                  {debugData.modelType === 'vrm' ? 'VRM (teacher.vrm)' : debugData.modelType === 'procedural' ? 'Procedural Fallback' : 'Loading...'}
                </span>
              </div>

              {/* Classroom Mode & Interruption Status */}
              <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/80 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span>Classroom Mode:</span>
                  <span className={`font-semibold ${
                    isPlayingAudio && isListening
                      ? 'text-teal-400 animate-pulse'
                      : isListening
                      ? 'text-rose-400'
                      : 'text-slate-400'
                  }`}>
                    {isPlayingAudio && isListening ? 'Simultaneous' : isListening ? 'Listening' : 'Ready'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Interruption:</span>
                  <span className={`font-semibold ${
                    hasInterrupted || lessonProgress?.status === 'interrupted'
                      ? 'text-amber-400 animate-pulse'
                      : resumeTeaching
                      ? 'text-sky-400'
                      : 'text-emerald-400'
                  }`}>
                    {hasInterrupted || lessonProgress?.status === 'interrupted'
                      ? 'Interrupted (<100ms)'
                      : resumeTeaching
                      ? 'Resuming Lesson'
                      : 'Listening'}
                  </span>
                </div>
                {lessonProgress && (
                  <div className="flex items-center justify-between">
                    <span>Lesson Step:</span>
                    <span className="text-slate-300">
                      Step {lessonProgress.step} ({lessonProgress.status})
                    </span>
                  </div>
                )}
                {lessonProgress?.interruptedSentence && (
                  <div className="text-[9px] text-amber-300/80 truncate max-w-[230px]" title={lessonProgress.interruptedSentence}>
                    Cut: "{lessonProgress.interruptedSentence}"
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {hasWebGL ? (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center text-slate-400 text-xs animate-pulse">
                <span className="text-3xl mb-2">👩‍🏫</span>
                Initializing 3D Teacher...
              </div>
            }
          >
            <AvatarCanvas
              isListening={isListening}
              isPlayingAudio={isPlayingAudio}
              audioLevel={audioLevel}
              loading={loading}
              hasInterrupted={hasInterrupted}
              move={move}
              expression={expression}
              boardEventCount={boardEventCount}
              onDebugUpdate={setDebugData}
              className="absolute inset-0"
            />
          </Suspense>
        ) : (
          // Static 2D Fallback for weak devices or no WebGL per SPEC.md
          <div className="flex flex-col items-center justify-center">
            <div
              className={`w-28 h-28 md:w-36 md:h-36 rounded-full border-4 flex items-center justify-center text-5xl md:text-6xl transition-all duration-150 ${
                isPlayingAudio
                  ? 'border-[var(--color-highlight)] shadow-[0_0_25px_rgba(242,169,59,0.5)] scale-105'
                  : isListening
                  ? 'border-red-400 shadow-[0_0_20px_rgba(248,113,113,0.4)]'
                  : 'border-slate-700'
              }`}
              style={{
                transform: isPlayingAudio ? `scale(${1 + Math.min(audioLevel * 0.3, 0.15)})` : undefined,
              }}
            >
              👩‍🏫
            </div>
            <span className="text-xs text-slate-400 mt-2 font-medium">2D Mode Active</span>
          </div>
        )}
      </div>

      {/* Captions of sentence being spoken per SPEC.md */}
      <div
        aria-live="polite"
        className="w-full max-w-lg min-h-[3.25rem] bg-slate-800/85 backdrop-blur-md border border-slate-700/80 rounded-lg p-2.5 text-center text-xs md:text-sm text-slate-100 flex items-center justify-center shadow-lg z-10 shrink-0"
      >
        {currentCaption ? (
          <span className="font-medium animate-fadeIn leading-relaxed">{currentCaption}</span>
        ) : isListening && interimTranscript ? (
          <div className="flex flex-col items-center justify-center space-y-0.5 w-full text-center">
            {rawTranscript && rawTranscript !== interimTranscript && (
              <span className="text-[11px] text-amber-300/80 font-mono tracking-wide">
                <span className="text-amber-400 font-semibold">[Raw]:</span> "{rawTranscript}"
              </span>
            )}
            <span className="text-xs md:text-sm text-teal-300 font-semibold">
              "{interimTranscript}"
            </span>
          </div>
        ) : isListening ? (
          <span className="text-slate-400 italic">Listening to your voice...</span>
        ) : loading ? (
          <span className="text-slate-400 animate-pulse">Thinking...</span>
        ) : (
          <span className="text-slate-400 italic">Teacher is ready. Ask or speak anything!</span>
        )}
      </div>
    </div>
  );
};
