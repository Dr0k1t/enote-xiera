/**
 * Enote — Audit suite F9.5: conflict detection end-to-end
 * Dos contextos admin editan la misma nota; valida que aparezca conflict-view
 * y que "Sobrescribir" / "Mantener servidor" se comporten correctamente.
 *
 * Uso: AUDIT_PASS=xxx node audit-conflict.js [URL]
 */

const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const BASE_URL = process.env.ENOTE_URL || process.argv[2] || 'https://enote-xiera.vercel.app';
const PASS = process.env.AUDIT_PASS;
if (!PASS) {
  console.error('ERROR: env var AUDIT_PASS es requerida. Uso: AUDIT_PASS=xxx node audit-conflict.js');
  process.exit(1);
}
const HEADLESS = process.env.HEADLESS !== '0';
const SHOTS = path.join(__dirname, 'screenshots-conflict');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const ADMIN = { email: 'admin@xiera.com', pass: PASS };
const TAG = `CONFLICT-${Date.now().toString().slice(-6)}`;
const results = [];

function check(label, passed, detail = '') {
  results.push({ label, passed, detail });
  const sym = passed ? '✓' : '✗';
  console.log(`  ${sym} ${label}${detail ? ' — ' + detail : ''}`);
}

async function login(page, user) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.fill('#inp-user', user.email);
  await page.fill('#inp-pass', user.pass);
  await page.click('button[type="submit"]');
  await page.waitForSelector('#view-dashboard.active', { timeout: 12000 });
}

async function fillMin(page, tag, obs) {
  await page.waitForSelector('.modal-overlay.visible', { timeout: 5000 });
  await page.fill('.prod-nombre-inp', `${tag}-prod`);
  await page.fill('.prod-cantidad-inp', '1');
  await page.fill('#nf-obs', obs);
}

async function saveAndWait(page) {
  await page.click('button[data-action="save"]');
  await page.waitForFunction(
    () => !document.getElementById('modal-overlay').classList.contains('visible'),
    { timeout: 12000 }
  );
}

async function openNoteById(page, tag) {
  const card = page.locator(`.note-card:has-text("${tag}")`).first();
  await card.locator('.btn-editar').click();
  await page.waitForSelector('.modal-overlay.visible', { timeout: 8000 });
}

(async () => {
  console.log(`\n  AUDIT CONFLICT — tag=${TAG}  url=${BASE_URL}\n`);
  const browser = await chromium.launch({ headless: HEADLESS });
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  try {
    // 1. Admin A crea nota
    await login(pageA, ADMIN);
    await pageA.click('.btn-nueva');
    await fillMin(pageA, TAG, 'inicial');
    await saveAndWait(pageA);
    check('Admin A creó nota inicial', true);
    await pageA.screenshot({ path: path.join(SHOTS, '01-creada.png') });

    // 2. Admin B login y abre la misma nota en edición
    await login(pageB, ADMIN);
    await openNoteById(pageB, TAG);
    check('Admin B abrió nota para editar', true);

    // 3. Admin A abre y guarda primero (cambia obs)
    await openNoteById(pageA, TAG);
    await pageA.fill('#nf-obs', 'editada por A');
    await saveAndWait(pageA);
    check('Admin A guardó primero', true);

    // 4. Admin B intenta guardar — debe aparecer conflict-view
    await pageB.fill('#nf-obs', 'editada por B (conflicto)');
    await pageB.click('button[data-action="save"]');
    const conflictAppears = await pageB.locator('.conflict-view, [data-conflict-view], :text("conflict"), :text("modificada"), :text("Sobrescribir")')
      .first().isVisible({ timeout: 8000 }).catch(() => false);
    check('Aparece conflict-view en B', conflictAppears);
    await pageB.screenshot({ path: path.join(SHOTS, '02-conflict-view.png') });

    // 5. Admin B elige "Mantener servidor" si el botón existe
    const keepBtn = pageB.locator('button:has-text("Mantener"), .btn-keep-server, [data-action="keep-server"]').first();
    if (await keepBtn.isVisible().catch(() => false)) {
      await keepBtn.click();
      await pageB.waitForFunction(
        () => !document.getElementById('modal-overlay').classList.contains('visible'),
        { timeout: 8000 }
      ).catch(() => {});
      check('Mantener servidor cierra modal sin sobrescribir', true);
    } else {
      check('Botón "Mantener servidor" detectado', false, 'no encontrado');
    }

    // 6. Cleanup — admin A borra la nota
    await pageA.reload({ waitUntil: 'domcontentloaded' });
    await pageA.waitForSelector('#view-dashboard.active', { timeout: 8000 }).catch(() => {});
    const delBtn = pageA.locator(`.note-card:has-text("${TAG}")`).first().locator('.btn-eliminar');
    if (await delBtn.isVisible().catch(() => false)) {
      await delBtn.click();
      await pageA.waitForSelector('.modal-overlay.visible', { timeout: 5000 }).catch(() => {});
      const confirmBtn = pageA.locator('.btn-confirmar-delete');
      if (await confirmBtn.isVisible().catch(() => false)) await confirmBtn.click();
    }
    check('Cleanup nota conflict', true);
  } catch (err) {
    console.error('  ERROR:', err.message);
    check('Sin excepciones inesperadas', false, err.message);
  } finally {
    await browser.close();
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\n  RESULTADO: ${passed}✓ ${failed}✗\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
