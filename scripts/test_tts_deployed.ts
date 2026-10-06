import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';

const env = loadEnv('', process.cwd(), '');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: userAuth } = await supabase.auth.signInAnonymously();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  console.log('Testing deployed tts function...');
  const start = Date.now();
  const res = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      text: 'Hello, this is MyGuru speaking.',
      language: 'en'
    })
  });

  console.log(`Status: ${res.status} ${res.statusText} (${Date.now() - start}ms)`);
  const data = await res.json();
  if (data.audio_base64) {
    console.log(`Success! sample_rate: ${data.sample_rate}, mime_type: ${data.mime_type}, bytes: ${data.audio_base64.length}`);
  } else {
    console.log('Error payload:', data);
  }
}

run();
