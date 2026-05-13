import { CONFIG } from './config.js';

const P = CONFIG.storagePrefix;
const SESSION_KEY = P + 'session';

export function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}

export function setSession(user) {
  const session = { username: user.username, role: user.role, destino: user.destino, loginAt: new Date().toISOString() };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function login(username, password) {
  const user = CONFIG.users.find(u => u.username === username && u.password === password);
  if (!user) return { ok: false, error: 'Usuario o contraseña incorrectos' };
  const session = setSession(user);
  return { ok: true, session };
}

export function requireAuth() {
  return getSession();
}

export function canCreate(session) { return CONFIG.roles[session.role]?.canCreate ?? false; }
export function canEdit(session)   { return CONFIG.roles[session.role]?.canEdit   ?? false; }
export function canDelete(session) { return CONFIG.roles[session.role]?.canDelete ?? false; }
export function canSeeAll(session) { return CONFIG.roles[session.role]?.canSeeAll ?? false; }
