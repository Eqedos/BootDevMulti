import { supabase } from './lib/supabaseClient';
import './styles/index.css';
import { User } from '@supabase/supabase-js';

const signedInView = document.getElementById('signed-in-view');
const signedOutView = document.getElementById('signed-out-view');

const emailInput = document.getElementById('email-input') as HTMLInputElement;
const passwordInput = document.getElementById('password-input') as HTMLInputElement;
const loginButton = document.getElementById('login-button');
const signupButton = document.getElementById('signup-button');
const errorMessage = document.getElementById('error-message');

const userInfo = document.getElementById('user-info');
const signOutButton = document.getElementById('sign-out-button');

const versusButton = document.getElementById('versus-button');
const coopButton = document.getElementById('coop-button');
const joinCodeInput = document.getElementById('join-code-input') as HTMLInputElement;
const joinButton = document.getElementById('join-button');

let currentRoomCode: string = '';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function initializeRoom(): void {
  currentRoomCode = generateRoomCode();
  displayRoomCode();
}

function displayRoomCode(): void {
  const roomCodeContainer = document.getElementById('room-code-container');
  if (roomCodeContainer) {
    roomCodeContainer.innerHTML = `
      <div class="room-code-section">
        <p class="room-code-label">share this code:</p>
        <p class="room-code">${currentRoomCode}</p>
      </div>
    `;
  }
}

function handleJoinRoom(): void {
  const code = joinCodeInput?.value.toUpperCase().trim();

// TODO: implement room joining logic 
  if (!code) {
    alert('Please enter a room code.');
    return;
  }
  
  if (code.length !== 5) {
    alert('Room code must be 5 letters.');
    return;
  }
  
  if (code === currentRoomCode) {
    alert('You cannot join your own session.');
    return;
  }
  
  alert(`Attempting to join room: ${code}`);
  
  if (joinCodeInput) {
    joinCodeInput.value = '';
  }
}

const handleAuthAction = async (action: 'signUp' | 'signInWithPassword') => {
  if (!emailInput.value || !passwordInput.value) {
    errorMessage!.textContent = 'Email and password are required.';
    return;
  }
  errorMessage!.textContent = '';

  const { error } = await supabase.auth[action]({
    email: emailInput.value,
    password: passwordInput.value,
  });

  if (error) {
    errorMessage!.textContent = error.message;
  } else if (action === 'signUp') {
    errorMessage!.textContent = 'Success! Check your email to confirm your account.';
  }
};

loginButton?.addEventListener('click', () => handleAuthAction('signInWithPassword'));
signupButton?.addEventListener('click', () => handleAuthAction('signUp'));
signOutButton?.addEventListener('click', () => supabase.auth.signOut());
joinButton?.addEventListener('click', handleJoinRoom);

joinCodeInput?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    handleJoinRoom();
  }
});

joinCodeInput?.addEventListener('input', (e) => {
  const target = e.target as HTMLInputElement;
  target.value = target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
});

versusButton?.addEventListener('click', () => { 
  window.location.href = 'versus.html';
});

coopButton?.addEventListener('click', () => { 
  window.location.href = 'coop.html';
});

const startGameButton = document.getElementById('start-game-btn');
startGameButton?.addEventListener('click', () => {
  window.location.href = 'game.html';
});

const updateUserUI = (user: User | null) => {
  if (user) {
    signedInView?.classList.remove('hidden');
    signedOutView?.classList.add('hidden');
    userInfo!.textContent = `Logged in as: ${user.email}`;
  } else {
    signedInView?.classList.add('hidden');
    signedOutView?.classList.remove('hidden');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const currentPage = window.location.pathname;
  if (currentPage.includes('coop.html') || currentPage.includes('versus.html')) {
    initializeRoom();
  }
});

supabase.auth.onAuthStateChange((_event, session) => {
  updateUserUI(session?.user ?? null);
});