import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cjlnkjnlpzdjxkazrpix.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_MLVsNZHi4L1sfSv-P5J8wQ_EY8AYB3W';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
