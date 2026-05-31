// Boot recovery — corre como script clásico (no module) ANTES de js/app.js.
// Extraído del <script> inline de index.html para permitir CSP sin 'unsafe-inline'.
// Cubre el caso en que app.js (module) falle al cargar (boot-fail recovery).
(function () {
  // SW controllerchange: recarga cuando un nuevo SW toma control.
  // Si app.js cargó bien (window.__enoteAppLoaded), delega en su handler
  // —que respeta borradores abiertos— y NO recarga aquí (evita perder draft).
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (window.__enoteAppLoaded) return; // app.js maneja la recarga
      if (sessionStorage.getItem('_sw_reloading')) return;
      sessionStorage.setItem('_sw_reloading', '1');
      window.location.reload();
    });
  }
  // Failsafe: si app.js no arranca en 8s, mostrar mensaje accionable.
  window.__bootFailsafe = setTimeout(function () {
    var el = document.getElementById('loading');
    if (!el) return;
    el.setAttribute('aria-busy', 'false');
    el.textContent = 'No se pudo cargar Enote. Revisa tu conexión y recarga.';
    el.style.cursor = 'pointer';
    el.addEventListener('click', function () { location.reload(); });
  }, 8000);
})();
