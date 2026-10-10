import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfigurationError } from './supabaseConfig';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const configurationError = getSupabaseConfigurationError();
if (configurationError) {
  throw new Error(configurationError);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
