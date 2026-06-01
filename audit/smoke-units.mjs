// Verificación dirigida sin login: evalúa los módulos reales en el navegador
// (mismo origen servido) y comprueba el contrato de los cambios.
import { chromium } from 'playwright';

const URL = process.argv[2] || 'http://localhost:3000';
const browser = await chromium.launch();
const page = await browser.newPage();
const perr = [];
page.on('pageerror', e => perr.push(e.message));
await page.goto(URL, { waitUntil: 'domcontentloaded' });

const res = await page.evaluate(async () => {
  const detail = await import('/js/ui/detail.js');
  const shared = await import('/js/ui/shared.js');
  const out = {};

  const note = {
    id: 7, numero: '#0007', fecha: '2026-06-01', destino: 'Planta de Producción',
    estatus: 'Nueva', observaciones: 'x', creadoPor: 'a', modificadoPor: 'a',
    creadoEn: new Date().toISOString(), modificadoEn: new Date().toISOString(),
    imagenes: ['https://ovlhabedefwbajrnfpup.supabase.co/img/a.webp'],
  };
  const session = { role: 'admin', username: 'a' };
  const html = detail.renderDetailView(note, session);

  out.hasWide = html.includes('modal-card modal-card--wide');
  out.hasModalBody = html.includes('class="modal-body"');
  out.hasCancelar = html.includes('btn-cancelar-modal');
  out.hasImagePanel = html.includes('image-selector-btn'); // nota con imagen
  out.noOldToolbar = !html.includes('detail-toolbar') && !html.includes('btn-volver"');
  // Balance de <div>: aperturas vs cierres (heurístico)
  out.divOpen = (html.match(/<div\b/g) || []).length;
  out.divClose = (html.match(/<\/div>/g) || []).length;

  // resolveImageUrl: blob stale -> '', data: -> tal cual
  out.blobResolved = await shared.resolveImageUrl('blob:https://x/abc');
  out.dataResolved = await shared.resolveImageUrl('data:image/png;base64,AAAA');
  return out;
});

await browser.close();

const checks = [
  ['detalle usa modal-card--wide', res.hasWide],
  ['detalle tiene modal-body', res.hasModalBody],
  ['detalle tiene btn-cancelar-modal (cerrar)', res.hasCancelar],
  ['panel de imagen presente', res.hasImagePanel],
  ['sin toolbar/btn-volver viejos', res.noOldToolbar],
  ['divs balanceados (' + res.divOpen + '/' + res.divClose + ')', res.divOpen === res.divClose],
  ['resolveImageUrl(blob:) -> ""', res.blobResolved === ''],
  ['resolveImageUrl(data:) -> intacto', res.dataResolved === 'data:image/png;base64,AAAA'],
  ['sin pageerror', perr.length === 0],
];
let ok = true;
for (const [label, pass] of checks) { console.log((pass ? 'PASS' : 'FAIL') + ' — ' + label); if (!pass) ok = false; }
if (perr.length) perr.forEach(e => console.log('  pageerror: ' + e));
console.log(ok ? 'UNITS OK' : 'UNITS FAIL');
process.exit(ok ? 0 : 1);
