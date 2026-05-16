/**
 * Enote — Producción audit suite (Playwright)
 * Cubre login 3 roles, CRUD, offline-first (B.1/B.2/B.5), reconexión, PWA, a11y.
 * Uso: node audit-prod.js [URL]
 *
 * Env vars opcionales:
 *   ENOTE_URL       (default: https://enote-xiera.vercel.app)
 *   AUDIT_PASS      (default: passss)
 *   HEADLESS        (default: 1; HEADLESS=0 para abrir browser)
 */

const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const BASE_URL = process.env.ENOTE_URL || process.argv[2] || 'https://enote-xiera.vercel.app';
const PASS = process.env.AUDIT_PASS || 'passss';
const HEADLESS = process.env.HEADLESS !== '0';
const SHOTS = path.join(__dirname, 'screenshots-prod');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const USERS = {
  admin:    { email: 'admin@xiera.com',   role: 'admin' },
  planta:   { email: 'planta@xiera.com',  role: 'planta' },
  ocotlan:  { email: 'ocotlan@xiera.com', role: 'sucursal' },
};

const TS = Date.now().toString().slice(-6);
const NOTE_TAG = `AUDIT-${TS}`;

const report = { checks: [], consoleErrors: [], pageErrors: [], failed: [] };

function check(label, passed, detail = '') {
  report.checks.push({ label, passed, detail });
  if (!passed) report.failed.push(label + (detail ? ` — ${detail}` : ''));
  const icon = passed ? '✓' : '✗';
  console.log(`  ${icon} ${label}${detail ? ' — ' + detail : ''}`);
}

async function shot(page, name) {
  try { await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false }); } catch {}
}

async function login(page, user) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForSelector('#inp-user', { timeout: 10000 });
  await page.fill('#inp-user', user.email);
  await page.fill('#inp-pass', PASS);
  await Promise.all([
    page.waitForSelector('#view-dashboard.active, #view-repartidor.active', { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ]);
}

async function logout(page) {
  const btn = page.locator('.btn-logout').first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    await page.waitForSelector('#view-login.active', { timeout: 5000 }).catch(() => {});
  }
}

async function fillNoteForm(page, { destino, productoNombre, productoCantidad, observaciones }) {
  await page.waitForSelector('.modal-overlay.visible', { timeout: 5000 });
  if (destino) await page.selectOption('#nf-destino', destino);
  await page.fill('.prod-nombre-inp', productoNombre);
  await page.fill('.prod-cantidad-inp', productoCantidad);
  if (observaciones) await page.fill('#nf-obs', observaciones);
}

async function saveAndWaitClose(page) {
  await page.click('button[data-action="save"]');
  await page.waitForFunction(
    () => !document.getElementById('modal-overlay').classList.contains('visible'),
    { timeout: 10000 }
  );
}

async function deleteAuditNotes(page) {
  let removed = 0;
  for (let i = 0; i < 30; i++) {
    const card = page.locator(`.note-card:has-text("${NOTE_TAG}")`).first();
    if (!(await card.isVisible().catch(() => false))) break;
    const del = card.locator('.btn-eliminar');
    if (!(await del.isVisible().catch(() => false))) break;
    await del.click();
    await page.waitForSelector('.modal-overlay.visible', { timeout: 5000 });
    await page.click('.btn-confirmar-delete');
    await page.waitForFunction(
      () => !document.getElementById('modal-overlay').classList.contains('visible'),
      { timeout: 10000 }
    ).catch(() => {});
    removed++;
    await page.waitForTimeout(300);
  }
  return removed;
}

async function clearLocalState(page) {
  await page.evaluate(async () => {
    try {
      await new Promise((resolve) => {
        const req = indexedDB.deleteDatabase('enote-local');
        req.onsuccess = resolve; req.onerror = resolve; req.onblocked = resolve;
      });
    } catch {}
    try { localStorage.clear(); sessionStorage.clear(); } catch {}
  });
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  ENOTE PROD AUDIT');
  console.log(`  URL: ${BASE_URL}`);
  console.log(`  Tag: ${NOTE_TAG}`);
  console.log(`  ${new Date().toISOString()}`);
  console.log('══════════════════════════════════════════\n');

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page    = await context.newPage();

  const ignoredErrorPatterns = [
    '/api/log',
    'favicon',
    'manifest',
    'status of 405',
    'status of 404',
  ];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!ignoredErrorPatterns.some(p => text.includes(p))) {
        report.consoleErrors.push(text);
      }
    }
  });
  page.on('pageerror', err => report.pageErrors.push(err.message));
  page.on('response', resp => {
    if (resp.status() >= 500) {
      report.consoleErrors.push(`HTTP ${resp.status()}: ${resp.url()}`);
    }
  });

  try {
    // ── 1. Login admin ────────────────────────────────────────────────────────
    console.log('[ 1. Login admin ]');
    await login(page, USERS.admin);
    check('Dashboard admin visible', await page.locator('#view-dashboard.active').isVisible());
    check('Header presente', await page.locator('.app-header').isVisible());
    check('Username admin@xiera.com en header', (await page.locator('.header-user').innerText()).includes('admin'));
    await shot(page, '01-dashboard-admin');

    // ── 2. Dashboard admin: filtros y paginación ──────────────────────────────
    console.log('\n[ 2. Dashboard filtros + paginación ]');
    check('Filtro estatus presente', await page.locator('.filter-estatus').isVisible());
    check('Filtro destino presente', await page.locator('.filter-destino').isVisible());
    check('Filtro búsqueda presente', await page.locator('.filter-search').isVisible());
    const initialCards = await page.locator('.note-card').count();
    console.log(`    info: ${initialCards} notas visibles inicialmente`);
    const searchInput = page.locator('.filter-search');
    await searchInput.click();
    await searchInput.type(NOTE_TAG, { delay: 50 });
    await page.waitForTimeout(600);
    const afterSearch = await page.locator('.note-card').count();
    check('Búsqueda filtra a 0 con tag inexistente', afterSearch === 0, `count=${afterSearch}`);
    await searchInput.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(500);

    // ── 3. Crear nota online ──────────────────────────────────────────────────
    console.log('\n[ 3. Crear nota online (admin) ]');
    await page.click('.btn-nueva');
    await fillNoteForm(page, {
      destino: 'Planta de Producción',
      productoNombre: `${NOTE_TAG}-create`,
      productoCantidad: '5',
      observaciones: 'audit nota creación',
    });
    await saveAndWaitClose(page);
    await page.waitForTimeout(1500);
    const createdVisible = await page.locator(`.note-card:has-text("${NOTE_TAG}-create")`).first().isVisible().catch(() => false);
    check('Nota creada visible en dashboard', createdVisible);
    await shot(page, '03-nota-creada');

    // ── 4. Editar nota online ─────────────────────────────────────────────────
    console.log('\n[ 4. Editar nota (admin) ]');
    if (createdVisible) {
      const created = page.locator(`.note-card:has-text("${NOTE_TAG}-create")`).first();
      await created.locator('.btn-editar').click();
      await page.waitForSelector('.modal-overlay.visible', { timeout: 5000 });
      await page.fill('#nf-obs', 'audit editado');
      await saveAndWaitClose(page);
      await page.waitForTimeout(1000);
      check('Edición sin error (modal cerrado)', true);
    } else {
      check('Edición skipped (nota no encontrada)', false, 'creación falló');
    }

    // ── 5. Eliminar nota ──────────────────────────────────────────────────────
    console.log('\n[ 5. Eliminar nota (admin) ]');
    const beforeDel = await page.locator(`.note-card:has-text("${NOTE_TAG}-create")`).count();
    if (beforeDel > 0) {
      const card = page.locator(`.note-card:has-text("${NOTE_TAG}-create")`).first();
      await card.locator('.btn-eliminar').click();
      await page.waitForSelector('.modal-overlay.visible');
      await page.click('.btn-confirmar-delete');
      await page.waitForFunction(
        () => !document.getElementById('modal-overlay').classList.contains('visible'),
        { timeout: 10000 }
      );
      await page.waitForTimeout(800);
      const afterDel = await page.locator(`.note-card:has-text("${NOTE_TAG}-create")`).count();
      check('Nota eliminada (count=0)', afterDel === 0, `after=${afterDel}`);
    } else {
      check('Eliminación skipped', false, 'nada que borrar');
    }

    // ── 6. Logout admin ───────────────────────────────────────────────────────
    console.log('\n[ 6. Logout admin ]');
    await logout(page);
    check('Login view tras logout', await page.locator('#view-login.active').isVisible());

    // ── 7. Login ocotlan (sucursal) + crear nota offline (B.1) ───────────────
    console.log('\n[ 7. Login ocotlan (sucursal) ]');
    await login(page, USERS.ocotlan);
    check('Dashboard visible (sucursal)', await page.locator('#view-dashboard.active').isVisible());
    await shot(page, '07-dashboard-sucursal');

    console.log('\n[ 8. B.1 Crear nota OFFLINE ]');
    await context.setOffline(true);
    await page.waitForTimeout(500);
    await page.click('.btn-nueva');
    await fillNoteForm(page, {
      destino: undefined,
      productoNombre: `${NOTE_TAG}-offline1`,
      productoCantidad: '1',
      observaciones: 'offline test 1',
    });
    await page.click('button[data-action="save"]');
    await page.waitForFunction(
      () => !document.getElementById('modal-overlay').classList.contains('visible'),
      { timeout: 10000 }
    );
    await page.waitForTimeout(800);
    const toastInfo = await page.locator('.toast').filter({ hasText: 'sin conexión' }).first().isVisible().catch(() => false);
    check('Toast "sin conexión" visible', toastInfo);
    const badge1 = page.locator('.app-header .offline-badge');
    const badgeText = await badge1.innerText().catch(() => '');
    check('Badge offline visible con conteo', /⟳\s*\d+/.test(badgeText), `text="${badgeText}"`);
    await shot(page, '08-offline-badge-1');

    // ── 9. B.5 Badge incrementa (3 notas offline) ────────────────────────────
    console.log('\n[ 9. B.5 Badge incrementa con multi-offline ]');
    for (let i = 2; i <= 3; i++) {
      await page.click('.btn-nueva');
      await fillNoteForm(page, {
        destino: undefined,
        productoNombre: `${NOTE_TAG}-offline${i}`,
        productoCantidad: String(i),
        observaciones: `offline test ${i}`,
      });
      await page.click('button[data-action="save"]');
      await page.waitForFunction(
        () => !document.getElementById('modal-overlay').classList.contains('visible'),
        { timeout: 10000 }
      );
      await page.waitForTimeout(600);
    }
    const badge3 = await page.locator('.app-header .offline-badge').innerText().catch(() => '');
    check('Badge muestra ⟳ 3 tras 3 notas offline', /⟳\s*3/.test(badge3), `text="${badge3}"`);
    await shot(page, '09-offline-badge-3');

    // ── 10. B.2 Lectura offline (reload) ─────────────────────────────────────
    console.log('\n[ 10. B.2 Lectura offline tras F5 ]');
    await page.reload({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const stillLoggedIn = await page.locator('#view-dashboard.active').isVisible().catch(() => false);
    check('Dashboard pintado offline (sin red)', stillLoggedIn);

    // ── 11. Reconexión + sync (B.4) ──────────────────────────────────────────
    console.log('\n[ 11. Reconexión + sync ]');
    await context.setOffline(false);
    await page.waitForTimeout(300);
    const toastP = page.locator('.toast').filter({ hasText: 'Conexión restaurada' }).first().waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    const restoredToast = await toastP;
    check('Toast "Conexión restaurada" visible', restoredToast);
    await page.waitForFunction(
      () => {
        const b = document.querySelector('.app-header .offline-badge');
        return !b || b.textContent.trim() === '';
      },
      { timeout: 15000 }
    ).catch(() => {});
    const badgeAfter = await page.locator('.app-header .offline-badge').innerText().catch(() => '');
    check('Badge desaparece (count=0)', badgeAfter === '', `text="${badgeAfter}"`);
    await shot(page, '11-reconexion');

    // ── 12. Cleanup notas AUDIT (sucursal) ────────────────────────────────────
    console.log('\n[ 12. Cleanup notas sucursal AUDIT ]');
    const removedSuc = await deleteAuditNotes(page);
    console.log(`    info: ${removedSuc} notas sucursal borradas`);
    check('Cleanup sucursal sin error', true);

    await logout(page);

    // ── 13. Login planta ──────────────────────────────────────────────────────
    console.log('\n[ 13. Login planta ]');
    await login(page, USERS.planta);
    const plantaView = await page.locator('#view-dashboard.active, #view-repartidor.active').first().isVisible();
    check('Vista planta visible', plantaView);
    await shot(page, '13-dashboard-planta');

    // Planta NO puede crear notas
    const btnNuevaPlanta = await page.locator('.btn-nueva').isVisible().catch(() => false);
    check('Planta no tiene botón "Nueva"', !btnNuevaPlanta);

    await logout(page);

    // ── 14. Login admin (cleanup global) ──────────────────────────────────────
    console.log('\n[ 14. Cleanup admin (notas AUDIT residuales) ]');
    await login(page, USERS.admin);
    const removedAdmin = await deleteAuditNotes(page);
    console.log(`    info: ${removedAdmin} notas admin borradas`);
    const residuals = await page.locator(`.note-card:has-text("${NOTE_TAG}")`).count();
    check('Cero notas AUDIT residuales en prod', residuals === 0, `residual=${residuals}`);

    // ── 15. PWA: manifest + sw ────────────────────────────────────────────────
    console.log('\n[ 15. PWA manifest + service worker ]');
    const pwa = await page.evaluate(async () => {
      const manifestLink = document.querySelector('link[rel="manifest"]');
      const swReg = await navigator.serviceWorker.getRegistration().catch(() => null);
      return {
        manifest: !!manifestLink,
        swActive: !!(swReg && (swReg.active || swReg.installing || swReg.waiting)),
      };
    });
    check('link[rel=manifest] presente', pwa.manifest);
    check('Service Worker registrado', pwa.swActive);

    // ── 16. A11y básico ───────────────────────────────────────────────────────
    console.log('\n[ 16. A11y básico ]');
    const a11y = await page.evaluate(() => ({
      imgsNoAlt: Array.from(document.querySelectorAll('img')).filter(i => !i.alt).length,
      buttonsNoLabel: Array.from(document.querySelectorAll('button')).filter(b =>
        !b.getAttribute('aria-label') && !b.textContent.trim()
      ).length,
    }));
    check('Imágenes sin alt = 0', a11y.imgsNoAlt === 0, `count=${a11y.imgsNoAlt}`);
    check('Botones sin label/texto = 0', a11y.buttonsNoLabel === 0, `count=${a11y.buttonsNoLabel}`);

    // ── 17. Errores consola / page ────────────────────────────────────────────
    console.log('\n[ 17. Errores consola/page ]');
    check('Cero pageerror', report.pageErrors.length === 0,
      report.pageErrors.slice(0, 3).join(' | '));
    check('Cero console errors no triviales', report.consoleErrors.length === 0,
      report.consoleErrors.slice(0, 3).join(' | '));

    await logout(page);

  } catch (err) {
    console.error('\n  ERROR fatal:', err.message);
    report.checks.push({ label: 'Error inesperado', passed: false, detail: err.message });
    report.failed.push(err.message);
    await shot(page, 'fatal-error');
  } finally {
    await browser.close();
  }

  const passed = report.checks.filter(c => c.passed).length;
  const failed = report.checks.filter(c => !c.passed).length;
  console.log('\n══════════════════════════════════════════');
  console.log(`  Checks: ${passed} ✓  ${failed} ✗`);
  if (report.pageErrors.length) {
    console.log(`\n  pageerrors (${report.pageErrors.length}):`);
    report.pageErrors.forEach(e => console.log(`    - ${e}`));
  }
  if (report.consoleErrors.length) {
    console.log(`\n  console.error (${report.consoleErrors.length}):`);
    report.consoleErrors.forEach(e => console.log(`    - ${e}`));
  }
  console.log(`\n  RESULTADO: ${failed === 0 && report.pageErrors.length === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log('══════════════════════════════════════════\n');

  process.exit(failed > 0 || report.pageErrors.length > 0 ? 1 : 0);
}

run().catch(err => { console.error('Error fatal:', err); process.exit(1); });
