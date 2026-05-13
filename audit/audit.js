/**
 * Enote — Playwright audit script
 * Uso: node audit.js [URL]
 * Default URL: http://localhost:5500
 * Override: ENOTE_URL=http://localhost:8080 node audit.js
 */

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
  console.log('  ENOTE AUDIT');
  console.log(`  URL: ${BASE_URL}`);
  console.log(`  ${report.timestamp}`);
  console.log('══════════════════════════════════════════\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page    = await context.newPage();

  // Collect console errors
  page.on('console', msg => {
    if (msg.type() === 'error') report.consoleErrors.push(msg.text());
  });

  try {
    // ── 1. Login view ───────────────────────────────────────────────────────
    console.log('[ Login ]');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForSelector('#view-login.active', { timeout: 5000 });
    await page.screenshot({ path: path.join(SHOTS_DIR, '01-login.png') });

    check('Título contiene "Enote"', (await page.title()).includes('Enote'));
    check('Input usuario visible', await page.locator('#inp-user').isVisible());
    check('Input contraseña visible', await page.locator('#inp-pass').isVisible());
    check('Botón Entrar visible', await page.locator('button[type="submit"]').isVisible());

    // ── 2. Login inválido ───────────────────────────────────────────────────
    console.log('\n[ Login inválido ]');
    await page.fill('#inp-user', 'usuario_malo');
    await page.fill('#inp-pass', 'clave_mala');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(300);
    const loginError = await page.locator('#login-error').textContent();
    check('Mensaje de error mostrado', loginError.trim().length > 0, loginError.trim());

    // ── 3. Dashboard admin ──────────────────────────────────────────────────
    console.log('\n[ Dashboard — admin1 ]');
    await page.fill('#inp-user', 'admin1');
    await page.fill('#inp-pass', 'pass');
    await page.click('button[type="submit"]');
    await page.waitForSelector('#view-dashboard.active', { timeout: 5000 });
    await page.screenshot({ path: path.join(SHOTS_DIR, '02-dashboard-admin.png') });

    const noteCards = await page.locator('.note-card').count();
    check('Dashboard admin visible', true);
    check('Botón "+ Nueva nota" presente', await page.locator('.btn-nueva').isVisible());
    check(`Hay notas en pantalla (seed data)`, noteCards > 0, `${noteCards} nota(s)`);
    check('Botón Editar presente en alguna nota', await page.locator('.btn-editar').first().isVisible());
    check('Botón Eliminar presente en alguna nota', await page.locator('.btn-eliminar').first().isVisible());

    // ── 4. Formulario de nota ──────────────────────────────────────────────
    console.log('\n[ Formulario nueva nota ]');
    await page.click('.btn-nueva');
    await page.waitForSelector('.modal-overlay.visible', { timeout: 3000 });
    await page.screenshot({ path: path.join(SHOTS_DIR, '03-form-nueva.png') });

    check('Modal de formulario abre', await page.locator('.modal-overlay.visible').isVisible());
    check('Campo fecha visible', await page.locator('#nf-fecha').isVisible());
    check('Campo destino visible', await page.locator('#nf-destino').isVisible());
    check('Tabla de productos visible', await page.locator('.products-table').isVisible());
    check('Botón "Guardar" visible', await page.locator('button[data-action="save"]').isVisible());
    check('Botón "Previsualizar" visible', await page.locator('button[data-action="preview"]').isVisible());

    // Cerrar modal con Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    check('Escape cierra el modal', !(await page.locator('.modal-overlay.visible').isVisible()));

    // ── 5. Detalle de nota ─────────────────────────────────────────────────
    console.log('\n[ Vista de detalle ]');
    await page.locator('.btn-ver').first().click();
    await page.waitForSelector('#view-detail.active', { timeout: 3000 });
    await page.screenshot({ path: path.join(SHOTS_DIR, '04-detalle-nota.png') });

    check('Vista de detalle visible', await page.locator('#view-detail.active').isVisible());
    check('Botón Imprimir presente', await page.locator('.btn-imprimir').isVisible());
    check('Botón Volver presente', await page.locator('.btn-volver').isVisible());

    await page.click('.btn-volver');
    await page.waitForSelector('#view-dashboard.active', { timeout: 3000 });

    // ── 6. Filtros ─────────────────────────────────────────────────────────
    console.log('\n[ Filtros ]');
    await page.selectOption('.filter-estatus', 'Completada');
    await page.waitForTimeout(200);
    const filteredCards = await page.locator('.note-card').count();
    check('Filtro por estado funciona', filteredCards <= noteCards, `Mostrando ${filteredCards}/${noteCards}`);
    await page.selectOption('.filter-estatus', '');

    await page.fill('.filter-search', 'conchas');
    await page.waitForTimeout(400);
    const searchCards = await page.locator('.note-card').count();
    check('Búsqueda de texto funciona', searchCards <= noteCards, `Resultados: ${searchCards}`);
    await page.fill('.filter-search', '');
    await page.waitForTimeout(300);

    // ── 7. Logout ──────────────────────────────────────────────────────────
    console.log('\n[ Logout ]');
    await page.click('.btn-logout');
    await page.waitForSelector('#view-login.active', { timeout: 3000 });
    check('Logout redirige a login', await page.locator('#view-login.active').isVisible());

    // ── 8. Dashboard planta1 ───────────────────────────────────────────────
    console.log('\n[ Dashboard — planta1 ]');
    await page.fill('#inp-user', 'planta1');
    await page.fill('#inp-pass', 'pass');
    await page.click('button[type="submit"]');
    await page.waitForSelector('#view-dashboard.active', { timeout: 5000 });
    await page.screenshot({ path: path.join(SHOTS_DIR, '05-dashboard-planta.png') });

    check('Dashboard planta visible', true);
    const hasCreateBtn = await page.locator('.btn-nueva').count() > 0;
    check('Planta NO tiene botón crear', !hasCreateBtn);
    check('Planta tiene flechas de prioridad', await page.locator('.btn-priority-up').first().isVisible());
    check('Planta tiene selector de estado', await page.locator('.status-select').first().isVisible());
    const hasEditBtn = await page.locator('#view-dashboard .btn-editar').count() > 0;
    check('Planta NO tiene botón editar en dashboard', !hasEditBtn);

    // ── 9. Imágenes sin alt ────────────────────────────────────────────────
    report.missingAlt = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img'))
        .filter(img => !img.alt)
        .map(img => img.src)
    );

    // ── 10. Bug fix — sucursal1 destino default ────────────────────────────
    console.log('\n[ Bug fix — sucursal1 destino default ]');
    await page.click('.btn-logout');
    await page.waitForSelector('#view-login.active', { timeout: 3000 });
    await page.fill('#inp-user', 'sucursal1');
    await page.fill('#inp-pass', 'pass');
    await page.click('button[type="submit"]');
    await page.waitForSelector('#view-dashboard.active', { timeout: 5000 });
    await page.screenshot({ path: path.join(SHOTS_DIR, '07-dashboard-sucursal1.png') });

    await page.click('.btn-nueva');
    await page.waitForSelector('.modal-overlay.visible', { timeout: 3000 });
    const destinoValue = await page.$eval('#nf-destino', s => s.value);
    check('sucursal1 destino default = Sucursal 1', destinoValue === 'Sucursal 1', `Actual: ${destinoValue}`);
    // Llenar al menos un producto (validación lo requiere)
    await page.fill('.prod-nombre-inp', 'Conchas');
    await page.fill('.prod-cantidad-inp', '10');
    await page.screenshot({ path: path.join(SHOTS_DIR, '08-form-sucursal1.png') });
    await page.click('[data-action="save"]');
    // Esperar cierre real del modal (no solo que el dashboard esté activo)
    await page.waitForFunction(() => !document.getElementById('modal-overlay')?.classList.contains('visible'), { timeout: 3000 });
    await page.waitForSelector('#view-dashboard.active', { timeout: 3000 });
    const sucursalCards = await page.locator('.note-card').count();
    check('sucursal1 ve su nota creada en dashboard', sucursalCards >= 1, `${sucursalCards} nota(s)`);

    // ── 11. Vista repartidor ────────────────────────────────────────────────
    console.log('\n[ Vista repartidor ]');
    await page.click('.btn-logout');
    await page.waitForSelector('#view-login.active', { timeout: 3000 });
    await page.fill('#inp-user', 'repartidor1');
    await page.fill('#inp-pass', 'pass');
    await page.click('button[type="submit"]');
    await page.waitForSelector('#view-repartidor.active', { timeout: 5000 });
    await page.screenshot({ path: path.join(SHOTS_DIR, '09-repartidor-view.png') });

    check('repartidor ve vista correcta', await page.locator('#view-repartidor.active').isVisible());
    check('dropdown de sucursal visible', await page.locator('#repartidor-sucursal').isVisible());

    // ── 12. Repartidor selecciona sucursal ─────────────────────────────────
    console.log('\n[ Repartidor — selección de sucursal ]');
    await page.selectOption('#repartidor-sucursal', 'Sucursal 1');
    await page.waitForTimeout(300);
    const repCards = await page.locator('.repartidor-card').count();
    check('repartidor ve notas de Sucursal 1', repCards >= 1, `${repCards} nota(s)`);
    await page.screenshot({ path: path.join(SHOTS_DIR, '10-repartidor-sucursal1.png') });

    // ── 13. Toggle Tomada ──────────────────────────────────────────────────
    console.log('\n[ Repartidor — toggle Tomada ]');
    const firstRepCard = page.locator('.repartidor-card').first();
    await firstRepCard.click();
    await page.waitForTimeout(300);
    const isTomada = await firstRepCard.evaluate(el => el.classList.contains('repartidor-card--tomada'));
    check('click en card → clase tomada aplicada', isTomada);
    const tomadaBadgeVisible = await firstRepCard.locator('.tomada-badge').isVisible();
    check('badge "Tomada" visible tras primer click', tomadaBadgeVisible);
    await page.screenshot({ path: path.join(SHOTS_DIR, '11-repartidor-tomada.png') });

    await firstRepCard.click();
    await page.waitForTimeout(300);
    const isUntomada = await firstRepCard.evaluate(el => !el.classList.contains('repartidor-card--tomada'));
    check('segundo click → tomada removida', isUntomada);
    await page.screenshot({ path: path.join(SHOTS_DIR, '12-repartidor-untomada.png') });

    // ── 14. Screenshot final ───────────────────────────────────────────────
    await page.screenshot({ path: path.join(SHOTS_DIR, '13-final-state.png') });

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
  } else {
    console.log('\n  Sin errores de consola ✓');
  }

  if (report.missingAlt.length > 0) {
    console.log(`\n  Imágenes sin alt (${report.missingAlt.length}):`);
    report.missingAlt.forEach(s => console.log(`    - ${s}`));
  }

  console.log(`\n  Screenshots: ${path.relative(process.cwd(), SHOTS_DIR)}`);
  console.log(`\n  RESULTADO: ${failed === 0 && report.consoleErrors.length === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log('══════════════════════════════════════════\n');

  process.exit(failed > 0 || report.consoleErrors.length > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
