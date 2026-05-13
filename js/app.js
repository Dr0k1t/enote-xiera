import { CONFIG } from './config.js';
import { getNotes, getNote, createNote, updateNote, deleteNote, moveNoteUp, moveNoteDown, seedDemoNotes, toggleTomada } from './store.js';
import { login, clearSession, requireAuth, canSeeAll, logout, isDemoMode } from './auth.js';
import { compressImage, MAX_IMAGES_PER_NOTE } from './imageUtils.js';
import { log } from './logger.js';
import { syncPendingNotes } from './offline.js';
import { isOnline } from './offline.js';

import {
  showView, openModal, closeModal, renderToast, formatFecha,
} from './ui/shared.js';

import { renderLoginView } from './ui/login.js';
import { renderDashboardView, refreshGrid } from './ui/dashboard.js';
import { renderNoteForm, renderProductRow, getFormData } from './ui/form.js';
import { renderDetailView, renderDiffView, renderDeleteConfirm } from './ui/detail.js';
import { renderRepartidorView, renderRepartidorCard } from './ui/repartidor.js';

// ─── Module state ─────────────────────────────────────────────────────────────
let currentSession     = null;
let editingNoteId      = null;
let pendingFormData    = null;
let pendingImages      = [];   // imágenes del formulario activo (existing - removed)
let currentDetailNoteId = null;

// ─── Service Worker ───────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(reg => console.log('SW registered:', reg.scope))
    .catch(err => console.warn('SW registration failed:', err));
}

// ─── Init ─────────────────────────────────────────────────────────────────────
init();

async function init() {
  // Load Google Fonts
  const fontLink = document.createElement('link');
  fontLink.rel  = 'stylesheet';
  fontLink.href = CONFIG.googleFontsUrl;
  document.head.appendChild(fontLink);

  // Seed demo data on first load
  seedDemoNotes();

  // Create permanent view containers
  document.getElementById('app').innerHTML = `
    <div id="view-login"       class="view"></div>
    <div id="view-dashboard"   class="view"></div>
    <div id="view-detail"      class="view"></div>
    <div id="view-repartidor"  class="view"></div>
    <div id="modal-overlay"    class="modal-overlay"></div>`;

  // Wire all events once
  setupEventDelegation();

  // Auth check
  currentSession = requireAuth();
  if (!currentSession) {
    showLoginView();
  } else {
    await routeByRole();
  }

  window.addEventListener('storage', async (e) => {
    // Escuchar específicamente cambios en las notas
    if (e.key === CONFIG.storagePrefix + 'notes') {
      if (currentSession) {
        await applyFilters(); 
      }
    }
  });

  window.addEventListener('online', async () => {
    updateOnlineIndicator(true);
    renderToast('Conexión restaurada', 'success');
    if (currentSession) {
      await syncPendingNotes(createNote);
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

  // Login
  loginView.addEventListener('submit', async e => {
    if (e.target.id === 'login-form') { e.preventDefault(); await handleLogin(); }
  });

  // Dashboard clicks
  dash.addEventListener('click', handleDashboardClick);

  // Dashboard status select change
  dash.addEventListener('change', async e => {
    if (e.target.closest('.filter-estatus') || e.target.closest('.filter-destino')) {
      await applyFilters();
    } else if (e.target.closest('.status-select')) {
      const card = e.target.closest('[data-note-id]');
      const id = card ? parseInt(card.dataset.noteId) : NaN;
      if (isNaN(id)) return;
      await handleStatusChangeInit(id, e.target.value, card);
    }
  });

  // Search input (debounced)
  const debouncedSearch = debounce(async () => await applyFilters(), 280);
  dash.addEventListener('input', e => {
    if (e.target.closest('.filter-search')) debouncedSearch();
  });

  // Detail view
  detail.addEventListener('click', handleDetailClick);

  // Repartidor view
  const repartidor = document.getElementById('view-repartidor');
  repartidor.addEventListener('click', handleRepartidorClick);
  repartidor.addEventListener('change', async e => {
    if (e.target.id === 'repartidor-sucursal') await renderNotasRepartidor(e.target.value);
  });

  // Modal
  modal.addEventListener('click', handleModalClick);
  modal.addEventListener('submit', async e => {
    if (e.target.id === 'note-form') {
      e.preventDefault();
      await handleFormSubmit(e.submitter?.dataset.action ?? 'save');
    }
  });

  // File input: show count of selected files
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

  // Add product row (delegated from modal)
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

  // Escape key closes modal
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

  const result = await login(username, password);
  if (!result.ok) {
    errorEl.textContent = result.error;
    form.querySelector('[name="password"]').value = '';
    return;
  }
  currentSession = result.session;
  log.sessionStart(currentSession);
  await routeByRole();
}

// ─── Route por rol ───────────────────────────────────────────────────────────
async function routeByRole() {
  if (currentSession.role === 'repartidor') { await showRepartidor(); return; }
  await showDashboard();
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function showDashboard() {
  // Render with ALL notes for this user — filters reset to default with new DOM
  const notes = await getBaseNotes();
  document.getElementById('view-dashboard').innerHTML = renderDashboardView(notes, currentSession);
  showView('dashboard');
}

async function getBaseNotes() {
  let notes = await getNotes();
  if (!canSeeAll(currentSession)) {
    notes = notes.filter(n => n.destino === currentSession.destino);
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
      n.observaciones.toLowerCase().includes(searchFilter) ||
      n.destino.toLowerCase().includes(searchFilter) ||
      n.productos.some(p => p.nombre.toLowerCase().includes(searchFilter))
    );
  }
  return notes;
}

async function applyFilters() {
  const notes = await getFilteredNotes();
  refreshGrid(notes, currentSession);
}

// ─── Dashboard click handler ──────────────────────────────────────────────────
async function handleDashboardClick(e) {
  const card   = e.target.closest('[data-note-id]');
  const noteId = card ? parseInt(card.dataset.noteId) : NaN;

  if (e.target.closest('.btn-logout'))         { handleLogout(); return; }
  if (e.target.closest('.btn-nueva'))          { await showForm(null); return; }

  if (isNaN(noteId)) {
    if (e.target.closest('.btn-confirm-status')) {
      const btn = e.target.closest('.btn-confirm-status');
      const id = parseInt(btn.dataset.noteId);
      if (!isNaN(id)) await handleConfirmStatus(id, btn.dataset.status);
    }
    return;
  }

  if (e.target.closest('.btn-ver'))  { await showDetail(noteId); return; }
  if (e.target.closest('.btn-editar')) { await showForm(noteId); return; }
  if (e.target.closest('.btn-eliminar')) { await confirmDelete(noteId); return; }

  if (e.target.closest('.btn-priority-up')) {
    await moveNoteUp(noteId);
    await applyFilters();
    return;
  }
  if (e.target.closest('.btn-priority-down')) {
    await moveNoteDown(noteId);
    await applyFilters();
    return;
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

    const bar = document.createElement('div');
    bar.className = 'status-confirm-bar';
    bar.innerHTML = `
      <span class="confirm-label">¿Cambiar a <strong>"${newStatus}"</strong>?</span>
      <button type="button" class="btn btn-sm btn-primary btn-confirm-status"
        data-note-id="${noteId}" data-status="${newStatus}">Confirmar</button>
      <button type="button" class="btn btn-sm btn-ghost btn-cancel-status">Cancelar</button>`;
    footer?.insertBefore(bar, footer.firstChild);
  } else {
    await updateNote(noteId, { estatus: newStatus }, currentSession);
    await applyFilters();
    renderToast(`Estado: ${newStatus}`, 'success');
  }
}

async function handleConfirmStatus(noteId, newStatus) {
  await updateNote(noteId, { estatus: newStatus }, currentSession);
  await applyFilters();
  renderToast(`Estado cambiado a "${newStatus}"`, 'success');
}

// ─── Detail view ─────────────────────────────────────────────────────────────
async function showDetail(noteId) {
  let note = await getNote(noteId);
  if (!note) { await showDashboard(); return; }

  // Lógica de auto-lectura y transición de estado para la planta
  if (currentSession.role === 'planta') {
    const updates = {};
    if (note.unreadNew) {
      updates.unreadNew = false;
      if (note.estatus === 'Nueva') {
        updates.estatus = 'En Proceso';
      }
    }
    if (note.unreadModified) {
      updates.unreadModified = false;
    }

    if (Object.keys(updates).length > 0) {
      const result = await updateNote(noteId, updates, currentSession);
      if (result) note = result.new;
    }
  }

  currentDetailNoteId = noteId;
  document.getElementById('view-detail').innerHTML = renderDetailView(note, currentSession);
  showView('detail');
  window.scrollTo(0, 0);
}

// ─── Detail click handler ────────────────────────────────────────────────────
async function handleDetailClick(e) {
  if (e.target.closest('.btn-volver'))   { await showDashboard(); return; }
  if (e.target.closest('.btn-imprimir')) { window.print(); return; }
  if (e.target.closest('.btn-editar')) {
    const btn = e.target.closest('.btn-editar');
    const id = parseInt(btn.dataset.noteId);
    if (!isNaN(id)) await showForm(id);
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
  pendingImages = note?.imagenes ? [...note.imagenes] : [];
  openModal(renderNoteForm(note, currentSession));
  document.getElementById('nf-fecha')?.focus();
}

async function handleFormSubmit(action) {
  const fields = getFormData();
  if (!fields || !validateForm(fields)) return;

  // Comprimir nuevas imágenes y combinar con las que sobreviven la edición
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
    const result = await updateNote(editingNoteId, fields, currentSession);
    if (result) log.noteUpdated(result.new);
    closeModal();
    if (action === 'preview') {
      await showDetail(editingNoteId);
    } else {
      await showDashboard();
      renderToast('Nota actualizada', 'success');
    }
    editingNoteId = null;
  } else {
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
  }
}

// ─── Modal click handler ──────────────────────────────────────────────────────
async function handleModalClick(e) {
  const overlay = document.getElementById('modal-overlay');
  if (e.target === overlay) { closeModal(); return; }

  // Corregido: capturar clics en botones de cancelar/cerrar modal
  if (e.target.closest('.btn-cancelar-modal')) { 
    closeModal(); 
    return; 
  }

  if (e.target.closest('.btn-remove-image')) {
    const btn     = e.target.closest('.btn-remove-image');
    const imageId = btn.dataset.imageId;
    pendingImages = pendingImages.filter(img => img.id !== imageId);
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
    await updateNote(noteId, fields, currentSession);
    closeModal();
    if (action === 'preview') {
      await showDetail(noteId);
    } else {
      await showDashboard();
      renderToast('Nota actualizada', 'success');
    }
    editingNoteId = null;
    return;
  }

  // Corregido: asegurar captura de confirmación de eliminación
  if (e.target.closest('.btn-confirmar-delete')) {
    const btn    = e.target.closest('.btn-confirmar-delete');
    const noteId = parseInt(btn.dataset.noteId);
    if (isNaN(noteId)) return;
    await deleteNote(noteId);
    closeModal();
    await showDashboard();
    renderToast('Nota eliminada', 'info');
    return;
  }
}

// ─── Repartidor view ─────────────────────────────────────────────────────────
async function showRepartidor() {
  document.getElementById('view-repartidor').innerHTML = renderRepartidorView(currentSession);
  showView('repartidor');
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

  // Reemplazar solo esa card en el DOM
  const newCard = document.createElement('div');
  newCard.innerHTML = renderRepartidorCard(updated).trim();
  card.replaceWith(newCard.firstElementChild);

  log.noteTomada(updated);
}

// ─── Image preview overlay ────────────────────────────────────────────────────
async function showImagePreview(index) {
  const note = await getNote(currentDetailNoteId);
  if (!note?.imagenes?.[index]) return;
  const img = note.imagenes[index];

  const overlay = document.createElement('div');
  overlay.className = 'image-preview-overlay';
  overlay.innerHTML = `
    <div class="image-preview-container">
      <button class="btn btn-ghost btn-close-preview" aria-label="Cerrar">✕</button>
    </div>`;

  const imgEl = document.createElement('img');
  imgEl.src = img.url;
  imgEl.alt = `Imagen ${index + 1}`;
  overlay.querySelector('.image-preview-container').appendChild(imgEl);

  document.body.appendChild(overlay);
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) overlay.remove(); });
  overlay.querySelector('.btn-close-preview').addEventListener('click', () => overlay.remove());
}

// ─── Delete confirm ───────────────────────────────────────────────────────────
async function confirmDelete(noteId) {
  const note = await getNote(noteId);
  if (!note) return;
  openModal(renderDeleteConfirm(note));
}

// ─── Logout ───────────────────────────────────────────────────────────────────
async function handleLogout() {
  await logout();
  currentSession  = null;
  editingNoteId   = null;
  pendingFormData = null;
  // Clear stale view content to prevent cross-session data leaks in DOM
  document.getElementById('view-dashboard').innerHTML  = '';
  document.getElementById('view-detail').innerHTML     = '';
  document.getElementById('view-repartidor').innerHTML = '';
  closeModal();
  showLoginView();
}

// ─── Diff computation ─────────────────────────────────────────────────────────
function computeDiff(oldNote, newFields) {
  const changes = [];
  if (oldNote.fecha !== newFields.fecha) {
    changes.push({ field: 'fecha', label: 'Fecha',
      old: formatFecha(oldNote.fecha), new: formatFecha(newFields.fecha) });
  }
  if (oldNote.destino !== newFields.destino) {
    changes.push({ field: 'destino', label: 'Destino',
      old: oldNote.destino, new: newFields.destino });
  }
  const oldObs = (oldNote.observaciones || '').trim();
  const newObs = (newFields.observaciones || '').trim();
  if (oldObs !== newObs) {
    changes.push({ field: 'observaciones', label: 'Observaciones',
      old: oldObs || '(vacío)', new: newObs || '(vacío)' });
  }
  const oldProds = oldNote.productos.map(p => `${p.nombre}|${p.cantidad}`).join(';');
  const newProds = newFields.productos.map(p => `${p.nombre}|${p.cantidad}`).join(';');
  if (oldProds !== newProds) {
    changes.push({ field: 'productos', label: 'Productos',
      old: oldNote.productos.map(p => `${p.nombre} ×${p.cantidad}`).join(', '),
      new: newFields.productos.map(p => `${p.nombre} ×${p.cantidad}`).join(', ') });
  }
  return changes;
}

// ─── Validation ───────────────────────────────────────────────────────────────
function validateForm(fields) {
  if (!fields.fecha) { renderToast('La fecha es requerida', 'error'); return false; }
  if (!fields.destino) { renderToast('El destino es requerido', 'error'); return false; }
  if (fields.productos.length === 0) { renderToast('Agrega al menos un producto', 'error'); return false; }
  return true;
}

// ─── Debounce ─────────────────────────────────────────────────────────────────
function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

// ─── Online/Offline indicator ──────────────────────────────────────────────────
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
