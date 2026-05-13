import { CONFIG } from './config.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function statusClass(estatus) {
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

function role(session) { return CONFIG.roles[session?.role] ?? {}; }

// ─── View router ─────────────────────────────────────────────────────────────

export function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + id);
  if (el) el.classList.add('active');
}

// ─── Modal ───────────────────────────────────────────────────────────────────

export function openModal(html) {
  const overlay = document.getElementById('modal-overlay');
  overlay.innerHTML = html;
  overlay.classList.add('visible');
}

export function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('visible');
  overlay.innerHTML = '';
}

// ─── Toasts ──────────────────────────────────────────────────────────────────

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
  setTimeout(() => el.remove(), 3200);
}

// ─── Login ───────────────────────────────────────────────────────────────────

export function renderLoginView() {
  return `
  <div class="login-card">
    <div class="login-brand">
      <div class="login-brand-name">${esc(CONFIG.clientName)}</div>
      <div class="login-brand-sub">${esc(CONFIG.clientSubtitle)}</div>
    </div>
    <form class="login-form" id="login-form" novalidate>
      <div class="form-group">
        <label class="form-label" for="inp-user">Usuario</label>
        <input class="form-input" id="inp-user" name="username"
          type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="inp-pass">Contraseña</label>
        <input class="form-input" id="inp-pass" name="password"
          type="password" autocomplete="current-password" required>
      </div>
      <div class="form-group" style="margin-top:var(--space-5)">
        <button type="submit" class="btn btn-primary btn-full">Entrar</button>
      </div>
      <div class="login-error" id="login-error"></div>
    </form>
  </div>`;
}

// ─── Header ──────────────────────────────────────────────────────────────────

function renderHeader(session) {
  const chipClasses = { admin: 'role-chip role-chip--admin', sucursal: 'role-chip role-chip--sucursal' };
  const chipClass = chipClasses[session.role] ?? 'role-chip';
  return `
  <header class="app-header">
    <div class="header-brand">
      ${esc(CONFIG.appName)}<span>${esc(CONFIG.clientName)}</span>
    </div>
    <div class="header-right">
      <span class="header-user">
        ${esc(session.username)}&nbsp;<span class="${chipClass}">${esc(session.role)}</span>
      </span>
      <button class="btn btn-ghost btn-sm btn-logout">Salir</button>
    </div>
  </header>`;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export function renderDashboardView(notes, session) {
  const r = role(session);
  const destinoFilter = r.canSeeAll ? `
    <select class="form-select filter-destino">
      <option value="">Todos los destinos</option>
      ${CONFIG.locations.map(l => `<option value="${esc(l)}">${esc(l)}</option>`).join('')}
    </select>` : '';

  const createBtn = r.canCreate ? `
    <div class="toolbar-actions">
      <button class="btn btn-primary btn-nueva">+ Nueva nota</button>
    </div>` : '';

  const grid = notes.length > 0
    ? `<div class="notes-grid" id="notes-grid">${notes.map(n => renderNoteCard(n, session)).join('')}</div>`
    : `<div class="notes-grid" id="notes-grid">${renderEmptyState()}</div>`;

  return `
  ${renderHeader(session)}
  <main class="dashboard-main">
    <div class="dashboard-toolbar">
      <div class="toolbar-filters">
        <input class="form-input filter-search" type="search" placeholder="Buscar nota…" aria-label="Buscar">
        <select class="form-select filter-estatus">
          <option value="">Todos los estados</option>
          ${CONFIG.statuses.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}
        </select>
        ${destinoFilter}
      </div>
      ${createBtn}
    </div>
    ${grid}
  </main>`;
}

export function refreshGrid(notes, session) {
  const grid = document.getElementById('notes-grid');
  if (!grid) return;
  if (notes.length > 0) {
    grid.innerHTML = notes.map(n => renderNoteCard(n, session)).join('');
  } else {
    grid.innerHTML = renderEmptyState();
  }
}

function renderEmptyState() {
  return `
  <div class="empty-state">
    <div class="empty-state__icon">📋</div>
    <div class="empty-state__title">Sin notas</div>
    <p class="empty-state__desc">No hay notas que coincidan con los filtros.</p>
  </div>`;
}

// ─── Note Card ───────────────────────────────────────────────────────────────

export function renderNoteCard(note, session) {
  const r = role(session);
  const badge = `<span class="badge badge--${statusClass(note.estatus)}">${esc(note.estatus)}</span>`;

  // Indicator classes — only for planta role
  const isPlanta = !r.canEdit;
  const isUnreadNew      = isPlanta && !!note.unreadNew;
  const isUnreadModified = isPlanta && !!note.unreadModified;
  let cardClass = 'note-card';
  if (isUnreadNew)      cardClass += ' indicator-new';
  if (isUnreadModified) cardClass += ' indicator-modified';

  // Footer buttons / controls differ by role
  let footer;
  if (isPlanta) {
    let statusCtrl;
    if (note.estatus === 'Cancelada') {
      statusCtrl = `<span style="font-size:0.78rem;color:var(--color-text-muted);font-style:italic">Cancelada</span>`;
    } else if (note.estatus === 'Nueva') {
      // Auto-transitions to "En Proceso" when planta opens it
      statusCtrl = `<span style="font-size:0.78rem;color:var(--color-text-muted);font-style:italic">→ Abre para iniciar</span>`;
    } else {
      statusCtrl = renderStatusSelector(note, session);
    }
    footer = `
    <div class="note-card__status-row">${statusCtrl}</div>
    <div class="priority-controls">
      <button class="btn btn-ghost btn-icon btn-priority-up" title="Subir prioridad">↑</button>
      <button class="btn btn-ghost btn-icon btn-priority-down" title="Bajar prioridad">↓</button>
    </div>
    <button class="btn btn-secondary btn-sm btn-ver">Ver</button>`;
  } else {
    // Admin: action buttons only (badge already shown in top)
    footer = `
    <div style="margin-left:auto;display:flex;gap:var(--space-2);flex-wrap:wrap">
      <button class="btn btn-ghost btn-sm btn-ver">Ver</button>
      <button class="btn btn-secondary btn-sm btn-editar">Editar</button>
      <button class="btn btn-ghost btn-sm btn-eliminar" style="color:#c0392b">Eliminar</button>
    </div>`;
  }

  const prodCount = note.productos.length;
  const prodLabel = prodCount === 1 ? '1 producto' : `${prodCount} productos`;

  return `
  <div class="${cardClass}" data-note-id="${note.id}">
    <div class="note-card__top">
      <div class="note-card__numero">${esc(note.numero)}</div>
      ${badge}
    </div>
    <div class="note-card__meta">
      <div class="note-card__meta-row">
        <span class="meta-icon">📅</span>${esc(formatFecha(note.fecha))}
      </div>
      <div class="note-card__meta-row">
        <span class="meta-icon">📍</span>${esc(note.destino)}
      </div>
    </div>
    <div class="note-card__prods">${esc(prodLabel)}: ${esc(note.productos.map(p => p.nombre).join(', '))}</div>
    <div class="note-card__footer">${footer}</div>
  </div>`;
}

function renderStatusSelector(note, session) {
  const allowedStatuses = ['En Proceso', 'Completada'];
  const opts = allowedStatuses.map(s =>
    `<option value="${esc(s)}" ${s === note.estatus ? 'selected' : ''}>${esc(s)}</option>`
  ).join('');
  return `<select class="form-select status-select" style="font-size:0.8rem;padding:4px 28px 4px 8px">${opts}</select>`;
}

// ─── Image upload section (used by renderNoteForm) ───────────────────────────

function renderImageUploadSection(note, r) {
  const canUpload = r.canCreate || r.canEdit;
  const existing  = note?.imagenes || [];

  const thumbs = existing.map((img, idx) => `
    <div class="image-preview-item" data-image-id="${esc(img.id)}">
      <img src="${esc(img.url)}" alt="Imagen ${idx + 1}" width="60" height="60" style="object-fit:cover;border-radius:4px;">
      ${canUpload ? `<button type="button" class="btn-remove-image" data-image-id="${esc(img.id)}" aria-label="Eliminar imagen ${idx + 1}">✕</button>` : ''}
    </div>`).join('');

  if (!canUpload) {
    if (!existing.length) return '';
    return `
    <div class="form-group">
      <label class="form-label">Imágenes adjuntas</label>
      <div class="image-previews">${thumbs}</div>
    </div>`;
  }

  return `
  <div class="form-group">
    <label class="form-label">Imágenes <span class="form-label-hint">(máx 3 · WebP 40%)</span></label>
    <div class="image-previews" id="existing-image-previews">${thumbs}</div>
    <div id="image-counter" class="form-hint"${existing.length ? '' : ' style="display:none"'}>${existing.length}/3 imagen(es) adjunta(s)</div>
    <input type="file" id="nf-imagenes" name="imagenes" accept="image/*" multiple class="form-input image-file-input">
    <p class="form-hint">Nuevas imágenes se comprimen automáticamente a WebP.</p>
  </div>`;
}

// ─── Note Form ───────────────────────────────────────────────────────────────

export function renderNoteForm(note, session) {
  const isEdit = note !== null;
  const title = isEdit ? `Editar ${esc(note.numero)}` : 'Nueva nota';
  const today = new Date().toISOString().slice(0, 10);
  const fecha = isEdit ? note.fecha : today;
  const destino = isEdit ? note.destino : CONFIG.defaultDestino;
  const obs = isEdit ? note.observaciones : '';
  const productos = isEdit && note.productos.length > 0
    ? note.productos
    : [{ nombre: '', cantidad: '' }];

  const destinoOpts = CONFIG.locations.map(l =>
    `<option value="${esc(l)}" ${l === destino ? 'selected' : ''}>${esc(l)}</option>`
  ).join('');

  const prodRows = productos.map(p => renderProductRow(p)).join('');

  return `
  <div class="modal-card">
    <div class="modal-header">
      <h2 class="modal-title">${title}</h2>
      <button type="button" class="btn btn-ghost btn-icon btn-cancelar-modal" aria-label="Cerrar">✕</button>
    </div>
    <div class="modal-body">
      <form id="note-form" novalidate>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4)">
          <div class="form-group">
            <label class="form-label" for="nf-fecha">Fecha</label>
            <input class="form-input" id="nf-fecha" name="fecha" type="date" value="${esc(fecha)}" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="nf-destino">Destino</label>
            <select class="form-select" id="nf-destino" name="destino" required>
              ${destinoOpts}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Productos</label>
          <table class="products-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="prod-tbody">
              ${prodRows}
            </tbody>
          </table>
          <button type="button" class="btn-add-row">+ Agregar producto</button>
        </div>

        <div class="form-group">
          <label class="form-label" for="nf-obs">Observaciones</label>
          <textarea class="form-textarea" id="nf-obs" name="observaciones"
            placeholder="Instrucciones especiales, horarios de entrega…"
            rows="3">${esc(obs)}</textarea>
        </div>

        ${renderImageUploadSection(note, role(session))}
      </form>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-ghost btn-cancelar-modal">Cancelar</button>
      <button type="submit" form="note-form" class="btn btn-secondary" data-action="preview">Previsualizar</button>
      <button type="submit" form="note-form" class="btn btn-primary" data-action="save">Guardar</button>
    </div>
  </div>`;
}

export function renderProductRow(prod = { nombre: '', cantidad: '' }) {
  return `
  <tr class="prod-row">
    <td class="prod-nombre">
      <input class="form-input prod-nombre-inp" type="text"
        placeholder="Nombre del producto" value="${esc(prod.nombre)}" autocomplete="off">
    </td>
    <td class="prod-cantidad">
      <input class="form-input prod-cantidad-inp" type="text"
        placeholder="Ej. 20" value="${esc(prod.cantidad)}" autocomplete="off">
    </td>
    <td class="prod-actions">
      <button type="button" class="btn btn-ghost btn-icon btn-remove-row" title="Quitar fila">✕</button>
    </td>
  </tr>`;
}

// ─── Detail View ─────────────────────────────────────────────────────────────

export function renderDetailView(note, session) {
  const r = role(session);
  const editBtn = r.canEdit
    ? `<button class="btn btn-secondary btn-editar" data-note-id="${note.id}">Editar</button>`
    : '';

  const prodRows = note.productos.map(p => `
    <tr>
      <td>${esc(p.nombre)}</td>
      <td>${esc(p.cantidad)}</td>
    </tr>`).join('');

  const obsContent = note.observaciones
    ? esc(note.observaciones)
    : '<em class="detail-obs--empty">Sin observaciones</em>';

  const images = note.imagenes || [];
  const imagePanel = images.length > 0 ? `
    <div class="image-selector-panel">
      <div class="image-selector-title">Imágenes</div>
      ${images.map((img, idx) => `
        <button type="button" class="btn btn-secondary btn-sm image-selector-btn"
          data-image-index="${idx}">
          Imagen ${idx + 1}
        </button>`).join('')}
    </div>` : '';

  return `
  <div class="detail-toolbar">
    <button class="btn btn-ghost btn-volver">← Volver</button>
    <div class="detail-toolbar-spacer"></div>
    ${editBtn}
    <button class="btn btn-primary btn-imprimir">🖨 Imprimir / PDF</button>
  </div>

  <div class="detail-wrapper">
    <div class="detail-layout">
    <div class="detail-card">
      <div class="detail-header">
        <div>
          <div class="detail-brand-name">${esc(CONFIG.clientName)}</div>
          <div class="detail-brand-sub">${esc(CONFIG.clientSubtitle)}</div>
        </div>
        <div>
          <div class="detail-numero">${esc(note.numero)}</div>
          <div style="font-size:0.75rem;color:var(--color-text-muted);text-align:right;margin-top:4px">
            Nota de Remisión
          </div>
        </div>
      </div>

      <div class="detail-body">
        <div class="detail-status-row">
          <span class="detail-status-label">Estado:</span>
          <span class="badge badge--${statusClass(note.estatus)}">${esc(note.estatus)}</span>
        </div>

        <div class="detail-meta-grid">
          <div class="detail-meta-item">
            <div class="detail-meta-label">Fecha</div>
            <div class="detail-meta-value">${esc(formatFecha(note.fecha))}</div>
          </div>
          <div class="detail-meta-item">
            <div class="detail-meta-label">Destino</div>
            <div class="detail-meta-value">${esc(note.destino)}</div>
          </div>
          <div class="detail-meta-item">
            <div class="detail-meta-label">Elaboró</div>
            <div class="detail-meta-value">${esc(note.creadoPor)}</div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">Productos</div>
          <table class="detail-products-table">
            <thead>
              <tr><th>Producto</th><th>Cantidad</th></tr>
            </thead>
            <tbody>${prodRows}</tbody>
          </table>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">Observaciones</div>
          <div class="detail-obs">${obsContent}</div>
        </div>
      </div>

      <div class="detail-footer">
        <div class="detail-sig-block">
          <div style="height:36px"></div>
          <div class="detail-sig-line">Autorizado por</div>
        </div>
        <div class="detail-sig-block">
          <div style="height:36px"></div>
          <div class="detail-sig-line">Recibido por</div>
        </div>
      </div>

      <div class="detail-timestamps">
        <span>Creado: ${esc(formatTs(note.creadoEn))} por ${esc(note.creadoPor)}</span>
        <span>Modificado: ${esc(formatTs(note.modificadoEn))} por ${esc(note.modificadoPor)}</span>
      </div>
    </div>
    ${imagePanel}
    </div>
  </div>`;
}

// ─── Diff view ───────────────────────────────────────────────────────────────

export function renderDiffView(changes, estatus) {
  const items = changes.map(c => `
    <div class="diff-field">
      <span class="diff-field__label">${esc(c.label)}</span>
      <span class="diff-val--old">${esc(c.old)}</span>
      <span class="diff-arrow">→</span>
      <span class="diff-val--new">${esc(c.new)}</span>
    </div>`).join('');

  return `
  <div class="modal-card">
    <div class="modal-header">
      <h2 class="modal-title">Confirmar cambios</h2>
    </div>
    <div class="modal-body">
      <div class="diff-alert">
        <div class="diff-alert__title">
          ⚠ Esta nota está en estado <strong>"${esc(estatus)}"</strong>.
          Los siguientes campos cambiarán:
        </div>
        ${items}
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-ghost btn-volver-editar">← Volver a editar</button>
      <button type="button" class="btn btn-primary btn-confirmar-diff">Confirmar cambios</button>
    </div>
  </div>`;
}

// ─── Delete confirm ──────────────────────────────────────────────────────────

export function renderDeleteConfirm(note) {
  return `
  <div class="modal-card">
    <div class="modal-header">
      <h2 class="modal-title">Eliminar nota</h2>
    </div>
    <div class="modal-body">
      <p style="font-size:0.95rem;line-height:1.6">
        ¿Eliminar la nota <strong>${esc(note.numero)}</strong>?<br>
        <span style="color:var(--color-text-muted)">Esta acción no se puede deshacer.</span>
      </p>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-ghost btn-cancelar-modal">Cancelar</button>
      <button type="button" class="btn btn-danger btn-confirmar-delete" data-note-id="${note.id}">Eliminar</button>
    </div>
  </div>`;
}

// ─── Form data extraction ─────────────────────────────────────────────────────

export function getFormData() {
  const form = document.getElementById('note-form');
  if (!form) return null;
  const fecha = form.querySelector('[name="fecha"]').value;
  const destino = form.querySelector('[name="destino"]').value;
  const observaciones = (form.querySelector('[name="observaciones"]').value || '').trim();
  const productos = [];
  form.querySelectorAll('.prod-row').forEach(row => {
    const nombre = (row.querySelector('.prod-nombre-inp').value || '').trim();
    const cantidad = (row.querySelector('.prod-cantidad-inp').value || '').trim();
    if (nombre) productos.push({ nombre, cantidad });
  });
  return { fecha, destino, productos, observaciones };
}
