
import { buildProgressSnapshot } from './lib/progress';
import {
  upsertPlayerProgress,
  getRoomMembers,
  subscribeRoom,
  PlayerRow,
} from './lib/rooms';

let currentRoomId: string | null = null;
let lessonId: string | null = null;

let unsubscribeRoom: (() => void) | null = null;

let navRoot: HTMLDivElement | null = null;
let navPanel: HTMLDivElement | null = null;
let tableBody: HTMLTableSectionElement | null = null;

let pollTimer: number | null = null;
const POLL_MS = 10_000; // 10s polling

const DEBUG = true;

export async function initLessonFeatures(): Promise<void> {
  dlog('INIT', 'Lesson features initializing (poll mode)...');

  lessonId = getLessonIdFromPath();
  if (!lessonId) {
    derror('INIT', 'Could not extract lesson ID from URL.');
    return;
  }
  dlog('INIT', 'lessonId:', lessonId);

  currentRoomId = await getActiveRoomId();
  dlog('INIT', 'activeRoomId from chrome.storage:', currentRoomId);

  (window as any).BDB_forceSync = syncProgress;

  await syncProgress(); 

  if (currentRoomId) {
    await injectNavbarLeaderboard(currentRoomId);
  } else {
    dlog('INIT', 'No room → not injecting leaderboard');
  }

  startPolling();
  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('beforeunload', cleanup);
}

function startPolling() {
  stopPolling();
  if (document.hidden) {
    dlog('POLL', 'Tab hidden; skipping startPolling');
    return;
  }
  pollTimer = window.setInterval(syncProgress, POLL_MS);
  dlog('POLL', `Polling started every ${POLL_MS}ms`);
}

function stopPolling() {
  if (pollTimer) {
    window.clearInterval(pollTimer);
    pollTimer = null;
    dlog('POLL', 'Polling stopped');
  }
}

function handleVisibility() {
  if (document.hidden) {
    dlog('VISIBILITY', 'hidden → stop polling');
    stopPolling();
  } else {
    dlog('VISIBILITY', 'visible → immediate sync + restart polling');
    syncProgress();
    startPolling();
  }
}

async function syncProgress() {
  if (!lessonId) return;
  (window as any).__BDB_LAST_SYNC_AT = Date.now();

  const ts = tsNow();
  dgroup(`SYNC @ ${ts}`);

  try {
    dlog('SYNC', 'Calling buildProgressSnapshot with lessonId:', lessonId);
    const { snapshot, score } = await buildProgressSnapshot(lessonId);

    dlog('SYNC', 'Raw snapshot object:');
    console.dir(snapshot);
    dlog('SYNC', `done=${snapshot.done}, total=${snapshot.total}`);
    dlog('SYNC', `Calculated score = Math.round(done/total*100) = ${score}`);

    if (snapshot.chapters?.length) {
      dlog('SYNC', 'Per-chapter breakdown (done/total):');
      console.table(
        snapshot.chapters.map((c: any) => ({
          title: c.title,
          done: c.done,
          total: c.total,
          pct: c.total ? Math.round((c.done / c.total) * 100) : 0,
        }))
      );
    }

    if (currentRoomId) {
      dlog('SYNC', 'Upserting progress for room:', currentRoomId);
      try {
        const row = await upsertPlayerProgress(currentRoomId, snapshot, score);
        dlog('SYNC', 'upsertPlayerProgress returned row:');
        console.dir(row);

        if (tableBody) {
          dlog('SYNC', 'Refreshing members for leaderboard...');
          const members = await getRoomMembers(currentRoomId);
          renderRows(members);
        }
      } catch (e: any) {
        derror('SYNC', 'upsert failed:', e?.message || e);
      }
    } else {
      dlog('SYNC', 'No active room → skip upsert');
    }
  } catch (err: any) {
    derror('SYNC', 'buildProgressSnapshot error:', err?.message || err);
  }

  dendgroup();
}

async function injectNavbarLeaderboard(roomId: string) {
  dlog('LB', 'Injecting navbar leaderboard for room:', roomId);
  destroyLeaderboard();

  navRoot = document.createElement('div');
  navRoot.id = 'bdb-nav';
  navRoot.innerHTML = `
    <div id="bdb-nav-toggle" class="bdb-toggle">⚔︎ Leaderboard</div>
    <div id="bdb-nav-panel" class="bdb-panel">
      <table class="bdb-table">
        <thead>
          <tr><th>#</th><th>Player</th><th>Score</th></tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;
  document.body.appendChild(navRoot);

  navPanel  = navRoot.querySelector('#bdb-nav-panel') as HTMLDivElement;
  tableBody = navRoot.querySelector('tbody') as HTMLTableSectionElement;

  ensureNavbarStyle();

  const toggle = navRoot.querySelector('#bdb-nav-toggle') as HTMLElement;
  toggle.onclick = () => {
    navRoot!.classList.toggle('open');
  };

  try {
    const members = await getRoomMembers(roomId);
    dlog('LB', 'Initial members loaded:', members.length);
    renderRows(members);
  } catch (e) {
    derror('LB', 'load members failed:', e);
  }

  unsubscribeRoom = subscribeRoom(
    roomId,
    () => { /* meta changes ignored here */ },
    async () => {
      try {
        const m = await getRoomMembers(roomId);
        dlog('LB', 'Realtime players update, count:', m.length);
        renderRows(m);
      } catch (e) {
        derror('LB', 'realtime reload failed:', e);
      }
    }
  );
  dlog('LB', 'Subscribed to room realtime:', roomId);
}

function renderRows(members: PlayerRow[]) {
  if (!tableBody) return;
  const rows = members
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .map((m, i) => `
      <tr>
        <td>${i + 1}</td>
        <td title="${m.player_id}">${escapeHtml(m.display_name || m.player_id.slice(0, 8))}</td>
        <td>${m.score ?? 0}</td>
      </tr>
    `)
    .join('');
  tableBody.innerHTML =
    rows || `<tr><td colspan="3" style="opacity:.6;">no players</td></tr>`;
}

function destroyLeaderboard() {
  if (unsubscribeRoom) { unsubscribeRoom(); unsubscribeRoom = null; }
  if (navRoot && navRoot.parentNode) navRoot.parentNode.removeChild(navRoot);
  navRoot = null;
  navPanel = null;
  tableBody = null;
}

function ensureNavbarStyle() {
  if (document.getElementById('bdb-navbar-style')) return;
  const style = document.createElement('style');
  style.id = 'bdb-navbar-style';
  style.textContent = `
#bdb-nav{
  position:fixed;
  bottom:150px;
  right:0;
  z-index:999999;
  font-family:'ArcuataTrial',system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  display:flex;
  flex-direction:column;
}
#bdb-nav .bdb-toggle{
  background:#171C28 !important;
  color:#fff !important;
  padding:6px 10px;
  border-radius:8px;
  cursor:pointer;
  font-size:12px;
  font-family:'ArcuataTrial',system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  font-weight:600;
  box-shadow:0 2px 6px rgba(0,0,0,.2);
  border:none;
  user-select:none;
  min-width:100px;
}
#bdb-nav .bdb-panel{
  width:260px;
  max-height:70vh;
  overflow:auto;
  background:#171C28 !important;
  box-shadow:0 2px 10px rgba(0,0,0,.15);
  border-radius:0 0 8px 8px;
  opacity:0;
  visibility:hidden;
  transform:translateY(-10px);
  transition:opacity .25s ease, visibility .25s ease, transform .25s ease;
}
#bdb-nav.open .bdb-panel{
  opacity:1;
  visibility:visible;
  transform:translateY(0);
}
#bdb-nav.open .bdb-toggle{
  border-radius:8px 8px 0 0;
}
#bdb-nav .bdb-table{
  width:100%;
  border-collapse:collapse;
  font-size:12px;
  color:#fff !important;
}
#bdb-nav .bdb-table th,
#bdb-nav .bdb-table td{
  padding:4px 6px;
  border-bottom:1px solid #3d4450;
  text-align:left;
  color:#fff !important;
}
#bdb-nav .bdb-table thead{
  background:#2a2f3a !important;
  position:sticky;
  top:0;
  color:#fff !important;
}
#bdb-nav, #bdb-nav *{
  color:#fff !important;
}
`;
  document.head.appendChild(style);
}

function getLessonIdFromPath(): string | null {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts.pop() || null;
}

function getActiveRoomId(): Promise<string | null> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return Promise.resolve(null);
  return new Promise(resolve => {
    chrome.storage.local.get('activeRoomId', r => resolve(r.activeRoomId ?? null));
  });
}

function cleanup() {
  stopPolling();
  document.removeEventListener('visibilitychange', handleVisibility);
  destroyLeaderboard();
  dlog('CLEANUP', 'unloaded');
}

function dlog(scope: string, ...args: any[]) {
  if (!DEBUG) return;
}
function derror(scope: string, ...args: any[]) {
  if (!DEBUG) return;
  console.error(`[BDB:${scope} ERROR]`, ...args);
}
function tsNow() {
  return new Date().toLocaleTimeString();
}
function dgroup(label: string) {
  if (!DEBUG) return;
  console.group(label);
}
function dendgroup() {
  if (!DEBUG) return;
  console.groupEnd();
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!
  ));
}
