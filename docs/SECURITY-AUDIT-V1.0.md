# Reporte de Auditoría de Seguridad — enote-xiera v1.0

**Fecha:** 2026-05-11
**Auditor:** Claude Sonnet 4.6 (asistido por Elius Santiago García López)
**Alcance:** Todo el proyecto (`index.html`, `js/`, `css/`, `audit/`)
**Output:** Solo reporte — sin aplicar fixes

---

## Resumen Ejecutivo

| ID | Severidad | Archivo | Descripción |
|----|-----------|---------|-------------|
| SEC-001 | **CRÍTICO** | `auth.js:17` | Logout roto — `clearSession` usa `sessionStorage` en vez de `localStorage` |
| SEC-002 | **ALTO** | `config.js:14-17` | Credenciales hardcoded en plaintext en el bundle |
| SEC-003 | **ALTO** | `auth.js` + `app.js` | RBAC bypass total vía `localStorage`/consola del navegador |
| SEC-004 | **MEDIO** | `ui.js:176,379` | Attribute injection vía `statusClass()` sin escape HTML |
| SEC-005 | **MEDIO** | `ui.js:5-9` | `esc()` no escapa comilla simple (`'`) |
| SEC-006 | **MEDIO** | `store.js:26-83` | Sin validación de campos — `localStorage` quota exhaustion posible |
| SEC-007 | **BAJO** | `auth.js:11` | Sesión sin TTL/expiración |
| SEC-008 | **BAJO** | `auth.js:20` | Sin rate limiting en login |
| SEC-009 | **BAJO** | `app.js` múltiples | `parseInt()` sin check `NaN` |
| SEC-010 | **INFO** | `app.js:13` | `currentSession` no sincroniza con `localStorage` externamente |
| SEC-011 | **INFO** | `store.js` | Datos de notas en `localStorage` plaintext |

---

## Hallazgos Detallados

---

### SEC-001 — CRÍTICO: Logout roto

**Archivo:** `js/auth.js:17`

**Descripción:**
`clearSession()` llama `sessionStorage.removeItem(SESSION_KEY)`, pero `setSession()` escribe en `localStorage`. El logout no borra la sesión real.

**Código actual:**
```js
// setSession escribe en localStorage (línea 12):
localStorage.setItem(SESSION_KEY, JSON.stringify(session));

// clearSession borra de sessionStorage — storage distinto:
export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);  // BUG
}
```

**Impacto:** Abrir una pestaña nueva después de hacer "Salir" restaura la sesión automáticamente. `requireAuth()` en `init()` lee `localStorage`, encuentra la sesión "borrada" y loguea al usuario sin credenciales.

**Fix:**
```js
export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
```

---

### SEC-002 — ALTO: Credenciales hardcoded en source visible

**Archivo:** `js/config.js:14-17`

**Código:**
```js
users: [
  { username: 'admin1',  password: 'pass', role: 'admin',  destino: null },
  { username: 'planta1', password: 'pass', role: 'planta', destino: 'Planta de Producción' },
],
```

**Impacto:** Cualquier usuario con DevTools → Sources ve credenciales en texto plano. En producción, las credenciales deben venir de Supabase Auth — nunca del bundle JS del cliente.

---

### SEC-003 — ALTO: RBAC bypass total vía DevTools/localStorage

**Archivos:** `js/auth.js:31-34`, `js/app.js` completo

**Descripción:** Todos los permisos son client-side. Un atacante puede escalar privilegios completos:

```js
// En la consola del navegador — escalar a admin:
localStorage.setItem('enote_session', JSON.stringify({
  username: 'hacker', role: 'admin', destino: null, loginAt: new Date().toISOString()
}));
location.reload();
```

O llamar operaciones directamente sin autenticación desde la consola.

**Impacto:** El rol `planta` puede escalar a `admin`. Sin backend, no hay autorización real.
**Mitigación para v1.2:** Todas las operaciones CRUD deben validarse en Supabase con RLS policies.

---

### SEC-004 — MEDIO: Attribute injection vía `statusClass()` sin escape

**Archivo:** `js/ui.js:176, 379`

**Código:**
```js
// statusClass() solo hace .toLowerCase().replace(/\s+/g, '-') — sin escape HTML:
const badge = `<span class="badge badge--${statusClass(note.estatus)}">${esc(note.estatus)}</span>`;
```

**Vector de ataque:** Modificar `note.estatus` directamente en `localStorage` con valor malicioso:
```
" onclick="alert(document.cookie)
```
Resultado renderizado:
```html
<span class="badge badge--" onclick="alert(document.cookie)">"Nueva"</span>
```

**Fix:**
```js
const badge = `<span class="badge badge--${esc(statusClass(note.estatus))}">${esc(note.estatus)}</span>`;
```
Aplicar igual en `js/ui.js:379`.

---

### SEC-005 — MEDIO: `esc()` no escapa comilla simple

**Archivo:** `js/ui.js:5-9`

**Código actual:**
```js
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    // Falta: .replace(/'/g, '&#39;')
}
```

Actualmente no explotable (todos los atributos HTML en templates usan comillas dobles), pero incompleto según OWASP. Si en el futuro se usa un atributo con `'`, habrá XSS.

**Fix:**
```js
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

---

### SEC-006 — MEDIO: Sin validación de campos en store.js

**Archivo:** `js/store.js:26-83`

`createNote()` y `updateNote()` aceptan cualquier valor sin validar:
- `fields.destino` — no validado contra `CONFIG.locations`
- `fields.fecha` — cualquier string aceptado
- `fields.observaciones` — sin límite de longitud → `localStorage` quota exhaustion

Un atacante puede llenar `localStorage` con observaciones de varios MB hasta romper la app.

---

### SEC-007 — BAJO: Sesión sin TTL/expiración

**Archivo:** `js/auth.js:11`

`loginAt` se guarda pero nunca se valida. Una sesión de semanas atrás es indefinidamente válida.

---

### SEC-008 — BAJO: Sin rate limiting en login

**Archivo:** `js/auth.js:20-24`

`login()` no tiene lockout, delay ni límite de intentos. Brute force trivial (aunque las credenciales ya son visibles en source, ver SEC-002).

---

### SEC-009 — BAJO: `parseInt()` sin validación de NaN

**Archivo:** `js/app.js` — múltiples líneas (80, 196, 197, 198, 213, 366)

```js
parseInt(card.dataset.noteId)  // Si dataset.noteId es undefined → NaN
```

`getNote(NaN)` retorna `null`. Falla silenciosa, no explotable actualmente pero frágil ante manipulación de DOM.

---

### SEC-010 — INFO: `currentSession` no sincroniza con localStorage externamente

**Archivo:** `js/app.js:13`

`currentSession` es variable de módulo. Si `localStorage` es limpiado desde otra pestaña o extensión, la sesión en memoria persiste hasta reload. Solo el evento `storage` para notas está escuchado (línea 48-55), no para la clave de sesión.

---

### SEC-011 — INFO: Datos de notas en localStorage plaintext

En contexto de terminal compartida (panadería con una sola computadora), todos los datos de notas son legibles por cualquier persona con acceso al navegador. Sin cifrado, sin partición por usuario.

---

## Prioridad de Fixes para v1.2

### Fixes inmediatos (antes de cualquier usuario real)

1. **SEC-001** — 1 línea. `sessionStorage` → `localStorage` en `clearSession()`.
2. **SEC-004** — 2 líneas. Envolver `statusClass()` en `esc()` en `ui.js:176,379`.
3. **SEC-005** — 1 línea. Agregar `.replace(/'/g, '&#39;')` a `esc()`.

### Resueltos estructuralmente en v1.2

- **SEC-002, SEC-003** → Supabase Auth elimina credenciales del cliente. RLS policies reemplazan el RBAC client-side.
- **SEC-006** → Validación en backend (Supabase) antes de escribir a BD.
- **SEC-007** → Supabase Auth maneja TTL de sesiones (JWT con exp).
- **SEC-008** → Supabase Auth tiene rate limiting nativo.
- **SEC-011** → Datos migran a Supabase PostgreSQL; `localStorage` solo para cola offline cifrada.

---

*Generado con Claude Code — sprint/v1.2-produccion*
