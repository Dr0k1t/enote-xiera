import { CONFIG } from './config.js';
import { supabase, isSupabaseConfigured } from './supabase.js';

const P = CONFIG.storagePrefix;
const SESSION_KEY = P + 'session';
const DEMO_MODE_KEY = P + 'demo_mode';

export function isDemoMode() {
  return !isSupabaseConfigured() || localStorage.getItem(DEMO_MODE_KEY) === 'true';
}

export async function login(email, password) {
  if (isDemoMode()) {
    return loginDemo(email, password);
  }
  return loginSupabase(email, password);
}

export async function loginSupabase(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profileError) return { ok: false, error: 'Perfil no encontrado' };

  const session = {
    userId: data.user.id,
    username: profile.username,
    role: profile.role,
    destino: profile.destino,
    email: data.user.email,
    loginAt: new Date().toISOString(),
    supabase: true,
  };
  setSession(session);
  return { ok: true, session };
}

export function loginDemo(username, password) {
  const user = CONFIG.users.find(u => u.username === username && u.password === password);
  if (!user) return { ok: false, error: 'Usuario o contraseña incorrectos' };
  const session = setSession(user);
  return { ok: true, session };
}

export async function logout() {
  if (!isDemoMode() && supabase) {
    await supabase.auth.signOut();
  }
  clearSession();
}

export function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}

export function setSession(user) {
  const session = {
    username: user.username,
    role: user.role,
    destino: user.destino,
    email: user.email,
    userId: user.userId,
    loginAt: new Date().toISOString(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function requireAuth() {
  return getSession();
}

export function canCreate(session) { return CONFIG.roles[session?.role]?.canCreate ?? false; }
export function canEdit(session)   { return CONFIG.roles[session?.role]?.canEdit   ?? false; }
export function canDelete(session) { return CONFIG.roles[session?.role]?.canDelete ?? false; }
export function canSeeAll(session) { return CONFIG.roles[session?.role]?.canSeeAll ?? false; }

export function enableDemoMode() {
  localStorage.setItem(DEMO_MODE_KEY, 'true');
}

export function disableDemoMode() {
  localStorage.removeItem(DEMO_MODE_KEY);
}

export async function getCurrentUser() {
  if (isDemoMode()) return getSession();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session ? getSession() : null;
}

export async function onAuthStateChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      const profile = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      callback({ ...profile.data, email: session.user.email });
    } else {
      callback(null);
    }
  });
  return () => data.subscription.unsubscribe();
}