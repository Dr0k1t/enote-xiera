# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Enote — Sistema de notas de remisión para Xiera (panadería, Ocotlán, Jalisco). Genera notas digitales con flujo multi-usuario y workflow de estatus.

**Estado actual:** v1.2 en producción. Supabase configurado y live. Modo demo local disponible en paralelo.

Docs:
- `docs/ROADMAP-PRODUCCION-V1.2.md` — spec completa (schema SQL, RLS, roles, deploy)
- `docs/SPRINT-PRODUCCION-V1.2.md` — desglose por semanas con horas estimadas

## Comandos

```bash
# Desarrollo local (demo + Supabase real)
npx serve .

# Tests E2E (Playwright)
cd audit
npm install
npm run audit

# Login
# Demo local: admin1/pass, planta1/pass, sucursal1/pass
# Supabase real: admin@xiera.com / contraseña
```

`audit/audit.js` corre Playwright headless chromium. Verifica: login, dashboard admin, modales, filtros, cambio estatus, logout, rol planta, rol repartidor.

## Arquitectura

SPA vanilla JS (`index.html` → `js/app.js` como ES module). Sin frameworks ni bundlers.

### Módulos JS (`js/`)

| Archivo | Rol |
|---------|-----|
| `app.js` | Orquestador. Estado global (`currentSession`, `editingNoteId`, `pendingFormData`, `pendingImages`), delegación de eventos, coordinación de vistas. |
| `config.js` | Constantes: usuarios demo, roles, estatus válidos, destinos, textos UI. |
| `store.js` | CRUD async. `isDemoMode()` → localStorage (demo) o Supabase (producción). |
| `auth.js` | Login/logout async. Demo (`CONFIG.users`) + Supabase Auth. `canCreate()`, `canEdit()`, `canDelete()`, `canSeeAll()`. |
| `supabase.js` | Cliente Supabase. `createClient()` con URL y anon key. `isSupabaseConfigured()`. |
| `offline.js` | IndexedDB: `syncNotesToCache()`, `createNoteOffline()`, `syncPendingNotes()` con retry 3x. `isOnline()`. |
| `logger.js` | Logger de eventos. POST silencioso a `/api/log`. |
| `imageUtils.js` | `compressImage()` → WebP 40% via Canvas API. `MAX_IMAGES_PER_NOTE = 3`. |
| `ui/shared.js` | `esc()`, `showView()`, `openModal()`, `closeModal()`, `renderToast()`, `renderHeader()`, `formatFecha()`, `formatTs()`, `statusClass()`, `role()`. |
| `ui/login.js` | Vista de login. Detecta demo vs Supabase, cambia label a "Email"/"Usuario". |
| `ui/dashboard.js` | Grid de notas con filtros (estatus, destino, búsqueda). `renderDashboardView()`, `refreshGrid()`. |
| `ui/form.js` | Formulario crear/editar nota. `renderNoteForm()`, `renderProductRow()`, `getFormData()`. |
| `ui/detail.js` | Vista detalle + diff view + confirmación de eliminación. |
| `ui/repartidor.js` | Vista repartidor: selector de sucursal + toggle `tomada`. |

### Flujo de datos

```
Evento DOM → app.js (delegación) → store.js (localStorage | Supabase)
                                         ↓
                                  ui/* render → DOM
                                         ↓
                                  logger.js → POST /api/log
```

`app.js` escucha `storage` event y `online`/`offline` para sync entre pestañas y cola offline.

## Patrones Clave

- **Escaping:** Toda entrada pasa por `esc()` en `ui/shared.js`.
- **Templates:** HTML como strings (no JSX).
- **Fechas:** ISO en store; `es-MX` en UI.
- **Estatus workflow:** `Nueva` → sobrescritura. `En Proceso`/`Completada` → confirmación + diff visible.
- **Rol `planta`:** Auto-transiciona `Nueva→En Proceso` al abrir detalle. Limpia flags `unreadNew`/`unreadModified`.
- **Rol `repartidor`:** Vista propia (`view-repartidor`). Toggle `tomada` via `store.toggleTomada()`.
- **`pendingFormData`:** Tercer estado en `app.js` para flujo diff. Almacena `{ noteId, fields, action }`.
- **Filtros:** Aplicados sobre `getBaseNotes()` (ya filtrado por rol/destino). Búsqueda cubre número, observaciones, destino, productos.
- **Debounce:** Búsqueda 280ms.
- **`store.js` async:** Todas las funciones son async para compatibilidad con Supabase.
- **`isDemoMode()`:** `!isSupabaseConfigured()` → localStorage. Forzable con `localStorage.setItem('enote_demo_mode', 'true')`.

## Estructura de una Nota

```js
{
  id, numero,           // '#0001'
  fecha,               // 'YYYY-MM-DD'
  destino,             // 'Atequiza'|'Poncitlan'|'Tototlan'|'Ocotlan'
  productos,           // [{ nombre, cantidad, unidad }]
  estatus,             // 'Nueva'|'En Proceso'|'Completada'|'Cancelada'
  observaciones,
  imagenes,            // [{ id, url }] — dataURL WebP base64, máx 3
  tomada,              // bool
  tomadaPor, tomadaEn,
  unreadNew, unreadModified,
  prioridad,
  creadoPor, creadoEn,
  modificadoPor, modificadoEn,
}
```

## Migración v1.2 (Completada)

- ✅ `sw.js` — Service Worker cache-first
- ✅ `manifest.json` — PWA instalable
- ✅ `js/supabase.js` — cliente Supabase configurado
- ✅ `js/auth.js` — login/ logout async con Supabase Auth
- ✅ `js/store.js` — CRUD async con Supabase
- ✅ `js/offline.js` — IndexedDB cache + cola
- ✅ Indicador online/offline en UI
- ⏳ Vercel deploy
- ⏳ Dominio propio

## Backend (Supabase)

- **Proyecto:** `https://ovlhabedefwbajrnfpup.supabase.co`
- **Auth:** Email + contraseña. Confirm email OFF.
- **RLS:** Activo en `profiles`, `notes`, `routes`
- **Rutas:** Atequiza, Poncitlan, Tototlan, Ocotlan

### Agregar usuario

1. Supabase → Authentication → Users → Add user
2. Copiar UUID
3. SQL: `INSERT INTO profiles (id, username, role, destino) VALUES ('<uuid>', 'name', 'role', 'destino|null')`
