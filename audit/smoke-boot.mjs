// Smoke test de boot: carga la app, captura errores de consola/página y verifica
// que el login renderiza (init() corrió sin lanzar). No requiere login.
import { chromium } from 'playwright';

const URL = process.argv[2] || 'http://localhost:3000';
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const loginVisible = await page.locator('#view-login.active, #view-login').first().isVisible().catch(() => false);
const hasLoginForm = await page.locator('#login-form, #inp-user').first().count();

// Filtrar ruido conocido irrelevante (favicon, SW en localhost, etc.)
const relevant = errors.filter(e =>
  !/favicon/i.test(e) &&
  !/manifest/i.test(e) &&
  !/ServiceWorker|sw\.js|404/i.test(e)
);

console.log('loginVisible:', loginVisible, '| loginForm count:', hasLoginForm);
console.log('blob errors:', errors.filter(e => /blob:/i.test(e)).length);
console.log('--- all console/page errors ---');
errors.forEach(e => console.log('  ' + e));

await browser.close();
const ok = (loginVisible || hasLoginForm > 0) && relevant.length === 0;
console.log(ok ? 'SMOKE OK' : 'SMOKE FAIL');
process.exit(ok ? 0 : 1);
