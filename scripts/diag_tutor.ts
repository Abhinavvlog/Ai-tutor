import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';

const env = loadEnv('', process.cwd(), '');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function testQuery(message: string, userLang?: string) {
  console.log(`\n========================================`);
  console.log(`Testing query: "${message}"`);
  console.log(`========================================`);
  
  const { data: userAuth, error: authErr } = await supabase.auth.signInAnonymously();
  if (authErr || !userAuth.user) {
    console.error('Failed to sign in anonymously:', authErr);
    return;
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) {
    console.error('No access token available');
    return;
  }

  if (userLang) {
    await supabase.from('profiles').upsert({
      id: userAuth.user.id,
      language: userLang,
      display_name: 'Test Student'
    });
  }

  const sessionId = crypto.randomUUID();
  const start = Date.now();
  let firstTokenTime: number | null = null;
  let fullText = '';
  let eventCount = 0;

  try {
    const res = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/tutor-turn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        session_id: sessionId,
        concept_id: 'arrays_1',
        message: message,
        input_mode: 'text',
        interrupted: false
      })
    });

    console.log(`Response status: ${res.status} ${res.statusText} (${Date.now() - start}ms)`);
    if (!res.ok) {
      const errText = await res.text();
      console.error('Error response body:', errText);
      return;
    }

    if (res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        eventCount++;
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'token') {
                if (firstTokenTime === null) {
                  firstTokenTime = Date.now() - start;
                }
                fullText += data.text;
              } else if (data.type === 'meta') {
                console.log(`[Meta] move=${data.move} mastery=${data.p_mastery} citations=${data.citations?.length}`);
              } else if (data.type === 'error') {
                console.error(`[Error Event]:`, data.message);
              } else if (data.type === 'done') {
                console.log(`[Done Event received]`);
              }
            } catch (e) {}
          }
        }
      }
    }

    const totalTime = Date.now() - start;
    console.log(`Time to first token: ${firstTokenTime !== null ? `${firstTokenTime}ms` : 'None'}`);
    console.log(`Total duration: ${totalTime}ms`);
    console.log(`Total events parsed: ${eventCount}`);
    console.log(`Assistant Response:\n${fullText.trim()}`);
  } catch (err: any) {
    console.error('Request failed:', err.message);
  }
}

async function run() {
  await testQuery('what is an array', 'en');
  // Small pause between queries
  await new Promise(r => setTimeout(r, 2000));
  await testQuery('array aur queue mai kya difference hai?', 'hinglish');
}

run();
