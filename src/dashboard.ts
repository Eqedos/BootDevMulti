import { supabase } from './lib/supabaseClient';
import { createRoomForCourse, joinRoomByCode } from './lib/rooms';

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
    const courseUrl = new URL(card.href);
    const courseId = courseUrl.pathname.split('/').filter(Boolean).pop() || null;

    if (!card.hasAttribute('data-logged')) {
      console.log(`Found Course -> Title: "${courseTitle}", ID: ${courseId}`);
      card.setAttribute('data-logged', 'true');
    }

    const injectionPoint = card.querySelector<HTMLDivElement>('.ml-2.flex-1');
    if (!injectionPoint || card.querySelector('.custom-button-container')) return;

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'custom-button-container flex items-center gap-3 mt-4';

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
        const room = await createRoomForCourse(courseId, courseTitle, true);
        alert(`Room created! Code: ${room.room_code}`);
      } catch (err: any) {
        console.error(err);
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
        const room = await joinRoomByCode(code);
        alert(`Joined room ${room.room_code}`);
      } catch (err: any) {
        console.error(err);
        if (err?.message) alert(err.message);
      }
    });

    buttonContainer.appendChild(createBtn);
    buttonContainer.appendChild(joinBtn);
    injectionPoint.appendChild(buttonContainer);
  });
}

export function initDashboardFeatures(): void {
  console.log('Dashboard features initializing...');
  console.log('Avatar:', extractUserAvatar());
  console.log('Name:', extractUserName());

  const observer = new MutationObserver(() => injectActionButtons());
  observer.observe(document.body, { childList: true, subtree: true });
  injectActionButtons();
}
