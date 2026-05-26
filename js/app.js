/// <reference path="./types.js" />
import { CONFIG } from './config.js';
import { getNotes, getNote, createNote, updateNote, deleteNote, toggleTomada, validateNoteFields } from './store.js';
import { login, requireAuth, canSeeAll, logout, clearSession } from './auth.js';
import { compressImage, MAX_IMAGES_PER_NOTE } from './imageUtils.js';
import { log } from './logger.js';
import { syncPendingNotes, isOnline, createNoteOffline, syncNotesToCache, getPendingCount, preCacheAllImages } from './offline.js';

import {
  showView, openModal, closeModal, renderToast, formatFecha, resolveImageUrl, revokeBlobUrls,
} from './ui/shared.js';

import { renderLoginView } from './ui/login.js';
import { renderDashboardView, refreshGrid } from './ui/dashboard.js';
import { renderNoteForm, renderProductRow, getFormData, updateFinancialTotals } from './ui/form.js';
import { renderDetailView, renderDiffView, renderDeleteConfirm, renderConflictView } from './ui/detail.js';
import { renderRepartidorView, renderRepartidorCard } from './ui/repartidor.js';

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

// ─── Service Worker ───────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            renderToast('Nueva versión disponible — recarga para actualizar', 'info', 8000);
          }
        });
      });
    })
    .catch(err => console.warn('SW registration failed:', err));
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

async function init() {
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
        const { _session, synced, localId, createdAt, ...fields } = item;
        return createNote(fields, _session || currentSession);
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
  const detail    = document.getElementById('view-detail');
  const modal     = document.getElementById('modal-overlay');

  loginView.addEventListener('submit', async e => {
    if (e.target.id === 'login-form') { e.preventDefault(); await handleLogin(); }
  });

  dash.addEventListener('click', safeHandler(handleDashboardClick));

  dash.addEventListener('change', async e => {
    if (e.target.closest('.filter-estatus') || e.target.closest('.filter-destino')) {
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

  detail.addEventListener('click', safeHandler(handleDetailClick));

  const repartidor = document.getElementById('view-repartidor');
  repartidor.addEventListener('click', safeHandler(handleRepartidorClick));
  repartidor.addEventListener('change', async e => {
    if (e.target.id === 'repartidor-sucursal') await renderNotasRepartidor(e.target.value);
  });

  modal.addEventListener('click', safeHandler(handleModalClick));
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

  modal.addEventListener('click', e => {
    if (e.target.closest('.btn-add-row')) {
      const tbody = document.getElementById('prod-tbody');
      if (tbody) tbody.insertAdjacentHTML('beforeend', renderProductRow());
    }
    if (e.target.closest('.btn-remove-row')) {
      const row = e.target.closest('.prod-row');
      const tbody = row?.closest('tbody');
      if (tbody && tbody.querySelectorAll('.prod-row').length > 1) {
        row.remove();
      } else {
        renderToast('Debe haber al menos un producto', 'error');
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
  document.getElementById('view-dashboard').innerHTML = renderDashboardView(
    pageNotes, currentSession, total, currentPage, totalPages
  );
  showView('dashboard');
  updateInstallButton();
  await updateOfflineBadge();
}

async function updateOfflineBadge() {
  const headerEl = document.querySelector('.app-header');
  if (!headerEl) return;
  const count = await getPendingCount();
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
  const searchFilter  = (document.querySelector('.filter-search')?.value ?? '').trim().toLowerCase();

  if (statusFilter)  notes = notes.filter(n => n.estatus === statusFilter);
  if (destinoFilter) notes = notes.filter(n => n.destino === destinoFilter);
  if (searchFilter) {
    notes = notes.filter(n =>
      n.numero.toLowerCase().includes(searchFilter) ||
      (n.observaciones || '').toLowerCase().includes(searchFilter) ||
      n.destino.toLowerCase().includes(searchFilter) ||
      n.productos.some(p => (p.nombre || '').toLowerCase().includes(searchFilter))
    );
  }
  return notes;
}

async function applyFilters() {
  const filtered = await getFilteredNotes();
  const hasFilters = !!(
    document.querySelector('.filter-estatus')?.value ||
    document.querySelector('.filter-destino')?.value ||
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
  if (e.target.closest('.btn-nueva'))        { await showForm(null); return; }
  if (e.target.closest('.btn-prev-page'))    { if (currentPage > 1) { currentPage--; await applyFilters(); } return; }
  if (e.target.closest('.btn-next-page'))    { currentPage++; await applyFilters(); return; }
  if (e.target.closest('.btn-clear-filters')) {
    const s = document.querySelector('.filter-search');
    if (s) s.value = '';
    const est = document.querySelector('.filter-estatus');
    if (est) est.value = '';
    const dest = document.querySelector('.filter-destino');
    if (dest) dest.value = '';
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
  if (e.target.closest('.btn-editar'))   { await showForm(noteId); return; }
  if (e.target.closest('.btn-eliminar')) { await confirmDelete(noteId); return; }
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
  document.getElementById('view-detail').innerHTML = renderDetailView(note, currentSession);
  const viewDetail = document.getElementById('view-detail');
  viewDetail.classList.add('detail-overlay-active');
  viewDetail.style.display = 'block';
  window.scrollTo(0, 0);
}

async function handleDetailClick(e) {
  if (e.target.closest('.btn-volver')) {
    const viewDetail = document.getElementById('view-detail');
    viewDetail.classList.remove('detail-overlay-active');
    viewDetail.style.display = '';
    return;
  }
  if (e.target.closest('.btn-imprimir')) { window.print(); return; }
  if (e.target.closest('.btn-editar')) {
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
}

// ─── Note form ────────────────────────────────────────────────────────────────
async function showForm(noteId) {
  editingNoteId = noteId !== undefined ? noteId : null;
  const note = editingNoteId !== null ? await getNote(editingNoteId) : null;
  editingNoteModifiedEn = note?.modificadoEn || note?.creadoEn || null;

  if (note?.imagenes) {
    const resolvedImagenes = await Promise.all(note.imagenes.map(async img => {
      const url = typeof img === 'string' ? img : img.url;
      const resolvedUrl = await resolveImageUrl(url);
      return typeof img === 'string' ? resolvedUrl : { ...img, url: resolvedUrl };
    }));
    pendingImages = resolvedImagenes;
  } else {
    pendingImages = [];
  }

  openModal(renderNoteForm(note ? { ...note, imagenes: pendingImages } : null, currentSession));
  document.getElementById('nf-fecha')?.focus();

  setTimeout(() => {
    updateFinancialTotals();
    document.querySelectorAll('.nf-financiero-input').forEach(input => {
      input.addEventListener('input', updateFinancialTotals);
    });
  }, 0);
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
        await createNoteOffline({ ...fields, _session: currentSession });
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
  if (e.target === overlay) { closeModal(); return; }

  if (e.target.closest('.btn-cancelar-modal')) { closeModal(); return; }

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
      await deleteNote(noteId);
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
  container.innerHTML = notes.length > 0
    ? notes.map(renderRepartidorCard).join('')
    : '<div class="repartidor-empty">Sin notas activas para esta sucursal.</div>';
}

async function handleRepartidorClick(e) {
  if (e.target.closest('.btn-logout')) { handleLogout(); return; }

  const card = e.target.closest('.repartidor-card');
  if (!card) return;

  const noteId  = parseInt(card.dataset.noteId);
  if (isNaN(noteId)) return;
  const updated = await toggleTomada(noteId, currentSession);
  if (!updated) return;

  const newCard = document.createElement('div');
  newCard.innerHTML = renderRepartidorCard(updated).trim();
  card.replaceWith(newCard.firstElementChild);

  log.noteTomada(updated);
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

  const imgEl = document.createElement('img');
  imgEl.src = await resolveImageUrl(imgUrl);
  imgEl.alt = `Imagen ${index + 1}`;
  overlay.querySelector('.image-preview-container').appendChild(imgEl);

  document.body.appendChild(overlay);
  const closePreview = () => { overlay.remove(); revokeBlobUrls(); };
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) closePreview(); });
  overlay.querySelector('.btn-close-preview').addEventListener('click', closePreview);
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
  const oldProds = oldNote.productos.map(p => `${p.nombre}|${p.cantidad}`).join(';');
  const newProds = newFields.productos.map(p => `${p.nombre}|${p.cantidad}`).join(';');
  if (oldProds !== newProds) {
    changes.push({ field: 'productos', label: 'Productos',
      old: oldNote.productos.map(p => `${p.nombre} ×${p.cantidad}`).join(', '),
      new: newFields.productos.map(p => `${p.nombre} ×${p.cantidad}`).join(', ') });
  }
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
