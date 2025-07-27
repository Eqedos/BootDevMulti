import { supabase } from './lib/supabaseClient';
import {
  createRoomForCourse,
  joinRoomByCode,
} from './lib/rooms';

function extractUserAvatar(): string | null {
  const avatarImg = document.querySelector<HTMLImageElement>('img[alt="user avatar"]');
  return avatarImg?.src || null;
}

function extractUserName(): string {
  const selectors = [
    'button[aria-label*="Profile"]',
    '[data-testid="user-menu"]',
    '.user-menu',
    'nav img[alt="user avatar"]',
  ];
  for (const s of selectors) {
    const el = document.querySelector(s);
    const text = el?.textContent?.trim();
    if (text && text !== 'Profile') return text;
  }
  return 'Player';
}

function sanitizeCode(v: string) {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function sanitizeName(v: string) {
  return v.trim().slice(0, 24); 
}

async function ensureSignedIn() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert('Please sign in first (via the extension popup).');
    throw new Error('Not signed in');
  }
  return user;
}

function injectActionButtons(): void {
  const courseCards = document.querySelectorAll<HTMLAnchorElement>('div.grid > a.block');

  courseCards.forEach(card => {
    const courseTitle = card.querySelector('h3')?.innerText ?? 'Unknown Course';
    const courseUrl   = new URL(card.href);
    const courseId    = courseUrl.pathname.split('/').filter(Boolean).pop() || null;

    if (!card.hasAttribute('data-bdb-logged')) {
      card.setAttribute('data-bdb-logged', 'true');
    }

    const injectionPoint = card.querySelector<HTMLDivElement>('.ml-2.flex-1');
    if (!injectionPoint || card.querySelector('.bdb-button-container')) return;

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'bdb-button-container flex items-center gap-3 mt-4';

    const createBtn = document.createElement('button');
    createBtn.innerText = 'Create Room';
    createBtn.className =
      'px-4 py-1 text-sm font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500';

    const joinBtn = document.createElement('button');
    joinBtn.innerText = 'Join Room';
    joinBtn.className =
      'px-4 py-1 text-sm font-semibold text-white bg-teal-600 rounded-md shadow-sm hover:bg-teal-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500';

    createBtn.addEventListener('click', async (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await ensureSignedIn();
        const raw = prompt('Pick a display name for this room:', extractUserName() || 'Player') || '';
        const display = sanitizeName(raw);
        if (!display) {
          alert('You must provide a name.');
          return;
        }
        const room = await createRoomForCourse(courseId, courseTitle, true, display); // <— pass it
        alert(`Room created! Code: ${room.room_code}`);
      } catch (err: any) {
        console.error('[BDB] create room error', err);
        if (err?.message) alert(err.message);
      }
    });
    

    joinBtn.addEventListener('click', async (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await ensureSignedIn();
        const code = sanitizeCode(prompt('Enter room code (6 chars):', '') || '');
        if (!code) return;
        if (code.length !== 6) {
          alert('Room code must be 6 characters.');
          return;
        }
        let name = sanitizeName(prompt('Pick a display name for this room:', extractUserName()) || '');
        if (!name) {
          alert('You must provide a name.');
          return;
        }
        const room = await joinRoomByCode(code, name);
        alert(`Joined room ${room.room_code} as "${name}"`);
      } catch (err: any) {
        console.error('[BDB] join room error', err);
        if (err?.message) alert(err.message);
      }
    });

    buttonContainer.appendChild(createBtn);
    buttonContainer.appendChild(joinBtn);
    injectionPoint.appendChild(buttonContainer);
  });
}

export function initDashboardFeatures(): void {

  const observer = new MutationObserver(() => injectActionButtons());
  observer.observe(document.body, { childList: true, subtree: true });

  injectActionButtons(); 
}
