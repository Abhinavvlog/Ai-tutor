import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useTutorStore } from '@/store/tutorStore';

export function StartScreen() {
  const [displayName, setDisplayName] = useState('');
  const [language, setLanguage] = useState<'en' | 'hi' | 'hinglish'>('en');
  const [pace, setPace] = useState<'slow' | 'normal' | 'fast'>('normal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const setStudentLanguage = useTutorStore((state) => state.setStudentLanguage);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Anonymous sign-in
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      if (authError) throw authError;

      const user = authData.user;
      if (!user) throw new Error('No user returned from anonymous sign in');

      // 2. Create profile
      const { error: profileError } = await supabase.from('profiles').insert({
        id: user.id,
        display_name: displayName.trim(),
        language,
        pace
      });
      
      if (profileError) throw profileError;

      setStudentLanguage(language);

      // 3. Navigate to progress or first concept
      // The spec says /progress or /learn/:conceptId
      navigate('/progress');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-3xl font-[var(--font-poppins)] font-bold text-[var(--color-navy)] mb-6 text-center">
          MyGuru AI Teacher
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-[var(--color-error)] text-white rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleStart} className="space-y-4">
          <div>
            <label className="block text-[var(--color-text)] font-semibold mb-1" htmlFor="name">
              Your Name
            </label>
            <input
              id="name"
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-[var(--color-teal)]"
              placeholder="e.g. Alex"
              required
            />
          </div>

          <div>
            <label className="block text-[var(--color-text)] font-semibold mb-1" htmlFor="language">
              Language
            </label>
            <select
              id="language"
              value={language}
              onChange={e => setLanguage(e.target.value as any)}
              className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-[var(--color-teal)]"
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="hinglish">Hinglish</option>
            </select>
          </div>

          <div>
            <label className="block text-[var(--color-text)] font-semibold mb-1" htmlFor="pace">
              Learning Pace
            </label>
            <select
              id="pace"
              value={pace}
              onChange={e => setPace(e.target.value as any)}
              className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-[var(--color-teal)]"
            >
              <option value="slow">Slow</option>
              <option value="normal">Normal</option>
              <option value="fast">Fast</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading || !displayName.trim()}
            className="w-full bg-[var(--color-teal)] hover:bg-[var(--color-navy)] text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50 mt-6"
          >
            {loading ? 'Starting...' : 'Start learning'}
          </button>
        </form>
      </div>
    </div>
  );
}
