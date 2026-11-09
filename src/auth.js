// MediaSpine Supabase Authentication & Activity Tracker
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wbnvjyfiegjsogvopyhz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_b_29-i9UjA3fpGV91NH3Ew_VIcfZKL7';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseClient = supabase;

export function showAuthToast(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'position:fixed; bottom:24px; right:24px; z-index:999; padding:12px 18px; border-radius:6px; background:#0F172A; color:#FFFFFF; font-size:13px; font-family:var(--font-mono); box-shadow:0 4px 16px rgba(0,0,0,0.2);';
  el.setAttribute('role', 'status');
  document.body.appendChild(el);
  setTimeout(() => { el.remove(); }, 3500);
}
window.showAuthToast = showAuthToast;

export async function signInWithGoogle() {
  const authBtn = document.getElementById('authBtn');
  if (authBtn) authBtn.disabled = true;
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) {
      showAuthToast('Sign-in error: ' + error.message);
      if (authBtn) authBtn.disabled = false;
    }
  } catch (err) {
    if (authBtn) authBtn.disabled = false;
  }
}
window.signInWithGoogle = signInWithGoogle;

export async function signOutUser() {
  await supabase.auth.signOut();
  window.location.reload();
}
window.signOutUser = signOutUser;

export function updateAuthUI(session) {
  const user = session?.user;
  window.currentUser = user || null;
  const authBtn = document.getElementById('authBtn');
  const userMenu = document.getElementById('userMenu');
  const userEmail = document.getElementById('userEmail');
  const userAvatar = document.getElementById('userAvatar');
  const progressNav = document.getElementById('progressNav');

  if (user) {
    if (authBtn) authBtn.style.display = 'none';
    if (userMenu) userMenu.style.display = 'inline-flex';
    const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'My Account';
    if (userEmail) userEmail.textContent = displayName;
    if (userAvatar && user.user_metadata?.avatar_url) {
      userAvatar.src = user.user_metadata.avatar_url;
      userAvatar.style.display = 'inline-block';
    }
    if (progressNav) progressNav.style.display = 'inline-block';
    if (typeof window.loadProgressData === 'function') {
      window.loadProgressData();
    }
  } else {
    if (authBtn) authBtn.style.display = 'inline-flex';
    if (userMenu) userMenu.style.display = 'none';
  }
}

export async function pingActivity(session) {
  if (!session || !session.user) return;
  try {
    await fetch('/api/activity', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
  } catch (e) {}

  if (typeof window.loadProgressData === 'function') {
    window.loadProgressData();
  }
}

export function initAuth() {
  supabase.auth.onAuthStateChange((event, session) => {
    updateAuthUI(session);
    if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) pingActivity(session);
  });
}
