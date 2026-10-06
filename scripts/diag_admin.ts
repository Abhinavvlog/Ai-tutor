import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';

const env = loadEnv('', process.cwd(), '');

const supabase = createClient(env.VITE_SUPABASE_URL, env.MYGURU_SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('concepts').select('*');
  console.log('Concepts Count:', data?.length);
  console.log('Error:', error);
}

check();
