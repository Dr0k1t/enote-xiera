/**
 * Enote — Offline integration tests (Playwright)
 * Verifica B.1, B.2, B.4, B.5 sin depender de login Supabase.
 * Uso: node audit-offline.js [URL]
 */

const { chromium } = require('playwright');

const BASE_URL = process.env.ENOTE_URL || process.argv[2] || 'http://localhost:5500';
const report = { checks: [], consoleErrors: [] };

function check(label, passed, detail = '') {
  report.checks.push({ label, passed, detail });
  const icon = passed ? '✓' : '✗';
  const msg = detail ? ` — ${detail}` : '';
  console.log(`  ${icon} ${label}${msg}`);
}

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  ENOTE OFFLINE AUDIT');
  console.log(`  URL: ${BASE_URL}`);
  console.log('══════════════════════════════════════════\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('/api/log') && !msg.text().includes('favicon')) {
      report.consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', err => report.consoleErrors.push('pageerror: ' + err.message));

  try {
    console.log('[ 1. Carga inicial sin errores ]');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForSelector('#app', { timeout: 5000 });
    check('Página carga sin pageerror', report.consoleErrors.length === 0,
      report.consoleErrors.length ? report.consoleErrors.join('; ') : '');

    console.log('\n[ 2. Exports offline.js ]');
    const exportsCheck = await page.evaluate(async () => {
      const mod = await import('/js/offline.js');
      return {
        isOnline: typeof mod.isOnline,
        createNoteOffline: typeof mod.createNoteOffline,
        getOfflineNotes: typeof mod.getOfflineNotes,
        syncNotesToCache: typeof mod.syncNotesToCache,
        syncPendingNotes: typeof mod.syncPendingNotes,
        getPendingNotes: typeof mod.getPendingNotes,
        getPendingCount: typeof mod.getPendingCount,
        deletePendingNote: typeof mod.deletePendingNote,
      };
    });
    check('isOnline export', exportsCheck.isOnline === 'function');
    check('createNoteOffline export', exportsCheck.createNoteOffline === 'function');
    check('getOfflineNotes export', exportsCheck.getOfflineNotes === 'function');
    check('syncNotesToCache export', exportsCheck.syncNotesToCache === 'function');
    check('syncPendingNotes export', exportsCheck.syncPendingNotes === 'function');
    check('getPendingCount export (B.4 nuevo)', exportsCheck.getPendingCount === 'function');

    console.log('\n[ 3. Clear IndexedDB ]');
    await page.evaluate(async () => {
      await new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase('enote-local');
        req.onsuccess = resolve;
        req.onerror = reject;
        req.onblocked = resolve;
      });
    });
    check('IndexedDB enote-local borrada', true);

    console.log('\n[ 4. createNoteOffline → getPendingCount ]');
    const pendingResult = await page.evaluate(async () => {
      const { createNoteOffline, getPendingCount, getPendingNotes } = await import('/js/offline.js');
      await createNoteOffline({ fecha: '2026-05-16', destino: 'Sucursal 1', productos: [{ nombre: 'test', cantidad: 1 }] });
      await createNoteOffline({ fecha: '2026-05-16', destino: 'Sucursal 2', productos: [{ nombre: 'test2', cantidad: 2 }] });
      const count = await getPendingCount();
      const pending = await getPendingNotes();
      return { count, firstDestino: pending[0]?.destino, hasLocalId: typeof pending[0]?.localId === 'number' };
    });
    check('getPendingCount === 2 tras 2 inserciones', pendingResult.count === 2, `count=${pendingResult.count}`);
    check('Item tiene localId autoIncrement', pendingResult.hasLocalId);
    check('Destino persistido correctamente', pendingResult.firstDestino === 'Sucursal 1');

    console.log('\n[ 5. syncNotesToCache + getOfflineNotes (B.2) ]');
    const cacheResult = await page.evaluate(async () => {
      const { syncNotesToCache, getOfflineNotes } = await import('/js/offline.js');
      const mockNotes = [
        { id: 1, numero: '#0001', destino: 'Planta de Producción', estatus: 'Nueva' },
        { id: 2, numero: '#0002', destino: 'Sucursal 1', estatus: 'En Proceso' },
      ];
      await syncNotesToCache(mockNotes);
      const cached = await getOfflineNotes();
      return { count: cached.length, ids: cached.map(n => n.id).sort() };
    });
    check('Cache contiene 2 notas tras sync', cacheResult.count === 2, `count=${cacheResult.count}`);
    check('IDs preservados', JSON.stringify(cacheResult.ids) === '[1,2]');

    console.log('\n[ 6. syncNotesToCache reemplaza (no acumula) ]');
    const replaceResult = await page.evaluate(async () => {
      const { syncNotesToCache, getOfflineNotes } = await import('/js/offline.js');
      await syncNotesToCache([{ id: 99, numero: '#0099', destino: 'Sucursal 1', estatus: 'Nueva' }]);
      const cached = await getOfflineNotes();
      return { count: cached.length, firstId: cached[0]?.id };
    });
    check('Cache reemplazado (1 nota)', replaceResult.count === 1 && replaceResult.firstId === 99);

    console.log('\n[ 7. syncPendingNotes — synced flag + dedup (B.4) ]');
    const syncResult = await page.evaluate(async () => {
      const { syncPendingNotes, getPendingCount } = await import('/js/offline.js');
      const calls = [];
      const fakeCreate = async (item) => {
        calls.push(item);
        return { id: 100 + calls.length };
      };
      await syncPendingNotes(fakeCreate);
      const remaining = await getPendingCount();
      return { calls: calls.length, remaining };
    });
    check('syncPendingNotes llamó createNote 2 veces', syncResult.calls === 2, `calls=${syncResult.calls}`);
    check('Cola vacía tras sync exitoso', syncResult.remaining === 0, `remaining=${syncResult.remaining}`);

    console.log('\n[ 8. syncPendingNotes — reintento al fallar 3x ]');
    const failResult = await page.evaluate(async () => {
      const { createNoteOffline, syncPendingNotes, getPendingCount } = await import('/js/offline.js');
      await createNoteOffline({ fecha: '2026-05-16', destino: 'Sucursal 1', productos: [{ nombre: 'fail', cantidad: 1 }] });
      let attempts = 0;
      const failingCreate = async () => { attempts++; throw new Error('simulated fail'); };
      await syncPendingNotes(failingCreate);
      const remaining = await getPendingCount();
      return { attempts, remaining };
    });
    check('Reintentó 3 veces', failResult.attempts === 3, `attempts=${failResult.attempts}`);
    check('Item permanece en cola tras fallo', failResult.remaining === 1, `remaining=${failResult.remaining}`);

    console.log('\n[ 9. renderHeader acepta pendingCount (B.5) ]');
    const headerResult = await page.evaluate(async () => {
      const { renderHeader } = await import('/js/ui/shared.js');
      const html0 = renderHeader({ username: 'test', role: 'admin' }, 0);
      const html3 = renderHeader({ username: 'test', role: 'admin' }, 3);
      return {
        noBadge: !html0.includes('offline-badge'),
        hasBadge: html3.includes('offline-badge') && html3.includes('⟳ 3'),
      };
    });
    check('Sin badge cuando pendingCount=0', headerResult.noBadge);
    check('Con badge "⟳ 3" cuando pendingCount=3', headerResult.hasBadge);

    console.log('\n[ 10. CSS .offline-badge cargado ]');
    const cssResult = await page.evaluate(() => {
      const span = document.createElement('span');
      span.className = 'offline-badge';
      span.textContent = '⟳ 1';
      document.body.appendChild(span);
      const styles = getComputedStyle(span);
      const result = {
        borderRadius: styles.borderRadius,
        background: styles.backgroundColor,
        color: styles.color,
      };
      span.remove();
      return result;
    });
    check('border-radius aplicado (pill)', cssResult.borderRadius && cssResult.borderRadius !== '0px',
      `border-radius=${cssResult.borderRadius}`);
    check('background no transparente', cssResult.background && cssResult.background !== 'rgba(0, 0, 0, 0)',
      `bg=${cssResult.background}`);

    console.log('\n[ 11. store.js getNotes offline fallback (B.2) ]');
    const storeResult = await page.evaluate(async () => {
      const { syncNotesToCache } = await import('/js/offline.js');
      await syncNotesToCache([
        { id: 7, numero: '#0007', destino: 'Sucursal 1', estatus: 'Nueva', productos: [], imagenes: [] },
      ]);
      const onLineSpy = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
      try {
        const { getNotes } = await import('/js/store.js');
        const notes = await getNotes();
        return { offlineCount: notes.length, id: notes[0]?.id };
      } finally {
        if (onLineSpy) Object.defineProperty(Navigator.prototype, 'onLine', onLineSpy);
      }
    });
    check('getNotes offline retorna caché (1 nota)', storeResult.offlineCount === 1,
      `count=${storeResult.offlineCount}`);
    check('ID correcto del caché', storeResult.id === 7);

  } catch (err) {
    console.error('\n  ERROR fatal:', err.message);
    report.checks.push({ label: 'Error inesperado', passed: false, detail: err.message });
  } finally {
    await browser.close();
  }

  const passed = report.checks.filter(c => c.passed).length;
  const failed = report.checks.filter(c => !c.passed).length;
  console.log('\n══════════════════════════════════════════');
  console.log(`  Checks: ${passed} ✓  ${failed} ✗`);
  if (report.consoleErrors.length > 0) {
    console.log(`\n  Errores consola/page (${report.consoleErrors.length}):`);
    report.consoleErrors.forEach(e => console.log(`    - ${e}`));
  }
  console.log(`\n  RESULTADO: ${failed === 0 && report.consoleErrors.length === 0 ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log('══════════════════════════════════════════\n');

  process.exit(failed > 0 || report.consoleErrors.length > 0 ? 1 : 0);
}

run().catch(err => { console.error('Error fatal:', err); process.exit(1); });
