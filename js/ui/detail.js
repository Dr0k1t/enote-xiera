import { esc, formatFecha, formatTs, role } from './shared.js';

/**
 * Renderiza la vista de detalle de una nota.
 */
export function renderDetailView(note, session) {
  const r = role(session);
  const editBtn = r.canEdit
    ? `<button class="btn btn-secondary btn-editar" data-note-id="${note.id}" aria-label="Editar esta nota">Editar nota</button>`
    : '';

  const prodRows = note.productos.map(p => `
    <tr>
      <td>${esc(p.nombre)}</td>
      <td>${esc(p.cantidad)}</td>
    </tr>`).join('');

  const obsContent = note.observaciones
    ? esc(note.observaciones)
    : '<em class="detail-obs--empty">Sin observaciones adicionales</em>';

  const images = note.imagenes || [];
  const imagePanel = images.length > 0 ? `
    <section class="image-selector-panel" aria-label="Galería de imágenes">
      <h3 class="image-selector-title">Imágenes adjuntas</h3>
      <div class="image-selector-grid">
        ${images.map((img, idx) => `
          <button type="button" class="btn btn-secondary btn-sm image-selector-btn"
            data-image-index="${idx}" aria-label="Ver imagen ${idx + 1}">
            Imagen ${idx + 1}
          </button>`).join('')}
      </div>
    </section>` : '';

  return `
  <nav class="detail-toolbar">
    <button class="btn btn-ghost btn-volver" aria-label="Volver al dashboard">← Volver</button>
    <div style="margin-left:auto;display:flex;gap:var(--space-3)">
      <button class="btn btn-secondary btn-imprimir" aria-label="Imprimir esta nota">Imprimir</button>
      ${editBtn}
    </div>
  </nav>

  <div class="detail-wrapper ${images.length > 0 ? 'detail-layout' : ''}">
    <article class="detail-card">
      <header class="detail-header">
        <div class="detail-brand-name">Xiera</div>
        <div style="text-align: right;">
          <div class="detail-brand-sub">Nota de Remisión</div>
          <div class="detail-numero">#${esc(String(note.numero).padStart(4, '0'))}</div>
        </div>
      </header>

      <div class="detail-meta-grid">
        <div class="detail-meta-item">
          <div class="detail-meta-label">Fecha de entrega</div>
          <div class="detail-meta-value">${esc(formatFecha(note.fecha))}</div>
        </div>
        <div class="detail-meta-item">
          <div class="detail-meta-label">Destino</div>
          <div class="detail-meta-value">${esc(note.destino)}</div>
        </div>
        <div class="detail-meta-item">
          <div class="detail-meta-label">Estado actual</div>
          <div class="detail-meta-value">
            <span class="badge badge--${esc(note.estatus.toLowerCase().replace(/\s+/g, '-'))}">${esc(note.estatus)}</span>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h3 class="detail-section-title">Productos</h3>
        <table class="detail-products-table">
          <thead>
            <tr>
              <th>Descripción</th>
              <th style="width:80px">Cant.</th>
            </tr>
          </thead>
          <tbody>${prodRows}</tbody>
        </table>
      </div>

      <div class="detail-section">
        <h3 class="detail-section-title">Observaciones</h3>
        <div class="detail-obs">${obsContent}</div>
      </div>

      <footer class="detail-footer">
        <div class="detail-sig-block">
          <div class="detail-sig-space"></div>
          <div class="detail-sig-line">Autorizado por</div>
        </div>
        <div class="detail-sig-block">
          <div class="detail-sig-space"></div>
          <div class="detail-sig-line">Recibido por</div>
        </div>
      </footer>

      <aside class="detail-timestamps" aria-label="Información de auditoría">
        <span>Creado: ${esc(formatTs(note.creadoEn))} por ${esc(note.creadoPor)}</span>
        <span>Modificado: ${esc(formatTs(note.modificadoEn))} por ${esc(note.modificadoPor)}</span>
      </aside>
    </article>
    ${imagePanel}
  </div>`;
}

/**
 * Renderiza la vista de diferencias para confirmación de cambios.
 */
export function renderDiffView(changes, estatus) {
  const items = changes.map(c => `
    <div class="diff-field">
      <span class="diff-field__label">${esc(c.label)}</span>
      <span class="diff-val--old">${esc(c.old)}</span>
      <span class="diff-arrow" aria-hidden="true">→</span>
      <span class="diff-val--new">${esc(c.new)}</span>
    </div>`).join('');

  return `
  <div class="modal-card" role="dialog" aria-labelledby="diff-title">
    <div class="modal-header">
      <h2 class="modal-title" id="diff-title">Confirmar cambios</h2>
    </div>
    <div class="modal-body">
      <div class="diff-alert">
        <p class="diff-alert__title">
          ⚠ Esta nota está en estado <strong>"${esc(estatus)}"</strong>.
          Los siguientes campos cambiarán:
        </p>
        <div class="diff-list">${items}</div>
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-ghost btn-volver-editar">← Volver a editar</button>
      <button type="button" class="btn btn-primary btn-confirmar-diff" style="margin-left:auto">Confirmar cambios</button>
    </div>
  </div>`;
}

/**
 * Renderiza el modal de confirmación de eliminación.
 */
export function renderDeleteConfirm(note) {
  return `
  <div class="modal-card" role="alertdialog" aria-labelledby="delete-title" aria-describedby="delete-desc">
    <div class="modal-header">
      <h2 class="modal-title" id="delete-title" style="color:#c0392b">Eliminar nota</h2>
    </div>
    <div class="modal-body">
      <p id="delete-desc" style="font-size:0.95rem;line-height:1.6">
        ¿Estás seguro de que deseas eliminar la nota <strong>${esc(note.numero)}</strong>?<br>
        <span style="color:var(--color-text-muted)">Esta acción es permanente y no se puede deshacer.</span>
      </p>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-ghost btn-cancelar-modal" aria-label="Cancelar y volver">Cancelar</button>
      <button type="button" class="btn btn-danger btn-confirmar-delete" 
        data-note-id="${note.id}" style="margin-left:auto" aria-label="Confirmar eliminación">Eliminar nota</button>
    </div>
  </div>`;
}
