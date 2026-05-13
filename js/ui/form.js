import { CONFIG } from '../config.js';
import { esc, role } from './shared.js';

/**
 * Renderiza el formulario de creación/edición de notas.
 */
export function renderNoteForm(note, session) {
  const isEdit = note !== null;
  const title = isEdit ? `Editar ${esc(note.numero)}` : 'Nueva nota';
  const today = new Date().toISOString().slice(0, 10);
  const fecha = isEdit ? note.fecha : today;
  
  // CORRECCIÓN: Para nuevas notas, el destino siempre debe ser Planta de Producción por defecto.
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
  <div class="modal-card" role="dialog" aria-labelledby="modal-title">
    <div class="modal-header">
      <h2 class="modal-title" id="modal-title">${title}</h2>
      <button type="button" class="btn btn-ghost btn-icon btn-cancelar-modal" aria-label="Cerrar modal">✕</button>
    </div>
    <div class="modal-body">
      <form id="note-form" novalidate>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4)">
          <div class="form-group">
            <label class="form-label" for="nf-fecha">Fecha de entrega</label>
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
          <label class="form-label">Lista de productos</label>
          <table class="products-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th aria-label="Acciones"></th>
              </tr>
            </thead>
            <tbody id="prod-tbody">
              ${prodRows}
            </tbody>
          </table>
          <button type="button" class="btn-add-row" aria-label="Agregar otra fila de producto">+ Agregar producto</button>
        </div>

        <div class="form-group">
          <label class="form-label" for="nf-obs">Observaciones / Instrucciones</label>
          <textarea class="form-textarea" id="nf-obs" name="observaciones"
            placeholder="Ej: Entregar antes de las 3pm, usar charolas limpias..."
            rows="3">${esc(obs)}</textarea>
        </div>

        ${renderImageUploadSection(note, role(session))}
      </form>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-ghost btn-cancelar-modal">Cancelar</button>
      <div style="margin-left:auto;display:flex;gap:var(--space-3)">
        <button type="submit" form="note-form" class="btn btn-secondary" data-action="preview">Previsualizar</button>
        <button type="submit" form="note-form" class="btn btn-primary" data-action="save">Guardar nota</button>
      </div>
    </div>
  </div>`;
}

/**
 * Renderiza una fila de la tabla de productos.
 */
export function renderProductRow(prod = { nombre: '', cantidad: '' }) {
  return `
  <tr class="prod-row">
    <td class="prod-nombre">
      <input class="form-input prod-nombre-inp" type="text"
        placeholder="Nombre del producto" value="${esc(prod.nombre)}" autocomplete="off" aria-label="Nombre del producto">
    </td>
    <td class="prod-cantidad">
      <input class="form-input prod-cantidad-inp" type="text"
        placeholder="Cant." value="${esc(prod.cantidad)}" autocomplete="off" aria-label="Cantidad">
    </td>
    <td class="prod-actions">
      <button type="button" class="btn btn-ghost btn-icon btn-remove-row" title="Quitar producto" aria-label="Quitar producto">✕</button>
    </td>
  </tr>`;
}

/**
 * Renderiza la sección de carga de imágenes.
 */
function renderImageUploadSection(note, r) {
  const canUpload = r.canCreate || r.canEdit;
  const existing  = note?.imagenes || [];

  const thumbs = existing.map((img, idx) => `
    <div class="image-preview-item" data-image-id="${esc(img.id)}">
      <img src="${esc(img.url)}" alt="Miniatura ${idx + 1}" width="60" height="60" style="object-fit:cover;border-radius:4px;">
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
    <label class="form-label">Imágenes <span class="form-label-hint">(máx 3 · WebP comprimido)</span></label>
    <div class="image-previews" id="existing-image-previews">${thumbs}</div>
    <div id="image-counter" class="form-hint"${existing.length ? '' : ' style="display:none"'}>${existing.length}/3 imagen(es) adjunta(s)</div>
    <input type="file" id="nf-imagenes" name="imagenes" accept="image/*" multiple class="form-input image-file-input" aria-describedby="image-counter">
    <p class="form-hint">Las nuevas imágenes se comprimen automáticamente para ahorrar espacio.</p>
  </div>`;
}

/**
 * Extrae los datos del formulario del DOM.
 */
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
