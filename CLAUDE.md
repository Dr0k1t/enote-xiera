# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Demo SPA para Xiera (panadería, Ocotlán, Jalisco). Genera notas de remisión digitales con flujo multi-usuario y workflow de estatus. Estado actual: v1.0 demo funcional con localStorage. Próximo: v1.2 con Supabase + PWA offline-first.

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

`audit/audit.js` corre Playwright headless chromium. Verifica: login válido/inválido, dashboard de admin (cards, botones crear/editar/eliminar), apertura/cierre de modal (Escape), vista detalle, filtros (estatus/destino/búsqueda), cambio de estatus, logout, rol `planta` (sin botón crear, con flechas de prioridad y selector de estatus). Guarda screenshots en `audit/screenshots/`. Exit code 1 si algún check falla o hay errores de consola.

## Arquitectura

SPA de un solo HTML (`index.html` → `js/app.js` como ES module). Sin frameworks ni bundlers.

### Módulos JS (`js/`)

| Archivo | Rol |
|---------|-----|
| `app.js` | Orquestador. Estado global (`currentSession`, `editingNoteId`, `pendingFormData`), delegación de eventos, coordinación de vistas. |
| `config.js` | Fuente de verdad de constantes: usuarios demo, roles, estatus válidos, textos UI, nombre del cliente. |
| `store.js` | CRUD sobre `localStorage` (prefijo `enote_`). Toda persistencia pasa por aquí. |
| `auth.js` | Sesión y permisos RBAC. Valida contra `CONFIG.users`. Helpers: `canCreate()`, `canEdit()`, `canDelete()`, `canSeeAll()`. |
| `ui.js` | Generadores de templates HTML como strings. Rendering, toasts, diff view, formulario de productos dinámico. |

### Flujo de datos

```
Evento DOM → delegación en app.js → handler → store.js (localStorage)
                                             ↓
                                       ui.js render → DOM update
```

`app.js` también escucha el evento `storage` del navegador para refrescar el grid si otra pestaña modifica notas.

### Funciones públicas clave por módulo

**`store.js`:** `getNotes()`, `getNote(id)`, `createNote(fields, user)`, `updateNote(id, fields, user)`, `deleteNote(id)`, `moveNoteUp(id)`, `moveNoteDown(id)`, `seedDemoNotes()`.  
`updateNote` activa `unreadModified=true` automáticamente cuando un admin edita una nota en estado `'En Proceso'`.

**`auth.js`:** `login(username, password)`, `getSession()`, `setSession(user)`, `clearSession()`, `requireAuth()`, `canCreate/Edit/Delete/SeeAll(session)`.

**`ui.js`:** `showView(id)`, `openModal(html)`, `closeModal()`, `renderToast(msg, type)`, `renderDashboardView()`, `refreshGrid()`, `renderNoteForm()`, `renderDetailView()`, `renderDiffView()`, `renderDeleteConfirm()`, `getFormData()`, `esc(str)`.

**`app.js` handlers:** `handleLogin()`, `showDashboard()`, `showDetail(noteId)`, `showForm(noteId)`, `handleFormSubmit(action)`, `getBaseNotes()`, `getFilteredNotes()`, `computeDiff(oldNote, newFields)`, `validateForm(fields)`.

### CSS (`css/`)

- `variables.css` — design tokens (colores, espaciado, tipografía). Paleta cálida (borgoña `#7A3045`, crema `#F5EDEB`, fondo `#C4A09A`). Fuentes: Cormorant Garamond (headings) + DM Sans (body) vía Google Fonts. Editar aquí para cambios visuales globales.
- `main.css` — componentes y layout.
- `print.css` — layout de impresión / PDF.

## Patrones Clave

- **Escaping:** Toda entrada de usuario pasa por `esc()` en `ui.js` antes de insertarse en el DOM.
- **Templates:** HTML construido como string concatenation (no JSX). Las funciones de `ui.js` retornan strings.
- **Sección headers:** `// ─── Título ─────` para organizar bloques en archivos largos.
- **Fechas:** ISO strings en store; formato localizado con `es-MX` en `ui.js`. Fechas de nota como `YYYY-MM-DD`; timestamps como ISO completo.
- **Estatus workflow:** `Nueva` → sobrescritura silenciosa. `En Proceso` o `Completada` (`CONFIG.confirmEditStatuses`) → requiere confirmación + diff visible. Lógica en `app.js`.
- **Rol `planta`:** Auto-transiciona nota de `Nueva` → `En Proceso` al visualizarla (`showDetail`). Limpia flags `unreadNew`/`unreadModified`.
- **`pendingFormData`:** Tercer estado en `app.js` para el flujo de confirmación diff. Almacena `{ noteId, fields, action }` entre el modal de diff y su confirmación.
- **Filtros:** Se aplican siempre sobre `getBaseNotes()` (ya filtrado por rol/destino). El filtro de búsqueda cubre número, observaciones, destino y nombres de productos.
- **Debounce:** Búsqueda de texto usa `debounce(fn, 280ms)` definido en `app.js`.

## Estructura de una Nota

```js
{
  id, numero,          // auto-increment; numero = '#0001'
  fecha,               // 'YYYY-MM-DD'
  destino,             // 'Sucursal' | 'Planta de Producción'
  productos,           // [{ nombre, cantidad, unidad }]
  estatus,             // 'Nueva' | 'En Proceso' | 'Completada' | 'Cancelada'
  observaciones,
  unreadNew,           // bool — planta no ha visto la nota nueva
  unreadModified,      // bool — admin editó en estado 'En Proceso'; planta no vio el cambio
  prioridad,           // int — orden en dashboard (menor = primero)
  creadoPor, creadoEn,
  modificadoPor, modificadoEn,
}
```

`unreadNew` y `unreadModified` no están en el schema del ROADMAP-V1.2; deberán añadirse al SQL al migrar.

## Bug conocido en `auth.js`

`clearSession()` (línea 17) llama `sessionStorage.removeItem(SESSION_KEY)` pero `setSession()` escribe en `localStorage`. El logout no borra la sesión. Fix: cambiar a `localStorage.removeItem(SESSION_KEY)`.

## Usuarios demo (`config.js`)

| username | password | role | destino |
|----------|----------|------|---------|
| admin1 | pass | admin | null (ve todo) |
| planta1 | pass | planta | 'Planta de Producción' |

## Migración v1.2 (Producción)

Al migrar a Supabase:
- `store.js` → CRUD Supabase + cola offline (IndexedDB/RxDB via `js/offline.js` nuevo).
- `auth.js` → Supabase Auth.
- Agregar `sw.js` (Service Worker cache-first para assets estáticos).
- Nuevos roles: `sucursal` (crear notas, cola offline), `repartidor` (gestión de rutas).
- Deploy: Vercel + dominio personalizado.
- Añadir `unreadNew`/`unreadModified` al schema SQL de notas.
- Ver `docs/ROADMAP-PRODUCCION-V1.2.md` para schema SQL completo, políticas RLS y lógica de sync offline.
