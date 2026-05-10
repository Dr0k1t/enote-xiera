# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Demo SPA para Xiera (panadería, Ocotlán, Jalisco). Genera notas de remisión digitales con flujo multi-usuario y workflow de estatus. Estado actual: v1.0 demo funcional con localStorage. Próximo: v1.2 con Supabase + PWA offline-first.

Ver `docs/ROADMAP-PRODUCCION-V1.2.md` para spec de producción completa (schema SQL, RLS, Service Worker, roles nuevos).

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

El audit guarda screenshots en `audit/screenshots/` y termina con exit code 1 si algún check falla o hay errores de consola.

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

### CSS (`css/`)

- `variables.css` — design tokens (colores, espaciado, tipografía). Editar aquí para cambios visuales globales.
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
