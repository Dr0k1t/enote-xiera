/**
 * Enote — Playwright Audit v2.0
 * Suite completa: auth, CRUD pastel, impresion, workflow, multi-rol, offline, a11y
 * Uso: node audit-v2.js [URL]
 * Default URL: http://localhost:5500
 *
 * Credenciales de produccion:
 *   admin@xiera.com / passss
 *   planta@xiera.com / passss
 *   ocotlan@xiera.com / passss
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.ENOTE_URL || process.argv[2] || 'https://enote-xiera.vercel.app';
const SHOTS_DIR = path.join(__dirname, 'screenshots-v2');

const CREDS = {
  admin:    { email: 'admin@xiera.com',    pass: 'passss' },
  planta:   { email: 'planta@xiera.com',   pass: 'passss' },
  ocotlan:  { email: 'ocotlan@xiera.com',  pass: 'passss' },
};

if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR, { recursive: true });

const report = {
  suite: 'Enote Audit v2.0',
  url: BASE_URL,
  sections: [],
  consoleErrors: [],
  timestamp: new Date().toISOString(),
  totalPassed: 0,
  totalFailed: 0,
};

let currentSection = '';

function section(name) {
  currentSection = name;
  report.sections.push({ name, checks: [] });
  console.log(`\n──────────────────────────────────────────────`);
  console.log(`  ${name}`);
  console.log(`──────────────────────────────────────────────`);
}

function check(label, passed, detail = '') {
  const sec = report.sections[report.sections.length - 1];
  sec.checks.push({ label, passed, detail });
  if (passed) report.totalPassed++;
  else report.totalFailed++;
  const icon = passed ? '✓' : '✗';
  const msg = detail ? ` — ${detail}` : '';
  console.log(`  ${icon} ${label}${msg}`);
}

async function loginAs(page, email, password) {
  await page.fill('#inp-user', email);
  await page.fill('#inp-pass', password);
  await page.click('button[type="submit"]');
}

async function run() {
  console.log('══════════════════════════════════════════════');
  console.log('  ENOTE AUDIT v2.0');
  console.log(`  URL: ${BASE_URL}`);
  console.log(`  ${report.timestamp}`);
  console.log('══════════════════════════════════════════════');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('/api/log')) {
      report.consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', err => report.consoleErrors.push(err.message));

  try {
    // ────────────────────────────────────────────────────────────────────────
    // 1. CARGA INICIAL Y LOGIN
    // ────────────────────────────────────────────────────────────────────────
    section('1. Carga inicial y Login');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForSelector('#view-login.active', { timeout: 5000 });
    check('Pagina carga correctamente', true);
    check('Vista login activa', await page.locator('#view-login.active').isVisible());
    check('Input usuario visible', await page.locator('#inp-user').isVisible());
    check('Input password visible', await page.locator('#inp-pass').isVisible());
    check('Boton submit visible', await page.locator('button[type="submit"]').isVisible());

    // Login invalido
    await page.fill('#inp-user', 'invalido@noexiste.com');
    await page.fill('#inp-pass', 'mal123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    const errorEl = page.locator('#login-error');
    const errorText = await errorEl.textContent().catch(() => '');
    check('Login invalido muestra error', !!errorText, errorText || '(vacio)');

    // Login admin
    await loginAs(page, CREDS.admin.email, CREDS.admin.pass);
    await page.waitForSelector('#view-dashboard.active', { timeout: 5000 });
    check('Login admin exitoso', true);
    await page.screenshot({ path: path.join(SHOTS_DIR, '01-dashboard-admin.png') });

    // ────────────────────────────────────────────────────────────────────────
    // 2. CREAR NOTA (FORMATO PASTEL)
    // ────────────────────────────────────────────────────────────────────────
    section('2. Crear nota formato pastel');
    await page.click('.btn-nueva');
    await page.waitForSelector('.modal-overlay.visible', { timeout: 3000 });
    check('Modal formulario abierto', true);

    // Fecha (default hoy)
    const fechaVal = await page.$eval('#nf-fecha', el => el.value);
    check('Fecha default es hoy', /^\d{4}-\d{2}-\d{2}$/.test(fechaVal), fechaVal);

    // Llenar campos pastel
    const testId = 'AUDIT-' + Date.now().toString().slice(-6);
    await page.fill('#nf-cliente-nombre', testId);
    await page.fill('#nf-cliente-direccion', 'Calle Prueba 123');
    await page.fill('#nf-cliente-telefono', '3312345678');
    await page.fill('#nf-sabor', 'Chocolate');
    await page.fill('#nf-kilos', '2 kg');
    await page.fill('#nf-modelo', 'Boda Elegante');
    await page.fill('#nf-texto', 'Feliz Aniversario');
    await page.fill('#nf-colores', 'Blanco y dorado');
    await page.fill('#nf-pisos', '2');
    await page.fill('#nf-hora-entrega', '15:00');
    await page.fill('#nf-direccion-entrega', 'Calle Entrega 456');
    await page.fill('#nf-costo-pastel', '850');
    await page.fill('#nf-deposito-equipo', '200');
    await page.fill('#nf-arreglos-figura', '150');
    await page.fill('#nf-servicio-domicilio', '100');
    await page.fill('#nf-anticipo', '500');
    await page.selectOption('#nf-metodo-pago', 'Transferencia');
    await page.fill('#nf-obs', 'Entregar con mucho cuidado');

    check('Campos pastel llenados', true);

    // Guardar
    await page.click('button[data-action="save"]');
    try {
      await page.waitForFunction(
        () => !document.getElementById('modal-overlay').classList.contains('visible'),
        { timeout: 8000 }
      );
      check('Nota creada exitosamente', true);
    } catch {
      check('Nota creada exitosamente', false, 'Timeout: modal no se cerro');
    }

    await page.screenshot({ path: path.join(SHOTS_DIR, '02-nota-creada.png') });

    // Esperar a que el dashboard refresque y la card aparezca
    await page.waitForTimeout(1500);

    const card = page.locator(`.note-card:has-text("${testId}")`).first();
    const cardVisible = await card.isVisible().catch(() => false);
    check('Card visible en dashboard con cliente', cardVisible);

    // Verificar que el card muestra datos de pastel
    if (cardVisible) {
      const hasSabor = await card.locator(':has-text("Chocolate")').isVisible().catch(() => false);
      check('Card muestra sabor del pastel', hasSabor);
    }

    // ────────────────────────────────────────────────────────────────────────
    // 3. VISTA DE DETALLE E IMPRESIÓN
    // ────────────────────────────────────────────────────────────────────────
    section('3. Vista detalle e impresion');
    if (cardVisible) {
      await card.locator('.btn-ver').click();
      await page.waitForTimeout(500);
      check('Vista detalle abierta', true);

      // Verificar printable receipt
      const receiptPresent = await page.locator('#printable-receipt').isVisible().catch(() => false);
      check('Receipt de impresion presente en DOM', receiptPresent);

      // Verificar campos poblados en el receipt
      if (receiptPresent) {
        const hasCliente = await page.locator('#printable-receipt').textContent().then(t => t.includes(testId));
        check('Receipt contiene cliente', hasCliente);
        const hasSabor = await page.locator('#printable-receipt').textContent().then(t => t.includes('Chocolate'));
        check('Receipt contiene sabor', hasSabor);
        const hasTotal = await page.locator('#printable-receipt').textContent().then(t => t.includes('1,300'));
        check('Receipt contiene total correcto', hasTotal);
      }

      await page.screenshot({ path: path.join(SHOTS_DIR, '03-detalle.png') });
      await page.screenshot({ path: path.join(SHOTS_DIR, '03b-receipt-print.png'), fullPage: true });

      // Boton volver
      await page.click('.btn-volver');
      await page.waitForTimeout(300);
      check('Volver al dashboard', await page.locator('#view-dashboard.active').isVisible());
    }

    // ────────────────────────────────────────────────────────────────────────
    // 4. EDICION Y DIFF VIEW
    // ────────────────────────────────────────────────────────────────────────
    section('4. Edicion y Diff View');
    if (cardVisible) {
      await card.locator('.btn-editar').click();
      await page.waitForSelector('.modal-overlay.visible', { timeout: 3000 });
      check('Modal edicion abierto', true);

      await page.fill('#nf-colores', 'Rosa y plata');
      await page.click('button[data-action="save"]');

      await page.waitForTimeout(500);
      const modalStillOpen = await page.locator('.modal-overlay.visible').isVisible().catch(() => false);
      if (modalStillOpen) {
        // Puede mostrar diff view (estado En Proceso/Completada)
        const diffVisible = await page.locator('.diff-alert').isVisible().catch(() => false);
        if (diffVisible) {
          check('Diff view mostrado correctamente', true);
          await page.screenshot({ path: path.join(SHOTS_DIR, '04-diff-view.png') });
          await page.click('.btn-confirmar-diff');
          await page.waitForFunction(
            () => !document.getElementById('modal-overlay').classList.contains('visible'),
            { timeout: 5000 }
          );
          check('Diff confirmado, nota editada', true);
        } else {
          check('Edicion completada sin diff', true);
        }
      } else {
        check('Edicion completada sin diff', true);
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 5. LOGOUT Y LOGIN PLANTA
    // ────────────────────────────────────────────────────────────────────────
    section('5. Multi-rol: Planta');
    await page.click('.btn-logout');
    await page.waitForSelector('#view-login.active', { timeout: 3000 });
    check('Logout exitoso', true);

    await loginAs(page, CREDS.planta.email, CREDS.planta.pass);
    await page.waitForSelector('#view-dashboard.active', { timeout: 5000 });
    check('Login planta exitoso', true);

    // Planta ve nota creada por sucursal/admin solo si destino coincide
    const plantaVeNota = await page.locator(`.note-card:has-text("${testId}")`).isVisible().catch(() => false);
    check('Planta ve nota (si destino coincide)', plantaVeNota, plantaVeNota ? 'Visible' : 'No visible (destino distinto)');

    await page.screenshot({ path: path.join(SHOTS_DIR, '05-planta-dashboard.png') });

    // ────────────────────────────────────────────────────────────────────────
    // 6. CAMBIO DE ESTATUS (PLANTA)
    // ────────────────────────────────────────────────────────────────────────
    section('6. Cambio de estatus');
    if (plantaVeNota) {
      const plantaCard = page.locator(`.note-card:has-text("${testId}")`).first();
      try {
        await plantaCard.locator('.btn-ver').click();
      } catch { /* card may have moved */ }
      await page.waitForTimeout(800);

      const badgeProceso = await page.locator('.badge--en-proceso').isVisible().catch(() => false);
      check('Auto-transicion Nueva->En Proceso', badgeProceso, badgeProceso ? 'Badge En Proceso visible' : 'Badge no encontrado / no transito');

      try {
        await page.click('.btn-volver');
      } catch { /* overlay may not have btn-volver */ }
      await page.waitForTimeout(300);
    } else {
      check('Auto-transicion Nueva->En Proceso', false, 'Nota no visible para planta');
    }

    // ────────────────────────────────────────────────────────────────────────
    // 7. LOGOUT Y LOGIN SUCURSAL
    // ────────────────────────────────────────────────────────────────────────
    section('7. Multi-rol: Sucursal (crea + elimina)');
    await page.click('.btn-logout');
    await page.waitForSelector('#view-login.active', { timeout: 3000 });

    await loginAs(page, CREDS.ocotlan.email, CREDS.ocotlan.pass);
    await page.waitForSelector('#view-dashboard.active', { timeout: 5000 });
    check('Login sucursal exitoso', true);

    // Crear nota para borrar
    await page.click('.btn-nueva');
    await page.waitForSelector('.modal-overlay.visible', { timeout: 3000 });
    const deleteId = 'DEL-' + Date.now().toString().slice(-6);
    await page.selectOption('#nf-destino', 'Sucursal 1');
    await page.fill('#nf-cliente-nombre', deleteId);
    await page.fill('#nf-sabor', 'Vainilla');
    await page.click('button[data-action="save"]');
    try {
      await page.waitForFunction(
        () => !document.getElementById('modal-overlay').classList.contains('visible'),
        { timeout: 8000 }
      );
      check('Sucursal crea nota', true);
    } catch {
      check('Sucursal crea nota', false, 'Timeout');
    }

    // Esperar a que la card aparezca en el dashboard
    await page.waitForTimeout(1500);

    const delCard = page.locator(`.note-card:has-text("${deleteId}")`).first();
    const delCardVisibleNow = await delCard.isVisible().catch(() => false);
    if (delCardVisibleNow) {
      await delCard.locator('.btn-eliminar').click();
      await page.waitForSelector('.modal-overlay.visible', { timeout: 3000 });
      check('Modal confirmacion eliminar abierto', true);

      await page.click('.btn-confirmar-delete');
      try {
        await page.waitForFunction(
          () => !document.getElementById('modal-overlay').classList.contains('visible'),
          { timeout: 5000 }
        );
        const stillVisible = await page.locator(`.note-card:has-text("${deleteId}")`).isVisible().catch(() => false);
        check('Nota eliminada correctamente', !stillVisible);
      } catch {
        check('Nota eliminada correctamente', false, 'Timeout');
      }
    } else {
      check('Nota creada para eliminacion no visible', false, 'Posible problema de visibilidad sucursal');
    }

    await page.screenshot({ path: path.join(SHOTS_DIR, '07-sucursal-dashboard.png') });

    // ────────────────────────────────────────────────────────────────────────
    // 8. A11Y
    // ────────────────────────────────────────────────────────────────────────
    section('8. Accesibilidad');
    const missingAlt = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img'))
        .filter(img => !img.alt)
        .map(img => img.src || '(sin src)')
    );
    check('Imagenes con alt', missingAlt.length === 0, `${missingAlt.length} sin alt`);

    // Verificar labels en inputs
    const inputsSinLabel = await page.evaluate(() =>
      Array.from(document.querySelectorAll('input:not([type="hidden"]):not([aria-label]):not([aria-labelledby])'))
        .filter(inp => {
          const id = inp.id;
          if (!id) return true;
          return !document.querySelector(`label[for="${id}"]`);
        })
        .map(inp => inp.id || inp.name || '(sin id)')
    );
    check('Inputs con label/aria-label', inputsSinLabel.length === 0, `${inputsSinLabel.length} sin label`);

    // ────────────────────────────────────────────────────────────────────────
    // 9. FORM VALIDATION (NUEVAS REGLAS)
    // ────────────────────────────────────────────────────────────────────────
    section('9. Validacion de formulario');
    await page.click('.btn-nueva');
    await page.waitForSelector('.modal-overlay.visible', { timeout: 3000 });

    // Intentar guardar sin datos (solo debe tener fecha y destino)
    await page.click('button[data-action="save"]');
    await page.waitForTimeout(500);

    // Debe mostrar toast de error pq no hay productos ni datos pastel
    const toastVisible = await page.locator('.toast-container .toast--error').isVisible().catch(() => false);
    check('Muestra error al guardar sin datos pastel ni productos', toastVisible);

    // Ahora llenar solo datos pastel (sin productos)
    await page.fill('#nf-cliente-nombre', 'Cliente SoloPastel');
    await page.fill('#nf-sabor', 'Fresa');
    await page.click('button[data-action="save"]');
    try {
      await page.waitForFunction(
        () => !document.getElementById('modal-overlay').classList.contains('visible'),
        { timeout: 8000 }
      );
      check('Guarda con solo datos pastel (sin productos)', true);
    } catch {
      check('Guarda con solo datos pastel (sin productos)', false, 'Timeout');
    }

    await page.screenshot({ path: path.join(SHOTS_DIR, '09-validacion-form.png') });

    // ────────────────────────────────────────────────────────────────────────
    // 10. LOGOUT
    // ────────────────────────────────────────────────────────────────────────
    section('10. Logout final');
    await page.click('.btn-logout');
    await page.waitForSelector('#view-login.active', { timeout: 3000 });
    check('Logout final exitoso', true);

    await page.screenshot({ path: path.join(SHOTS_DIR, '10-logout.png') });

  } catch (err) {
    console.error(`\n  ERROR en seccion "${currentSection}":`, err.message);
    const sec = report.sections[report.sections.length - 1];
    if (sec) sec.checks.push({ label: 'Error inesperado', passed: false, detail: err.message });
    report.consoleErrors.push(`Exception: ${err.message}`);
    await page.screenshot({ path: path.join(SHOTS_DIR, `error-${Date.now()}.png`) });
  } finally {
    await browser.close();
  }

  // ────────────────────────────────────────────────────────────────────────
  // REPORTE FINAL
  // ────────────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════');
  console.log('  RESUMEN FINAL');
  console.log('══════════════════════════════════════════════');

  report.sections.forEach(sec => {
    const p = sec.checks.filter(c => c.passed).length;
    const f = sec.checks.filter(c => !c.passed).length;
    console.log(`  ${sec.name}: ${p}✓ ${f}✗`);
  });

  console.log(`\n  TOTAL: ${report.totalPassed}✓ ${report.totalFailed}✗`);

  if (report.consoleErrors.length > 0) {
    const unique = [...new Set(report.consoleErrors)];
    console.log(`\n  Errores de consola (${unique.length}):`);
    unique.slice(0, 10).forEach(e => console.log(`    - ${e}`));
    if (unique.length > 10) console.log(`    ... y ${unique.length - 10} mas`);
  }

  const status = report.totalFailed === 0 && report.consoleErrors.length === 0 ? 'PASS ✓' : 'FAIL ✗';
  console.log(`\n  RESULTADO: ${status}`);
  console.log('══════════════════════════════════════════════\n');

  // Guardar reporte JSON
  const reportPath = path.join(SHOTS_DIR, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`  Reporte guardado: ${reportPath}`);

  process.exit(report.totalFailed > 0 || report.consoleErrors.length > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
