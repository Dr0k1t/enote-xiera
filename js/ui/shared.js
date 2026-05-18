/// <reference path="../types.js" />
import { CONFIG } from '../config.js';
import { getImageFromCache } from '../offline.js';

// Tracking de blob URLs creadas con URL.createObjectURL para evitar leaks.
const _blobUrls = new Set();

/**
 * Revoca todas las blob URLs creadas vía resolveImageUrl.
 * Llamar antes de limpiar DOM que pudiera referenciarlas.
 */
export function revokeBlobUrls() {
  _blobUrls.forEach(url => URL.revokeObjectURL(url));
  _blobUrls.clear();
}

/**
 * Resuelve URL de imagen: si está en IndexedDB, devuelve blob URL temporal.
 */
export async function resolveImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;

  try {
    const record = await getImageFromCache(url);
    const blob = record?.blob;
    if (blob) {
      const blobUrl = URL.createObjectURL(blob);
      _blobUrls.add(blobUrl);
      return blobUrl;
    }
  } catch (err) {
    console.warn('Error al resolver imagen desde caché:', url, err);
  }
  return url;
}

/**
 * Escapa caracteres especiales para prevenir XSS.
 */
export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function statusClass(estatus) {
  return (estatus || '').toLowerCase().replace(/\s+/g, '-');
}

export function formatFecha(isoDate) {
  if (!isoDate) return '—';
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

export function formatTs(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function role(session) {
  return CONFIG.roles[session?.role] ?? {};
}

export function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + id);
  if (el) el.classList.add('active');
}

export function openModal(html) {
  const overlay = document.getElementById('modal-overlay');
  overlay.innerHTML = html;
  overlay.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

export function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('visible');
  // Limpiar DOM primero para que ningún <img> siga referenciando blob URLs,
  // luego revocarlas.
  overlay.innerHTML = '';
  revokeBlobUrls();
  document.body.style.overflow = '';
}

export function renderToast(message, type = 'info', duration = 3000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 400);
  }, duration);
}

export function renderHeader(session, pendingCount = 0) {
  const chipClasses = { admin: 'role-chip role-chip--admin', sucursal: 'role-chip role-chip--sucursal' };
  const chipClass = chipClasses[session.role] ?? 'role-chip';
  const badge = pendingCount > 0
    ? `<span class="offline-badge">⟳ ${esc(String(pendingCount))}</span>`
    : '';
  return `
  <header class="app-header">
    <div class="header-brand">
      ${esc(CONFIG.appName)}<span>${esc(CONFIG.clientName)}</span>
    </div>
    <div class="header-right">
      <div class="header-user">
        ${esc(session.username)}&nbsp;<span class="${chipClass}">${esc(session.role)}</span>
      </div>
      ${badge}
      <button class="btn btn-ghost btn-sm btn-logout" aria-label="Cerrar sesión">Salir</button>
    </div>
  </header>`;
}
