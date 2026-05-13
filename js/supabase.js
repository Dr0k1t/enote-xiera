import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://ovlhabedefwbajrnfpup.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92bGhhYmVkZWZ3YmFqcm5mcHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NjA5MTgsImV4cCI6MjA5NDIzNjkxOH0.773DrsxjtbCLgLo1Z4Z6EHBJGeBFUihYUFH_fXo3DgQ';

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export function isSupabaseConfigured() {
  return !!supabase;
}