import { createClient } from '@supabase/supabase-js';
import { resolveAuthRedirectUrl } from '../utils/authRedirect';

const SUPABASE_URL = 'https://ukgwipazzjstjkdfaozg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_CRMgURG899vqIqUIsADWgw_p90ZliES';
const SUPABASE_PROJECT_MARKER_KEY = 'tiya_supabase_project_ref';
const SUPABASE_PROJECT_REF = 'ukgwipazzjstjkdfaozg';

// Clear any old saved session once when switching Supabase projects so users log in fresh
if (typeof window !== 'undefined') {
  try {
    if (window.localStorage.getItem(SUPABASE_PROJECT_MARKER_KEY) !== SUPABASE_PROJECT_REF) {
      const clearPrefix = (storage: Storage) => {
        const keysToRemove: string[] = [];
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key && key.startsWith('sb-')) {
            keysToRemove.push(key);
          }
        }
        for (const key of keysToRemove) {
          storage.removeItem(key);
        }
      };

      clearPrefix(window.localStorage);
      clearPrefix(window.sessionStorage);
      window.localStorage.removeItem('tiya_birth_year_cache_v1');
      window.localStorage.setItem(SUPABASE_PROJECT_MARKER_KEY, SUPABASE_PROJECT_REF);
    }
  } catch {
    // Ignore storage access errors
  }
}

export function getAuthRedirectUrl(): string {
  return resolveAuthRedirectUrl();
}

const realSupabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** The demo admin page puts sample data in window.__roseDemoDb; everywhere else this is the real Supabase. */
export const supabase = new Proxy(realSupabase, {
  get(target, key) {
    const demo = typeof window !== 'undefined' ? (window as any).__roseDemoDb : null;
    const src = demo && key in demo ? demo : target;
    const v = (src as any)[key];
    return typeof v === 'function' ? v.bind(src) : v;
  },
}) as typeof realSupabase;
