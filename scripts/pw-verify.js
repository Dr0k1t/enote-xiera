const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  const failedReqs = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
  page.on('requestfailed', req => {
    failedReqs.push(req.url() + ' — ' + req.failure()?.errorText);
  });

  const url = process.argv[2] || 'http://localhost:3030';
  console.log('Testing:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(4000);

  const loadingEl = await page.$('#loading');
  const loadingVisible = loadingEl ? await loadingEl.isVisible() : false;
  const loginEl = await page.$('#view-login');
  const emailInput = await page.$('input[type="email"]');
  const splashLinks = await page.$$eval('link[rel="apple-touch-startup-image"]', els => els.length);
  const statusBar = await page.$eval('meta[name="apple-mobile-web-app-status-bar-style"]', el => el.content).catch(() => null);
  const viewport = await page.$eval('meta[name="viewport"]', el => el.content).catch(() => null);
  const bodyText = (await page.textContent('body')).replace(/\s+/g, ' ').trim().slice(0, 300);

  await browser.close();

  console.log('---');
  console.log('loading#visible:', loadingVisible, '(want: false)');
  console.log('view-login exists:', !!loginEl, '(want: true)');
  console.log('email input:', !!emailInput, '(want: true)');
  console.log('splash links:', splashLinks, '(want: 7)');
  console.log('status-bar style:', statusBar, '(want: black-translucent)');
  console.log('viewport-fit:', viewport && viewport.includes('viewport-fit=cover') ? 'yes' : 'no', '(want: yes)');
  console.log('body snippet:', bodyText);
  console.log('---');
  console.log('console errors:', errors.length);
  errors.forEach(e => console.log('  ERR:', e));
  console.log('failed requests:', failedReqs.length);
  failedReqs.forEach(r => console.log('  FAIL:', r));

  const iosOk = splashLinks === 7 && statusBar === 'black-translucent' && !!(viewport && viewport.includes('viewport-fit=cover'));
  if (loadingVisible || !loginEl || !iosOk) {
    console.log('\nRESULT: FAIL — app did not boot');
    process.exit(1);
  } else {
    console.log('\nRESULT: PASS — app boots to login, iOS tags ok');
  }
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
