/// <reference path="./types.js" />
import { CONFIG, ENOTE_VERSION } from './config.js';
import { getNotes, getNote, createNote, updateNote, deleteNote, toggleTomada, validateNoteFields } from './store.js';
import { login, requireAuth, canSeeAll, canCreate, canEdit, canDelete, logout, clearSession } from './auth.js';
import { compressImage, MAX_IMAGES_PER_NOTE } from './imageUtils.js';
import { log } from './logger.js';
import { syncPendingNotes, isOnline, createNoteOffline, syncNotesToCache, getPendingCount, preCacheAllImages } from './offline.js';

import {
  showView, openModal, closeModal, renderToast, formatFecha, resolveImageUrl,
} from './ui/shared.js';

import { renderLoginView } from './ui/login.js';
import { renderDashboardView, refreshGrid } from './ui/dashboard.js';
import { renderNoteForm, getFormData, updateFinancialTotals } from './ui/form.js';
import { renderDetailView, renderDiffView, renderDeleteConfirm, renderConflictView } from './ui/detail.js';
import { renderRepartidorView, renderRepartidorCard } from './ui/repartidor.js';
import { printReceipt } from './ui/print.js';

// Exponer constante para suite de audit (audit-v2.js F9.4)
window.MAX_IMAGES_PER_NOTE = MAX_IMAGES_PER_NOTE;

// ─── Module state ─────────────────────────────────────────────────────────────
let currentSession      = null;
let editingNoteId       = null;
let editingNoteModifiedEn = null; // versión del servidor al abrir el form (para conflict detection)
let pendingFormData     = null;
let pendingImages       = [];
let currentDetailNoteId = null;
let currentPage         = 1;
let deferredPrompt      = null;
let isInstalled         = false;
let _repartidorNotes    = []; // notas renderizadas en vista repartidor (para UI optimista en toggle tomada)

// ─── Service Worker ───────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  let _reloadingFromSw = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (_reloadingFromSw) return;
    // No recargar si hay un formulario abierto o imágenes pendientes — bug_014
    const modalOpen = document.querySelector('.modal-overlay.visible');
    const hasDraft  = editingNoteId !== null || pendingImages.length > 0;
    if (modalOpen || hasDraft) {
      renderToast('Nueva versión disponible — recárgala cuando termines', 'info', 10000);
      return;
    }
    _reloadingFromSw = true;
    window.location.reload();
  });
  // Señal para boot.js: app.js cargó y su listener controllerchange está activo,
  // así boot.js delega aquí (respeta borradores) en vez de recargar a ciegas.
  window.__enoteAppLoaded = true;

  navigator.serviceWorker.register('/sw.js')
    .then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            renderToast('Nueva versión disponible — actualizando…', 'info', 4000);
            // Aplicar update automáticamente; controllerchange dispara reload
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    })
    .catch(err => console.warn('SW registration failed:', err));

  // Warm-cache diferido de los assets pesados de Typst (recibo PDF). En idle y
  // solo online, para que la impresión funcione offline desde la 2.ª sesión sin
  // bloquear el boot ni el primer arranque sobre internet inestable.
  const warmTypst = () => {
    if (!navigator.onLine) return;
    navigator.serviceWorker.ready
      .then(reg => (reg.active || navigator.serviceWorker.controller)?.postMessage({ type: 'WARM_TYPST_CACHE' }))
      .catch(() => {});
  };
  const scheduleWarm = () => window.requestIdleCallback
    ? requestIdleCallback(warmTypst, { timeout: 5000 })
    : setTimeout(warmTypst, 3000);
  if (navigator.onLine) scheduleWarm();
  else window.addEventListener('online', scheduleWarm, { once: true });
}

// ─── PWA Install ──────────────────────────────────────────────────────────────
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  updateInstallButton();
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  isInstalled = true;
  const btn = document.querySelector('.install-btn');
  if (btn) btn.remove();
  renderToast('App instalada', 'success');
});

document.addEventListener('click', e => {
  if (e.target.closest('.btn-refresh')) { refreshApp(); return; }
  if (e.target.closest('.install-btn')) {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(choiceResult => {
      if (choiceResult.outcome === 'accepted') {
        isInstalled = true;
        const btn = document.querySelector('.install-btn');
        if (btn) btn.remove();
      }
      deferredPrompt = null;
    });
  }
});

// ─── Refresh manual (SW + notas) ────────────────────────────────────────────
async function refreshApp() {
  if (!currentSession) return;
  const btn = document.querySelector('.btn-refresh');
  if (btn?.classList.contains('is-spinning')) return; // anti doble-click
  btn?.classList.add('is-spinning');
  renderToast('Buscando actualizaciones…', 'info', 2500);
  try {
    // 1. Chequear nueva versión del SW y aplicarla en 1 clic.
    //    Si ya hay un SW esperando (waiting), reg.update() no dispara updatefound,
    //    así que hay que postearle SKIP_WAITING directamente → controllerchange → reload.
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update().catch(() => {});
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          return; // controllerchange recargará la página con la versión nueva
        }
      }
    }
    // 2. Re-consultar notas + re-render vista actual
    if (currentSession.role === 'repartidor') {
      const sel = document.getElementById('repartidor-sucursal');
      await renderNotasRepartidor(sel?.value || '');
    } else {
      await applyFilters(); // preserva filtros/búsqueda; re-consulta vía getBaseNotes
    }
    renderToast('Actualizado', 'success', 1800);
  } catch (err) {
    log.error('refresh_failed', { message: String(err?.message || err) });
    renderToast('No se pudo actualizar — revisa tu conexión', 'error', 5000);
  } finally {
    btn?.classList.remove('is-spinning');
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
init();

// ─── Global error handlers ────────────────────────────────────────────────────
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error || event.message);
  if (event.error) {
    try { void log.error?.('unhandled', { message: event.error.message, stack: event.error.stack?.slice(0, 500) }); } catch {}
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
  try {
    void log.error?.('unhandledrejection', { message: event.reason?.message || String(event.reason) });
  } catch {}
  try { renderToast('Ocurrió un error inesperado. Intenta de nuevo.', 'error', 6000); } catch {}
  event.preventDefault();
});

// Wrapper que captura errores en handlers async y los reporta vía toast.
function safeHandler(fn) {
  return async (...args) => {
    try { return await fn(...args); }
    catch (err) {
      console.error('Handler error:', err);
      try { renderToast('Error: ' + (err?.message || 'inesperado'), 'error'); } catch {}
    }
  };
}

// Escuchar eventos de auth expirada disparados desde store.js
window.addEventListener('enote:auth-expired', () => {
  clearSession();
  currentSession = null;
  closeModal();
  showLoginView();
  renderToast('Sesión expirada — inicia sesión de nuevo', 'info');
});

// Badge de versión fijo abajo-derecha (comprobar refresh/deploy).
function renderVersionBadge() {
  if (document.getElementById('version-badge')) return;
  const el = document.createElement('div');
  el.id = 'version-badge';
  el.textContent = 'v' + ENOTE_VERSION;
  document.body.appendChild(el);
}

async function init() {
  clearTimeout(window.__bootFailsafe);
  renderVersionBadge();
  sessionStorage.removeItem('_sw_reloading'); // limpiar flag de reload-recovery
  document.getElementById('app').innerHTML = `
    <div id="view-login"       class="view"></div>
    <div id="view-dashboard"   class="view"></div>
    <div id="view-detail"      class="view"></div>
    <div id="view-repartidor"  class="view"></div>
    <div id="modal-overlay"    class="modal-overlay"></div>`;

  setupEventDelegation();

  currentSession = requireAuth();
  if (!currentSession) {
    showLoginView();
  } else {
    try {
      await routeByRole();
      await updateOfflineBadge();
      // F5.8: sincronizar pendientes al arrancar (no solo en evento online)
      if (isOnline()) {
        syncPendingNotes(async (item) => {
          const { _session, _userId, _failCount, synced, localId, createdAt, ...fields } = item;
          return createNote(fields, _session || currentSession);
        }, currentSession.userId, () => renderToast('Una nota offline no pudo enviarse y fue descartada', 'error', 8000))
          .then(() => updateOfflineBadge())
          .catch(err => console.warn('Initial sync failed:', err));
      }
    } catch (err) {
      const msg = String(err?.message || err || '').toLowerCase();
      const code = err?.status || err?.code || '';
      const isAuth = /jwt|token.*expir|refresh.*token|invalid.*token|unauthorized/i.test(msg) || code === 401 || code === 403 || String(code) === '401' || String(code) === '403';
      if (isAuth && isOnline()) {
        clearSession();
        currentSession = null;
        showLoginView();
        renderToast('Sesion expirada — inicia sesion de nuevo', 'info');
      } else {
        console.error('init failed:', err);
        renderToast('Error al cargar la aplicación. Verifica tu conexión.', 'error', 8000);
        if (currentSession) {
          try { await routeByRole(); } catch (e2) { console.warn('Fallback routeByRole failed:', e2); }
        }
      }
    }
  }

  window.addEventListener('online', async () => {
    updateOnlineIndicator(true);
    renderToast('Conexión restaurada', 'success');
    if (currentSession) {
      await syncPendingNotes(async (item) => {
        const { _session, _userId, _failCount, _permanentError, synced, localId, createdAt, ...fields } = item;
        return createNote(fields, _session || currentSession);
      }, currentSession.userId, (_item, reason) => {
        const msg = reason ? `Nota offline no se pudo enviar: ${reason}` : 'Nota offline no se pudo enviar — revisa tu conexión';
        renderToast(msg, 'error', 10000);
      });
      void getBaseNotes(); // re-cachea notes + imágenes tras sync
      await updateOfflineBadge();
      updateInstallButton();
    }
  });
  window.addEventListener('offline', () => {
    updateOnlineIndicator(false);
    renderToast('Sin conexión — modo offline', 'info');
  });
}

// ─── Event delegation ─────────────────────────────────────────────────────────
function setupEventDelegation() {
  const loginView = document.getElementById('view-login');
  const dash      = document.getElementById('view-dashboard');
  const modal     = document.getElementById('modal-overlay');

  loginView.addEventListener('submit', async e => {
    if (e.target.id === 'login-form') { e.preventDefault(); await handleLogin(); }
  });

  dash.addEventListener('click', safeHandler(handleDashboardClick));

  dash.addEventListener('change', async e => {
    if (e.target.closest('.filter-estatus') || e.target.closest('.filter-destino') || e.target.closest('.filter-year') || e.target.closest('.filter-month')) {
      currentPage = 1;
      await applyFilters();
    } else if (e.target.closest('.status-select')) {
      const card = e.target.closest('[data-note-id]');
      const id = card ? parseInt(card.dataset.noteId) : NaN;
      if (isNaN(id)) return;
      await handleStatusChangeInit(id, e.target.value, card);
    }
  });

  const debouncedSearch = debounce(async () => { currentPage = 1; await applyFilters(); }, 280);
  dash.addEventListener('input', e => {
    if (e.target.closest('.filter-search')) debouncedSearch();
  });

  const repartidor = document.getElementById('view-repartidor');
  repartidor.addEventListener('click', safeHandler(handleRepartidorClick));
  repartidor.addEventListener('change', async e => {
    if (e.target.id === 'repartidor-sucursal') await renderNotasRepartidor(e.target.value);
  });

  modal.addEventListener('click', safeHandler(handleModalClick));
  // Anti drag-close: registra si el pointer BAJÓ sobre el overlay mismo.
  // Evita cierre accidental (y pérdida de borrador) al arrastrar desde dentro hacia afuera.
  modal.addEventListener('pointerdown', e => { modal._downOnOverlay = (e.target === modal); });
  modal.addEventListener('submit', safeHandler(async e => {
    if (e.target.id === 'note-form') {
      e.preventDefault();
      await handleFormSubmit(e.submitter?.dataset.action ?? 'save');
    }
  }));

  modal.addEventListener('change', e => {
    if (e.target.id === 'nf-imagenes') {
      const fileCount = e.target.files.length;
      const counter   = document.getElementById('image-counter');
      const total     = pendingImages.length + fileCount;
      if (counter) {
        if (total > 0) {
          counter.textContent = `${total}/3 imagen(es) (${fileCount} nueva(s) seleccionada(s))`;
          counter.style.display = '';
        }
      }
    }
  });


  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('visible')) closeModal();
  });
}

// ─── Login ────────────────────────────────────────────────────────────────────
function showLoginView() {
  document.getElementById('view-login').innerHTML = renderLoginView();
  showView('login');
  document.getElementById('inp-user')?.focus();
}

async function handleLogin() {
  const form = document.getElementById('login-form');
  const username = form.querySelector('[name="username"]').value.trim();
  const password = form.querySelector('[name="password"]').value;
  const errorEl  = document.getElementById('login-error');

  try {
    const result = await login(username, password);
    if (!result.ok) {
      errorEl.textContent = result.error || 'Email o contraseña incorrectos';
      form.querySelector('[name="password"]').value = '';
      return;
    }
    currentSession = result.session;
    log.sessionStart(currentSession);
    await routeByRole();
  } catch (err) {
    errorEl.textContent = err.message || 'Error de conexión — verifica tu internet';
    form.querySelector('[name="password"]').value = '';
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────
async function routeByRole() {
  if (currentSession.role === 'repartidor') { await showRepartidor(); return; }
  await showDashboard();
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function showDashboard() {
  currentPage = 1;
  const notes = await getBaseNotes();
  const total = notes.length;
  const totalPages = Math.max(1, Math.ceil(total / CONFIG.PAGE_SIZE));
  const pageNotes = notes.slice(0, CONFIG.PAGE_SIZE);
  const availableYears = notes.reduce((acc, n) => {
    if (n.fecha) { const y = String(n.fecha).substring(0, 4); if (y) acc.add(y); }
    return acc;
  }, new Set());
  document.getElementById('view-dashboard').innerHTML = renderDashboardView(
    pageNotes, currentSession, total, currentPage, totalPages, false, [...availableYears]
  );
  showView('dashboard');
  updateInstallButton();
  await updateOfflineBadge();
}

async function updateOfflineBadge() {
  const headerEl = document.querySelector('.app-header');
  if (!headerEl) return;
  const count = await getPendingCount(currentSession?.userId);
  let badge = headerEl.querySelector('.offline-badge');
  if (count > 0) {
    if (badge) {
      badge.textContent = '⟳ ' + count;
    } else {
      badge = document.createElement('span');
      badge.className = 'offline-badge';
      badge.textContent = '⟳ ' + count;
      const logoutBtn = headerEl.querySelector('.btn-logout');
      if (logoutBtn) {
        logoutBtn.parentNode.insertBefore(badge, logoutBtn);
      } else {
        headerEl.querySelector('.header-right')?.appendChild(badge);
      }
    }
  } else if (badge) {
    badge.remove();
  }
}

async function getBaseNotes() {
  let notes = await getNotes();
  if (isOnline()) {
    void syncNotesToCache(notes);
    void preCacheAllImages(notes);
  }
  if (!canSeeAll(currentSession)) {
    notes = notes.filter(n => n.destino === currentSession.destino || n.creadoPor === currentSession.username);
  }
  return notes;
}

async function getFilteredNotes() {
  let notes = await getBaseNotes();
  const statusFilter  = document.querySelector('.filter-estatus')?.value  ?? '';
  const destinoFilter = document.querySelector('.filter-destino')?.value  ?? '';
  const yearFilter    = document.querySelector('.filter-year')?.value    ?? '';
  const monthFilter   = document.querySelector('.filter-month')?.value   ?? '';
  const searchFilter  = (document.querySelector('.filter-search')?.value ?? '').trim().toLowerCase();

  if (statusFilter)  notes = notes.filter(n => n.estatus === statusFilter);
  if (destinoFilter) notes = notes.filter(n => n.destino === destinoFilter);
  if (yearFilter)    notes = notes.filter(n => String(n.fecha || '').startsWith(yearFilter + '-'));
  if (monthFilter)   notes = notes.filter(n => String(n.fecha || '').substring(5, 7) === monthFilter);
  if (searchFilter) {
    notes = notes.filter(n =>
      n.numero.toLowerCase().includes(searchFilter) ||
      (n.observaciones || '').toLowerCase().includes(searchFilter) ||
      n.destino.toLowerCase().includes(searchFilter) ||
      (n.clienteNombre || '').toLowerCase().includes(searchFilter) ||
      (n.sabor || '').toLowerCase().includes(searchFilter) ||
      (n.modelo || '').toLowerCase().includes(searchFilter) ||
      (n.texto || '').toLowerCase().includes(searchFilter)
    );
  }
  return notes;
}

async function applyFilters() {
  const filtered = await getFilteredNotes();
  const hasFilters = !!(
    document.querySelector('.filter-estatus')?.value ||
    document.querySelector('.filter-destino')?.value ||
    document.querySelector('.filter-year')?.value ||
    document.querySelector('.filter-month')?.value ||
    document.querySelector('.filter-search')?.value?.trim()
  );
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / CONFIG.PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * CONFIG.PAGE_SIZE;
  const pageNotes = filtered.slice(start, start + CONFIG.PAGE_SIZE);
  refreshGrid(pageNotes, currentSession, total, currentPage, totalPages, hasFilters);
}

// ─── Dashboard clicks ─────────────────────────────────────────────────────────
async function handleDashboardClick(e) {
  if (e.target.closest('.btn-logout'))       { handleLogout(); return; }
  if (e.target.closest('.btn-nueva'))        {
    if (!canCreate(currentSession)) { renderToast('Permisos insuficientes', 'error'); return; }
    await showForm(null); return;
  }
  if (e.target.closest('.btn-prev-page'))    { if (currentPage > 1) { currentPage--; await applyFilters(); } return; }
  if (e.target.closest('.btn-next-page'))    { currentPage++; await applyFilters(); return; }
  if (e.target.closest('.btn-clear-filters')) {
    const s = document.querySelector('.filter-search');
    if (s) s.value = '';
    const est = document.querySelector('.filter-estatus');
    if (est) est.value = '';
    const dest = document.querySelector('.filter-destino');
    if (dest) dest.value = '';
    const y = document.querySelector('.filter-year');
    if (y) y.value = '';
    const m = document.querySelector('.filter-month');
    if (m) m.value = '';
    currentPage = 1;
    await applyFilters();
    return;
  }

  // Barra de confirmación de cambio de status (planta) — debe correr aunque la barra esté dentro de una card con data-note-id.
  if (e.target.closest('.btn-confirm-status')) {
    const btn = e.target.closest('.btn-confirm-status');
    const id  = parseInt(btn.dataset.noteId);
    if (!isNaN(id)) await handleConfirmStatus(id, btn.dataset.status);
    return;
  }
  if (e.target.closest('.btn-cancel-status')) {
    const bar = e.target.closest('.status-confirm-bar');
    const card = e.target.closest('[data-note-id]');
    const select = card?.querySelector('.status-select');
    if (select && select.dataset.prevValue) select.value = select.dataset.prevValue;
    bar?.remove();
    return;
  }

  const card   = e.target.closest('[data-note-id]');
  const noteId = card ? parseInt(card.dataset.noteId) : NaN;
  if (isNaN(noteId)) return;

  if (e.target.closest('.btn-ver'))      { await showDetail(noteId); return; }
  if (e.target.closest('.btn-editar'))   {
    if (!canEdit(currentSession)) { renderToast('Permisos insuficientes', 'error'); return; }
    await showForm(noteId); return;
  }
  if (e.target.closest('.btn-eliminar')) {
    if (!canDelete(currentSession)) { renderToast('Permisos insuficientes', 'error'); return; }
    await confirmDelete(noteId); return;
  }
}

// ─── Status change (planta) ──────────────────────────────────────────────────
async function handleStatusChangeInit(noteId, newStatus, cardEl) {
  const note = await getNote(noteId);
  if (!note) return;

  if (CONFIG.confirmEditStatuses.includes(note.estatus)) {
    const footer = cardEl.querySelector('.note-card__footer');
    const existing = footer?.querySelector('.status-confirm-bar');
    if (existing) existing.remove();

    // Guardar valor previo del select para poder restaurarlo al cancelar
    const select = cardEl.querySelector('.status-select');
    if (select) select.dataset.prevValue = note.estatus;

    const bar = document.createElement('div');
    bar.className = 'status-confirm-bar';
    bar.innerHTML = `
      <span class="confirm-label">¿Cambiar a <strong>"${newStatus}"</strong>?</span>
      <button type="button" class="btn btn-sm btn-primary btn-confirm-status"
        data-note-id="${noteId}" data-status="${newStatus}">Confirmar</button>
      <button type="button" class="btn btn-sm btn-ghost btn-cancel-status">Cancelar</button>`;
    footer?.insertBefore(bar, footer.firstChild);
  } else {
    await updateNote(noteId, { estatus: newStatus, _force: true }, currentSession);
    await applyFilters();
    renderToast(`Estado: ${newStatus}`, 'success');
  }
}

async function handleConfirmStatus(noteId, newStatus) {
  await updateNote(noteId, { estatus: newStatus, _force: true }, currentSession);
  await applyFilters();
  renderToast(`Estado cambiado a "${newStatus}"`, 'success');
}

// ─── Detail view ─────────────────────────────────────────────────────────────
async function showDetail(noteId) {
  let note = await getNote(noteId);
  if (!note) { await showDashboard(); return; }

  if (currentSession.role === 'planta') {
    const updates = { _force: true };
    let dirty = false;
    if (note.unreadNew) {
      updates.unreadNew = false;
      dirty = true;
      if (note.estatus === 'Nueva') {
        updates.estatus = 'En Proceso';
      }
    }
    if (note.unreadModified) {
      updates.unreadModified = false;
      dirty = true;
    }

    if (dirty) {
      try {
        const result = await updateNote(noteId, updates, currentSession);
        if (result?.new) note = result.new;
        await applyFilters();
      } catch (err) {
        console.warn('Auto-transición fallida:', err.message);
      }
    }
  }

  currentDetailNoteId = noteId;
  // Detalle renderizado dentro del modal-overlay (mismo mecanismo que editar):
  // hereda click-fuera, ESC, focus-trap, anti-drag y scroll de .modal-card.
  openModal(renderDetailView(note, currentSession));
}

// ─── Note form ────────────────────────────────────────────────────────────────
async function showForm(noteId) {
  editingNoteId = noteId !== undefined ? noteId : null;
  const note = editingNoteId !== null ? await getNote(editingNoteId) : null;
  editingNoteModifiedEn = note?.modificadoEn || note?.creadoEn || null;

  // Identidad canónica: conservar la URL original (https Supabase) en pendingImages.
  // El blob URL es solo artefacto de display en runtime; nunca debe entrar al modelo
  // ni persistirse (un blob muere al recargar → "may not load data from blob:").
  pendingImages = note?.imagenes ? [...note.imagenes] : [];

  openModal(renderNoteForm(note ? { ...note, imagenes: pendingImages } : null, currentSession));
  document.getElementById('nf-fecha')?.focus();

  // Pase de display: sustituir el src de las miniaturas por su blob de caché si existe
  // (visualización offline) sin tocar la identidad canónica (data-canonical-url).
  void resolveExistingThumbnails();

  setTimeout(() => {
    updateFinancialTotals();
    document.querySelectorAll('.nf-financiero-input').forEach(input => {
      input.addEventListener('input', updateFinancialTotals);
    });
  }, 0);
}

// Resuelve las miniaturas de imágenes existentes del formulario: si hay blob en caché
// IndexedDB lo usa para mostrar offline; si la imagen no carga, oculta el thumbnail.
// data-canonical-url (identidad) permanece intacto — no toca pendingImages.
async function resolveExistingThumbnails() {
  const imgs = document.querySelectorAll('#existing-image-previews .image-preview-item img[data-canonical-url]');
  for (const imgEl of imgs) {
    imgEl.addEventListener('error', () => { imgEl.style.display = 'none'; }, { once: true });
    const canonical = imgEl.dataset.canonicalUrl;
    if (!canonical || canonical.startsWith('blob:') || canonical.startsWith('data:')) continue;
    try {
      const resolved = await resolveImageUrl(canonical);
      if (resolved && resolved !== canonical) imgEl.src = resolved;
    } catch { /* conserva src https; el listener de error lo maneja */ }
  }
}

async function handleFormSubmit(action) {
  const fields = getFormData();
  if (!fields) return;
  const errors = validateNoteFields(fields);
  if (errors.length) {
    renderToast(errors.join(' · '), 'error');
    return;
  }

  const imageInput = document.getElementById('nf-imagenes');
  let newImages = [];
  if (imageInput && imageInput.files.length > 0) {
    const total = pendingImages.length + imageInput.files.length;
    if (total > MAX_IMAGES_PER_NOTE) {
      renderToast(`Máximo ${MAX_IMAGES_PER_NOTE} imágenes por nota`, 'error');
      return;
    }
    try {
      newImages = await Promise.all(Array.from(imageInput.files).map(compressImage));
    } catch (err) {
      renderToast(err.message, 'error');
      return;
    }
  }
  fields.imagenes = [...pendingImages, ...newImages];

  if (editingNoteId !== null) {
    const existing = await getNote(editingNoteId);
    if (existing && CONFIG.confirmEditStatuses.includes(existing.estatus)) {
      const diff = computeDiff(existing, fields);
      if (diff.length > 0) {
        pendingFormData = { noteId: editingNoteId, fields, action };
        openModal(renderDiffView(diff, existing.estatus));
        return;
      }
    }
    await commitUpdate(editingNoteId, fields, action);
  } else {
    if (!isOnline()) {
      try {
        await createNoteOffline({ ...fields, _session: currentSession }, currentSession.userId);
        renderToast('Nota guardada sin conexión — se enviará automáticamente al reconectar', 'info');
        closeModal();
        editingNoteId = null;
        await updateOfflineBadge();
      } catch (err) {
        renderToast(err.message || 'Error al guardar offline', 'error');
      }
      return;
    }
    try {
      const note = await createNote(fields, currentSession);
      log.noteCreated(note);
      closeModal();
      editingNoteId = null;
      if (action === 'preview') {
        await showDetail(note.id);
      } else {
        await showDashboard();
        renderToast('Nota creada', 'success');
      }
    } catch (err) {
      renderToast(err.message || 'Error al crear nota', 'error');
    }
  }
}

async function commitUpdate(noteId, fields, action) {
  try {
    const fieldsWithCheck = { ...fields, _localModifiedEn: editingNoteModifiedEn };
    const result = await updateNote(noteId, fieldsWithCheck, currentSession);
    if (result?.conflict) {
      pendingFormData = { noteId, fields, action };
      openModal(renderConflictView(result.serverNote, fields));
      return;
    }
    if (result?.new) log.noteUpdated(result.new);
    closeModal();
    if (action === 'preview') {
      await showDetail(noteId);
    } else {
      await showDashboard();
      renderToast('Nota actualizada', 'success');
    }
    editingNoteId = null;
    editingNoteModifiedEn = null;
  } catch (err) {
    renderToast(err.message || 'Error al actualizar', 'error');
  }
}

// ─── Modal clicks ─────────────────────────────────────────────────────────────
async function handleModalClick(e) {
  const overlay = document.getElementById('modal-overlay');
  if (e.target === overlay && overlay._downOnOverlay) { closeModal(); return; }

  if (e.target.closest('.btn-cancelar-modal')) { closeModal(); return; }

  // Detalle (renderizado dentro del modal): imprimir / editar / ver imagen.
  if (e.target.closest('.btn-imprimir')) {
    const note = await getNote(currentDetailNoteId);
    if (note) await printReceipt(note);
    return;
  }
  if (e.target.closest('.btn-editar')) {
    if (!canEdit(currentSession)) { renderToast('Permisos insuficientes', 'error'); return; }
    const btn = e.target.closest('.btn-editar');
    const rawId = btn.dataset.noteId;
    if (rawId) {
      const id = isNaN(rawId) ? rawId : Number(rawId);
      await showForm(id);
    }
    return;
  }
  if (e.target.closest('.image-selector-btn')) {
    const btn = e.target.closest('.image-selector-btn');
    const idx = parseInt(btn.dataset.imageIndex);
    if (!isNaN(idx)) await showImagePreview(idx);
    return;
  }

  if (e.target.closest('.btn-remove-image')) {
    const btn      = e.target.closest('.btn-remove-image');
    const imageId  = btn.dataset.imageId;
    const imageUrl = btn.dataset.imageUrl;

    pendingImages = pendingImages.filter(img => {
      const url = typeof img === 'string' ? img : img.url;
      const id = typeof img === 'string' ? `img-${pendingImages.indexOf(img)}` : img.id;
      return imageUrl ? url !== imageUrl : id !== imageId;
    });

    btn.closest('.image-preview-item').remove();
    const counter = document.getElementById('image-counter');
    if (counter) {
      if (pendingImages.length > 0) {
        counter.textContent = `${pendingImages.length}/3 imagen(es) adjunta(s)`;
        counter.style.display = '';
      } else {
        counter.style.display = 'none';
      }
    }
    return;
  }

  if (e.target.closest('.btn-volver-editar')) {
    pendingFormData = null;
    await showForm(editingNoteId);
    return;
  }

  if (e.target.closest('.btn-confirmar-diff')) {
    if (!pendingFormData) return;
    const { noteId, fields, action } = pendingFormData;
    pendingFormData = null;
    await commitUpdate(noteId, fields, action);
    return;
  }

  // Conflict: forzar sobrescritura
  if (e.target.closest('.btn-conflict-overwrite')) {
    if (!pendingFormData) return;
    const { noteId, fields, action } = pendingFormData;
    pendingFormData = null;
    try {
      const result = await updateNote(noteId, { ...fields, _force: true }, currentSession);
      if (result?.new) log.noteUpdated(result.new);
      closeModal();
      if (action === 'preview') {
        await showDetail(noteId);
      } else {
        await showDashboard();
        renderToast('Nota sobrescrita', 'success');
      }
      editingNoteId = null;
      editingNoteModifiedEn = null;
    } catch (err) {
      renderToast(err.message || 'Error al sobrescribir', 'error');
    }
    return;
  }

  // Conflict: descartar cambios locales
  if (e.target.closest('.btn-conflict-keep-server')) {
    pendingFormData = null;
    closeModal();
    if (editingNoteId !== null) await showDetail(editingNoteId);
    editingNoteId = null;
    editingNoteModifiedEn = null;
    return;
  }

  if (e.target.closest('.btn-confirmar-delete')) {
    const btn    = e.target.closest('.btn-confirmar-delete');
    const noteId = parseInt(btn.dataset.noteId);
    if (isNaN(noteId)) return;
    try {
      await deleteNote(noteId, currentSession);
      closeModal();
      await showDashboard();
      renderToast('Nota eliminada', 'info');
    } catch (err) {
      renderToast(err.message || 'No se pudo eliminar la nota', 'error');
    }
    return;
  }
}

// ─── Repartidor ──────────────────────────────────────────────────────────────
async function showRepartidor() {
  document.getElementById('view-repartidor').innerHTML = renderRepartidorView(currentSession);
  showView('repartidor');
  updateInstallButton();
}

async function renderNotasRepartidor(sucursal) {
  const container = document.getElementById('repartidor-notes');
  if (!container) return;
  if (!sucursal) {
    container.innerHTML = '<div class="repartidor-empty">Selecciona una sucursal para ver sus notas.</div>';
    return;
  }
  const allNotes = await getNotes();
  const notes = allNotes.filter(n => n.destino === sucursal && n.estatus !== 'Cancelada');
  _repartidorNotes = notes; // cache para UI optimista en toggleTomada
  container.innerHTML = notes.length > 0
    ? notes.map(renderRepartidorCard).join('')
    : '<div class="repartidor-empty">Sin notas activas para esta sucursal.</div>';
}

// Reemplaza una tarjeta repartidor en el DOM por su versión re-renderizada.
function replaceCard(cardEl, noteObj) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = renderRepartidorCard(noteObj).trim();
  const fresh = wrapper.firstElementChild;
  cardEl.replaceWith(fresh);
  return fresh;
}

async function handleRepartidorClick(e) {
  if (e.target.closest('.btn-logout')) { handleLogout(); return; }

  const card = e.target.closest('.repartidor-card');
  if (!card) return;

  const noteId = parseInt(card.dataset.noteId);
  if (isNaN(noteId)) return;

  const note = _repartidorNotes.find(n => n.id === noteId);
  if (!note) return;

  // 1. UI optimista: reflejar el toggle al instante (sin esperar la red)
  const nextTomada = !note.tomada;
  const optimistic = {
    ...note,
    tomada:    nextTomada,
    tomadaPor: nextTomada ? currentSession.username : null,
    tomadaEn:  nextTomada ? new Date().toISOString() : null,
  };
  replaceCard(card, optimistic);

  // 2. Persistir en segundo plano
  try {
    const updated = await toggleTomada(noteId, currentSession, note);
    if (updated) {
      Object.assign(note, updated); // reconciliar cache en memoria
      const liveCard = document.querySelector(`.repartidor-card[data-note-id="${noteId}"]`);
      if (liveCard) replaceCard(liveCard, updated);
      log.noteTomada(updated);
    }
  } catch (err) {
    // 3. Revertir al estado original
    const liveCard = document.querySelector(`.repartidor-card[data-note-id="${noteId}"]`);
    if (liveCard) replaceCard(liveCard, note);
    renderToast('No se pudo actualizar la nota — reintenta', 'error', 4000);
  }
}

// ─── Image preview ───────────────────────────────────────────────────────────
async function showImagePreview(index) {
  const note = await getNote(currentDetailNoteId);
  if (!note?.imagenes?.[index]) return;
  const imgData = note.imagenes[index];
  const imgUrl = typeof imgData === 'string' ? imgData : imgData?.url;

  const overlay = document.createElement('div');
  overlay.className = 'image-preview-overlay';
  overlay.innerHTML = `
    <div class="image-preview-container">
      <button class="btn btn-ghost btn-close-preview" aria-label="Cerrar">✕</button>
    </div>`;

  const container = overlay.querySelector('.image-preview-container');
  const resolvedSrc = await resolveImageUrl(imgUrl);
  if (resolvedSrc) {
    const imgEl = document.createElement('img');
    imgEl.alt = `Imagen ${index + 1}`;
    imgEl.addEventListener('error', () => { imgEl.replaceWith(buildPreviewError()); }, { once: true });
    imgEl.src = resolvedSrc;
    container.appendChild(imgEl);
  } else {
    container.appendChild(buildPreviewError());
  }

  document.body.appendChild(overlay);

  // Overlay autónomo: revoca SOLO el blob que creó (no global) y captura ESC en fase
  // de captura para cerrarse antes que el modal de detalle de fondo.
  const closePreview = () => {
    document.removeEventListener('keydown', onKey, true);
    overlay.remove();
    if (resolvedSrc && resolvedSrc.startsWith('blob:')) {
      try { URL.revokeObjectURL(resolvedSrc); } catch {}
    }
  };
  const onKey = (ev) => {
    if (ev.key === 'Escape') { ev.stopPropagation(); closePreview(); }
  };
  document.addEventListener('keydown', onKey, true);
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) closePreview(); });
  overlay.querySelector('.btn-close-preview').addEventListener('click', closePreview);
}

function buildPreviewError() {
  const p = document.createElement('p');
  p.style.cssText = 'color:#fff;padding:2rem;text-align:center;font-size:0.95rem';
  p.textContent = 'No se pudo cargar la imagen.';
  return p;
}

// ─── Delete ──────────────────────────────────────────────────────────────────
async function confirmDelete(noteId) {
  const note = await getNote(noteId);
  if (!note) return;
  openModal(renderDeleteConfirm(note));
}

// ─── Logout ──────────────────────────────────────────────────────────────────
async function handleLogout() {
  await logout();
  currentSession  = null;
  editingNoteId   = null;
  pendingFormData = null;
  document.getElementById('view-dashboard').innerHTML  = '';
  document.getElementById('view-detail').innerHTML     = '';
  document.getElementById('view-repartidor').innerHTML = '';
  closeModal();
  showLoginView();
}

// ─── Diff ────────────────────────────────────────────────────────────────────
function computeDiff(oldNote, newFields) {
  const changes = [];
  const add = (field, label, oldVal, newVal) => {
    if (String(oldVal ?? '') !== String(newVal ?? '')) {
      changes.push({ field, label, old: oldVal || '(vacío)', new: newVal || '(vacío)' });
    }
  };
  add('fecha', 'Fecha', formatFecha(oldNote.fecha), formatFecha(newFields.fecha));
  add('destino', 'Destino', oldNote.destino, newFields.destino);
  add('observaciones', 'Observaciones', (oldNote.observaciones || '').trim(), (newFields.observaciones || '').trim());
  add('clienteNombre', 'Cliente', oldNote.clienteNombre, newFields.clienteNombre);
  add('clienteDireccion', 'Dir. Cliente', oldNote.clienteDireccion, newFields.clienteDireccion);
  add('clienteTelefono', 'Tel. Cliente', oldNote.clienteTelefono, newFields.clienteTelefono);
  add('pastelCantidad', 'Cant. Pasteles', oldNote.pastelCantidad, newFields.pastelCantidad);
  add('pisos', 'Pisos', oldNote.pisos, newFields.pisos);
  add('sabor', 'Sabor', oldNote.sabor, newFields.sabor);
  add('kilos', 'Kilos', oldNote.kilos, newFields.kilos);
  add('modelo', 'Modelo', oldNote.modelo, newFields.modelo);
  add('texto', 'Texto pastel', oldNote.texto, newFields.texto);
  add('colores', 'Colores', oldNote.colores, newFields.colores);
  add('horaEntrega', 'Hora entrega', oldNote.horaEntrega, newFields.horaEntrega);
  add('horaPeriodo', 'AM/PM', oldNote.horaPeriodo, newFields.horaPeriodo);
  add('direccionEntrega', 'Dir. Entrega', oldNote.direccionEntrega, newFields.direccionEntrega);
  add('costoPastel', 'Costo Pastel', oldNote.costoPastel, newFields.costoPastel);
  add('depositoEquipo', 'Dep. Equipo', oldNote.depositoEquipo, newFields.depositoEquipo);
  add('arreglosFigura', 'Arreglos', oldNote.arreglosFigura, newFields.arreglosFigura);
  add('servicioDomicilio', 'Servicio', oldNote.servicioDomicilio, newFields.servicioDomicilio);
  add('anticipo', 'Anticipo', oldNote.anticipo, newFields.anticipo);
  add('metodoPago', 'Metodo Pago', oldNote.metodoPago, newFields.metodoPago);
  return changes;
}

function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

function updateOnlineIndicator(online) {
  let indicator = document.querySelector('.online-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'online-indicator';
    document.body.prepend(indicator);
  }
  indicator.textContent = online ? '' : 'Sin conexión';
  indicator.className = 'online-indicator' + (online ? '' : ' offline');
}

function updateInstallButton() {
  const headerEl = document.querySelector('.app-header');
  if (!headerEl) return;
  let btn = headerEl.querySelector('.install-btn');
  if (deferredPrompt && !isInstalled) {
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'btn btn-primary btn-sm install-btn';
      btn.textContent = 'Instalar app';
      btn.setAttribute('aria-label', 'Instalar aplicación');
      const logoutBtn = headerEl.querySelector('.btn-logout');
      if (logoutBtn) {
        logoutBtn.parentNode.insertBefore(btn, logoutBtn);
      } else {
        headerEl.querySelector('.header-right')?.appendChild(btn);
      }
    }
  } else {
    if (btn) btn.remove();
  }
}
