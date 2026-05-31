/// <reference path="../types.js" />
import { CONFIG } from '../config.js';
import { esc, formatFecha, statusClass, role, renderHeader } from './shared.js';

export function renderDashboardView(notes, session, total = notes.length, page = 1, totalPages = 1, hasFilters = false) {
  const r = role(session);
  const destinoFilter = r.canSeeAll ? `
    <select class="form-select filter-destino" aria-label="Filtrar por destino">
      <option value="">Todos los destinos</option>
      ${CONFIG.locations.map(l => `<option value="${esc(l)}">${esc(l)}</option>`).join('')}
    </select>` : '';

  const createBtn = r.canCreate ? `
    <div class="toolbar-actions">
      <button class="btn btn-primary btn-nueva" aria-label="Crear nueva nota">+ Nueva nota</button>
    </div>` : '';

  const gridContent = notes.length > 0
    ? notes.map(n => renderNoteCard(n, session)).join('')
    : renderEmptyState(hasFilters);

  return `
  ${renderHeader(session)}
  <main class="dashboard-main">
    <section class="dashboard-toolbar">
      <div class="toolbar-filters">
        <input class="form-input filter-search" type="search" placeholder="Buscar nota…" aria-label="Buscar por número, producto o destino">
        <select class="form-select filter-estatus" aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          ${CONFIG.statuses.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}
        </select>
        ${destinoFilter}
      </div>
      ${createBtn}
    </section>
    <section class="notes-grid" id="notes-grid">
      ${gridContent}
    </section>
    ${renderPaginationBar(total, page, totalPages)}
  </main>`;
}

export function refreshGrid(notes, session, total = notes.length, page = 1, totalPages = 1, hasFilters = false) {
  const grid = document.getElementById('notes-grid');
  if (!grid) return;
  grid.innerHTML = notes.length > 0
    ? notes.map(n => renderNoteCard(n, session)).join('')
    : renderEmptyState(hasFilters);

  // Reemplazar paginación
  const existing = document.querySelector('.pagination-bar');
  const newBarHtml = renderPaginationBar(total, page, totalPages);
  if (existing) {
    if (newBarHtml.trim()) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = newBarHtml;
      existing.replaceWith(wrapper.firstElementChild);
    } else {
      existing.remove();
    }
  } else if (newBarHtml.trim()) {
    grid.insertAdjacentHTML('afterend', newBarHtml);
  }
}

function renderPaginationBar(total, page, totalPages) {
  if (totalPages <= 1) return '';
  return `
    <section class="pagination-bar">
      <span class="pagination-info">Página ${page} de ${totalPages} (${total} nota${total === 1 ? '' : 's'})</span>
      <button class="btn btn-ghost btn-sm btn-prev-page" ${page <= 1 ? 'disabled' : ''}>← Anterior</button>
      <button class="btn btn-ghost btn-sm btn-next-page" ${page >= totalPages ? 'disabled' : ''}>Siguiente →</button>
    </section>`;
}

function renderEmptyState(hasFilters = false) {
  if (hasFilters) {
    return `
    <div class="empty-state">
      <div class="empty-state__icon" aria-hidden="true">🔍</div>
      <h3 class="empty-state__title">Sin resultados</h3>
      <p class="empty-state__desc">Ninguna nota coincide con los filtros aplicados.</p>
      <button class="btn btn-ghost btn-sm btn-clear-filters" style="margin-top:var(--space-3)">
        Limpiar filtros
      </button>
    </div>`;
  }
  return `
  <div class="empty-state">
    <div class="empty-state__icon" aria-hidden="true">📋</div>
    <h3 class="empty-state__title">Sin notas aún</h3>
    <p class="empty-state__desc">Crea la primera nota con el botón «+ Nueva nota».</p>
  </div>`;
}

export function renderNoteCard(note, session) {
  const r = role(session);
  const badge = `<span class="badge badge--${esc(statusClass(note.estatus))}">${esc(note.estatus)}</span>`;

  const isPlanta = session.role === 'planta';
  const isUnreadNew      = isPlanta && !!note.unreadNew;
  const isUnreadModified = isPlanta && !!note.unreadModified;
  let cardClass = 'note-card';
  if (isUnreadNew)      cardClass += ' indicator-new';
  if (isUnreadModified) cardClass += ' indicator-modified';

  let footer;
  if (isPlanta) {
    let statusCtrl;
    if (note.estatus === 'Cancelada') {
      statusCtrl = `<span class="status-static-text">Cancelada</span>`;
    } else if (note.estatus === 'Nueva') {
      statusCtrl = `<span class="status-static-text">→ Abre para iniciar</span>`;
    } else {
      statusCtrl = renderStatusSelector(note);
    }
    footer = `
    <div class="note-card__status-row">${statusCtrl}</div>
    <button class="btn btn-secondary btn-sm btn-ver" aria-label="Ver detalle de nota ${esc(note.numero)}">Ver</button>`;
  } else {
    footer = `
    <div class="note-card__actions">
      <button class="btn btn-ghost btn-sm btn-ver" aria-label="Ver detalle">Ver</button>
      <button class="btn btn-secondary btn-sm btn-editar" aria-label="Editar nota">Editar</button>
      <button class="btn btn-ghost btn-sm btn-eliminar" style="color:var(--color-danger)" aria-label="Eliminar nota">Eliminar</button>
    </div>`;
  }

  const clienteInfo = note.clienteNombre
    ? `<span class="meta-icon" aria-hidden="true">👤</span> ${esc(note.clienteNombre)}`
    : '';
  const pastelInfo = note.sabor
    ? `<span class="meta-icon" aria-hidden="true">🎂</span> ${esc(note.sabor)}${note.modelo ? ' — ' + esc(note.modelo) : ''}`
    : '';
  const totalInfo = (note.costoPastel || note.depositoEquipo || note.arreglosFigura || note.servicioDomicilio)
    ? `<span class="meta-icon" aria-hidden="true">💰</span> Total: $${(
        (note.costoPastel || 0) + (note.depositoEquipo || 0) +
        (note.arreglosFigura || 0) + (note.servicioDomicilio || 0)
      ).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : '';

  let cardBody;
  if (clienteInfo || pastelInfo || totalInfo) {
    cardBody = `
      ${clienteInfo ? `<div class="note-card__meta-row">${clienteInfo}</div>` : ''}
      ${pastelInfo ? `<div class="note-card__meta-row">${pastelInfo}</div>` : ''}
      ${totalInfo ? `<div class="note-card__meta-row">${totalInfo}</div>` : ''}`;
  } else {
    cardBody = '';
  }

  const metaRows = `
    <div class="note-card__meta-row">
      <span class="meta-icon" aria-hidden="true">📅</span> ${esc(formatFecha(note.fecha))}
    </div>
    <div class="note-card__meta-row">
      <span class="meta-icon" aria-hidden="true">📍</span> ${esc(note.destino)}
    </div>
    ${cardBody}`;

  return `
  <article class="${cardClass}" data-note-id="${note.id}">
    <div class="note-card__top">
      <div class="note-card__numero">${esc(note.numero)}</div>
      ${badge}
    </div>
    <div class="note-card__meta">${metaRows}</div>
    <footer class="note-card__footer">${footer}</footer>
  </article>`;
}

function renderStatusSelector(note) {
  const allowedStatuses = ['En Proceso', 'Completada'];
  const opts = allowedStatuses.map(s =>
    `<option value="${esc(s)}" ${s === note.estatus ? 'selected' : ''}>${esc(s)}</option>`
  ).join('');
  return `<select class="form-select status-select" aria-label="Cambiar estado de la nota" style="font-size:0.8rem;padding:4px 28px 4px 8px">${opts}</select>`;
}
