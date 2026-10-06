import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export function ProgressScreen() {
  const [masteryData, setMasteryData] = useState<any[]>([]);
  const [concepts, setConcepts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: cData } = await supabase.from('concepts').select('*').order('order_index');
      if (cData) setConcepts(cData);

      const { data: mData } = await supabase.from('mastery').select('*').eq('student_id', user.id);
      if (mData) setMasteryData(mData);

      setLoading(false);
    };
    fetchData();
  }, []);

  const getMastery = (conceptId: string) => {
    const m = masteryData.find(x => x.concept_id === conceptId);
    return m ? m.p_mastery : 0.3; // init mastery
  };

  if (loading) return <div className="p-8">Loading progress...</div>;

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-[var(--color-navy)] mb-6 font-[var(--font-poppins)]">Your Progress</h1>
        
        <div className="bg-white shadow-md rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4 text-[var(--color-navy)]">Concepts</h2>
          <div className="space-y-6">
            {concepts.map(c => {
              const mastery = getMastery(c.id);
              const masteryPct = Math.round(mastery * 100);
              
              return (
                <div key={c.id} className="border-b border-gray-100 pb-4 last:border-0">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold text-lg text-[var(--color-text)]">{c.title}</h3>
                    <Link 
                      to={`/learn/${c.id}`} 
                      className="bg-[var(--color-teal)] hover:bg-[var(--color-navy)] text-white px-4 py-1 rounded text-sm transition-colors"
                    >
                      {masteryPct >= 80 ? 'Review' : 'Learn'}
                    </Link>
                  </div>
                  <p className="text-sm text-gray-500 mb-2">{c.description}</p>
                  
                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-[var(--color-success)] h-2.5 rounded-full" 
                      style={{ width: `${masteryPct}%` }}
                    ></div>
                  </div>
                  <div className="text-right text-xs text-gray-500 mt-1">{masteryPct}% Mastery</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
