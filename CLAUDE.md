# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Demo SPA para Xiera (panadería, Ocotlán, Jalisco). Genera notas de remisión digitales con flujo multi-usuario y workflow de estatus. Estado actual: v1.0 demo funcional con localStorage. Próximo: v1.2 con Supabase + PWA offline-first.

Ver `docs/ROADMAP-PRODUCCION-V1.2.md` para spec de producción.

## Comandos

No hay build step — vanilla JS estático.

```bash
# Desarrollo: abrir index.html directamente en browser
# o servir con cualquier servidor estático, ej:
npx serve .

# Tests E2E (Playwright)
cd audit
npm install
npm run audit
```

## Arquitectura

SPA de un solo HTML (`index.html` → `js/app.js` como ES module). Sin frameworks ni bundlers.

### Módulos JS (`js/`)

| Archivo | Rol |
|---------|-----|
| `app.js` | Orquestador. Estado global (`currentSession`, `editingNoteId`), delegación de eventos, coordinación de vistas. |
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

- `variables.css` — design tokens (colores, espaciado, tipografía). **Editar aquí para cambios visuales globales.**
- `main.css` — componentes y layout.
- `print.css` — layout de impresión / PDF.

## Patrones Clave

- **Escaping:** Toda entrada de usuario pasa por `esc()` en `ui.js` antes de insertarse en el DOM.
- **Templates:** HTML construido como string concatenation (no JSX). Las funciones de `ui.js` retornan strings.
- **Sección headers:** `// ─── Título ─────` para organizar bloques en archivos largos.
- **Fechas:** ISO strings en store; formato localizado con `es-MX` en `ui.js`.
- **Estatus workflow:** `Nueva` → sobrescritura silenciosa. `En Proceso` o posterior → requiere confirmación + diff visible. Lógica de negocio en `app.js`.
- **Rol `planta`:** Auto-transiciona nota de `Nueva` → `En Proceso` al visualizarla.

## Estructura de una Nota

```js
{
  id, numero,        // auto-increment
  fecha,             // ISO string
  destino,           // 'Sucursal' | 'Planta de Producción'
  productos,         // [{ nombre, cantidad, unidad }]
  estatus,           // 'Nueva' | 'En Proceso' | 'Completada' | 'Cancelada'
  observaciones,
  prioridad,         // orden en dashboard
  creadoEn, actualizadoEn
}
```

## Migración v1.2 (Producción)

Al migrar a Supabase:
- `store.js` → reemplazar localStorage por Supabase client + cola offline (IndexedDB/RxDB).
- `auth.js` → reemplazar por Supabase Auth.
- Agregar Service Worker para offline-first.
- Nuevos roles: `repartidor` (gestión de rutas).
- Deploy target: Vercel + dominio personalizado.
