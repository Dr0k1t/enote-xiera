/// <reference path="./types.js" />
import { CONFIG } from './config.js';
import { supabase } from './supabase.js';
import { clearAllOfflineData } from './offline.js';

const SESSION_KEY = CONFIG.storagePrefix + 'session';

export async function login(email, password) {
  if (!supabase) return { ok: false, error: 'Supabase no configurado' };

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
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { ok: true, session };
}

export async function logout() {
  try {
    if (supabase) await supabase.auth.signOut();
  } catch (err) {
    console.warn('supabase signOut failed:', err);
  }
  clearSession();
  // Limpiar IndexedDB para evitar PII residual entre usuarios en dispositivos compartidos
  await clearAllOfflineData().catch(() => {});
}

/**
 * Helper de autorización: defensa en profundidad sobre RLS.
 */
export function canModifyNote(session, note) {
  if (!session || !note) return false;
  if (session.role === 'admin') return true;
  if (session.role === 'sucursal' &&
      (note.destino === session.destino || note.creadoPor === session.username)) return true;
  if (session.role === 'planta' && note.destino === session.destino) return true;
  if (session.role === 'repartidor') return true;
  return false;
}

export function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}

export function setSession(session) {
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

export async function getCurrentUser() {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session ? getSession() : null;
  } catch {
    return getSession();
  }
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
