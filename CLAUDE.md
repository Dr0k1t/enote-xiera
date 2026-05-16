# CLAUDE.md

Guidance para Claude Code (claude.ai/code) en este repo.

## Proyecto

Enote — notas de remisión para Xiera (panadería, Ocotlán, Jalisco). Notas digitales, multi-usuario, workflow estatus.

**Estado actual:** v1.2 en producción. Supabase-only (demo eliminado). Deploy Vercel: https://enote-xiera.vercel.app

Docs:
- `docs/ROADMAP-PRODUCCION-V1.2.md` — spec completa (schema SQL, RLS, roles, deploy)
- `docs/SPRINT-PRODUCCION-V1.2.md` — desglose por semanas
- `docs/AUDIT-V1.1.md` — cierre hardening v1.1

## Comandos

```bash
# Generar js/supabase.js a partir de .env (obligatorio antes de servir local)
node scripts/build-config.js

# Desarrollo local
npx serve .

# Deploy a producción Vercel
npx vercel --prod

# Tests E2E (Playwright)
cd audit
npm install
npm run audit
```

`audit/audit.js` corre Playwright headless chromium. Verifica login, dashboard admin, modales, filtros, cambio estatus, logout, rol planta, rol repartidor.

**Env vars Vercel (producción):** `SUPABASE_URL` y `SUPABASE_ANON_KEY` — seteadas en `dr0k1ts-projects/enote-xiera`. Local: `.env` (gitignoreado). Ver `.env.example`.

## Arquitectura

SPA vanilla JS (`index.html` → `js/app.js` como ES module). Sin frameworks ni bundlers.

### Módulos JS (`js/`)

| Archivo | Rol |
|---------|-----|
| `app.js` | Orquestador. Estado global (`currentSession`, `editingNoteId`, `editingNoteModifiedEn`, `pendingFormData`, `pendingImages`, `currentDetailNoteId`, `currentPage`), delegación eventos, paginación, conflict-view dispatch. |
| `config.js` | Roles, estatus, destinos, `PAGE_SIZE = 20`, textos UI. Sin usuarios demo. |
| `store.js` | CRUD async sobre Supabase. `validateNoteFields()`, conflict detection vía `_localModifiedEn`, override vía `_force`, número correlativo `MAX(numero)+1`. |
| `auth.js` | Supabase Auth únicamente. `login()`, `logout()`, `requireAuth()`, helpers permisos. |
| `supabase.js` | **Generado** por `scripts/build-config.js`. `isSupabaseConfigured()` retorna `!!supabase`. |
| `supabase.js.template` | Plantilla con `__SUPABASE_URL__` y `__SUPABASE_ANON_KEY__`. |
| `offline.js` | IndexedDB v3 — `IMAGE_CACHE` keyPath `url`, `cacheImages` paralelo en batches 5. `createNoteOffline` y `syncPendingNotes` (infraestructura). |
| `logger.js` | Logger eventos. POST silencioso a `/api/log`. |
| `imageUtils.js` | `compressImage()` → WebP 40% via Canvas. `MAX_IMAGES_PER_NOTE = 3`. |
| `types.js` | `@typedef` JSDoc (`Note`, `Session`, `Role`, `Product`, `ImageRef`). |
| `ui/shared.js` | `esc()`, `showView()`, `openModal()`, `closeModal()` (vacía DOM antes revocar blob URLs), `renderToast()`, `renderHeader()`, `resolveImageUrl()` (IndexedDB → blob URL con tracking en `_blobUrls`), `revokeBlobUrls()`. |
| `ui/login.js` | Vista login Supabase (email + contraseña). |
| `ui/dashboard.js` | Grid + filtros + barra paginación. |
| `ui/form.js` | Formulario crear/editar nota. |
| `ui/detail.js` | Detalle + diff view + delete confirm + **conflict view**. |
| `ui/repartidor.js` | Vista repartidor. |

### Scripts y config

| Archivo | Rol |
|---------|-----|
| `scripts/build-config.js` | Lee `SUPABASE_URL` / `SUPABASE_ANON_KEY` de `process.env` o `.env`, inyecta en `js/supabase.js` desde template. Sin deps externas (solo `fs`, `path`). |
| `vercel.json` | `buildCommand: node scripts/build-config.js`, `outputDirectory: .`, rewrites SPA. |

### Flujo de datos

```
Evento DOM → app.js (delegación) → store.js (Supabase)
                                         ↓
                                  ui/* render → DOM
                                         ↓
                                  logger.js → POST /api/log
```

`app.js` escucha `online`/`offline` para indicador y `syncPendingNotes(createNote)` al reconectar.

## Patrones Clave

- **Escaping:** Toda entrada pasa por `esc()` en `ui/shared.js` (incluye `'` → `&#39;`).
- **Templates:** HTML como strings.
- **Fechas:** ISO en store; `es-MX` en UI.
- **Estatus workflow:** `Nueva` → sobrescritura. `En Proceso`/`Completada` → confirmación + diff visible.
- **Detail view:** No usa `showView()`. Usa `detail-overlay-active` + `display: block` para superponer sobre dashboard. `currentDetailNoteId` mantiene ID abierto para `showImagePreview`.
- **Rol `planta`:** Auto-transiciona `Nueva→En Proceso` al abrir detalle. Usa `_force: true` para evitar conflict spurious.
- **Rol `repartidor`:** Vista `view-repartidor`. Toggle `tomada` vía `store.toggleTomada()`.
- **`pendingFormData`:** Tercer estado en `app.js` para flujo diff/conflict. Estructura `{ noteId, fields, action }`.
- **Filtros:** `getBaseNotes()` (filtro por rol/destino) → `getFilteredNotes()` (filtros UI) → `slice` por página.
- **Paginación:** Client-side. `CONFIG.PAGE_SIZE = 20`. Reset página 1 cuando cambian filtros.
- **Conflict detection:** `app.js` pasa `editingNoteModifiedEn` como `_localModifiedEn` a `updateNote`. Si servidor más nuevo → `{ conflict, serverNote }` → `renderConflictView`. Botones: **Sobrescribir** (re-llama con `_force: true`) o **Mantener servidor** (descarta cambios).
- **Validación backend:** `validateNoteFields()` valida `fecha`, `destino` (whitelist), `productos` no vacío, `observaciones` ≤ 2000.
- **Número de nota:** `MAX(numero) + 1` formato `#0001`. Race condition teórica aceptable.
- **Debounce búsqueda:** 280 ms.
- **`store.js` async:** Todo es async.

## Estructura de una Nota

```js
{
  id, numero,           // id = SERIAL de Supabase; numero = '#0001'
  fecha,               // 'YYYY-MM-DD'
  destino,             // uno de CONFIG.locations
  productos,           // [{ nombre, cantidad }]
  estatus,             // 'Nueva'|'En Proceso'|'Completada'|'Cancelada'
  observaciones,
  imagenes,            // [string|{id,url,blob?}] — URLs de Supabase Storage, máx 3
  tomada, tomadaPor, tomadaEn,
  unreadNew, unreadModified,
  prioridad,
  creadoPor, creadoEn,
  modificadoPor, modificadoEn,
  // cliente, pastel, entrega, financiero (ver js/types.js)
}
```

## Migración v1.2 (Completada)

- ✅ `sw.js` cache-first con `CACHE_VERSION` dinámico (lee `self.ENOTE_VERSION` desde index.html)
- ✅ `manifest.json` PWA instalable
- ✅ `js/supabase.js` generado por build-config
- ✅ `auth.js`, `store.js` solo Supabase (demo eliminado)
- ✅ `offline.js` IndexedDB v3, `IMAGE_CACHE` keyPath, cacheImages paralelo
- ✅ Blob URL leak fix en `closeModal`
- ✅ JSDoc types
- ✅ Paginación client-side
- ✅ Conflict detection
- ✅ Validación backend
- ✅ Vercel deploy (https://enote-xiera.vercel.app)
- 🔲 Dominio propio

## Backend (Supabase)

- **Proyecto:** `https://ovlhabedefwbajrnfpup.supabase.co`
- **Auth:** Email + contraseña. Confirm email OFF.
- **RLS:** Activo en `profiles`, `notes`, `routes`

### Agregar usuario

1. Supabase → Authentication → Users → Add user
2. Copiar UUID
3. SQL: `INSERT INTO profiles (id, username, role, destino) VALUES ('<uuid>', 'name', 'role', 'destino|null')`