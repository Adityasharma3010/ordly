// Single entry point for all data access. UI code imports `api` and never
// talks to Supabase or localStorage directly.
import { isSupabaseConfigured } from '../lib/config'
import { supabaseApi } from './supabaseApi'
import { localApi } from './localApi'

export const api = isSupabaseConfigured ? supabaseApi : localApi
export const backendMode = isSupabaseConfigured ? 'supabase' : 'local'
