# Enote — Sistema de Notas de Remisión

> **Cliente:** Xiera — Panadería, Ocotlán, Jalisco
> **Stack:** Vanilla JS SPA · Supabase (PostgreSQL + Auth) · PWA (Service Worker + IndexedDB) · Vercel
> **Versión actual:** v1.2 — En producción (Supabase-only)

---

## Quick Start

```bash
# 1. Configurar credenciales (una sola vez, o cada vez que cambien)
#    Crear .env con SUPABASE_URL y SUPABASE_ANON_KEY (ver sección Environment Variables)
node scripts/build-config.js

# 2. Servir local
npx serve .
# Abrir http://localhost:3000

# Login (Supabase)
admin@xiera.com / tu-contraseña

# Tests E2E
cd audit && npm install && npm run audit
```

## Environment Variables

`scripts/build-config.js` lee desde `process.env` o `.env` en la raíz y genera `js/supabase.js` (gitignored).

| Variable | Descripción |
|----------|-------------|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Anon key de Supabase |

- **Local:** crear `.env` en la raíz del repo.
- **Producción (Vercel):** configurar en Project Settings → Environment Variables y correr `node scripts/build-config.js` en el build step.

Si las variables no existen, el script emite warning y genera un cliente vacío (`isSupabaseConfigured()` retorna `false`) — la app degrada graciosamente.

## Proyecto

Genera notas de remisión digitales con flujo multi-usuario y workflow de estatus. Backend único: Supabase (Auth + PostgreSQL + RLS). PWA con cache offline y cola de pendientes vía IndexedDB.

Docs:
- `docs/ROADMAP-PRODUCCION-V1.2.md` — spec completa (schema SQL, RLS, roles, deploy)
- `docs/SPRINT-PRODUCCION-V1.2.md` — desglose por semanas con horas estimadas
- `docs/AUDIT-V1.1.md` — cierre del hardening v1.1

## Arquitectura

SPA vanilla JS (`index.html` → `js/app.js` como ES module). Sin frameworks ni bundlers.

### Módulos JS (`js/`)

| Archivo | Rol |
|---------|-----|
| `app.js` | Orquestador. Estado global, delegación de eventos, paginación, conflict view. |
| `config.js` | Constantes: roles, estatus, destinos, `PAGE_SIZE`, textos UI. |
| `store.js` | CRUD async sobre Supabase. Validación de campos, conflict detection vía `_localModifiedEn`, número de nota correlativo. |
| `auth.js` | Login/logout async con Supabase Auth. `canCreate()`, `canEdit()`, `canDelete()`, `canSeeAll()`. |
| `supabase.js` | **Generado** por `scripts/build-config.js`. Cliente Supabase + `uploadImage()`. |
| `supabase.js.template` | Plantilla con placeholders `__SUPABASE_URL__` y `__SUPABASE_ANON_KEY__`. |
| `offline.js` | IndexedDB v3 con `IMAGE_CACHE` (keyPath `url`), `notes_cache`, `pending_queue`. `cacheImages` paralelo en batches de 5. |
| `logger.js` | Logger de eventos. POST silencioso a `/api/log`. |
| `imageUtils.js` | `compressImage()` → WebP via Canvas. `MAX_IMAGES_PER_NOTE = 3`. |
| `types.js` | `@typedef` JSDoc compartidos (`Note`, `Session`, `Role`, `Product`, `ImageRef`). |
| `ui/shared.js` | `esc()`, `showView()`, `openModal()`, `closeModal()` (revoca blob URLs), `renderToast()`, helpers de formato. |
| `ui/login.js` | Vista de login (Supabase email + contraseña). |
| `ui/dashboard.js` | Grid con filtros + barra de paginación. |
| `ui/form.js` | Formulario crear/editar nota. |
| `ui/detail.js` | Detalle + diff view + delete confirm + **conflict view**. |
| `ui/repartidor.js` | Vista repartidor. |

### Scripts

| Archivo | Rol |
|---------|-----|
| `scripts/build-config.js` | Inyecta env vars en `js/supabase.js` desde `process.env` o `.env`. |

### Flujo de datos

```
Evento DOM → app.js (delegación) → store.js (Supabase)
                                         ↓
                                  ui/* render → DOM
                                         ↓
                                  logger.js → POST /api/log
```

## Patrones Clave

- **Escaping:** Toda entrada de usuario pasa por `esc()` en `ui/shared.js` (cubre `&`, `<`, `>`, `"`, `'`).
- **Templates:** HTML como strings (no JSX).
- **Fechas:** ISO en store; formato `es-MX` en UI.
- **Estatus workflow:** `Nueva` → sobrescritura. `En Proceso`/`Completada` → confirmación + diff visible.
- **Rol `planta`:** Auto-transiciona `Nueva→En Proceso` al abrir detalle (con `_force: true` para no disparar conflict).
- **Rol `repartidor`:** Vista propia, toggle `tomada`.
- **Paginación:** Client-side, `PAGE_SIZE = 20`. `getNotes()` retorna todo; `app.js` aplica `slice` por página.
- **Conflict detection:** `updateNote()` compara `modificado_en` del servidor con `_localModifiedEn` enviado por el cliente; si el servidor es más nuevo retorna `{conflict, serverNote}` y la UI muestra `renderConflictView`.
- **Validación backend:** `validateNoteFields()` en `store.js` valida `fecha`, `destino` (whitelist), `productos`, `observaciones` (≤2000).
- **Número de nota:** `createNote()` consulta `MAX(numero)` y suma 1 (race condition aceptable para el volumen actual).
- **Debounce búsqueda:** 280 ms.

## Tipos (JSDoc)

`js/types.js` declara `@typedef` para `Note`, `Session`, `Role`, `Product`, `ImageRef`. Los módulos los referencian con `/// <reference path="./types.js" />` para autocompletado y verificación en VS Code.

## Estructura de una Nota

```js
{
  id, numero,           // id = SERIAL auto-increment de Supabase; numero = '#0001'
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
  clienteNombre, clienteDireccion, clienteTelefono,
  pastelCantidad, pisos, sabor, kilos, modelo, texto, colores,
  horaEntrega, horaPeriodo, direccionEntrega,
  costoPastel, depositoEquipo, arreglosFigura, servicioDomicilio,
  anticipo, metodoPago,
}
```

## Roles y Permisos

| Rol | Dashboard | Crear | Editar | Eliminar | Offline |
|-----|-----------|-------|--------|----------|---------|
| admin | Todas | ✅ | ✅ | ✅ | Lectura cache |
| planta | Solo Planta | ❌ | Estatus | ❌ | Lectura cache |
| sucursal | Solo su destino | ✅ | Nueva | Nueva | Cola escrita |
| repartidor | Vista propia | ❌ | toggle tomada | ❌ | ❌ |

## Backend (Supabase)

- **Proyecto:** `https://ovlhabedefwbajrnfpup.supabase.co`
- **Tablas:** `profiles`, `notes`, `routes`
- **RLS:** Activo en las 3 tablas
- **Auth:** Email + contraseña, Confirm email OFF

### Agregar usuario

1. **Supabase → Authentication → Users → Add user**
2. Copiar el **UUID** del usuario creado
3. SQL Editor:
```sql
INSERT INTO profiles (id, username, role, destino) VALUES
    ('<uuid>', 'username', 'admin|planta|sucursal|repartidor', '<destino o NULL>');
```

## Deploy

```bash
# Push a main → Vercel hace deploy automático (build step debe correr build-config.js)
git push origin main
```

Vercel build command sugerido: `node scripts/build-config.js`.

## Costo

| Servicio | Plan | Costo |
|----------|------|-------|
| Supabase | Free | **$0** |
| Vercel | Hobby | **$0** |
| Dominio | Cloudflare Registrar | ~$8/año |
| **Total mensual** | | **~$0.67** |
