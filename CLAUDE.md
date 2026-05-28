# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Enote — notas de remision para Xiera (panaderia, Ocotlan, Jalisco). Notas digitales, multi-usuario, workflow estatus.

**Estado actual:** v1.3.3 en produccion. Supabase-only (demo eliminado). Deploy Vercel: https://enote-xiera.vercel.app

Docs:
- `docs/PLAN-REMEDIACION-V1.3.md` — plan de correccion de hallazgos de auditoria completa (COMPLETADO)
- `docs/INFORME-AUDITORIA-V1.3.md` — hallazgos completos de auditoria (8 categorias, ~120 issues)
- `docs/ROADMAP-PRODUCCION-V1.2.md` — [ARCHIVADO] spec v1.2 (schema SQL, RLS, roles, deploy)
- `docs/SPRINT-PRODUCCION-V1.2.md` — [ARCHIVADO] desglose por semanas v1.2
- `docs/AUDIT-V1.1.md` — [ARCHIVADO] cierre hardening v1.1

## Comandos

```bash
# Generar js/supabase.js a partir de .env (obligatorio antes de servir local)
node scripts/build-config.js

# Desarrollo local
npx serve .

# Deploy a produccion Vercel
npx vercel --prod

# Tests E2E (Playwright) — instalar dependencias solo la primera vez
cd audit && npm install

# Suite offline (IndexedDB, cola pending, badge, fallback store) — no requiere login
node audit-offline.js [URL]          # default: http://localhost:3000

# Suite produccion (3 roles, CRUD online, offline B.1/B.2/B.5, reconexion, PWA, a11y)
node audit-prod.js [URL]             # default: https://enote-xiera.vercel.app
# Env vars opcionales para audit-prod.js:
#   ENOTE_URL=https://...   AUDIT_PASS=passss   HEADLESS=0

# Suite v2 (pasteleria, financiero, receipt impresion, conflict)
node audit-v2.js [URL]               # default: https://enote-xiera.vercel.app

# NOTA: audit.js esta obsoleto — usaba credenciales demo ya eliminadas.

# Verificar PWA y config de produccion
node scripts/pw-verify.js [URL]      # default: https://enote-xiera.vercel.app

# Generar iconos PWA desde SVG
node scripts/generate-icons.js
```

**Env vars Vercel (produccion):** `SUPABASE_URL` y `SUPABASE_ANON_KEY` — seteadas en `dr0k1ts-projects/enote-xiera`. Local: `.env` (gitignoreado). Ver `.env.example`.

## Arquitectura

SPA vanilla JS (`index.html` → `js/app.js` como ES module). Sin frameworks ni bundlers. Supabase JS vendorizado localmente (`js/vendor/supabase-js.esm.js`). Fuentes self-hosted en `assets/fonts/`. Sin dependencias CDN.

### Modulos JS (`js/`)

| Archivo | Rol |
|---------|-----|
| `app.js` | Orquestador. Estado global (`currentSession`, `editingNoteId`, `editingNoteModifiedEn`, `pendingFormData`, `pendingImages`, `currentDetailNoteId`, `currentPage`), delegacion eventos, paginacion, conflict-view dispatch. `safeHandler` wrapper para handlers. `window.onerror` + `unhandledrejection` global. `init()` limpia `_sw_reloading` flag al boot exitoso. |
| `config.js` | Roles, estatus, destinos, `PAGE_SIZE = 20`, textos UI, `BUSINESS_INFO` exportado. Sin usuarios demo. |
| `store.js` | CRUD async sobre Supabase. `validateNoteFields()`, conflict detection via `_localModifiedEn`, override via `_force`, numero correlativo `MAX(numero)+1`. `handleApiError()` mapea codes Supabase (401, PGRST301, 42501, 23505). RBAC defense-in-depth: `updateNote`/`deleteNote` validan permisos antes de servidor. |
| `auth.js` | Supabase Auth unicamente. `login()`, `logout()`, `requireAuth()`, helpers permisos. `canModifyNote()` para RBAC. `logout()` llama `clearAllOfflineData()` (IndexedDB). |
| `supabase.js` | **Generado** por `scripts/build-config.js`. `isSupabaseConfigured()` retorna `!!supabase`. Ver `scripts/pw-verify.js` para verificacion post-deploy. |
| `supabase.js.template` | Plantilla con `__SUPABASE_URL__`, `__SUPABASE_ANON_KEY__`, y `__ENOTE_VERSION__`. |
| `offline.js` | IndexedDB v3 — `IMAGE_CACHE` keyPath `url` con evitacion FIFO (limite 500 via `cachedAt`). `PENDING_QUEUE` scoped por `_userId`. `cacheImages` con `AbortController` + 10s timeout. `syncPendingNotes` con guardia `_syncing` anti-concurrencia. `openDB()` con handlers `onblocked`/`onversionchange`/`onclose`. Transacciones atomicas (tx.oncomplete). `createNoteOffline`, `getOfflineNotes`, `getOfflineNote`, `getPendingCount`, `isOnline`, `clearAllOfflineData`. |
| `logger.js` | Logger eventos. POST silencioso a `/api/log`. `log.error()` para handlers globales. |
| `imageUtils.js` | `compressImage()` → WebP 40% via Canvas. `MAX_IMAGES_PER_NOTE = 3`. Trackea blob URLs creadas via `_blobUrls`. |
| `types.js` | `@typedef` JSDoc (`Note`, `Session`, `Role`, `Product`, `ImageRef`). |
| `ui/shared.js` | `esc()`, `showView()`, `openModal()`, `closeModal()` (revoca blob URLs antes de vaciar DOM), `renderToast()`, `renderHeader()`, `resolveImageUrl()` (IndexedDB → blob URL con tracking en `_blobUrls`), `revokeBlobUrls()`, `formatFecha()` (usa UTC para evitar shift por timezone). |
| `ui/login.js` | Vista login Supabase (email + contrasena). |
| `ui/dashboard.js` | Grid + filtros + barra paginacion. |
| `ui/form.js` | Formulario crear/editar nota. `getFormData()` con optional chaining en fecha/destino/observaciones. `pastelCantidad`/`pisos` usan `!= null` (no falsy). |
| `ui/detail.js` | Detalle + diff view + delete confirm + **conflict view**. |
| `ui/repartidor.js` | Vista repartidor. |
| `ui/print.js` | `renderPrintableReceipt()` — recibo imprimible estilo papel. Referencia `BUSINESS_INFO` de config (sin PII hardcodeada). |

### Vendor

| Archivo | Rol |
|---------|-----|
| `js/vendor/supabase-js.esm.js` | Supabase JS client v2 vendorizado. 44 KB. Self-hosted para evitar NS_ERROR_CORRUPTED_CONTENT en Firefox con carga CDN. |

### Scripts y config

| Archivo | Rol |
|---------|-----|
| `scripts/build-config.js` | Lee `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `ENOTE_VERSION` de `process.env` o `.env`, inyecta en `js/supabase.js` desde template. Tambien inyecta `ENOTE_VERSION` en `sw.js`. Sin deps externas (solo `fs`, `path`). |
| `scripts/pw-verify.js` | Verifica post-deploy: config generada, PWA manifest, SW registrado, CSP headers, static assets. |
| `scripts/generate-icons.js` | Genera iconos PWA (192, 512, maskable) en `icons/` desde `icons/icon.svg`. |
| `scripts/generate-splash.js` | Genera 7 splash screens PNG `#7A3045` en `icons/splash/` para iOS `apple-touch-startup-image`. Sin deps externas. |
| `vercel.json` | `buildCommand: node scripts/build-config.js`, `outputDirectory: .`, rewrites SPA. Headers de seguridad (CSP, HSTS, X-Frame-Options, X-Content-Type, Referrer-Policy, Permissions-Policy). CSP sin CDNs externos (fuentes y scripts self-hosted). `Cache-Control: no-cache, must-revalidate` en `/js/supabase.js`. `Cache-Control: immutable` en assets estaticos versionados. |

### Assets estaticos

| Path | Rol |
|------|-----|
| `assets/fonts/` | Fuentes self-hosted (Inter + Material Symbols). `fonts.css` con `@font-face` declarations. Sin dependencia de Google Fonts CDN. |
| `icons/` | Iconos PWA (192, 512, maskable, SVG). Generados por `scripts/generate-icons.js`. |
| `icons/splash/` | 7 splash screens PNG para iOS (1125–2048px). Generados por `scripts/generate-splash.js`. Pre-cacheados por SW. |
| `manifest.json` | PWA manifest — `start_url: /`, `display: standalone`, theme colors. |
| `offline.html` | Pagina fallback offline (cacheada por SW). |
| `robots.txt` | `User-agent: * Disallow: /` |
| `sw.js` | Service Worker con cache versionado (`enote-` + version). `install` usa `fetch({cache:'reload'})` para evitar stale cache HTTP. `skipWaiting()` + `clientsClaim()`. Stale-while-revalidate para navegacion. |
| `css/main.css` | Estilos principales. |
| `css/print.css` | Estilos impresion (receipt). `media="print"`. |

### Flujo de datos

```
Evento DOM → app.js (safeHandler) → store.js (Supabase + handleApiError)
                                          ↓
                                   ui/* render → DOM
                                          ↓
                                   logger.js → POST /api/log
```

`app.js` escucha `online`/`offline` para indicador y `syncPendingNotes(async item => createNote(item.fields, item.session))` al reconectar (wrapper extrae `_session` del item guardado offline).

## Patrones Clave

- **Global error handling:** `window.onerror` + `unhandledrejection` con toast + `log.error`. `safeHandler(fn)` wrapper en handlers de dashboard/detail/repartidor/modal. `init()` reporta errores no-auth y muestra fallback dashboard.
- **RBAC defense-in-depth:** `canModifyNote()` en auth.js. `updateNote`/`deleteNote` en store.js validan permisos antes del servidor. Guards `canCreate`/`canEdit`/`canDelete` en handlers UI.
- **Escaping:** Toda entrada pasa por `esc()` en `ui/shared.js` (incluye `'` → `&#39;`).
- **Templates:** HTML como strings.
- **Fechas:** ISO en store; `es-MX` en UI. `formatFecha()` usa UTC para evitar shift de dia por timezone.
- **Estatus workflow:** `Nueva` → sobrescritura. `En Proceso`/`Completada` → confirmacion + diff visible.
- **Detail view:** No usa `showView()`. Usa `detail-overlay-active` + `display: block` para superponer sobre dashboard. `currentDetailNoteId` mantiene ID abierto para `showImagePreview`.
- **Rol `planta`:** Auto-transiciona `Nueva→En Proceso` al abrir detalle. Usa `_force: true` para evitar conflict spurious.
- **Rol `repartidor`:** Vista `view-repartidor`. Toggle `tomada` via `store.toggleTomada()`.
- **`pendingFormData`:** Tercer estado en `app.js` para flujo diff/conflict. Estructura `{ noteId, fields, action }`.
- **Filtros:** `getBaseNotes()` (filtro por rol/destino) → `getFilteredNotes()` (filtros UI) → `slice` por pagina.
- **Paginacion:** Client-side. `CONFIG.PAGE_SIZE = 20`. Reset pagina 1 cuando cambian filtros.
- **Conflict detection:** `app.js` pasa `editingNoteModifiedEn` como `_localModifiedEn` a `updateNote`. Si servidor mas nuevo → `{ conflict, serverNote }` → `renderConflictView`. Botones: **Sobrescribir** (re-llama con `_force: true`) o **Mantener servidor** (descarta cambios).
- **Validacion backend:** `validateNoteFields()` valida `fecha`, `destino` (whitelist), `productos` no vacio, `observaciones` ≤ 2000.
- **Numero de nota:** `MAX(numero) + 1` formato `#0001`. Race condition teorica aceptable.
- **Debounce busqueda:** 280 ms.
- **`store.js` async:** Todo es async.
- **HandleApiError:** `store.js` mapea codigos Supabase — 401/PGRST301/42501 → dispara `enote:auth-expired`, 23505 → unique violation. `app.js` escucha `enote:auth-expired` y ejecuta logout.
- **Blob URL tracking:** `compressImage` trackea URLs en array `_blobUrls`. `revokeBlobUrls()` en `closeModal()` limpia todas antes de vaciar DOM. `showImagePreview` tambien trackea.
- **Offline-first:** `getNotes()` y `getNote()` retornan cache IndexedDB si `!isOnline()`. `getBaseNotes()` hace `syncNotesToCache` fire-and-forget online. `handleFormSubmit` guarda en cola offline si no hay conexion. `syncPendingNotes` procesa cola al reconectar con wrapper que extrae `_session` del item.
- **Badge offline:** `renderHeader(session, pendingCount)` muestra `⟳ N` si hay notas pendientes. `updateOfflineBadge()` se llama desde `init()`, listener `online`, creacion offline, y `showDashboard()`.
- **IndexedDB hardening:** `PENDING_QUEUE` scoped por `_userId` (getPendingNotes/getPendingCount filtran). `openDB()` con `onblocked`/`onversionchange`/`onclose` para multi-tab. Transacciones atomicas resuelven en `tx.oncomplete`. `IMAGE_CACHE` evitacion FIFO via `cachedAt` (limite 500). `_syncing` guardia anti-concurrencia en `syncPendingNotes`. `_failCount` tracking en cola pending.
- **Self-hosted:** Supabase JS client y fuentes vendorizados localmente. CSP no permite CDNs externos.
- **SW controllerchange:** `index.html` inline: recarga al activarse nuevo SW. Flag `_sw_reloading` en sessionStorage previene loop. `app.js init()` limpia el flag en boot exitoso.
- **`/js/supabase.js` no-cache:** Ver `vercel.json` — `Cache-Control: no-cache, must-revalidate` para evitar config stale en cliente.
- **Logout limpia IndexedDB:** `auth.js logout()` llama `clearAllOfflineData()` para eliminar PII residual.

## Estructura de una Nota

```js
{
  id, numero,           // id = SERIAL de Supabase; numero = '#0001'
  fecha,               // 'YYYY-MM-DD'
  destino,             // uno de CONFIG.locations
  productos,           // [{ nombre, cantidad }]
  estatus,             // 'Nueva'|'En Proceso'|'Completada'|'Cancelada'
  observaciones,
  imagenes,            // [string|{id,url,blob?}] — URLs de Supabase Storage, max 3
  tomada, tomadaPor, tomadaEn,
  unreadNew, unreadModified,
  prioridad,
  creadoPor, creadoEn,
  modificadoPor, modificadoEn,
  // cliente, pastel, entrega, financiero (ver js/types.js)
}
```

## Backend (Supabase)

- **Proyecto:** `https://ovlhabedefwbajrnfpup.supabase.co`
- **Auth:** Email + contrasena. Confirm email OFF.
- **RLS:** Activo en `profiles`, `notes`, `routes`

### Agregar usuario

1. Supabase → Authentication → Users → Add user
2. Copiar UUID
3. SQL: `INSERT INTO profiles (id, username, role, destino) VALUES ('<uuid>', 'name', 'role', 'destino|null')`
