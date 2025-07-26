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

versusButton?.addEventListener('click', () => { window.location.href = 'versus.html'; });
coopButton?.addEventListener('click', () => { window.location.href = 'coop.html'; });

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

supabase.auth.onAuthStateChange((_event, session) => {
  updateUserUI(session?.user ?? null);
});