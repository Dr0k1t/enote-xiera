/// <reference path="../types.js" />
import { CONFIG } from '../config.js';
import { getImageFromCache } from '../offline.js';

// Tracking de blob URLs creadas con URL.createObjectURL para evitar leaks.
const _blobUrls = new Set();

// Elemento que originó la apertura del modal, para restaurar foco al cerrar.
let _modalOpener = null;

/**
 * Revoca todas las blob URLs creadas vía resolveImageUrl.
 * Llamar antes de limpiar DOM que pudiera referenciarlas.
 */
export function revokeBlobUrls() {
  _blobUrls.forEach(url => URL.revokeObjectURL(url));
  _blobUrls.clear();
  // Limpiar blob URLs creadas por compressImage (preview de upload)
  if (typeof window !== 'undefined' && window.__enoteBlobUrls) {
    window.__enoteBlobUrls.forEach(url => URL.revokeObjectURL(url));
    window.__enoteBlobUrls.clear();
  }
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
  // Parsear como UTC y formatear en UTC para evitar desplazamiento de día por timezone local.
  const parts = String(isoDate).split('-');
  if (parts.length !== 3) return '—';
  const dt = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
  return dt.toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC',
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
  _modalOpener = document.activeElement;
  const overlay = document.getElementById('modal-overlay');
  overlay.innerHTML = html;
  overlay.classList.add('visible');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    const focusable = overlay.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable) focusable.focus();
  });
  overlay._trapHandler = (e) => {
    if (e.key !== 'Tab') return;
    const focusables = Array.from(overlay.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
    if (!focusables.length) return;
    const first = focusables[0];
    const last  = focusables[focusables.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  };
  overlay.addEventListener('keydown', overlay._trapHandler);
}

export function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay._trapHandler) {
    overlay.removeEventListener('keydown', overlay._trapHandler);
    overlay._trapHandler = null;
  }
  overlay.classList.remove('visible');
  overlay.innerHTML = '';
  revokeBlobUrls();
  document.body.style.overflow = '';
  const opener = _modalOpener;
  _modalOpener = null;
  if (opener && typeof opener.focus === 'function') {
    requestAnimationFrame(() => { try { opener.focus(); } catch {} });
  }
}

export function renderToast(message, type = 'info', duration = 3000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  // Limitar a 3 toasts simultáneos para evitar spam visual
  while (container.children.length >= 3) {
    container.firstChild.remove();
  }
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity   = '0';
    el.style.transform = 'translateY(8px)';
    el.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
    setTimeout(() => el.remove(), 380);
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
