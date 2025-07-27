
import { supabase } from './lib/supabaseClient';
import { initDashboardFeatures } from './dashboard';
import { initLessonFeatures } from './lessons';

const path = window.location.pathname;

let hookInjected = false;
function injectPageHook() {
  if (hookInjected) return;
  hookInjected = true;
  const url = chrome.runtime.getURL('pageHook.js');
  const s = document.createElement('script');
  s.src = url;
  s.onload = () => s.remove();
  (document.head || document.documentElement).appendChild(s);
}

window.addEventListener('message', e => {
  if (e.data?.type === 'BDB_BOOTDEV_TOKEN') {
    chrome.storage.local.set({ bootdevJWT: e.data.token });
  }
});

injectPageHook();

(async () => {
  try {
    if (path === '/dashboard' || path.startsWith('/dashboard/')) {
      initDashboardFeatures();
    } else if (path.includes('/lessons/')) {
      await initLessonFeatures();
    } else {
    }
  } catch (e) {
    console.error('[BDB] Error running feature init:', e);
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) console.error('[BDB] getUser error:', error);
  } catch (e) {
    console.error('[BDB] Unexpected getUser error:', e);
  }

  supabase.auth.onAuthStateChange((event, session) => {
  });
})();
