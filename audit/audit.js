/**
 * OBSOLETO — Este script usaba credenciales demo que ya no existen.
 * Usar audit-prod.js o audit-v2.js para pruebas en producción.
 *
 * Enote — Playwright audit script (v1.1.5 — obsoleto)
 * Uso: node audit.js [URL]
 * Default URL: http://localhost:5500
 */
console.error('[audit.js] OBSOLETO — usa audit-prod.js o audit-v2.js. Saliendo.');
process.exit(1);

const { chromium } = require('playwright');
const path  = require('path');
const fs    = require('fs');

const BASE_URL = process.env.ENOTE_URL || process.argv[2] || 'http://localhost:5500';
const SHOTS_DIR = path.join(__dirname, 'screenshots');

if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR, { recursive: true });

const report = { checks: [], consoleErrors: [], missingAlt: [], timestamp: new Date().toISOString() };

function check(label, passed, detail = '') {
  report.checks.push({ label, passed, detail });
  const icon = passed ? '✓' : '✗';
  const msg  = detail ? ` — ${detail}` : '';
  console.log(`  ${icon} ${label}${msg}`);
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  ENOTE AUDIT v1.1.5');
  console.log(`  URL: ${BASE_URL}`);
  console.log(`  ${report.timestamp}`);
  console.log('══════════════════════════════════════════\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page    = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('/api/log')) {
      report.consoleErrors.push(msg.text());
    }
  });

  page.on('response', resp => {
    if (resp.status() >= 400 && !resp.url().includes('/api/log')) {
      report.consoleErrors.push(`Error ${resp.status()}: ${resp.url()}`);
    }
  });

  try {
    // ── 1. Login view ───────────────────────────────────────────────────────
    console.log('[ 1. Login ]');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForSelector('#view-login.active', { timeout: 5000 });
    check('Input usuario visible', await page.locator('#inp-user').isVisible());

    // ── 2. Login admin1 ─────────────────────────────────────────────────────
    console.log('\n[ 2. Login Admin ]');
    await page.fill('#inp-user', 'admin1');
    await page.fill('#inp-pass', 'pass');
    await page.click('button[type="submit"]');
    await page.waitForSelector('#view-dashboard.active', { timeout: 5000 });
    check('Dashboard admin visible', true);

    // ── 3. Logout ──────────────────────────────────────────────────────────
    console.log('\n[ 3. Logout ]');
    await page.click('.btn-logout');
    await page.waitForSelector('#view-login.active', { timeout: 3000 });
    check('Logout exitoso', true);

    // ── 4. Bug Fix: Visibilidad Sucursal -> Planta ─────────────────────────
    console.log('\n[ 4. Bug Fix: Sucursal -> Planta ]');
    await page.fill('#inp-user', 'sucursal1');
    await page.fill('#inp-pass', 'pass');
    await page.click('button[type="submit"]');
    await page.waitForSelector('#view-dashboard.active', { timeout: 5000 });

    await page.click('.btn-nueva');
    await page.waitForSelector('.modal-overlay.visible', { timeout: 3000 });
    
    const defaultDestino = await page.$eval('#nf-destino', s => s.value);
    check('Destino default es Planta de Producción', defaultDestino === 'Planta de Producción', `Actual: ${defaultDestino}`);

    const testNoteNum = 'TEST-' + Date.now().toString().slice(-4);
    await page.fill('.prod-nombre-inp', testNoteNum);
    await page.fill('.prod-cantidad-inp', '1');
    await page.click('button[data-action="save"]');
    
    // Esperar a que se cierre el modal y se guarde (asíncrono)
    await page.waitForFunction(() => !document.getElementById('modal-overlay').classList.contains('visible'));
    check('Nota creada por sucursal', true);

    await page.click('.btn-logout');
    await page.waitForSelector('#view-login.active');

    // Login como Planta para ver si aparece
    await page.fill('#inp-user', 'planta1');
    await page.fill('#inp-pass', 'pass');
    await page.click('button[type="submit"]');
    await page.waitForSelector('#view-dashboard.active');
    
    const plantaNoteVisible = await page.locator(`.note-card:has-text("${testNoteNum}")`).isVisible();
    check('Planta ve la nota creada por Sucursal', plantaNoteVisible);

    // ── 5. Bug Fix: Botones de Eliminación/Cancelación (Sucursal) ──────────
    console.log('\n[ 5. Bug Fix: Eliminación/Cancelación ]');
    await page.click('.btn-logout');
    await page.waitForSelector('#view-login.active');
    
    await page.fill('#inp-user', 'sucursal1');
    await page.fill('#inp-pass', 'pass');
    await page.click('button[type="submit"]');
    await page.waitForSelector('#view-dashboard.active');

    // Probar botón Cancelar en el formulario
    await page.click('.btn-nueva');
    await page.waitForSelector('.modal-overlay.visible');
    await page.click('.btn-cancelar-modal');
    await page.waitForTimeout(300);
    const modalClosed = !(await page.locator('.modal-overlay.visible').isVisible());
    check('Botón Cancelar cierra el formulario', modalClosed);

    // Probar eliminación completa
    // Buscamos la nota que creamos antes (sucursal1 ve las suyas si el destino coincide o si las creó? 
    // Wait, sucursal1 solo ve destino='Sucursal 1'. La nota TEST-... se creó para Planta.
    // Sucursal1 no la verá en su dashboard. 
    // Vamos a crear una nota para Sucursal 1 para probar borrarla.
    await page.click('.btn-nueva');
    await page.waitForSelector('.modal-overlay.visible');
    await page.selectOption('#nf-destino', 'Sucursal 1');
    await page.fill('.prod-nombre-inp', 'BORRAR-ME');
    await page.fill('.prod-cantidad-inp', '99');
    await page.click('button[data-action="save"]');
    await page.waitForFunction(() => !document.getElementById('modal-overlay').classList.contains('visible'));
    
    const cardToDelete = page.locator('.note-card:has-text("BORRAR-ME")');
    await cardToDelete.locator('.btn-eliminar').click();
    await page.waitForSelector('.modal-overlay.visible');
    
    // Probar Cancelar en modal de borrado
    await page.click('.btn-cancelar-modal');
    await page.waitForTimeout(300);
    check('Botón Cancelar cierra modal de eliminación', !(await page.locator('.modal-overlay.visible').isVisible()));

    // Probar Eliminar definitivo
    await cardToDelete.locator('.btn-eliminar').click();
    await page.waitForSelector('.modal-overlay.visible');
    await page.click('.btn-confirmar-delete');
    
    // Esperar a que el modal se cierre y la lista se refresque
    await page.waitForFunction(() => !document.getElementById('modal-overlay').classList.contains('visible'));
    await page.waitForTimeout(500); // Dar tiempo al render asíncrono
    
    const isVisible = await page.locator('.note-card:has-text("BORRAR-ME")').isVisible();
    check('Nota eliminada correctamente por Sucursal', !isVisible);

    // ── 6. Accesibilidad (Imágenes Alt) ────────────────────────────────────
    console.log('\n[ 6. Accesibilidad ]');
    report.missingAlt = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img'))
        .filter(img => !img.alt)
        .map(img => img.src)
    );
    check('Sin imágenes sin atributo alt', report.missingAlt.length === 0, `${report.missingAlt.length} encontradas`);

    await page.screenshot({ path: path.join(SHOTS_DIR, 'final-v1.1.5.png') });

  } catch (err) {
    console.error('\n  ERROR en audit:', err.message);
    report.checks.push({ label: 'Error inesperado', passed: false, detail: err.message });
  } finally {
    await browser.close();
  }

  // ── Reporte final ──────────────────────────────────────────────────────────
  const passed = report.checks.filter(c => c.passed).length;
  const failed = report.checks.filter(c => !c.passed).length;

  console.log('\n══════════════════════════════════════════');
  console.log(`  Checks: ${passed} ✓  ${failed} ✗`);
  if (report.consoleErrors.length > 0) {
    console.log(`\n  Errores de consola (${report.consoleErrors.length}):`);
    report.consoleErrors.forEach(e => console.log(`    - ${e}`));
  }
  console.log(`\n  RESULTADO: ${failed === 0 && report.consoleErrors.length === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log('══════════════════════════════════════════\n');

  process.exit(failed > 0 || report.consoleErrors.length > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
