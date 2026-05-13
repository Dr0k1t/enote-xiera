import { CONFIG } from '../config.js';
import { esc } from './shared.js';

/**
 * Renderiza la vista de inicio de sesión.
 */
export function renderLoginView() {
  return `
  <main class="login-card">
    <div class="login-brand">
      <h1 class="login-brand-name">${esc(CONFIG.clientName)}</h1>
      <p class="login-brand-sub">${esc(CONFIG.clientSubtitle)}</p>
    </div>
    <form class="login-form" id="login-form" novalidate>
      <div class="form-group">
        <label class="form-label" for="inp-user">Usuario</label>
        <input class="form-input" id="inp-user" name="username"
          type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="inp-pass">Contraseña</label>
        <input class="form-input" id="inp-pass" name="password"
          type="password" autocomplete="current-password" required>
      </div>
      <div class="form-group" style="margin-top:var(--space-5)">
        <button type="submit" class="btn btn-primary btn-full">Entrar</button>
      </div>
      <div class="login-error" id="login-error" role="alert"></div>
    </form>
  </main>`;
}
