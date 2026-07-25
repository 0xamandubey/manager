import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qhgozdehdsesgbrrzgyq.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoZ296ZGVoZHNlc2dicnJ6Z3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MDYxMzYsImV4cCI6MjEwMDQ4MjEzNn0.WfNHWuheURR7cz_ZbiZdGRX3MsRLqcpQ_3wUtfXqFrg';

// Check if credentials are placeholders
const isConfigured = 
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your-project-ref') && 
  !supabaseAnonKey.includes('your-anon-key');

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
