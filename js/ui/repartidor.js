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
 * Renderiza una tarjeta de nota simplificada para el repartidor.
 */
export function renderRepartidorCard(note) {
  const tomada = !!note.tomada;
  return `
  <article class="repartidor-card${tomada ? ' repartidor-card--tomada' : ''}" 
    data-note-id="${note.id}" role="button" aria-pressed="${tomada}" aria-label="Nota ${esc(note.numero)}, ${esc(note.destino)}">
    <div class="repartidor-card__check" aria-hidden="true">
      <span class="repartidor-checkbox-icon">${tomada ? '✓' : ''}</span>
    </div>
    <div class="repartidor-card__info">
      <div class="repartidor-card__id">
        <strong>${esc(note.numero)}</strong>
        ${tomada ? '<span class="tomada-badge">Tomada</span>' : ''}
      </div>
      <div class="repartidor-card__cliente">${esc(note.destino)}</div>
      <div class="repartidor-card__fecha">Entrega: ${esc(formatFecha(note.fecha))}</div>
    </div>
  </article>`;
}
