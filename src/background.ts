import { supabase } from './lib/supabaseClient';
import {
  createRoomForCourse,
  joinRoomByCode,
} from './lib/rooms';

type Msg =
  | { type: 'GET_USER' }
  | { type: 'SIGN_OUT' }
  | { type: 'CREATE_ROOM'; courseId: string | null; courseName: string | null; isPrivate?: boolean }
  | { type: 'JOIN_ROOM'; code: string; name: string };

chrome.runtime.onInstalled.addListener(() => {
  console.log('[BDB:bg] installed');
});

chrome.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {
        case 'GET_USER': {
          const { data: { user }, error } = await supabase.auth.getUser();
          if (error) throw error;
          sendResponse({ user });
          break;
        }

        case 'SIGN_OUT': {
          await supabase.auth.signOut();
          sendResponse({ ok: true });
          break;
        }

        case 'CREATE_ROOM': {
          const room = await createRoomForCourse(
            msg.courseId,
            msg.courseName,
            msg.isPrivate ?? true
          );
          sendResponse({ room });
          break;
        }

        case 'JOIN_ROOM': {
          const room = await joinRoomByCode(msg.code, msg.name);
          sendResponse({ room });
          break;
        }

        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (err: any) {
      console.error('[BDB:bg] error', err);
      sendResponse({ error: err?.message || 'Unknown error' });
    }
  })();

  return true;
});

supabase.auth.onAuthStateChange((event, session) => {
  console.log('[BDB:bg] onAuthStateChange', event, session?.user?.id);
});
