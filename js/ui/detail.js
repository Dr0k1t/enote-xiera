/// <reference path="../types.js" />
import { esc, formatFecha, formatTs, role } from './shared.js';
import { renderPrintableReceipt } from './print.js';

/**
 * Renderiza la vista de detalle de una nota.
 */
export function renderDetailView(note, session) {
  const r = role(session);
  const editBtn = (r.canEdit && !note._pending)
    ? `<button class="btn btn-secondary btn-sm btn-editar" data-note-id="${note.id}" aria-label="Editar esta nota">Editar</button>`
    : '';

  const pendingBanner = note._pending ? `
  <div class="pending-sync-banner">
    <span>⏳</span>
    <p>Esta nota aún no se ha sincronizado. Se enviará automáticamente cuando haya conexión y recibirá su folio.</p>
  </div>` : '';

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
  <div class="modal-card modal-card--wide" role="dialog" aria-modal="true" aria-labelledby="detail-title">
    <div class="modal-header">
      <h2 class="modal-title" id="detail-title">Detalle ${esc(note.numero)}</h2>
      <div class="detail-header-actions">
        ${note._pending ? '' : '<button class="btn btn-secondary btn-sm btn-imprimir" aria-label="Imprimir esta nota">Imprimir</button>'}
        ${editBtn}
        <button type="button" class="btn btn-ghost btn-icon btn-cancelar-modal" aria-label="Cerrar detalle">✕</button>
      </div>
    </div>
    <div class="modal-body">
  ${pendingBanner}
  <div class="detail-wrapper ${images.length > 0 ? 'detail-layout' : ''}">
    <article class="detail-card">
      <header class="detail-header">
        <div class="detail-brand-name">Xiera</div>
        <div style="text-align: right;">
          <div class="detail-brand-sub">Nota de Remisión</div>
          <div class="detail-numero">${esc(note.numero)}</div>
        </div>
      </header>

      <div class="detail-card-body">
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
        <h3 class="detail-section-title">Observaciones</h3>
        <div class="detail-obs">${obsContent}</div>
      </div>

      ${note.clienteNombre || note.clienteDireccion || note.clienteTelefono ? `
      <div class="detail-section">
        <h3 class="detail-section-title">Datos de cliente</h3>
        <div class="detail-meta-grid">
          ${note.clienteNombre ? `<div class="detail-meta-item"><div class="detail-meta-label">Nombre</div><div class="detail-meta-value">${esc(note.clienteNombre)}</div></div>` : ''}
          ${note.clienteDireccion ? `<div class="detail-meta-item"><div class="detail-meta-label">Dirección</div><div class="detail-meta-value">${esc(note.clienteDireccion)}</div></div>` : ''}
          ${note.clienteTelefono ? `<div class="detail-meta-item"><div class="detail-meta-label">Teléfono</div><div class="detail-meta-value">${esc(note.clienteTelefono)}</div></div>` : ''}
        </div>
      </div>
      ` : ''}

      ${note.sabor || note.modelo || note.colores || note.kilos || note.texto || note.pisos || note.pastelCantidad ? `
      <div class="detail-section">
        <h3 class="detail-section-title">Datos de pastel</h3>
        <div class="detail-meta-grid">
          ${note.pastelCantidad ? `<div class="detail-meta-item"><div class="detail-meta-label">Cantidad de pasteles</div><div class="detail-meta-value">${esc(String(note.pastelCantidad))}</div></div>` : ''}
          ${note.pisos ? `<div class="detail-meta-item"><div class="detail-meta-label">Pisos</div><div class="detail-meta-value">${esc(String(note.pisos))}</div></div>` : ''}
          ${note.sabor ? `<div class="detail-meta-item"><div class="detail-meta-label">Sabor</div><div class="detail-meta-value">${esc(note.sabor)}</div></div>` : ''}
          ${note.kilos ? `<div class="detail-meta-item"><div class="detail-meta-label">Kilos / Presentación</div><div class="detail-meta-value">${esc(note.kilos)}</div></div>` : ''}
          ${note.modelo ? `<div class="detail-meta-item"><div class="detail-meta-label">Modelo</div><div class="detail-meta-value">${esc(note.modelo)}</div></div>` : ''}
          ${note.texto ? `<div class="detail-meta-item"><div class="detail-meta-label">Texto en pastel</div><div class="detail-meta-value">${esc(note.texto)}</div></div>` : ''}
          ${note.colores ? `<div class="detail-meta-item"><div class="detail-meta-label">Colores</div><div class="detail-meta-value">${esc(note.colores)}</div></div>` : ''}
        </div>
      </div>
      ` : ''}

      ${note.horaEntrega || note.direccionEntrega ? `
      <div class="detail-section">
        <h3 class="detail-section-title">Datos de entrega</h3>
        <div class="detail-meta-grid">
          ${note.horaEntrega ? `<div class="detail-meta-item"><div class="detail-meta-label">Hora de entrega</div><div class="detail-meta-value">${esc(note.horaEntrega)} ${esc(note.horaPeriodo || 'AM')}</div></div>` : ''}
          ${note.direccionEntrega ? `<div class="detail-meta-item"><div class="detail-meta-label">Dirección de entrega</div><div class="detail-meta-value">${esc(note.direccionEntrega)}</div></div>` : ''}
        </div>
      </div>
      ` : ''}

      ${note.costoPastel || note.depositoEquipo || note.arreglosFigura || note.servicioDomicilio ? `
      <div class="detail-section">
        <h3 class="detail-section-title">Financiero</h3>
        <table class="detail-products-table" style="font-size:0.95rem">
          <tbody>
            ${note.costoPastel ? `<tr><td>Costo pastel</td><td style="text-align:right">$${note.costoPastel.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td></tr>` : ''}
            ${note.depositoEquipo ? `<tr><td>Depósito equipo</td><td style="text-align:right">$${note.depositoEquipo.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td></tr>` : ''}
            ${note.arreglosFigura ? `<tr><td>Arreglos y figura</td><td style="text-align:right">$${note.arreglosFigura.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td></tr>` : ''}
            ${note.servicioDomicilio ? `<tr><td>Servicio a domicilio</td><td style="text-align:right">$${note.servicioDomicilio.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td></tr>` : ''}
            <tr style="border-top:2px solid var(--color-text-dark);font-weight:bold">
              <td>TOTAL</td>
              <td style="text-align:right">$${(
                (note.costoPastel || 0) + (note.depositoEquipo || 0) + (note.arreglosFigura || 0) + (note.servicioDomicilio || 0)
              ).toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
            </tr>
            ${note.anticipo ? `<tr><td>Anticipo (${esc(note.metodoPago || '')})</td><td style="text-align:right">-$${note.anticipo.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td></tr>` : ''}
            ${note.concepto ? `<tr><td>Concepto</td><td style="text-align:right">${esc(note.concepto)}</td></tr>` : ''}
            <tr style="background:var(--color-surface);font-weight:bold">
              <td>SALDO A PAGAR</td>
              <td style="text-align:right">$${(
                (note.costoPastel || 0) + (note.depositoEquipo || 0) + (note.arreglosFigura || 0) + (note.servicioDomicilio || 0) - (note.anticipo || 0)
              ).toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
            </tr>
          </tbody>
        </table>
      </div>
      ` : ''}
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
  </div>
    </div>
    ${renderPrintableReceipt(note)}
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
  <div class="modal-card" role="dialog" aria-labelledby="diff-title" aria-modal="true">
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
 * Renderiza modal de conflicto: dos columnas (servidor vs cliente).
 */
export function renderConflictView(serverNote, clientFields) {
  const rows = [
    { label: 'Fecha', server: formatFecha(serverNote.fecha), client: formatFecha(clientFields.fecha) },
    { label: 'Destino', server: serverNote.destino, client: clientFields.destino },
    { label: 'Estatus', server: serverNote.estatus, client: clientFields.estatus ?? serverNote.estatus },
    { label: 'Observaciones',
      server: (serverNote.observaciones || '(vacío)'),
      client: (clientFields.observaciones || '(vacío)') },
  ];

  const tableRows = rows.map(r => `
    <tr>
      <td><strong>${esc(r.label)}</strong></td>
      <td>${esc(r.server)}</td>
      <td>${esc(r.client)}</td>
    </tr>`).join('');

  return `
  <div class="modal-card" role="alertdialog" aria-labelledby="conflict-title" aria-modal="true">
    <div class="modal-header">
      <h2 class="modal-title" id="conflict-title" style="color:var(--color-danger)">Conflicto de edición</h2>
    </div>
    <div class="modal-body">
      <p style="font-size:0.95rem;line-height:1.6;margin-bottom:var(--space-3)">
        Otro usuario modificó esta nota mientras la editabas.
        Última modificación remota: <strong>${esc(formatTs(serverNote.modificadoEn))}</strong>
        por <strong>${esc(serverNote.modificadoPor || '—')}</strong>.
      </p>
      <table class="detail-products-table" style="font-size:0.9rem">
        <thead>
          <tr>
            <th>Campo</th>
            <th>Versión servidor</th>
            <th>Tus cambios</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-ghost btn-conflict-keep-server">Mantener servidor</button>
      <button type="button" class="btn btn-danger btn-conflict-overwrite" style="margin-left:auto">Sobrescribir con mis cambios</button>
    </div>
  </div>`;
}

/**
 * Renderiza el modal de confirmación de eliminación.
 */
export function renderDeleteConfirm(note) {
  return `
  <div class="modal-card" role="alertdialog" aria-labelledby="delete-title" aria-describedby="delete-desc" aria-modal="true">
    <div class="modal-header">
      <h2 class="modal-title" id="delete-title" style="color:var(--color-danger)">Eliminar nota</h2>
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
