/// <reference path="../types.js" />
import { esc, renderToast } from './shared.js';
import { BUSINESS_INFO } from '../config.js';
import { log } from '../logger.js';

// Typst (glue ~206KB + wasm ~27MB) se carga lazy vía dynamic import: solo al
// imprimir, nunca en el boot. Mantiene el arranque liviano (offline-first).

/**
 * Genera el recibo. Ruta principal: PDF vectorial con Typst (WASM) →
 * navigator.share / descarga. Si Typst no está disponible (assets no
 * cacheados sin red) o falla, degrada a la impresión nativa del navegador.
 * @param {Note} note
 * @returns {Promise<void>}
 */
export async function printReceipt(note) {
  let toastEl;
  try {
    const { generateReceiptPdf, shareOrDownloadPdf, typstAvailable } =
      await import('../typstReceipt.js');
    if (!(await typstAvailable())) return printViaBrowser(note);

    toastEl = renderToast('Generando PDF…', 'info', 0);
    const pdf = await generateReceiptPdf(note);
    if (toastEl && toastEl.remove) toastEl.remove();
    await shareOrDownloadPdf(pdf, note);
    return;
  } catch (err) {
    if (toastEl && toastEl.remove) toastEl.remove();
    log.error('typst-pdf-failed', { message: String(err && err.message || err) });
    renderToast('PDF no disponible, usando impresión del navegador', 'error');
    return printViaBrowser(note);
  }
}

/**
 * Fallback: imprime el recibo clonando el HTML directamente en <body> (fuera
 * del modal y de cualquier capa GPU-composited). Llama window.print() en la
 * ventana principal. Evita el bug de iframe + compositing WebKit (rasterización
 * negra) en iOS PWA standalone.
 * @param {Note} note
 * @returns {Promise<void>}
 */
export function printViaBrowser(note) {
  return new Promise((resolve) => {
    // 1. Crear el clon e inyectarlo en el body
    const clone = document.createElement('div');
    clone.id = 'receipt-print-clone';
    clone.innerHTML = renderPrintableReceipt(note);
    document.body.appendChild(clone);

    // 2. Aplicar la clase para el flujo nativo de mobile preview (Opencode Plan)
    document.body.classList.add('enote-printing');

    // Función segura de limpieza
    let isDone = false;
    const cleanup = () => {
      if (isDone) return;
      isDone = true;
      document.body.classList.remove('enote-printing');
      clone.remove();
      resolve();
    };

    // 3. Manejadores avanzados de limpieza sin depender de setTimeout (Codexplan Alt 3)
    const mql = window.matchMedia('print');
    const onMatchMediaChange = (e) => {
      if (!e.matches) {
        mql.removeEventListener('change', onMatchMediaChange);
        cleanup();
      }
    };
    mql.addEventListener('change', onMatchMediaChange);
    window.addEventListener('afterprint', cleanup, { once: true });

    // 4. Forzar un repintado síncrono del navegador para asegurar que vea las clases (Claude Plan)
    void document.body.offsetHeight; 

    // 5. Llamar sincrónicamente a la impresión nativa
    try {
      window.print();
    } catch (_) {
      cleanup();
    }
    
    // Sólo como seguro de vida extremo por si el motor Android se cuelga, 
    // pero configurado a 3 MINUTOS, no a 3 segundos, dándole tiempo suficiente al usuario.
    setTimeout(cleanup, 180000);
  });
}

export function renderPrintableReceipt(note) {
  let fecha;
  if (note.fecha) {
    const parts = String(note.fecha).split('-');
    fecha = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
  } else {
    fecha = new Date();
  }
  const dia = String(note.fecha ? fecha.getUTCDate() : fecha.getDate()).padStart(2, '0');
  const mes = String((note.fecha ? fecha.getUTCMonth() : fecha.getMonth()) + 1).padStart(2, '0');
  const anio = String(note.fecha ? fecha.getUTCFullYear() : fecha.getFullYear());

  const fechaFormato = note.fecha
    ? fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
    : '';

  const total = (note.costoPastel || 0) + (note.depositoEquipo || 0) +
    (note.arreglosFigura || 0) + (note.servicioDomicilio || 0);
  const saldo = total - (note.anticipo || 0);

  const hasPastel = note.sabor || note.modelo || note.colores || note.kilos || note.pisos;

  return `
  <div id="printable-receipt" class="receipt-print">
    <div class="receipt-scalloped-top"></div>
    <div class="receipt-wrinkle"></div>

    <div class="receipt-content">

      <!-- Header -->
      <div class="receipt-header">
        <div class="receipt-logo-container">
          <h1 class="receipt-logo">X I E R A</h1>
          <svg class="receipt-heart" viewBox="0 0 100 100">
            <path d="M 40 80 C 25 70, 15 45, 25 30 C 35 15, 60 10, 75 25 C 85 35, 80 50, 70 50 C 60 50, 50 35, 55 25 C 60 15, 75 15, 85 25 C 95 35, 95 55, 80 70 C 65 85, 45 85, 40 80 Z" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>
          </svg>
        </div>
        <div class="receipt-sub">P A L ' &nbsp; A L M A</div>

        <div class="receipt-contact">
          <div>
            <svg class="receipt-icon" viewBox="0 0 448 512"><path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z"/></svg>
            ${esc(BUSINESS_INFO.instagram)}
          </div>
          <div>
            <svg class="receipt-icon" viewBox="0 0 512 512"><path d="M164.9 24.6c-7.7-18.6-28-28.5-47.4-23.2l-88 24C12.1 30.2 0 46 0 64C0 311.4 200.6 512 448 512c18 0 33.8-12.1 38.6-29.5l24-88c5.3-19.4-4.6-39.7-23.2-47.4l-96-40c-16.3-6.8-35.2-2.1-46.3 11.6L304.7 368C234.3 334.7 177.3 277.7 144 207.3L193.3 167c13.7-11.2 18.4-30 11.6-46.3l-40-96z"/></svg>
            ${esc(BUSINESS_INFO.phone)}
          </div>
          <div>
            <svg class="receipt-icon" viewBox="0 0 320 512"><path d="M279.1 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.4 0 225.4 0c-73.22 0-121.1 44.38-121.1 124.7v70.62H22.89V288h81.39v224h100.2V288z"/></svg>
            ${esc(BUSINESS_INFO.facebook)}
          </div>
        </div>

        <div class="receipt-address">${esc(BUSINESS_INFO.address)}</div>
      </div>

      <!-- Meta info row -->
      <div class="receipt-meta-row">
        <div>FECHA: <span class="receipt-hw">${esc(fechaFormato)}</span></div>
        <div>VENDEDOR: <span class="receipt-hw">${esc(note.creadoPor || '')}</span></div>
        <div>PEDIDO: <span class="receipt-hw receipt-red-pen">${esc(note.numero || '')}</span></div>
      </div>

      <!-- CLIENTE -->
      <div class="receipt-section-divider">DATOS DE CLIENTE</div>
      <div class="receipt-field">
        <span class="receipt-field-label">NOMBRE:</span>
        <span class="receipt-field-value">${esc(note.clienteNombre || '')}</span>
      </div>
      <div class="receipt-field">
        <span class="receipt-field-label">DIRECCI&Oacute;N:</span>
        <span class="receipt-field-value">${esc(note.clienteDireccion || '')}</span>
      </div>
      <div class="receipt-field">
        <span class="receipt-field-label">TEL&Eacute;FONO:</span>
        <span class="receipt-field-value">${esc(note.clienteTelefono || '')}</span>
      </div>

      <!-- PASTEL -->
      <div class="receipt-section-divider">DATOS DE PASTEL</div>
      <div class="receipt-grid-2">
        <div class="receipt-field">
          <span class="receipt-field-label">PASTEL:</span>
          <span class="receipt-field-value"><span class="receipt-checkbox">${hasPastel ? '&#x2713;' : ''}</span></span>
        </div>
        <div class="receipt-field">
          <span class="receipt-field-label">PISOS:</span>
          <span class="receipt-field-value">${esc(note.pisos ? String(note.pisos) : '')}</span>
        </div>
      </div>
      <div class="receipt-grid-2">
        <div class="receipt-field">
          <span class="receipt-field-label">SABOR:</span>
          <span class="receipt-field-value">${esc(note.sabor || '')}</span>
        </div>
        <div class="receipt-field">
          <span class="receipt-field-label">KILOS:</span>
          <span class="receipt-field-value">${esc(note.kilos || '')}</span>
        </div>
      </div>
      <div class="receipt-grid-2">
        <div class="receipt-field">
          <span class="receipt-field-label">MODELO:</span>
          <span class="receipt-field-value">${esc(note.modelo || '')}</span>
        </div>
        <div class="receipt-field">
          <span class="receipt-field-label">TEXTO:</span>
          <span class="receipt-field-value">${esc(note.texto || '')}</span>
        </div>
      </div>
      <div class="receipt-field">
        <span class="receipt-field-label">COLORES:</span>
        <span class="receipt-field-value">${esc(note.colores || '')}</span>
      </div>

      <!-- ENTREGA -->
      <div class="receipt-section-divider">DATOS DE ENTREGA</div>
      <div class="receipt-date-container">
        <span class="receipt-field-label">FECHA:</span>
        <span class="receipt-date-bracket">[D&Iacute;A]</span> <span class="receipt-hw receipt-date-box">${dia}</span>
        <span class="receipt-date-bracket">[MES]</span> <span class="receipt-hw receipt-date-box">${mes}</span>
        <span class="receipt-date-bracket">[A&Ntilde;O]</span> <span class="receipt-hw receipt-date-box">${anio}</span>

        <span class="receipt-field-label" style="margin-left:20px;">HORA:</span>
        <span class="receipt-hw receipt-hora-box">${esc(note.horaEntrega || '')}</span>
        <span style="margin-left:10px;font-size:10px;">${esc(note.horaPeriodo || '')}</span>
      </div>
      <div class="receipt-field">
        <span class="receipt-field-label">DIRECCI&Oacute;N:</span>
        <span class="receipt-field-value">${esc(note.direccionEntrega || '')}</span>
      </div>
      <div class="receipt-field">
        <span class="receipt-field-label">OBSERVACIONES:</span>
        <span class="receipt-field-value">${esc(note.observaciones || '')}</span>
      </div>

      <!-- TOTALES -->
      <div class="receipt-section-divider" style="border-top:3px solid #1a1a1a; border-bottom:none;"></div>
      <div class="receipt-totals">
        <div class="receipt-total-row">
          <div class="receipt-total-label">COSTO PASTEL:</div>
          <div class="receipt-total-money"><span>($</span> <span class="receipt-hw">${(note.costoPastel || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span> <span>)</span></div>
        </div>
        <div class="receipt-total-row">
          <div class="receipt-total-label">DEP&Oacute;SITO EQUIPO:</div>
          <div class="receipt-total-money"><span>($</span> <span class="receipt-hw">${(note.depositoEquipo || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span> <span>)</span></div>
        </div>
        <div class="receipt-total-row">
          <div class="receipt-total-label">ARREGLOS Y FIGURA:</div>
          <div class="receipt-total-money"><span>($</span> <span class="receipt-hw">${(note.arreglosFigura || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span> <span>)</span></div>
        </div>
        <div class="receipt-total-row">
          <div class="receipt-total-label">SERVICIO A DOMICILIO:</div>
          <div class="receipt-total-money"><span>($</span> <span class="receipt-hw">${(note.servicioDomicilio || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span> <span>)</span></div>
        </div>
        <div class="receipt-total-row">
          <div class="receipt-total-label">TOTAL:</div>
          <div class="receipt-total-money"><span>($</span> <span class="receipt-hw">${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span> <span>)</span></div>
        </div>
        <div class="receipt-total-row" style="align-items:center;">
          <div class="receipt-total-label">ANTICIPO:</div>
          <div class="receipt-total-money"><span>($</span> <span class="receipt-hw">${(note.anticipo || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span> <span>)</span></div>
          <div class="receipt-payment-methods">${esc(note.metodoPago || '')}</div>
        </div>
        <div class="receipt-total-row" style="margin-top:5px;">
          <div class="receipt-total-label">SALDO A PAGAR:</div>
          <div class="receipt-total-money" style="justify-content:flex-end;padding-right:15px;"><span class="receipt-hw">${saldo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></div>
        </div>${note.concepto ? `
        <div class="receipt-field" style="margin-top:10px;">
          <div class="receipt-field-label">CONCEPTO:</div>
          <div class="receipt-field-value">${esc(note.concepto)}</div>
        </div>` : ''}
      </div>

    </div>
  </div>`;
}
