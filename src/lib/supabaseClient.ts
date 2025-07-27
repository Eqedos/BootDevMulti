import { createClient } from '@supabase/supabase-js';
import CONFIG from '../config';
import { chromeStorage, localStorageFallback } from './storage';

const isExt = typeof chrome !== 'undefined' && !!chrome.storage?.local;

export const supabase = createClient(
  CONFIG.SUPABASE.URL!,
  CONFIG.SUPABASE.ANON_KEY!,
  {
    auth: {
      storage: isExt ? chromeStorage : localStorageFallback,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  }
);
