export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const looksReal = (v) =>
  typeof v === "string" && v.length > 10 && !v.includes("your-");
export const isSupabaseConfigured =
  looksReal(SUPABASE_URL) && looksReal(SUPABASE_ANON_KEY);
