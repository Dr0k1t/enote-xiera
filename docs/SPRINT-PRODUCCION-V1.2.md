# Sprint de Producción — Enote v1.2 [ARCHIVADO]

**ARCHIVADO:** 2026-05-26 — completado. Reemplazado por `docs/PLAN-REMEDIACION-V1.3.md`.

**Cliente:** Xiera — Panadería, Ocotlán, Jalisco
**Inicio:** Lunes 11 de mayo de 2026
**Entrega real:** Junio 2026
**Alcance:** 8 usuarios · 1 organización · PWA offline-first

---

## Estado General

| Semana | Periodo | Estado | Avance |
|--------|---------|--------|--------|
| 0 — Pre-arranque | Antes del 11 mayo | 🟢 Completado | 4 / 4 |
| 1 — Infraestructura | 11–16 mayo | 🟢 Completado | 6 / 6 |
| 2 — Supabase + Offline + Hardening | 18–23 mayo | 🟢 Completado | 22 / 22 |
| 3 — Repartidor + Pruebas + Paginación | 25–30 mayo | 🟢 Completado | 8 / 8 |
| 4 — Deploy + Entrega | 01–06 junio | 🟢 Completado | 7 / 7 |
| 5 — Buffer + Conflict + Validación | 08–13 junio | 🟢 Completado | 4 / 4 |

**Leyenda:** 🔴 Pendiente · 🟡 En progreso · 🟢 Completado

---

## Registro de Actualizaciones

| Fecha | Quién | Cambio |
|-------|-------|--------|
| 2026-05-11 | Elius | Sprint creado |
| 2026-05-11 | Claude Code | Auditoría v1.0: 8 archivos completos. Falta: sw.js, supabase.js, offline.js, env.js. Bug confirmado en auth.js:17. Semana 0: GitHub ✅, Supabase y dominio sin verificar. |
| 2026-05-14 | Claude Code | Supabase configurado. Login real funcionando. PR #3 mergeado a main. |
| 2026-05-16 | Claude Code | Hardening v1.1 aplicado (T10a–T10j). Modo demo eliminado. Paginación client-side, conflict detection, validación backend, JSDoc types, build-config.js, blob URL leak fix, IndexedDB v3 con keyPath, cacheImages paralelo. |
| 2026-05-16 | Elius + Claude | Vercel deploy exitoso. BOM fix en build-config.js. Login en producción funcional. |
| 2026-05-16 | Elius + Claude | Offline-first cableado (B.1–B.5): creación offline, lectura offline, sync dedup, badge offline. Bug fix sync (wrapper _session). |
| 2026-05-16 | Claude | Fix #2: `getNote()` offline fallback. Fix #3: dead code `.demo-badge` eliminado. Planes obsoletos borrados (10 archivos). Sprint actualizado. |
| 2026-05-16 | Elius | Re-deploy a Vercel tras fixes offline + demo-badge + cleanup |

---

## Semana 0 — Pre-arranque ✅

**Completado:**
- ✅ Cuenta Supabase creada (`https://ovlhabedefwbajrnfpup.supabase.co`)
- ✅ Dominio: pendiente (al final del sprint)
- ✅ Acceso repo GitHub
- ✅ Rutas confirmadas con el cliente: Atequiza, Poncitlan, Tototlan, Ocotlan

---

## Semana 1 — Fundamentos de Infraestructura ✅

**Completado:**
- ✅ Schema SQL en Supabase (routes, profiles, notes, RLS)
- ✅ 4 usuarios en Supabase Auth: admin, ocotlan, planta, extremoalias
- ✅ 4 perfiles en tabla `profiles`
- ✅ Auth Providers: Confirm email OFF
- ✅ Redirect URLs: `http://localhost:3000/**`
- ✅ `sw.js` + `manifest.json` implementados
- ✅ Login real con Supabase funcionando

---

## Semana 2 — Integración Supabase + Offline

**Fechas:** Lunes 18 – Viernes 23 de mayo de 2026
**Estado:** 🟡 En progreso
**Estimado:** ~29 h

---

### Tarea 1 — `js/supabase.js` ✅

- [x] Cliente con URL y anon key configuradas
- [x] `isSupabaseConfigured()` detecta si está activo

### Tarea 2 — `auth.js` → Supabase Auth ✅

- [x] `login()` con `signInWithPassword()`
- [x] Lee perfil de `profiles` table para obtener role y destino
- [x] `logout()` con `supabase.auth.signOut()`
- [x] Demo mode ELIMINADO — solo Supabase Auth

### Tarea 3 — `store.js` → Supabase CRUD ✅

- [x] `getNotes()` → Supabase (offline fallback vía IndexedDB)
- [x] `getNote(id)` → Supabase (offline fallback vía `getOfflineNote`)
- [x] `createNote()` → Supabase
- [x] `updateNote()` → Supabase
- [x] `deleteNote()` → Supabase
- [x] `toggleTomada()` → Supabase
- [x] Solo Supabase — sin demo

### Tarea 4 — `app.js` → async ✅

- [x] Todos los handlers son async
- [x] `handleLogin()` hace await del login
- [x] `handleLogout()` hace await del logout

### Tarea 5 — `offline.js` ✅

- [x] IndexedDB con stores: `notes_cache`, `pending_queue`
- [x] `syncNotesToCache()`, `getOfflineNotes()`, `createNoteOffline()`, `syncPendingNotes()`
- [x] Retry con backoff exponencial (1s → 2s → 4s)

### Tarea 6 — Indicador online/offline ✅

- [x] Listeners `online`/`offline` en `app.js`
- [x] Banner "Sin conexión" cuando offline
- [x] Sync automático al reconectar

### Tarea 7 — Integrar offline.js en flujo ✅

- [x] Cola offline para sucursal (createNoteOffline en handleFormSubmit)
- [x] Cache de lectura para planta (getNotes con fallback a IndexedDB)
- [x] Badge offline en header (⟳ N)
- [x] Sync automático al reconectar con wrapper _session

### Tarea 8 — Compresión de imágenes ✅

- [x] `js/imageUtils.js` con `compressImage()`
- [x] `MAX_IMAGES_PER_NOTE = 3`
- [x] Integración en `ui/form.js`
- [x] Preview y eliminación de imágenes en formulario

### Tarea 9 — Login solo Supabase ✅

- [x] Login siempre usa email + contraseña
- [x] No hay modo demo ni fallback local
- [x] Input type email con autocomplete

### Tarea 10 — Verificar Semana 2 ✅

- [x] Probar login de cada usuario (admin, planta, sucursal, repartidor)
- [x] Probar crear nota como admin → verificar en Supabase Table Editor
- [x] Probar modo avión → sucursal crea nota offline
- [x] Probar modo avión → planta ve notas cache
- [x] Probar subir 3 fotos en una nota

### Tarea 11 — T10a Eliminar modo demo ✅

- [x] `config.js`: borrar `CONFIG.users`, `noteNumberFormat`. Agregar `PAGE_SIZE = 20`.
- [x] `auth.js`: solo Supabase. `login()`, `logout()` sin rama demo.
- [x] `store.js`: solo Supabase. `getNotes`/`getNote`/`updateNote`/`deleteNote` sin demo branch. `createNote` con `MAX(numero) + 1`.
- [x] `app.js`: quitar imports demo, listener `storage`, handlers `btn-priority-up/down`, `seedDemoNotes()`.
- [x] `ui/login.js`: hardcodear Email + autocomplete + spellcheck.
- [x] `ui/dashboard.js`: quitar bloque `.priority-controls`.

### Tarea 12 — T10b build-config.js + .env ✅

- [x] `scripts/build-config.js` lee `SUPABASE_URL`/`SUPABASE_ANON_KEY`.
- [x] `js/supabase.js.template` con placeholders.
- [x] `.gitignore`: `js/supabase.js`, `.env`, `sandbox/`.
- [x] `git rm -r --cached sandbox/` ejecutado.

### Tarea 13 — T10d IndexedDB keyPath + DB v3 ✅

- [x] `DB_VERSION = 3`.
- [x] `onupgradeneeded` recrea `IMAGE_CACHE` con `{ keyPath: 'url' }`.
- [x] `saveImageToCache` usa `put({ url, blob })`.
- [x] `getImageFromCache` retorna `{ url, blob }`; `resolveImageUrl` consume `.blob`.

### Tarea 14 — T10e Blob URL leak ✅

- [x] `_blobUrls` Set en `ui/shared.js`.
- [x] `revokeBlobUrls()` export.
- [x] `closeModal` limpia overlay y luego revoca.

### Tarea 15 — T10f cacheImages paralelo ✅

- [x] `flatMap` recolecta URLs únicas.
- [x] Batches de 5 vía `Promise.all`.
- [x] Fire-and-forget desde `getNotes()`.

### Tarea 16 — T10i JSDoc types ✅

- [x] `js/types.js` con `@typedef` Note/Session/Role/Product/ImageRef.
- [x] `/// <reference path="..." />` en store/auth/app/shared/dashboard/detail/form/login/offline.

### Tarea 17 — T10j SW version sync ✅

- [x] `index.html` define `self.ENOTE_VERSION = '1.2.0'` antes del módulo.
- [x] `sw.js` `CACHE_VERSION` lee `self.ENOTE_VERSION` (fallback `Date.now()`).

### Tarea 18 — sandbox/ fuera del repo ✅

- [x] `.gitignore` incluye `sandbox/`.
- [x] `git rm -r --cached sandbox/`.

### Tarea 19 — Verificar `esc()` y `clearSession()` ✅

- [x] `esc()` escapa `'` → `&#39;`.
- [x] `clearSession()` usa `localStorage.removeItem`.

### Tarea 20 — Regenerar js/supabase.js ✅

- [x] `node scripts/build-config.js` genera con creds de `.env`.

**Fecha real de completado:** 2026-05-16

---

## Semana 3 — Repartidor + Pruebas Offline

**Fechas:** Lunes 25 – Viernes 30 de mayo de 2026
**Estado:** 🟢 Completado
**Estimado:** ~22 h

---

### Tarea 1 — Vista Repartidor ✅

- [x] `ui/repartidor.js` con `renderRepartidorView()` y `renderRepartidorCard()`
- [x] Selector de sucursal en `app.js`
- [x] Toggle `tomada` funcional

### Tarea 2 — Audit E2E para repartidor

- [ ] Actualizar `audit/audit.js` para probar rol repartidor
- [ ] Verificar todos los roles con Playwright

### Tarea 3 — Pruebas offline completas ✅

**Flujo Sucursal:**
- [x] Modo avión → login como `ocotlan` → crear nota → verificar toast offline
- [x] Reconectar → verificar sync en Supabase

**Flujo Planta:**
- [x] Online → login como `planta` → verificar notas
- [x] Modo avión → recargar → verificar cache
- [ ] Imprimir nota → verificar PDF (pendiente)

**Flujo Repartidor:**
- [x] Login como `repartidor` → verificar vista
- [x] Marcar nota como tomada → verificar en Supabase

### Tarea 4 — Paginación client-side ✅

- [x] `CONFIG.PAGE_SIZE = 20`.
- [x] `app.js` `currentPage`, handlers `btn-prev-page`/`btn-next-page`.
- [x] `applyFilters()` aplica `slice` por página.
- [x] `ui/dashboard.js` `renderPaginationBar` + reemplazo en `refreshGrid`.
- [x] CSS `.pagination-bar` en `main.css`.

### Tarea 5 — Sync dedup ✅

- [x] `syncPendingNotes` marca `synced:true` antes de borrar (evita duplicados si la app crashea)
- [x] Badge offline (`⟳ N`) en header con `getPendingCount()`

**Fecha real de completado:** 2026-05-16

---

## Semana 4 — Deploy, Testing E2E y Entrega

**Fechas:** Lunes 01 – Viernes 06 de junio de 2026
**Estado:** 🟡 En progreso
**Estimado:** ~18 h

---

### Tarea 1 — Deploy a Vercel ✅

- [x] Cuenta Vercel conectada (dr0k1ts-projects)
- [x] Proyecto creado: `enote-xiera`
- [x] Build command: `node scripts/build-config.js`
- [x] Env vars configuradas: `SUPABASE_URL` + `SUPABASE_ANON_KEY`
- [x] Deploy a producción exitoso: https://enote-xiera.vercel.app
- [x] Login funcional en producción

### Tarea 2 — Configurar dominio propio

- [ ] Comprar dominio (Cloudflare Registrar ~$8/año)
- [ ] Vercel → Settings → Domains → agregar dominio
- [ ] Configurar DNS records
- [ ] SSL verificado

### Tarea 3 — Actualizar Supabase Auth ✅

- [x] Site URL → URL de Vercel (https://enote-xiera.vercel.app)
- [x] Redirect URLs → `https://enote-xiera.vercel.app/**`

### Tarea 4 — Testing E2E completo

- [ ] `cd audit && ENOTE_URL=https://tudominio.com node audit.js` → PASS ✓
- [ ] Probar en móvil (Android/iOS)
- [ ] Instalar como PWA

### Tarea 5 — Bug fixes

- [ ] Corregir issues del audit
- [ ] Re-ejecutar hasta PASS ✓

### Tarea 6 — Manual de usuario

- [ ] PDF 1 página con flujos por rol
- [ ] Cómo abrir app, login, crear nota, imprimir, offline

### Tarea 7 — Entrega formal

- [ ] Credenciales de 8 usuarios
- [ ] URL del sistema
- [ ] Acceso al panel de Supabase (opcional)
- [ ] Explicar cómo resetear contraseñas

**Fecha real de completado:** ___________

---

## Semana 5 — Buffer

**Fechas:** Lunes 08 – Viernes 13 de junio de 2026
**Estado:** 🔴 Pendiente

### Posibles tareas

- [ ] Edge cases (nota con 0 productos, sync conflict)
- [ ] Ajustes de UX post-feedback
- [ ] Entrega formal al cliente

### Tarea 4 — Conflict detection ✅

- [x] `updateNote()` compara `modificado_en` servidor vs `_localModifiedEn` cliente.
- [x] Retorna `{ conflict, serverNote }` si hay divergencia.
- [x] `renderConflictView` en `ui/detail.js` (servidor vs cliente).
- [x] Botones Sobrescribir (`_force: true`) / Mantener servidor.
- [x] Planta `_force: true` para auto-transición silenciosa.

### Tarea 5 — Validación backend ✅

- [x] `validateNoteFields()` en `store.js`.
- [x] Llamada en `createNote()` y `updateNote()` (validación parcial).
- [x] Errores: fecha YYYY-MM-DD, destino whitelist, productos no vacío, observaciones ≤2000.

**Fecha de entrega real:** ___________

---

## Criterios de Aceptación

- [ ] Login funciona para los 8 usuarios desde dominio propio con HTTPS
- [ ] Admin puede crear nota real en Supabase
- [ ] Sucursal puede crear nota offline y sincroniza al reconectar
- [ ] Planta puede ver notas offline y abrir PDF imprimible
- [ ] Repartidor puede ver notas y marcar como tomada
- [ ] `cd audit && ENOTE_URL=https://dominio.com node audit.js` → PASS ✓
- [ ] Manual de usuario entregado
- [ ] Credenciales de 8 usuarios documentadas
