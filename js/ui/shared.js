import { CONFIG } from '../config.js';

/**
 * Escapa caracteres especiales para prevenir XSS.
 */
export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Determina la clase CSS según el estatus de la nota.
 */
export function statusClass(estatus) {
  return (estatus || '').toLowerCase().replace(/\s+/g, '-');
}

/**
 * Formatea una fecha ISO a formato local es-MX (Día Mes Año).
 */
export function formatFecha(isoDate) {
  if (!isoDate) return '—';
  return new Date(isoDate + 'T00:00:00').toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

/**
 * Formatea un timestamp ISO a formato local es-MX (Día Mes Año, Hora).
 */
export function formatTs(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Obtiene los metadatos del rol del usuario.
 */
export function role(session) { 
  return CONFIG.roles[session?.role] ?? {}; 
}

/**
 * Cambia la vista activa de la aplicación.
 */
export function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + id);
  if (el) el.classList.add('active');
}

/**
 * Abre el modal con el contenido HTML proporcionado.
 */
export function openModal(html) {
  const overlay = document.getElementById('modal-overlay');
  overlay.innerHTML = html;
  overlay.classList.add('visible');
  document.body.style.overflow = 'hidden'; // Prevenir scroll del fondo
}

/**
 * Cierra el modal activo.
 */
export function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('visible');
  overlay.innerHTML = '';
  document.body.style.overflow = '';
}

/**
 * Renderiza una notificación tipo Toast.
 */
export function renderToast(message, type = 'info') {
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
  }, 3000);
}

/**
 * Renderiza el encabezado común de la aplicación.
 */
export function renderHeader(session) {
  const chipClasses = { admin: 'role-chip role-chip--admin', sucursal: 'role-chip role-chip--sucursal' };
  const chipClass = chipClasses[session.role] ?? 'role-chip';
  return `
  <header class="app-header">
    <div class="header-brand">
      ${esc(CONFIG.appName)}<span>${esc(CONFIG.clientName)}</span>
    </div>
    <div class="header-right">
      <div class="header-user">
        ${esc(session.username)}&nbsp;<span class="${chipClass}">${esc(session.role)}</span>
      </div>
      <button class="btn btn-ghost btn-sm btn-logout" aria-label="Cerrar sesión">Salir</button>
    </div>
  </header>`;
}
