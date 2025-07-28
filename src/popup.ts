// src/popup.ts
import './styles/index.css';
import { supabase } from './lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import {
  joinRoomByCode,
  getMyRooms,
  getRoomMembers,
  subscribeRooms,
  subscribeRoom,
  startRoom,
  finishRoom,
  deleteRoom,
  sendChatMessage,
  getChatHistory,
  subscribeChat,
  Room,
  PlayerRow,
  ChatMessage
} from './lib/rooms';

const signedInView   = document.getElementById('signed-in-view')  as HTMLElement;
const signedOutView  = document.getElementById('signed-out-view') as HTMLElement;

const emailInput     = document.getElementById('email-input')     as HTMLInputElement;
const passwordInput  = document.getElementById('password-input')  as HTMLInputElement;
const loginButton    = document.getElementById('login-button')    as HTMLButtonElement;
const signupButton   = document.getElementById('signup-button')   as HTMLButtonElement;
const errorMessage   = document.getElementById('error-message')   as HTMLElement;

const userInfo       = document.getElementById('user-info')       as HTMLElement;
const signOutButton  = document.getElementById('sign-out-button') as HTMLButtonElement;

const joinCodeInput  = document.getElementById('join-code-input') as HTMLInputElement;
const joinButton     = document.getElementById('join-button')     as HTMLButtonElement;

const myRoomsList    = document.getElementById('my-rooms-list')   as HTMLElement;

let roomDetail = document.getElementById('room-detail') as HTMLElement | null;
if (!roomDetail) {
  roomDetail = document.createElement('div');
  roomDetail.id = 'room-detail';
  roomDetail.className = 'room-detail hidden';
  myRoomsList?.parentElement?.appendChild(roomDetail);
}

let currentUser: User | null = null;
let currentRooms: Room[] = [];
let currentRoomId: string | null = null;

let unsubGlobal: (() => void) | null = null;
let unsubRoom:   (() => void) | null = null;
let unsubChat:   (() => void) | null = null;

let chatBoxEl: HTMLElement | null = null;
let nameMap = new Map<string, string>(); 

const showError    = (m: string) => (errorMessage.textContent = m || '');
const sanitizeCode = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
const fmt          = (d: string | null) => (d ? new Date(d).toLocaleString() : '—');
const cleanCourseName = (name: string) => {
  if (!name) return '—';
  return name.replace(/^\d+\.\s+/, '');
};
const HAS_CHROME   = typeof chrome !== 'undefined' && !!chrome.storage?.local;

function setActiveRoomId(id: string | null) {
  if (!HAS_CHROME) return;
  if (id) chrome.storage.local.set({ activeRoomId: id });
  else    chrome.storage.local.remove('activeRoomId');
}

function updateUserUI(user: User | null) {
  currentUser = user;
  if (user) {
    signedInView.classList.remove('hidden');
    signedOutView.classList.add('hidden');
    userInfo.textContent = `Logged in as: ${user.email}`;
    initGlobalRealtime();
    loadRooms();
  } else {
    signedInView.classList.add('hidden');
    signedOutView.classList.remove('hidden');
    userInfo.textContent = '';
    myRoomsList.innerHTML = '';
    closeRoomDetail();
    if (unsubGlobal) { unsubGlobal(); unsubGlobal = null; }
    if (unsubRoom)   { unsubRoom();   unsubRoom   = null; }
    if (unsubChat)   { unsubChat();   unsubChat   = null; }
    setActiveRoomId(null);
  }
}

async function loadRooms() {
  try {
    currentRooms = await getMyRooms();
    renderRooms(currentRooms);

    if (currentRoomId) {
      const stillExists = currentRooms.find(r => r.id === currentRoomId);
      if (!stillExists) closeRoomDetail();
      else               openRoomDetail(currentRoomId);
    }
  } catch (e) {
    console.error(e);
  }
}

function renderRooms(rooms: Room[]) {
  myRoomsList.innerHTML = '';
  if (!rooms.length) {
    myRoomsList.innerHTML = '<p style="font-size:12px;opacity:.6;text-align:center;margin-top:12px;">no rooms yet</p>';
    return;
  }

  rooms.forEach(r => {
    const div = document.createElement('div');
    div.className = 'room-card';
    div.dataset.roomId = r.id;
    div.innerHTML = `
      <div class="room-title">
        <span class="course-name">${cleanCourseName(r.course_name || '')}</span>
        <div class="room-tags">
          ${r.finished_at ? '<span class="tag done">🏁</span>' : 
            r.started_at ? '<span class="tag lock">⚔️</span>' : 
            '<span class="tag waiting">🔔</span>'}
        </div>
      </div>
      <div class="room-info">
        <span class="created-label">Created: ${fmt(r.created_at)}</span>
      </div>
      <div class="room-actions">
        <button class="form-button xs" data-action="detail" data-id="${r.id}">view</button>
        <button class="form-button xs" data-action="copy"   data-id="${r.id}">copy code</button>
      </div>
    `;
    myRoomsList.appendChild(div);
  });
}

myRoomsList.addEventListener('click', e => {
  const t   = e.target as HTMLElement;
  const act = t.getAttribute('data-action');
  const id  = t.getAttribute('data-id');
  if (!act || !id) return;

  if (act === 'detail') {
    openRoomDetail(id);
  } else if (act === 'copy') {
    const room = currentRooms.find(r => r.id === id);
    if (room?.room_code) {
      navigator.clipboard?.writeText(room.room_code).catch(() => {});
      alert(`Copied: ${room.room_code}`);
    }
  }
});

async function openRoomDetail(roomId: string) {
  currentRoomId = roomId;
  setActiveRoomId(roomId);

  if (unsubRoom) { unsubRoom(); unsubRoom = null; }
  if (unsubChat) { unsubChat(); unsubChat = null; chatBoxEl = null; }

  const room = currentRooms.find(r => r.id === roomId);
  if (!room) return;

  roomDetail!.classList.remove('hidden');
  roomDetail!.innerHTML = '<p style="font-size:12px;opacity:.6;">loading…</p>';

  try {
    const members = await getRoomMembers(roomId);
    renderRoomDetail(room, members);
  } catch (e) {
    console.error(e);
    roomDetail!.innerHTML = '<p style="color:red;">failed to load room</p>';
    return;
  }

  unsubRoom = subscribeRoom(
    roomId,
    payload => updateRoomMeta(payload.new as Room),
    async () => {
      if (currentRoomId !== roomId) return;
      try {
        const m = await getRoomMembers(roomId);
        renderMembersTable(m);
      } catch (e) {
        console.error(e);
      }
    }
  );
}

function closeRoomDetail() {
  currentRoomId = null;
  setActiveRoomId(null);
  if (unsubRoom) { unsubRoom(); unsubRoom = null; }
  if (unsubChat) { unsubChat(); unsubChat = null; }
  chatBoxEl = null;
  nameMap.clear();

  roomDetail!.classList.add('hidden');
  roomDetail!.innerHTML = '';
}

function renderRoomDetail(room: Room, members: PlayerRow[]) {
  const isAdmin   = currentUser?.id === room.admin_id;
  const canStart  = isAdmin && !room.started_at && !room.finished_at;
  const canFinish = isAdmin && room.started_at && !room.finished_at;

  rebuildNameMap(members);

  roomDetail!.innerHTML = `
    <div class="detail-header">
      <button id="close-detail">&larr;</button>
      <div class="header-spacer"></div>
      <span class="room-code-label"><span class="room-text">Room:</span> <span class="room-code-value">${room.room_code}</span></span>
    </div>

    <div class="detail-meta">
      <div class="meta-row"><span class="meta-label">Created:</span> <span class="meta-value" data-meta="created">${fmt(room.created_at)}</span></div>
      <div class="meta-row"><span class="meta-label">Started:</span> <span class="meta-value" data-meta="started">${fmt(room.started_at)}</span></div>
      <div class="meta-row"><span class="meta-label">Finished:</span> <span class="meta-value" data-meta="finished">${fmt(room.finished_at)}</span></div>
    </div>

    <div class="detail-actions">
      ${canStart  ? `<button class="form-button xs green"  id="start-room">Start</button>`   : ''}
      ${canFinish ? `<button class="form-button xs green"  id="finish-room">Finish</button>` : ''}
      ${isAdmin   ? `<button class="form-button xs danger" id="delete-room">Delete</button>` : ''}
    </div>

    <div class="section-divider"></div>
    <h4 class="leaderboard-title">Leaderboard</h4>
    <table class="members-table">
      <thead><tr><th>Place</th><th>Player</th><th>Score</th></tr></thead>
      <tbody id="members-tbody"></tbody>
    </table>

    <div class="section-divider"></div>
    <h4 class="chat-title">Chat</h4>
    <div id="chat-box" class="chat-box"></div>
    <div class="chat-input-row">
      <input id="chat-input" class="chat-input" placeholder="type a message…"/>
      <button id="chat-send" class="form-button xs chat-send-button">Send</button>
    </div>
  `;

  document.getElementById('close-detail')?.addEventListener('click', closeRoomDetail);
  document.getElementById('start-room')?.addEventListener('click', async () => {
    try { await startRoom(room.id); } catch (e:any) { alert(e.message || 'failed'); }
  });
  document.getElementById('finish-room')?.addEventListener('click', async () => {
    try {
      const res = await finishRoom(room.id);
      const winnerName = res.winnerId ? (nameMap.get(res.winnerId) || res.winnerId.slice(0,8)) : 'none';
      alert(`Room finished. Winner: ${winnerName}`);
    } catch (e:any) { alert(e.message || 'failed'); }
  });
  document.getElementById('delete-room')?.addEventListener('click', async () => {
    if (!confirm('Delete this room? This cannot be undone.')) return;
    try {
      await deleteRoom(room.id);
      closeRoomDetail();
      loadRooms();
    } catch (e:any) { alert(e.message || 'failed'); }
  });

  renderMembersTable(members);
  setupChat(room.id);
}

function renderMembersTable(members: PlayerRow[]) {
  const tbody = roomDetail!.querySelector('#members-tbody') as HTMLTableSectionElement;
  if (!tbody) return;

  rebuildNameMap(members);

  const rows = members
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .map((m, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${nameMap.get(m.player_id)}</td>
        <td>${m.score ?? 0}</td>
      </tr>
    `).join('');

  tbody.innerHTML = rows || '<tr><td colspan="3" style="opacity:.6;">no members</td></tr>';
}

function rebuildNameMap(members: PlayerRow[]) {
  nameMap.clear();
  members.forEach(m => {
    nameMap.set(m.player_id, m.display_name || m.player_id.slice(0, 8));
  });
}

function updateRoomMeta(r: Room) {
  const root = roomDetail!;
  const set = (key: string, txt: string) => {
    const el = root.querySelector(`[data-meta="${key}"]`);
    if (el) el.textContent = txt;
  };
  set('created',  fmt(r.created_at));
  set('started',  fmt(r.started_at));
  set('finished', fmt(r.finished_at));
}

function initGlobalRealtime() {
  if (unsubGlobal) return;
  unsubGlobal = subscribeRooms(() => loadRooms());
}

async function handleAuth(action: 'signUp' | 'signInWithPassword') {
  if (!emailInput.value || !passwordInput.value) {
    showError('Email and password are required.');
    return;
  }
  showError('');
  const { error } = await supabase.auth[action]({
    email: emailInput.value,
    password: passwordInput.value,
  });
  if (error) showError(error.message);
  else if (action === 'signUp') showError('Success! Check your email to confirm your account.');
}

loginButton?.addEventListener('click', () => handleAuth('signInWithPassword'));
signupButton?.addEventListener('click', () => handleAuth('signUp'));
signOutButton?.addEventListener('click', async () => {
  await supabase.auth.signOut();
  chrome.storage.local.remove(['bootdevJWT', 'activeRoomId']);
});

joinButton?.addEventListener('click', async () => {
  const code = sanitizeCode(joinCodeInput.value);
  if (code.length !== 6) {
    alert('Room code must be 6 chars.');
    return;
  }
  const name = prompt('Pick a display name for this room:')?.trim();
  if (!name) {
    alert('You must provide a name.');
    return;
  }
  try {
    const room = await joinRoomByCode(code, name);
    alert(`Joined room ${room.room_code} as "${name}"`);
    joinCodeInput.value = '';
    loadRooms();
  } catch (e: any) {
    alert(e.message || 'Failed to join room');
  }
});

joinCodeInput?.addEventListener('input', e => {
  const t = e.target as HTMLInputElement;
  t.value = sanitizeCode(t.value);
});

supabase.auth.onAuthStateChange((_event, session) => {
  updateUserUI(session?.user ?? null);
});

(async () => {
  const { data: { user } } = await supabase.auth.getUser();
  updateUserUI(user ?? null);
})();

async function setupChat(roomId: string) {
  chatBoxEl = document.getElementById('chat-box') as HTMLElement;
  const input   = document.getElementById('chat-input') as HTMLInputElement;
  const sendBtn = document.getElementById('chat-send')  as HTMLButtonElement;

  try {
    const history = await getChatHistory(roomId, 100);
    chatBoxEl.innerHTML = history.map(renderMsg).join('');
    chatBoxEl.scrollTop = chatBoxEl.scrollHeight;
  } catch {
    chatBoxEl.innerHTML = '<p style="color:red;font-size:12px;">chat load failed</p>';
  }

  if (unsubChat) unsubChat();
  unsubChat = subscribeChat(roomId, msg => appendMsg(msg));

  sendBtn.onclick = async () => {
    const txt = input.value.trim();
    if (!txt) return;
    input.value = '';
    try {
      const msg = await sendChatMessage(roomId, txt);
      appendMsg(msg);
    } catch (e:any) {
      alert(e.message || 'send failed');
    }
  };
  input.addEventListener('keypress', e => { if (e.key === 'Enter') sendBtn.click(); });
}

function appendMsg(m: ChatMessage) {
  if (!chatBoxEl) return;
  chatBoxEl.insertAdjacentHTML('beforeend', renderMsg(m));
  chatBoxEl.scrollTop = chatBoxEl.scrollHeight;
}

function renderMsg(m: ChatMessage) {
  const mine = m.sender_id === currentUser?.id;
  const who  = mine ? 'You' : (nameMap.get(m.sender_id) || m.sender_id.slice(0, 8));
  const time = new Date(m.created_at).toLocaleTimeString();
  const userColorClass = getUserColorClass(m.sender_id);
  return `
    <div class="chat-line">
      <span class="chat-user ${userColorClass}">${escapeHtml(who)}:</span>
      <span class="chat-message">${escapeHtml(m.content)}</span>
      <span class="chat-time">${time}</span>
    </div>
  `;
}

function getUserColorClass(userId: string): string {
  const colors = ['user-color-1', 'user-color-2', 'user-color-3', 'user-color-4', 'user-color-5', 'user-color-6'];
  const hash = userId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  return colors[Math.abs(hash) % colors.length];
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!
  ));
}
