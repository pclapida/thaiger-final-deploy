import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isValidUrl = (url) => {
  try {
    return Boolean(url && new URL(url));
  } catch {
    return false;
  }
};

const supabaseUrl = isValidUrl(rawUrl) ? rawUrl : 'https://placeholder-project.supabase.co';
const supabaseAnonKey = rawKey && rawKey !== 'TU_SUPABASE_ANON_KEY' ? rawKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder_anon_key';

export const isSupabaseConfigured = isValidUrl(rawUrl) && Boolean(rawKey && rawKey !== 'TU_SUPABASE_ANON_KEY');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

