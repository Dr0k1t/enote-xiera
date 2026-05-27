/// <reference path="../types.js" />
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
  <div class="modal-card" role="dialog" aria-labelledby="modal-title" aria-modal="true">
    <div class="modal-header">
      <h2 class="modal-title" id="modal-title">${title}</h2>
      <button type="button" class="btn btn-ghost btn-icon btn-cancelar-modal" aria-label="Cerrar modal">✕</button>
    </div>
    <div class="modal-body">
      <form id="note-form" novalidate>
        <div class="form-grid-2">
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
            placeholder="Ej: Entregar antes de las 3pm, usar charolas limpias…"
            rows="3">${esc(obs)}</textarea>
        </div>

        <!-- DATOS DE CLIENTE -->
        <fieldset class="fieldset-reset">
          <legend class="form-label">Datos de cliente</legend>
          <div class="form-group">
            <label class="form-label" for="nf-cliente-nombre">Nombre del cliente</label>
            <input class="form-input" id="nf-cliente-nombre" name="clienteNombre"
              placeholder="Nombre completo" value="${esc(isEdit && note.clienteNombre ? note.clienteNombre : '')}">
          </div>
          <div class="form-group">
            <label class="form-label" for="nf-cliente-direccion">Dirección del cliente</label>
            <input class="form-input" id="nf-cliente-direccion" name="clienteDireccion"
              placeholder="Dirección" value="${esc(isEdit && note.clienteDireccion ? note.clienteDireccion : '')}">
          </div>
          <div class="form-group">
            <label class="form-label" for="nf-cliente-telefono">Teléfono</label>
            <input class="form-input" id="nf-cliente-telefono" name="clienteTelefono"
              type="tel" placeholder="Teléfono" value="${esc(isEdit && note.clienteTelefono ? note.clienteTelefono : '')}">
          </div>
        </fieldset>

        <!-- DATOS DE PASTEL -->
        <fieldset class="fieldset-reset">
          <legend class="form-label">Datos de pastel</legend>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label" for="nf-pastel-cantidad">Cantidad de pasteles</label>
              <input class="form-input" id="nf-pastel-cantidad" name="pastelCantidad"
                type="number" min="1" value="${isEdit && note.pastelCantidad != null ? note.pastelCantidad : 1}">
            </div>
            <div class="form-group">
              <label class="form-label" for="nf-pisos">Pisos</label>
              <input class="form-input" id="nf-pisos" name="pisos"
                type="number" min="1" value="${esc(isEdit && note.pisos != null ? note.pisos : '')}">
            </div>
          </div>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label" for="nf-sabor">Sabor</label>
              <input class="form-input" id="nf-sabor" name="sabor"
                placeholder="Chocolate, vainilla…" value="${esc(isEdit && note.sabor ? note.sabor : '')}">
            </div>
            <div class="form-group">
              <label class="form-label" for="nf-kilos">Kilos / Presentación</label>
              <input class="form-input" id="nf-kilos" name="kilos"
                placeholder="Ej: 1kg, Vitrina mini" value="${esc(isEdit && note.kilos ? note.kilos : '')}">
            </div>
          </div>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label" for="nf-modelo">Modelo</label>
              <input class="form-input" id="nf-modelo" name="modelo"
                placeholder="Modelo del pastel" value="${esc(isEdit && note.modelo ? note.modelo : '')}">
            </div>
            <div class="form-group">
              <label class="form-label" for="nf-texto">Texto en pastel</label>
              <input class="form-input" id="nf-texto" name="texto"
                placeholder="Opcional" value="${esc(isEdit && note.texto ? note.texto : '')}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="nf-colores">Colores</label>
            <input class="form-input" id="nf-colores" name="colores"
              placeholder="Fondant, flores, etc." value="${esc(isEdit && note.colores ? note.colores : '')}">
          </div>
        </fieldset>

        <!-- DATOS DE ENTREGA -->
        <fieldset style="border:none;padding:0">
          <legend class="form-label" style="font-weight:600;margin-bottom:var(--space-3)">Datos de entrega</legend>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label" for="nf-hora-entrega">Hora de entrega</label>
              <input class="form-input" id="nf-hora-entrega" name="horaEntrega"
                type="time" value="${esc(isEdit && note.horaEntrega ? note.horaEntrega : '')}">
            </div>
            <div class="form-group">
              <label class="form-label" for="nf-hora-periodo">AM / PM</label>
              <select class="form-select" id="nf-hora-periodo" name="horaPeriodo">
                <option value="AM" ${isEdit && note.horaPeriodo === 'AM' ? 'selected' : ''}>AM</option>
                <option value="PM" ${isEdit && note.horaPeriodo === 'PM' ? 'selected' : ''}>PM</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="nf-direccion-entrega">Dirección de entrega</label>
            <input class="form-input" id="nf-direccion-entrega" name="direccionEntrega"
              placeholder="Dirección de entrega" value="${esc(isEdit && note.direccionEntrega ? note.direccionEntrega : '')}">
          </div>
        </fieldset>

        <!-- DATOS FINANCIEROS -->
        <fieldset style="border:none;padding:0">
          <legend class="form-label" style="font-weight:600;margin-bottom:var(--space-3)">Financiero</legend>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label" for="nf-costo-pastel">Costo pastel</label>
              <input class="form-input nf-financiero-input" id="nf-costo-pastel" name="costoPastel"
                type="number" step="0.01" min="0" value="${isEdit && note.costoPastel ? note.costoPastel : 0}">
            </div>
            <div class="form-group">
              <label class="form-label" for="nf-deposito-equipo">Depósito equipo</label>
              <input class="form-input nf-financiero-input" id="nf-deposito-equipo" name="depositoEquipo"
                type="number" step="0.01" min="0" value="${isEdit && note.depositoEquipo ? note.depositoEquipo : 0}">
            </div>
          </div>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label" for="nf-arreglos-figura">Arreglos y figura</label>
              <input class="form-input nf-financiero-input" id="nf-arreglos-figura" name="arreglosFigura"
                type="number" step="0.01" min="0" value="${isEdit && note.arreglosFigura ? note.arreglosFigura : 0}">
            </div>
            <div class="form-group">
              <label class="form-label" for="nf-servicio-domicilio">Servicio a domicilio</label>
              <input class="form-input nf-financiero-input" id="nf-servicio-domicilio" name="servicioDomicilio"
                type="number" step="0.01" min="0" value="${isEdit && note.servicioDomicilio ? note.servicioDomicilio : 0}">
            </div>
          </div>
          <div class="form-group" style="background:var(--color-surface);padding:var(--space-3);border-radius:var(--radius-md);border:1px solid var(--color-border)">
            <strong>TOTAL: \$<span id="nf-total-value">0</span></strong>
          </div>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label" for="nf-anticipo">Anticipo</label>
              <input class="form-input nf-financiero-input" id="nf-anticipo" name="anticipo"
                type="number" step="0.01" min="0" value="${isEdit && note.anticipo ? note.anticipo : 0}">
            </div>
            <div class="form-group">
              <label class="form-label" for="nf-metodo-pago">Método de pago</label>
              <select class="form-select" id="nf-metodo-pago" name="metodoPago">
                <option value="">Seleccionar...</option>
                <option value="Efectivo" ${isEdit && note.metodoPago === 'Efectivo' ? 'selected' : ''}>Efectivo</option>
                <option value="Tarjeta" ${isEdit && note.metodoPago === 'Tarjeta' ? 'selected' : ''}>Tarjeta</option>
                <option value="Transferencia" ${isEdit && note.metodoPago === 'Transferencia' ? 'selected' : ''}>Transferencia</option>
              </select>
            </div>
          </div>
          <div class="form-group" style="background:var(--color-surface);padding:var(--space-3);border-radius:var(--radius-md);border:1px solid var(--color-border)">
            <strong>SALDO A PAGAR: \$<span id="nf-saldo-value">0</span></strong>
          </div>
        </fieldset>

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
  // Normalizar: las imágenes pueden venir como objetos {url, id} o como strings (URLs)
  const existing = (note?.imagenes || []).map((img, idx) => {
    const url = typeof img === 'string' ? img : img.url;
    const id = typeof img === 'string' ? `img-${idx}` : img.id;
    return { url, id };
  });

  const thumbs = existing.map((img, idx) => `
    <div class="image-preview-item" data-image-id="${esc(img.id)}">
      <img src="${esc(img.url)}" alt="Miniatura ${idx + 1}" width="60" height="60" style="object-fit:cover;border-radius:4px;">
      ${canUpload ? `<button type="button" class="btn-remove-image" data-image-id="${esc(img.id)}" data-image-url="${esc(img.url)}" aria-label="Eliminar imagen ${idx + 1}">✕</button>` : ''}
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
    <p class="form-hint">Las nuevas imágenes se comprimen automáticamente para ahorrar espacio y optimizar el almacenamiento.</p>
  </div>`;
}

/**
 * Extrae los datos del formulario del DOM.
 */
export function getFormData() {
  const form = document.getElementById('note-form');
  if (!form) return null;
  const fecha = form.querySelector('[name="fecha"]')?.value || '';
  const destino = form.querySelector('[name="destino"]')?.value || '';
  const observaciones = (form.querySelector('[name="observaciones"]')?.value || '').trim();
  const productos = [];
  form.querySelectorAll('.prod-row').forEach(row => {
    const nombre = (row.querySelector('.prod-nombre-inp').value || '').trim();
    const cantidad = (row.querySelector('.prod-cantidad-inp').value || '').trim();
    if (nombre) productos.push({ nombre, cantidad });
  });
  return {
    fecha,
    destino,
    productos,
    observaciones,
    clienteNombre: (form.querySelector('[name="clienteNombre"]')?.value || '').trim(),
    clienteDireccion: (form.querySelector('[name="clienteDireccion"]')?.value || '').trim(),
    clienteTelefono: (form.querySelector('[name="clienteTelefono"]')?.value || '').trim(),
    pastelCantidad: (() => { const v = +(form.querySelector('[name="pastelCantidad"]')?.value); return Number.isFinite(v) ? v : 1; })(),
    pisos: (() => { const v = +(form.querySelector('[name="pisos"]')?.value); return Number.isFinite(v) ? v : null; })(),
    sabor: (form.querySelector('[name="sabor"]')?.value || '').trim(),
    kilos: (form.querySelector('[name="kilos"]')?.value || '').trim(),
    modelo: (form.querySelector('[name="modelo"]')?.value || '').trim(),
    texto: (form.querySelector('[name="texto"]')?.value || '').trim(),
    colores: (form.querySelector('[name="colores"]')?.value || '').trim(),
    horaEntrega: form.querySelector('[name="horaEntrega"]')?.value || '',
    horaPeriodo: form.querySelector('[name="horaPeriodo"]')?.value || 'AM',
    direccionEntrega: (form.querySelector('[name="direccionEntrega"]')?.value || '').trim(),
    costoPastel: +form.querySelector('[name="costoPastel"]')?.value || 0,
    depositoEquipo: +form.querySelector('[name="depositoEquipo"]')?.value || 0,
    arreglosFigura: +form.querySelector('[name="arreglosFigura"]')?.value || 0,
    servicioDomicilio: +form.querySelector('[name="servicioDomicilio"]')?.value || 0,
    anticipo: +form.querySelector('[name="anticipo"]')?.value || 0,
    metodoPago: form.querySelector('[name="metodoPago"]')?.value || '',
  };
}

/**
 * Actualiza el cálculo automático de TOTAL y SALDO A PAGAR.
 */
export function updateFinancialTotals() {
  const costo = +document.getElementById('nf-costo-pastel')?.value || 0;
  const dep = +document.getElementById('nf-deposito-equipo')?.value || 0;
  const arr = +document.getElementById('nf-arreglos-figura')?.value || 0;
  const svc = +document.getElementById('nf-servicio-domicilio')?.value || 0;
  const ant = +document.getElementById('nf-anticipo')?.value || 0;
  const total = costo + dep + arr + svc;
  const saldo = total - ant;
  const totalEl = document.getElementById('nf-total-value');
  const saldoEl = document.getElementById('nf-saldo-value');
  if (totalEl) totalEl.textContent = total.toLocaleString('es-MX', { minimumFractionDigits: 2 });
  if (saldoEl) saldoEl.textContent = saldo.toLocaleString('es-MX', { minimumFractionDigits: 2 });
}
