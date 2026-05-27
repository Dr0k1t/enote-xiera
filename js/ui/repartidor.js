import { CONFIG } from '../config.js';
import { esc, formatFecha, renderHeader } from './shared.js';

/**
 * Renderiza la vista principal para repartidores.
 */
export function renderRepartidorView(session) {
  const sucursalOpts = CONFIG.locations
    .filter(l => l !== 'Planta de Producción')
    .map(l => `<option value="${esc(l)}">${esc(l)}</option>`)
    .join('');

  return `
  ${renderHeader(session)}
  <main class="repartidor-main">
    <header class="repartidor-header">
      <div class="form-group">
        <label class="form-label" for="repartidor-sucursal">Sucursal a entregar</label>
        <select class="form-select" id="repartidor-sucursal" aria-label="Seleccionar sucursal de entrega">
          <option value="">— Selecciona sucursal —</option>
          ${sucursalOpts}
        </select>
      </div>
    </header>
    <section class="repartidor-notes" id="repartidor-notes" aria-live="polite">
      <div class="repartidor-empty">Selecciona una sucursal para ver sus notas pendientes.</div>
    </section>
  </main>`;
}

/**
 * Renderiza una tarjeta de nota enriquecida para el repartidor.
 * Muestra: productos, nombre del cliente, direccion, hora de entrega, y toggle tomada.
 */
export function renderRepartidorCard(note) {
  const tomada = !!note.tomada;

  const prodSummary = note.productos?.length
    ? note.productos.map(p => `${p.cantidad} ${p.nombre}`).join(', ')
    : '';

  const clienteDisplay = (note.clienteNombre || '').trim();

  const direccionDisplay = (note.direccionEntrega || note.clienteDireccion || '').trim();

  const horaDisplay = note.horaEntrega
    ? `${note.horaEntrega} ${note.horaPeriodo || 'AM'}`
    : '';

  const hasObs = !!(note.observaciones || '').trim();

  const ariaParts = [`Nota ${note.numero}`];
  if (prodSummary) ariaParts.push(prodSummary);
  if (clienteDisplay) ariaParts.push(clienteDisplay);
  if (note.destino) ariaParts.push(note.destino);
  if (tomada) ariaParts.push('Tomada');

  return `
  <article class="repartidor-card${tomada ? ' repartidor-card--tomada' : ''}"
    data-note-id="${note.id}" role="button" aria-pressed="${tomada}" aria-label="${esc(ariaParts.join(', '))}">
    <div class="repartidor-card__check" aria-hidden="true">
      <span class="repartidor-checkbox-icon">${tomada ? '✓' : ''}</span>
    </div>
    <div class="repartidor-card__info">
      <div class="repartidor-card__id">
        <strong>${esc(note.numero)}</strong>
        ${tomada ? '<span class="tomada-badge">Tomada</span>' : ''}
        ${horaDisplay ? `<span class="repartidor-card__hora">${esc(horaDisplay)}</span>` : ''}
      </div>
      ${prodSummary ? `<div class="repartidor-card__productos">${esc(prodSummary)}</div>` : ''}
      ${clienteDisplay || direccionDisplay ? `
        <div class="repartidor-card__cliente">
          ${clienteDisplay ? esc(clienteDisplay) : ''}
          ${clienteDisplay && direccionDisplay ? ' · ' : ''}
          ${direccionDisplay ? esc(direccionDisplay) : ''}
        </div>` : ''}
      <div class="repartidor-card__fecha">Entrega: ${esc(formatFecha(note.fecha))}</div>
    </div>
    ${hasObs ? '<span class="repartidor-card__obs-icon" aria-label="Tiene observaciones" title="Tiene observaciones">i</span>' : ''}
  </article>`;
}
