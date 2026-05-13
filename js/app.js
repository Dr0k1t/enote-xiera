import { CONFIG } from './config.js';
import { getNotes, getNote, createNote, updateNote, deleteNote, moveNoteUp, moveNoteDown, seedDemoNotes } from './store.js';
import { login, clearSession, requireAuth, canSeeAll } from './auth.js';
import { compressImage, MAX_IMAGES_PER_NOTE } from './imageUtils.js';
import {
  showView, openModal, closeModal, renderToast,
  renderLoginView, renderDashboardView, refreshGrid,
  renderNoteForm, renderProductRow,
  renderDetailView, renderDiffView, renderDeleteConfirm,
  getFormData, formatFecha,
} from './ui.js';

// ─── Module state ─────────────────────────────────────────────────────────────
let currentSession     = null;
let editingNoteId      = null;
let pendingFormData    = null;
let pendingImages      = [];   // imágenes del formulario activo (existing - removed)
let currentDetailNoteId = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
init();

function init() {
  // Load Google Fonts
  const fontLink = document.createElement('link');
  fontLink.rel  = 'stylesheet';
  fontLink.href = CONFIG.googleFontsUrl;
  document.head.appendChild(fontLink);

  // Seed demo data on first load
  seedDemoNotes();

  // Create permanent view containers
  document.getElementById('app').innerHTML = `
    <div id="view-login"     class="view"></div>
    <div id="view-dashboard" class="view"></div>
    <div id="view-detail"    class="view"></div>
    <div id="modal-overlay"  class="modal-overlay"></div>`;

  // Wire all events once
  setupEventDelegation();

  // Auth check
  currentSession = requireAuth();
  if (!currentSession) {
    showLoginView();
  } else {
    showDashboard();
  }

  window.addEventListener('storage', (e) => {
    // Escuchar específicamente cambios en las notas
    if (e.key === CONFIG.storagePrefix + 'notes') {
      if (currentSession) {
        applyFilters(); 
      }
    }
  });
}

// ─── Event delegation ─────────────────────────────────────────────────────────
function setupEventDelegation() {
  const loginView = document.getElementById('view-login');
  const dash      = document.getElementById('view-dashboard');
  const detail    = document.getElementById('view-detail');
  const modal     = document.getElementById('modal-overlay');

  // Login
  loginView.addEventListener('submit', e => {
    if (e.target.id === 'login-form') { e.preventDefault(); handleLogin(); }
  });

  // Dashboard clicks
  dash.addEventListener('click', handleDashboardClick);

  // Dashboard status select change
  dash.addEventListener('change', e => {
    if (e.target.closest('.filter-estatus') || e.target.closest('.filter-destino')) {
      applyFilters();
    } else if (e.target.closest('.status-select')) {
      const card = e.target.closest('[data-note-id]');
      if (!card) return;
      handleStatusChangeInit(parseInt(card.dataset.noteId), e.target.value, card);
    }
  });

  // Search input (debounced)
  const debouncedSearch = debounce(applyFilters, 280);
  dash.addEventListener('input', e => {
    if (e.target.closest('.filter-search')) debouncedSearch();
  });

  // Detail view
  detail.addEventListener('click', handleDetailClick);

  // Modal
  modal.addEventListener('click', handleModalClick);
  modal.addEventListener('submit', e => {
    if (e.target.id === 'note-form') {
      e.preventDefault();
      handleFormSubmit(e.submitter?.dataset.action ?? 'save');
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

function handleLogin() {
  const form = document.getElementById('login-form');
  const username = form.querySelector('[name="username"]').value.trim();
  const password = form.querySelector('[name="password"]').value;
  const errorEl  = document.getElementById('login-error');

  const result = login(username, password);
  if (!result.ok) {
    errorEl.textContent = result.error;
    form.querySelector('[name="password"]').value = '';
    return;
  }
  currentSession = result.session;
  showDashboard();
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function showDashboard() {
  // Render with ALL notes for this user — filters reset to default with new DOM
  const notes = getBaseNotes();
  document.getElementById('view-dashboard').innerHTML = renderDashboardView(notes, currentSession);
  showView('dashboard');
}

function getBaseNotes() {
  let notes = getNotes();
  if (!canSeeAll(currentSession)) {
    notes = notes.filter(n => n.destino === currentSession.destino);
  }
  return notes;
}

function getFilteredNotes() {
  let notes = getBaseNotes();
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

function applyFilters() {
  refreshGrid(getFilteredNotes(), currentSession);
}

// ─── Dashboard click handler ──────────────────────────────────────────────────
function handleDashboardClick(e) {
  const card   = e.target.closest('[data-note-id]');
  const noteId = card ? parseInt(card.dataset.noteId) : null;

  if (e.target.closest('.btn-logout'))         { handleLogout(); return; }
  if (e.target.closest('.btn-nueva'))          { showForm(null); return; }
  if (e.target.closest('.btn-ver') && noteId)  { showDetail(noteId); return; }
  if (e.target.closest('.btn-editar') && noteId) { showForm(noteId); return; }
  if (e.target.closest('.btn-eliminar') && noteId) { confirmDelete(noteId); return; }

  if (e.target.closest('.btn-priority-up') && noteId) {
    moveNoteUp(noteId);
    applyFilters();
    return;
  }
  if (e.target.closest('.btn-priority-down') && noteId) {
    moveNoteDown(noteId);
    applyFilters();
    return;
  }

  if (e.target.closest('.btn-confirm-status')) {
    const btn = e.target.closest('.btn-confirm-status');
    handleConfirmStatus(parseInt(btn.dataset.noteId), btn.dataset.status);
    return;
  }
  if (e.target.closest('.btn-cancel-status')) {
    applyFilters();
    return;
  }
}

// ─── Status change (planta) ──────────────────────────────────────────────────
function handleStatusChangeInit(noteId, newStatus, cardEl) {
  const note = getNote(noteId);
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
    updateNote(noteId, { estatus: newStatus }, currentSession);
    applyFilters();
    renderToast(`Estado: ${newStatus}`, 'success');
  }
}

function handleConfirmStatus(noteId, newStatus) {
  updateNote(noteId, { estatus: newStatus }, currentSession);
  applyFilters();
  renderToast(`Estado cambiado a "${newStatus}"`, 'success');
}

// ─── Detail view ─────────────────────────────────────────────────────────────
function showDetail(noteId) {
  let note = getNote(noteId);
  if (!note) { showDashboard(); return; }

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
      updateNote(noteId, updates, currentSession);
      note = getNote(noteId); // Refrescar datos
      applyFilters(); // Disparar actualización de UI en background
    }
  }

  currentDetailNoteId = noteId;
  document.getElementById('view-detail').innerHTML = renderDetailView(note, currentSession);
  showView('detail');
}

// ─── Detail click handler ────────────────────────────────────────────────────
function handleDetailClick(e) {
  if (e.target.closest('.btn-volver'))   { showDashboard(); return; }
  if (e.target.closest('.btn-imprimir')) { window.print(); return; }
  if (e.target.closest('.btn-editar')) {
    const btn = e.target.closest('.btn-editar');
    showForm(parseInt(btn.dataset.noteId));
    return;
  }
  if (e.target.closest('.image-selector-btn')) {
    const btn = e.target.closest('.image-selector-btn');
    showImagePreview(parseInt(btn.dataset.imageIndex));
    return;
  }
}

// ─── Note form ────────────────────────────────────────────────────────────────
function showForm(noteId) {
  editingNoteId = noteId !== undefined ? noteId : null;
  const note = editingNoteId !== null ? getNote(editingNoteId) : null;
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
    const existing = getNote(editingNoteId);
    if (existing && CONFIG.confirmEditStatuses.includes(existing.estatus)) {
      const diff = computeDiff(existing, fields);
      if (diff.length > 0) {
        pendingFormData = { noteId: editingNoteId, fields, action };
        openModal(renderDiffView(diff, existing.estatus));
        return;
      }
    }
    updateNote(editingNoteId, fields, currentSession);
    closeModal();
    if (action === 'preview') {
      showDetail(editingNoteId);
    } else {
      showDashboard();
      renderToast('Nota actualizada', 'success');
    }
    editingNoteId = null;
  } else {
    const note = createNote(fields, currentSession);
    closeModal();
    editingNoteId = null;
    if (action === 'preview') {
      showDetail(note.id);
    } else {
      showDashboard();
      renderToast('Nota creada', 'success');
    }
  }
}

// ─── Modal click handler ──────────────────────────────────────────────────────
function handleModalClick(e) {
  const overlay = document.getElementById('modal-overlay');
  if (e.target === overlay) { closeModal(); return; }

  if (e.target.closest('.btn-cancelar-modal')) { closeModal(); return; }

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
    showForm(editingNoteId);
    return;
  }

  if (e.target.closest('.btn-confirmar-diff')) {
    if (!pendingFormData) return;
    const { noteId, fields, action } = pendingFormData;
    pendingFormData = null;
    updateNote(noteId, fields, currentSession);
    closeModal();
    if (action === 'preview') {
      showDetail(noteId);
    } else {
      showDashboard();
      renderToast('Nota actualizada', 'success');
    }
    editingNoteId = null;
    return;
  }

  if (e.target.closest('.btn-confirmar-delete')) {
    const btn    = e.target.closest('.btn-confirmar-delete');
    const noteId = parseInt(btn.dataset.noteId);
    deleteNote(noteId);
    closeModal();
    showDashboard();
    renderToast('Nota eliminada', 'info');
    return;
  }
}

// ─── Image preview overlay ────────────────────────────────────────────────────
function showImagePreview(index) {
  const note = getNote(currentDetailNoteId);
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
function confirmDelete(noteId) {
  const note = getNote(noteId);
  if (!note) return;
  openModal(renderDeleteConfirm(note));
}

// ─── Logout ───────────────────────────────────────────────────────────────────
function handleLogout() {
  clearSession();
  currentSession  = null;
  editingNoteId   = null;
  pendingFormData = null;
  // Clear stale view content to prevent cross-session data leaks in DOM
  document.getElementById('view-dashboard').innerHTML = '';
  document.getElementById('view-detail').innerHTML    = '';
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
