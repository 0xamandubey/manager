import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if credentials are placeholders
const isConfigured = 
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your-project-ref') && 
  !supabaseAnonKey.includes('your-anon-key');

console.log('[Diagnostic] Supabase URL:', supabaseUrl);
console.log('[Diagnostic] Supabase Anon Key exists:', !!supabaseAnonKey);
console.log('[Diagnostic] Is Configured:', isConfigured);

export const supabase = createClient(
  isConfigured ? supabaseUrl : 'https://placeholder-project.supabase.co',
  isConfigured ? supabaseAnonKey : 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

export function isSupabaseConfigured(): boolean {
  return !!isConfigured;
}
