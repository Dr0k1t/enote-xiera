/// <reference path="./types.js" />
// Generación de recibo PDF con Typst (WASM) en cliente.
// Compila templates/nota.typ inyectando los datos de la nota vía sys.inputs.
// El compiler WASM (~27MB) se carga lazy y se cachea por el SW (warm-cache diferido).
import { $typst, TypstSnippet } from './vendor/typst.ts.esm.js';
import { BUSINESS_INFO } from './config.js';
// Template + logo INLINE (generados por build-config.js desde templates/nota.typ y
// assets/typst/logo-xiera.png). Autocontenido: el JS y su template/logo viajan juntos,
// imposibilitando el skew de versiones que rompía la compilación (bug v1.6.0, donde el
// warm-cache metía un template nuevo en una caché con typstReceipt.js viejo).
import { NOTA_TEMPLATE, LOGO_B64 } from './typstAssets.js';

const WASM_URL = '/assets/typst/typst_ts_web_compiler_bg.wasm';
const LOGO_VFS_PATH = '/assets/typst/logo-xiera.png'; // ruta que referencia nota.typ via image()
const FONTS = [
  '/assets/typst/fonts/Jost-VF.ttf',
  '/assets/typst/fonts/Caveat-VF.ttf',
];

let _ready = null;   // single-flight init

function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Inicializa el compilador Typst una sola vez (idempotente).
 * Self-hosted: WASM + fuentes locales, sin assets remotos (CSP).
 * @returns {Promise<void>}
 */
function ensureReady() {
  if (_ready) return _ready;
  _ready = (async () => {
    $typst.setCompilerInitOptions({ getModule: () => WASM_URL });
    // Sin fuentes default remotas (CSP connect-src 'self'); cargamos las nuestras.
    $typst.use(
      TypstSnippet.disableDefaultFontAssets(),
      ...FONTS.map(url => TypstSnippet.preloadFontFromUrl(url)),
    );
    // Fuerza la inicialización del compilador ahora (descarga/instancia el WASM).
    await $typst.getCompiler();
    // El logo se referencia con image() en nota.typ → debe estar en el VFS del
    // compiler. Bytes inline (no fetch) → siempre consistente con el template.
    if (LOGO_B64) {
      await $typst.mapShadow(LOGO_VFS_PATH, b64ToBytes(LOGO_B64));
    }
  })();
  return _ready;
}

/**
 * ¿Están los assets de Typst disponibles (cacheados o con red)? Decide si
 * intentar la ruta PDF o ir directo al fallback window.print().
 * @returns {Promise<boolean>}
 */
export async function typstAvailable() {
  try {
    const r = await fetch(WASM_URL, { method: 'HEAD' });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Mapea una Note a los inputs string que consume nota.typ.
 * Replica el formateo de renderPrintableReceipt (fecha UTC, montos es-MX).
 * @param {Note} note
 * @returns {Record<string,string>}
 */
export function noteToInputs(note) {
  const money = n => (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 });

  let dia = '', mes = '', anio = '', fechaFmt = '';
  if (note.fecha) {
    const [y, m, d] = String(note.fecha).split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dia = String(d).padStart(2, '0');
    mes = String(m).padStart(2, '0');
    anio = String(y);
    fechaFmt = dt.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
  }

  const total = (note.costoPastel || 0) + (note.depositoEquipo || 0) +
    (note.arreglosFigura || 0) + (note.servicioDomicilio || 0);
  const saldo = total - (note.anticipo || 0);
  const hasPastel = note.sabor || note.modelo || note.colores || note.kilos || note.pisos;

  return {
    instagram: BUSINESS_INFO.instagram || '',
    phone: BUSINESS_INFO.phone || '',
    facebook: BUSINESS_INFO.facebook || '',
    address: BUSINESS_INFO.address || '',
    fecha: fechaFmt,
    vendedor: note.creadoPor || '',
    numero: note.numero || '',
    clienteNombre: note.clienteNombre || '',
    clienteDireccion: note.clienteDireccion || '',
    clienteTelefono: note.clienteTelefono || '',
    pastelCheck: hasPastel ? 'X' : '',
    pisos: note.pisos != null ? String(note.pisos) : '',
    sabor: note.sabor || '',
    kilos: note.kilos != null ? String(note.kilos) : '',
    modelo: note.modelo || '',
    texto: note.texto || '',
    colores: note.colores || '',
    dia, mes, anio,
    horaEntrega: note.horaEntrega || '',
    horaPeriodo: note.horaPeriodo || '',
    direccionEntrega: note.direccionEntrega || '',
    observaciones: note.observaciones || '',
    costoPastel: money(note.costoPastel),
    depositoEquipo: money(note.depositoEquipo),
    arreglosFigura: money(note.arreglosFigura),
    servicioDomicilio: money(note.servicioDomicilio),
    total: money(total),
    anticipo: money(note.anticipo),
    metodoPago: note.metodoPago || '',
    saldo: money(saldo),
  };
}

/**
 * Compila la nota a PDF.
 * @param {Note} note
 * @returns {Promise<Uint8Array>}
 */
export async function generateReceiptPdf(note) {
  await ensureReady();
  const inputs = noteToInputs(note);
  const pdf = await $typst.pdf({ mainContent: NOTA_TEMPLATE, inputs });
  if (!pdf) throw new Error('Typst no devolvió PDF');
  return pdf;
}

/**
 * Comparte el PDF (share sheet nativo: WhatsApp/Archivos) o lo descarga.
 * navigator.share recibe el File directo (no navega a blob:), esquivando el
 * bug WKWebView #216918 que rompía descargas blob en iOS PWA standalone.
 * @param {Uint8Array} pdf
 * @param {Note} note
 * @returns {Promise<void>}
 */
export async function shareOrDownloadPdf(pdf, note) {
  const filename = `Nota_${(note.numero || '').replace('#', '') || 's-n'}.pdf`;
  const file = new File([pdf], filename, { type: 'application/pdf' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Nota ${note.numero || ''}` });
      return;
    } catch (err) {
      // AbortError = el usuario canceló el share sheet; no es fallo.
      if (err && err.name === 'AbortError') return;
      // Otro error → caer a descarga.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
