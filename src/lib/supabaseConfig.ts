export function getSupabaseConfigurationError(): string | null {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

  if (!supabaseUrl || !supabaseAnonKey) {
    return 'Supabase URL and anon key are required.'
  }

  if (/your[-_]|placeholder|replace[-_]?me|example/i.test(supabaseUrl + supabaseAnonKey)) {
    return 'Replace the example Supabase settings with your project values.'
  }

  try {
    const url = new URL(supabaseUrl)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return 'The Supabase URL must use HTTP or HTTPS.'
    }
  } catch {
    return 'The Supabase URL must be a valid absolute URL.'
  }

  return null
}
