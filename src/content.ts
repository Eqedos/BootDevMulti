console.log('✅ BootDevBattle content script injected and running!');

import { supabase } from './lib/supabaseClient';
import { initDashboardFeatures } from './dashboard';
import { initLessonFeatures } from './lessons';

const path = window.location.pathname;
console.log('[BDB] Current path:', path);

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
    console.log('[BDB] JWT captured (ext):', e.data.token.slice(0, 16) + '…');
  }
});

injectPageHook();

(async () => {
  try {
    if (path === '/dashboard' || path.startsWith('/dashboard/')) {
      initDashboardFeatures();
      console.log('[BDB] Dashboard module initialized.');
    } else if (path.includes('/lessons/')) {
      await initLessonFeatures();
      console.log('[BDB] Lessons module initialized.');
    } else {
      console.log('[BDB] No feature module matched this path.');
    }
  } catch (e) {
    console.error('[BDB] Error running feature init:', e);
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) console.error('[BDB] getUser error:', error);
    else console.log('[BDB] User in content script:', user);
  } catch (e) {
    console.error('[BDB] Unexpected getUser error:', e);
  }

  supabase.auth.onAuthStateChange((event, session) => {
    console.log('[BDB] onAuthStateChange:', event, session?.user);
  });
})();
