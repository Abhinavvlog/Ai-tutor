import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTutorStore } from '@/store/tutorStore';
import { supabase } from '@/lib/supabase';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { TeacherStage } from '@/components/TeacherStage';

export function TutorScreen() {
  const { conceptId } = useParams<{ conceptId: string }>();
  const {
    sessionId,
    messages,
    spokenTranscripts,
    board,
    citations,
    selectedCitation,
    setSelectedCitation,
    sendMessage,
    interruptTutor,
    startListening,
    stopListening,
    isListening,
    interimTranscript,
    rawTranscript,
    currentCaption,
    isPlayingAudio,
    audioLevel,
    micError,
    clearMicError,
    isSpeechSupported,
    loading,
    error,
    clearBoard,
    mastery,
    timeToFirstToken,
    timeToFirstAudio,
    currentMove,
    currentExpression,
    boardEventCount,
    hasInterrupted,
    resumeTeaching,
    lessonProgress,
  } = useTutorStore();

  const [inputText, setInputText] = useState('');
  const [mobileTab, setMobileTab] = useState<'board' | 'transcript'>('board');
  const [showChatLog, setShowChatLog] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const autoTeachingTriggeredRef = useRef<string | null>(null);

  useEffect(() => {
    async function initAuthAndSession() {
      try {
        let { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          const { data } = await supabase.auth.signInAnonymously();
          session = data.session;
        }
      } catch (err) {
        console.warn('Anonymous auth init error:', err);
      }
      if (conceptId && autoTeachingTriggeredRef.current !== conceptId) {
        autoTeachingTriggeredRef.current = conceptId;
        const storeState = useTutorStore.getState();
        // Generate new session ID and start teaching immediately
        storeState.setSessionId(crypto.randomUUID());
        storeState.startLesson(conceptId);
      }
    }
    initAuthAndSession();
  }, [conceptId]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, interimTranscript]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    // If the tutor is currently speaking audio, typing immediately silences the audio
    if (isPlayingAudio || loading) {
      interruptTutor();
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !loading && conceptId) {
      sendMessage(inputText.trim(), conceptId, 'text');
      setInputText('');
    }
  };

  const handleMicToggle = () => {
    if (isListening) {
      stopListening();
    } else if (conceptId) {
      startListening(conceptId);
    }
  };

  const handleStop = () => {
    interruptTutor();
  };

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--color-background)]">
        <div className="p-8 text-center text-gray-600 font-[var(--font-poppins)] animate-pulse">
          Starting session...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--color-background)] overflow-hidden">
      {/* Header */}
      <header className="bg-[var(--color-navy)] text-white p-3 md:p-4 flex justify-between items-center shadow-md z-10">
        <div>
          <h1 className="text-lg md:text-xl font-[var(--font-poppins)] font-bold capitalize">
            {conceptId?.replace('_', ' ')}
          </h1>
          <Link to="/progress" className="text-xs md:text-sm text-[var(--color-teal)] hover:underline">
            ← Back to Progress
          </Link>
        </div>
        <div className="flex items-center space-x-3">
          {citations.length > 0 && (
            <div className="hidden sm:flex items-center space-x-1">
              {citations.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedCitation(c)}
                  className="text-xs bg-[var(--color-teal)]/20 text-white border border-[var(--color-teal)] px-2 py-0.5 rounded-full hover:bg-[var(--color-teal)]/40 transition-colors"
                  title="View Citation"
                >
                  📖 {c.source_title}, p.{c.page}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowChatLog(true)}
            className="text-xs md:text-sm bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded transition-colors"
          >
            Chat History
          </button>
          <div className="flex items-center">
            <span className="mr-2 text-xs md:text-sm text-gray-300">Mastery:</span>
            <div className="w-10 h-10 md:w-11 md:h-11 rounded-full border-4 border-[var(--color-highlight)] flex items-center justify-center text-xs md:text-sm font-bold">
              {Math.round(mastery * 100)}%
            </div>
          </div>
        </div>
      </header>

      {/* Mic error banner */}
      {micError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-between text-xs md:text-sm text-red-700">
          <span>{micError}</span>
          <button
            onClick={clearMicError}
            className="text-red-900 font-bold ml-4 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        
        {/* 3D Teacher Stage - Left 45% on desktop, Top 35% on mobile */}
        <TeacherStage
          isListening={isListening}
          isPlayingAudio={isPlayingAudio}
          audioLevel={audioLevel}
          loading={loading}
          hasInterrupted={hasInterrupted}
          move={currentMove}
          expression={currentExpression}
          boardEventCount={boardEventCount}
          currentCaption={currentCaption}
          interimTranscript={interimTranscript}
          rawTranscript={rawTranscript}
          resumeTeaching={resumeTeaching}
          lessonProgress={lessonProgress}
        />

        {/* Mobile Tab Switcher (Visible on mobile/tablet only) */}
        <div className="lg:hidden flex border-b border-gray-300 bg-white">
          <button
            onClick={() => setMobileTab('board')}
            className={`flex-1 py-2 text-xs font-bold border-b-2 ${
              mobileTab === 'board'
                ? 'border-[var(--color-teal)] text-[var(--color-teal)]'
                : 'border-transparent text-gray-500'
            }`}
          >
            Digital Board ({board.length})
          </button>
          <button
            onClick={() => setMobileTab('transcript')}
            className={`flex-1 py-2 text-xs font-bold border-b-2 ${
              mobileTab === 'transcript'
                ? 'border-[var(--color-teal)] text-[var(--color-teal)]'
                : 'border-transparent text-gray-500'
            }`}
          >
            Transcript ({messages.length})
          </button>
        </div>

        {/* Digital Board - Middle 35% on desktop */}
        <div
          className={`lg:w-[35%] bg-white border-r border-gray-300 overflow-y-auto p-4 md:p-6 shadow-inner relative ${
            mobileTab === 'board' ? 'flex flex-col flex-1' : 'hidden lg:flex lg:flex-col'
          }`}
        >
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base md:text-lg font-bold text-[var(--color-navy)] flex items-center">
              <span>Digital Board</span>
            </h2>
            <button
              onClick={clearBoard}
              className="text-xs text-[var(--color-error)] hover:underline"
            >
              Clear
            </button>
          </div>
          <div className="prose prose-sm max-w-none flex-1">
            {board.map((b) => (
              <div
                key={b.id}
                className="mb-4 p-3 md:p-4 border border-[var(--color-teal)] rounded-md bg-[var(--color-background)] shadow-sm animate-fadeIn"
              >
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {"Teaching on 3D blackboard..."}
                </ReactMarkdown>
              </div>
            ))}
            {board.length === 0 && (
              <p className="text-gray-400 italic text-center mt-12 text-sm">
                The teacher writes formulas, diagrams, and code snippets here.
              </p>
            )}
          </div>
        </div>

        {/* Transcript - Right 20% on desktop */}
        <div
          className={`lg:w-[20%] bg-[var(--color-background)] flex flex-col shadow-inner ${
            mobileTab === 'transcript' ? 'flex-1' : 'hidden lg:flex'
          }`}
        >
          <div className="flex justify-between items-center p-3 border-b border-gray-300 bg-gray-50">
            <h2 className="text-xs md:text-sm font-bold text-[var(--color-navy)]">Transcript</h2>
            {citations.length > 0 && (
              <span className="text-[10px] bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded font-medium">
                {citations.length} cited
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === 'student' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`p-2.5 md:p-3 rounded-lg max-w-[92%] text-xs md:text-sm shadow-sm ${
                    m.role === 'student'
                      ? 'bg-[var(--color-teal)] text-white'
                      : 'bg-white border border-gray-200'
                  }`}
                >
                  {m.role === 'student' ? (
                    m.content
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {spokenTranscripts[m.id] ?? m.content}
                    </ReactMarkdown>
                  )}
                  {m.isStreaming && <span className="inline-block animate-pulse ml-1">...</span>}
                </div>
              </div>
            ))}
            {isListening && interimTranscript && (
              <div className="flex flex-col items-end space-y-1">
                {rawTranscript && rawTranscript !== interimTranscript && (
                  <div className="px-2 py-0.5 rounded text-[10px] bg-slate-200 text-slate-600 font-mono max-w-[92%]">
                    Raw: "{rawTranscript}"
                  </div>
                )}
                <div className="p-2.5 rounded-lg max-w-[92%] text-xs bg-[var(--color-teal)]/80 text-white font-medium shadow-sm animate-pulse">
                  🎙️ {interimTranscript} ...
                </div>
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </div>

      {/* Input Bar with Text, Mic, Send, and Stop */}
      <div className="bg-white p-3 md:p-4 border-t border-gray-300 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
        {error && (
          <div className="text-[var(--color-error)] text-xs md:text-sm mb-2 max-w-4xl mx-auto">
            {error}
          </div>
        )}
        <form onSubmit={handleSend} className="flex max-w-4xl mx-auto items-center space-x-2">
          {/* Microphone button */}
          <button
            type="button"
            onClick={handleMicToggle}
            disabled={!isSpeechSupported}
            className={`w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all ${
              isListening
                ? 'bg-red-500 text-white animate-pulse shadow-lg scale-105'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title={
              !isSpeechSupported
                ? 'Voice input is not supported in this browser'
                : isListening
                ? 'Click to stop listening'
                : 'Click to speak (en-IN / hi-IN)'
            }
          >
            {isListening ? '🎙️' : '🎤'}
          </button>

          {/* Text Input */}
          <input
            type="text"
            className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-xs md:text-sm focus:outline-none focus:border-[var(--color-teal)] transition-colors"
            placeholder={
              isListening
                ? 'Listening to you... (speaks automatically on pause)'
                : 'Type your question or answer...'
            }
            value={inputText}
            onChange={handleInputChange}
          />

          {/* Stop / Interrupt button */}
          <button
            type="button"
            onClick={handleStop}
            disabled={!loading && !isPlayingAudio}
            className="bg-gray-200 hover:bg-red-100 hover:text-red-700 text-gray-700 font-semibold py-2 px-3 md:px-4 rounded-full text-xs md:text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title="Interrupt/Stop teacher immediately"
          >
            ⏹ Stop
          </button>

          {/* Send button */}
          <button
            type="submit"
            disabled={loading || !inputText.trim()}
            className="bg-[var(--color-highlight)] hover:opacity-90 text-white font-bold py-2 px-4 md:px-6 rounded-full text-xs md:text-sm transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? 'Thinking...' : 'Send'}
          </button>
        </form>
      </div>

      {/* Dev-only Latency & State Footer (SPEC.md line 93) */}
      <footer className="bg-gray-900 text-gray-400 text-[10px] md:text-xs px-3 py-1 flex justify-between items-center border-t border-gray-800">
        <div className="flex items-center space-x-3">
          <span>
            TTFT:{' '}
            <strong className={timeToFirstToken && timeToFirstToken < 1500 ? 'text-green-400' : 'text-gray-300'}>
              {timeToFirstToken !== null ? `${timeToFirstToken}ms` : '—'}
            </strong>
          </span>
          <span>
            TTFA:{' '}
            <strong className={timeToFirstAudio && timeToFirstAudio < 2500 ? 'text-green-400' : 'text-gray-300'}>
              {timeToFirstAudio !== null ? `${timeToFirstAudio}ms` : '—'}
            </strong>
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span>Audio: {isPlayingAudio ? '🔊 Playing' : 'Idle'}</span>
          <span>•</span>
          <span>Mic: {isListening ? '🎙️ Active' : 'Off'}</span>
        </div>
      </footer>

      {/* Citation Drawer / Modal */}
      {selectedCitation && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl relative animate-scaleIn">
            <button
              onClick={() => setSelectedCitation(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-lg font-bold"
            >
              ✕
            </button>
            <div className="flex items-center space-x-2 text-[var(--color-teal)] mb-3">
              <span className="text-xl">📖</span>
              <h3 className="font-bold font-[var(--font-poppins)] text-base text-[var(--color-navy)]">
                Course Material Citation
              </h3>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-800 mb-4">
              <p className="font-semibold text-[var(--color-navy)]">{selectedCitation.source_title}</p>
              <p className="text-xs text-gray-500 mt-1">Page Reference: Page {selectedCitation.page}</p>
              <p className="text-xs text-gray-400 mt-2 font-mono break-all">Chunk ID: {selectedCitation.chunk_id}</p>
            </div>
            <button
              onClick={() => setSelectedCitation(null)}
              className="w-full bg-[var(--color-teal)] text-white py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Chat History Modal */}
      {showChatLog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full h-[80vh] flex flex-col shadow-2xl relative animate-scaleIn">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="font-bold font-[var(--font-poppins)] text-lg text-[var(--color-navy)]">
                Chat History
              </h3>
              <button
                onClick={() => setShowChatLog(false)}
                className="text-gray-400 hover:text-gray-700 text-2xl font-bold leading-none"
              >
                &times;
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.role === 'student' ? 'items-end' : 'items-start'}`}>
                  <div className="text-xs text-gray-400 mb-1 px-1">
                    {msg.role === 'student' ? 'You' : 'MyGuru'}
                  </div>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === 'student' 
                      ? 'bg-[var(--color-navy)] text-white rounded-tr-sm' 
                      : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                  }`}>
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {msg.role === 'tutor'
                          ? (spokenTranscripts[msg.id] ?? msg.content)
                          : msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <div className="text-center text-gray-400 mt-10 italic">No messages yet.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
