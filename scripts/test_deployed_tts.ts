import { loadEnv } from 'vite';

const env = loadEnv('', process.cwd(), '');
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://meqoslkcingukvfarwdl.supabase.co';
const anonKey = env.VITE_SUPABASE_ANON_KEY;

async function testEdgeTTS() {
  console.log('Testing deployed Edge Function at:', `${supabaseUrl}/functions/v1/tts`);
  const start = Date.now();
  const res = await fetch(`${supabaseUrl}/functions/v1/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`
    },
    body: JSON.stringify({
      text: 'An array is a linear data structure.',
      language: 'en'
    })
  });
  console.log(`Status: ${res.status} ${res.statusText} (${Date.now() - start}ms)`);
  const json = await res.json();
  if (res.ok) {
    console.log('SUCCESS! audio_base64 length:', json.audio_base64?.length, 'mime_type:', json.mime_type, 'sample_rate:', json.sample_rate);
    const buf = Buffer.from(json.audio_base64, 'base64');
    console.log('Byte length:', buf.length);
    console.log('First 4 bytes ASCII:', buf.slice(0, 4).toString('ascii'));
    console.log('First 8 bytes hex:', buf.slice(0, 8).toString('hex'));
  } else {
    console.error('FAILED:', json);
  }
}

testEdgeTTS();
