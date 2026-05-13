# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Demo SPA para Xiera (panadería, Ocotlán, Jalisco). Genera notas de remisión digitales con flujo multi-usuario y workflow de estatus. Estado actual: v1.2 sprint en progreso (rol repartidor, 5 sucursales, logger). Próximo: Supabase + PWA offline-first.

Docs de producción:
- `docs/ROADMAP-PRODUCCION-V1.2.md` — spec completa (schema SQL, RLS, Service Worker, roles nuevos, deploy).
- `docs/SPRINT-PRODUCCION-V1.2.md` — desglose por semanas con horas estimadas.

## Comandos

Sin build step — vanilla JS estático.

```bash
# Desarrollo: servir con cualquier servidor estático
npx serve .
# o con Live Server de VS Code en puerto 5500

# Tests E2E (Playwright)
cd audit
npm install
npm run audit                          # URL default: http://localhost:5500
ENOTE_URL=http://localhost:8080 node audit.js   # URL override
```

`audit/audit.js` corre Playwright headless chromium. Verifica: login válido/inválido, dashboard de admin (cards, botones crear/editar/eliminar), apertura/cierre de modal (Escape), vista detalle, filtros (estatus/destino/búsqueda), cambio de estatus, logout, rol `planta` (sin botón crear, con flechas de prioridad y selector de estatus), rol `repartidor` (vista propia, toggle tomada). Guarda screenshots en `audit/screenshots/`. Exit code 1 si algún check falla o hay errores de consola. Errores de `/api/log` son ignorados intencionalmente.

## Arquitectura

SPA de un solo HTML (`index.html` → `js/app.js` como ES module). Sin frameworks ni bundlers.

### Módulos JS (`js/`)

| Archivo | Rol |
|---------|-----|
| `app.js` | Orquestador. Estado global (`currentSession`, `editingNoteId`, `pendingFormData`, `pendingImages`, `currentDetailNoteId`), delegación de eventos, coordinación de vistas. |
| `config.js` | Fuente de verdad de constantes: usuarios demo, roles, estatus válidos, textos UI, `locations` (5 sucursales + Planta). |
| `store.js` | CRUD async sobre `localStorage` (prefijo `enote_`). Todas las funciones son `async` con `delay()` artificial para facilitar migración futura a Supabase. |
| `auth.js` | Sesión y permisos RBAC. Valida contra `CONFIG.users`. Helpers: `canCreate()`, `canEdit()`, `canDelete()`, `canSeeAll()`. |
| `logger.js` | Logger de eventos de sesión. POST silencioso a `/api/log`. No-op si el servidor no está disponible. |
| `imageUtils.js` | `compressImage(file)` → Promise con dataURL WebP 40%. Usa `canvas.toDataURL()` (no blob URLs) para persistencia en localStorage. |
| `ui/shared.js` | Utilidades compartidas entre vistas: `esc()`, `showView()`, `openModal()`, `closeModal()`, `renderToast()`, `renderHeader()`, `formatFecha()`, `formatTs()`, `statusClass()`, `role()`. |
| `ui/login.js` | Vista de login. |
| `ui/dashboard.js` | Grid de notas (admin/planta/sucursal). |
| `ui/form.js` | Formulario de creación/edición de nota. |
| `ui/detail.js` | Vista detalle de nota + diff view + confirmación de eliminación. |
| `ui/repartidor.js` | Vista repartidor: `renderRepartidorView()`, `renderRepartidorCard()`. |

### Flujo de datos

```
Evento DOM → delegación en app.js → handler → store.js (localStorage)
                                             ↓
                                    ui/* render → DOM update
                                             ↓
                                    logger.js → POST /api/log (silencioso)
```

`app.js` también escucha el evento `storage` del navegador para refrescar el grid si otra pestaña modifica notas.

### Funciones públicas clave por módulo

**`store.js`** (todas async): `getNotes()`, `getNote(id)`, `createNote(fields, user)`, `updateNote(id, fields, user)`, `deleteNote(id)`, `moveNoteUp(id)`, `moveNoteDown(id)`, `toggleTomada(id, user)`, `seedDemoNotes()`.  
`updateNote` activa `unreadModified=true` automáticamente cuando un admin edita una nota en estado `'En Proceso'`. `updateNote` retorna `{ old, new }`.

**`auth.js`:** `login(username, password)`, `getSession()`, `setSession(user)`, `clearSession()`, `requireAuth()`, `canCreate/Edit/Delete/SeeAll(session)`.

**`logger.js`:** `log.sessionStart(s)`, `log.noteCreated(n)`, `log.noteUpdated(n)`, `log.noteTomada(n)`, `log.imageCompressed(file, result)`.

**`ui/shared.js`:** `esc(str)`, `showView(id)`, `openModal(html)`, `closeModal()`, `renderToast(msg, type)`, `renderHeader(session)`, `formatFecha(isoDate)`, `formatTs(iso)`, `statusClass(estatus)`, `role(session)`.

**`ui/repartidor.js`:** `renderRepartidorView(session)`, `renderRepartidorCard(note)`.

### CSS (`css/`)

- `variables.css` — design tokens (colores, espaciado, tipografía). Paleta cálida (borgoña `#7A3045`, crema `#F5EDEB`, fondo `#C4A09A`). Fuentes: Cormorant Garamond (headings) + DM Sans (body) vía Google Fonts. Editar aquí para cambios visuales globales.
- `main.css` — componentes y layout.
- `print.css` — layout de impresión / PDF.

## Patrones Clave

- **Escaping:** Toda entrada de usuario pasa por `esc()` en `ui/shared.js` antes de insertarse en el DOM.
- **Templates:** HTML construido como string concatenation (no JSX). Las funciones de `ui/*` retornan strings.
- **Sección headers:** `// ─── Título ─────` para organizar bloques en archivos largos.
- **Fechas:** ISO strings en store; formato localizado con `es-MX` en `ui/shared.js`. Fechas de nota como `YYYY-MM-DD`; timestamps como ISO completo.
- **Estatus workflow:** `Nueva` → sobrescritura silenciosa. `En Proceso` o `Completada` (`CONFIG.confirmEditStatuses`) → requiere confirmación + diff visible. Lógica en `app.js`.
- **Rol `planta`:** Auto-transiciona nota de `Nueva` → `En Proceso` al visualizarla (`showDetail`). Limpia flags `unreadNew`/`unreadModified`.
- **Rol `repartidor`:** Vista propia (`view-repartidor`). Filtra notas por sucursal seleccionada. Puede togglear `tomada` en notas via `store.toggleTomada()`. No ve notas de Planta de Producción.
- **`pendingFormData`:** Tercer estado en `app.js` para el flujo de confirmación diff. Almacena `{ noteId, fields, action }` entre el modal de diff y su confirmación.
- **Filtros:** Se aplican siempre sobre `getBaseNotes()` (ya filtrado por rol/destino). El filtro de búsqueda cubre número, observaciones, destino y nombres de productos.
- **Debounce:** Búsqueda de texto usa `debounce(fn, 280ms)` definido en `app.js`.
- **`store.js` async:** Las funciones incluyen `delay()` artificial (≥100ms) para simular latencia de red. Al migrar a Supabase, solo se reemplaza la implementación interna — la interfaz async ya es compatible.

## Estructura de una Nota

```js
{
  id, numero,          // auto-increment; numero = '#0001'
  fecha,               // 'YYYY-MM-DD'
  destino,             // 'Sucursal 1'...'Sucursal 5' | 'Planta de Producción'
  productos,           // [{ nombre, cantidad, unidad }]
  estatus,             // 'Nueva' | 'En Proceso' | 'Completada' | 'Cancelada'
  observaciones,
  imagenes,            // [{ id, url, width, height, nombre }] — dataURL WebP base64, máx 3
  tomada,              // bool — repartidor marcó la nota para entrega
  tomadaPor,           // string|null
  tomadaEn,            // ISO string|null
  unreadNew,           // bool — planta no ha visto la nota nueva
  unreadModified,      // bool — admin editó en estado 'En Proceso'; planta no vio el cambio
  prioridad,           // int — orden en dashboard (menor = primero)
  creadoPor, creadoEn,
  modificadoPor, modificadoEn,
}
```

`unreadNew`, `unreadModified`, `tomada`, `tomadaPor`, `tomadaEn` no están en el schema del ROADMAP-V1.2; deberán añadirse al SQL al migrar.

## Usuarios demo (`config.js`)

| username | password | role | destino |
|----------|----------|------|---------|
| admin1 | pass | admin | null (ve todo) |
| planta1 | pass | planta | 'Planta de Producción' |
| sucursal1–5 | pass | sucursal | 'Sucursal 1'–'Sucursal 5' |
| repartidor1 | pass | repartidor | null (ve todo, solo lectura + toggle tomada) |

## Migración v1.2 (Producción)

Al migrar a Supabase:
- `store.js` → reemplazar cuerpo de funciones con CRUD Supabase + cola offline (IndexedDB/RxDB via `js/offline.js` nuevo). La interfaz async ya es compatible.
- `auth.js` → Supabase Auth.
- Agregar `sw.js` (Service Worker cache-first para assets estáticos).
- Deploy: Vercel + dominio personalizado.
- Añadir al schema SQL: `unreadNew`, `unreadModified`, `tomada`, `tomadaPor`, `tomadaEn`.
- Ver `docs/ROADMAP-PRODUCCION-V1.2.md` para schema SQL completo, políticas RLS y lógica de sync offline.
