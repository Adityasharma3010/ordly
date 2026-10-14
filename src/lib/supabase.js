import { createClient } from '@supabase/supabase-js'
import { isSupabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY } from './config'

// Only the public anon key is ever used here. Access control lives in the
// database (Row Level Security), not in this file.
export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null
