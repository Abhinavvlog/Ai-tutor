import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';

const env = loadEnv('', process.cwd(), '');

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: user } = await supabase.auth.signInAnonymously();
  console.log('User signed in:', user?.user?.id);
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session?.access_token) {
    const payload = JSON.parse(Buffer.from(sessionData.session.access_token.split('.')[1], 'base64').toString());
    console.log('JWT Role:', payload.role);
    console.log('JWT is_anonymous:', payload.is_anonymous);
  }
  const { data, error } = await supabase.from('concepts').select('*');
  console.log('Concepts:', data);
  console.log('Error:', error);
}

check();
