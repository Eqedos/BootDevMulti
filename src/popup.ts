import { supabase } from './lib/supabaseClient';

console.log('Popup script loaded. Supabase instance:', supabase);

document.addEventListener('DOMContentLoaded', () => {
  const versusButton = document.getElementById('versus-button');
  const coopButton = document.getElementById('coop-button');

  if (versusButton) {
    versusButton.addEventListener('click', () => {
      window.location.href = 'versus.html';
    });
  }

  if (coopButton) {
    coopButton.addEventListener('click', () => {
      window.location.href = 'coop.html';
    });
  }
});
