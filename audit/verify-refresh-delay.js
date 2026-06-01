// Verificación: botón refresh + delay optimista en repartidor.
// Uso: node audit/verify-refresh-delay.js [URL]
const { chromium } = require('playwright');

const URL = process.argv[2] || 'http://localhost:3000';
const PASS = process.env.AUDIT_PASS || 'passss';

async function login(page, email) {
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.fill('#login-form [name="username"]', email);
  await page.fill('#login-form [name="password"]', PASS);
  await page.click('#login-form button[type="submit"], #login-form .btn-primary');
  await page.waitForTimeout(1500);
}

async function logout(page) {
  const btn = page.locator('.btn-logout').first();
  if (await btn.count()) { await btn.click(); await page.waitForTimeout(800); }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const results = [];

  try {
    // ── 1. REPARTIDOR: botón refresh + delay optimista ──
    await login(page, 'repartidor@xiera.com');
    const inRepartidor = await page.locator('#repartidor-sucursal').count();
    results.push(['repartidor view cargada', inRepartidor > 0]);
    results.push(['btn-refresh presente (repartidor)', (await page.locator('.btn-refresh').count()) > 0]);

    // Seleccionar sucursales hasta encontrar una con notas
    const options = await page.locator('#repartidor-sucursal option').allTextContents();
    let cardFound = false;
    for (let i = 1; i < options.length && !cardFound; i++) {
      const val = await page.locator('#repartidor-sucursal option').nth(i).getAttribute('value');
      await page.selectOption('#repartidor-sucursal', val);
      await page.waitForTimeout(1200);
      if ((await page.locator('.repartidor-card').count()) > 0) cardFound = true;
    }
    results.push(['sucursal con notas encontrada', cardFound]);

    if (cardFound) {
      const card = page.locator('.repartidor-card').first();
      const noteId = await card.getAttribute('data-note-id');
      const wasTomada = (await card.getAttribute('class')).includes('--tomada');

      // Medir delay click → cambio visual (clase --tomada togglea)
      const t0 = await page.evaluate(() => performance.now());
      await card.click();
      // Esperar a que la tarjeta (mismo id) cambie su estado tomada respecto al original
      await page.waitForFunction(
        ([id, prev]) => {
          const el = document.querySelector(`.repartidor-card[data-note-id="${id}"]`);
          if (!el) return false;
          return el.classList.contains('repartidor-card--tomada') !== prev;
        },
        [noteId, wasTomada],
        { timeout: 5000 }
      );
      const t1 = await page.evaluate(() => performance.now());
      const delayMs = Math.round(t1 - t0);
      results.push([`delay visual toggle = ${delayMs}ms (objetivo <150ms)`, delayMs < 150]);

      // Revertir para dejar estado limpio (espera red de la 1ra + 2da escritura)
      await page.waitForTimeout(1500);
      await page.locator(`.repartidor-card[data-note-id="${noteId}"]`).click();
      await page.waitForTimeout(1500);
    }

    await logout(page);

    // ── 2. ADMIN: botón refresh re-renderiza dashboard ──
    await login(page, 'admin@xiera.com');
    const inDash = await page.locator('#view-dashboard.active, .dashboard-main').count();
    results.push(['dashboard cargado (admin)', inDash > 0]);
    results.push(['btn-refresh presente (admin)', (await page.locator('.btn-refresh').count()) > 0]);

    // Click refresh → toast "Buscando actualizaciones…" y luego dashboard sigue
    await page.locator('.btn-refresh').first().click();
    const toast = await page.waitForSelector('.toast, [class*="toast"]', { timeout: 3000 }).catch(() => null);
    results.push(['toast tras refresh', !!toast]);
    await page.waitForTimeout(2500);
    results.push(['dashboard sigue presente tras refresh', (await page.locator('.dashboard-main').count()) > 0]);
    // botón dejó de girar
    const spinning = await page.locator('.btn-refresh.is-spinning').count();
    results.push(['btn-refresh dejó de girar', spinning === 0]);

    await logout(page);
  } catch (err) {
    results.push([`ERROR: ${err.message}`, false]);
  } finally {
    await browser.close();
  }

  console.log('\n── RESULTADOS ──');
  let pass = 0;
  for (const [label, ok] of results) {
    console.log(`${ok ? '✓' : '✗'} ${label}`);
    if (ok) pass++;
  }
  console.log(`\n${pass}/${results.length} OK`);
  process.exit(pass === results.length ? 0 : 1);
})();
