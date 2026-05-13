# Enote — Sistema de Notas de Remisión

> **Cliente:** Xiera — Panadería, Ocotlán, Jalisco
> **Stack:** Vanilla JS SPA · Supabase (PostgreSQL + Auth) · PWA (Service Worker + IndexedDB) · Vercel
> **Versión actual:** v1.2 — En producción (Supabase live + modo demo local)

---

## Quick Start

```bash
# Desarrollo local
npx serve .
# Abre http://localhost:3000

# Login demo (local, sin Supabase)
admin1 / pass
planta1 / pass
sucursal1 / pass

# Login real (Supabase)
admin@xiera.com / tu-contraseña
planta@xiera.com / tu-contraseña

# Tests E2E
cd audit && npm install && npm run audit
```

## Proyecto

Genera notas de remisión digitales con flujo multi-usuario y workflow de estatus. Funciona en modo demo local (localStorage) o con Supabase real (Auth + PostgreSQL). Soporta PWA offline-first.

Docs:
- `docs/ROADMAP-PRODUCCION-V1.2.md` — spec completa (schema SQL, RLS, roles, deploy)
- `docs/SPRINT-PRODUCCION-V1.2.md` — desglose por semanas con horas estimadas

## Arquitectura

SPA vanilla JS (`index.html` → `js/app.js` como ES module). Sin frameworks ni bundlers.

### Módulos JS (`js/`)

| Archivo | Rol |
|---------|-----|
| `app.js` | Orquestador. Estado global, delegación de eventos, coordinación de vistas. |
| `config.js` | Constantes: roles, estatus válidos, destinos, textos UI. |
| `store.js` | CRUD async sobre localStorage (demo) o Supabase (producción). `isDemoMode()` detecta cuál usar. |
| `auth.js` | Login/ logout. Soporta demo (`CONFIG.users`) y Supabase Auth. `canCreate()`, `canEdit()`, `canDelete()`, `canSeeAll()`. |
| `supabase.js` | Cliente Supabase. URL y anon key hardcodeadas (repo privado). |
| `offline.js` | IndexedDB: cache de notas (planta) y cola de escritura (sucursal). Sync con retry 3x. |
| `logger.js` | Logger de eventos de sesión. POST silencioso a `/api/log`. |
| `imageUtils.js` | `compressImage()` → WebP 40% via Canvas API. |
| `ui/shared.js` | `esc()`, `showView()`, `openModal()`, `closeModal()`, `renderToast()`, `renderHeader()`, `formatFecha()`, `formatTs()`, `statusClass()`. |
| `ui/login.js` | Vista de login (detecta demo vs Supabase). |
| `ui/dashboard.js` | Grid de notas con filtros (estatus, destino, búsqueda). |
| `ui/form.js` | Formulario crear/editar nota con productos e imágenes. |
| `ui/detail.js` | Vista detalle, diff view, confirmación de eliminación. |
| `ui/repartidor.js` | Vista repartidor: selector de sucursal + toggle `tomada`. |

### Flujo de datos

```
Evento DOM → app.js (delegación) → store.js (localStorage | Supabase)
                                         ↓
                                  ui/* render → DOM
                                         ↓
                                  logger.js → POST /api/log
```

`app.js` escucha `storage` event para sincronizar entre pestañas y `online`/`offline` para el indicador de conexión y sync de cola.

## Patrones Clave

- **Escaping:** Toda entrada de usuario pasa por `esc()` en `ui/shared.js`.
- **Templates:** HTML como strings concatenados (no JSX).
- **Fechas:** ISO strings en store; formato `es-MX` en UI.
- **Estatus workflow:** `Nueva` → sobrescritura. `En Proceso`/`Completada` → confirmación + diff.
- **Rol `planta`:** Auto-transiciona `Nueva→En Proceso` al abrir detalle.
- **Rol `repartidor`:** Vista propia, toggle `tomada` por nota.
- **Modo demo:** `isDemoMode()` retorna `true` si no hay Supabase configurado. Login local funciona siempre.
- **Auth real:** `supabase.auth.signInWithPassword()`. Perfil se lee de `profiles` table.
- **Debounce:** Búsqueda 280ms.

## Estructura de una Nota

```js
{
  id, numero,           // '#0001'
  fecha,               // 'YYYY-MM-DD'
  destino,             // 'Atequiza'|'Poncitlan'|'Tototlan'|'Ocotlan'
  productos,           // [{ nombre, cantidad, unidad }]
  estatus,             // 'Nueva'|'En Proceso'|'Completada'|'Cancelada'
  observaciones,
  imagenes,            // [{ id, url }] — dataURL WebP, máx 3
  tomada,              // bool — repartidor marcó la nota
  tomadaPor, tomadaEn,
  unreadNew, unreadModified,
  prioridad,           // int — orden en dashboard
  creadoPor, creadoEn,
  modificadoPor, modificadoEn,
}
```

## Roles y Permisos

| Rol | Dashboard | Crear | Editar | Eliminar | Offline |
|-----|-----------|-------|--------|----------|---------|
| admin | Todas las notas | ✅ | ✅ | ✅ | ❌ |
| planta | Solo destino Planta | ❌ | Estatus | ❌ | Lectura cache |
| sucursal | Solo su destino | ✅ | Nueva | Nueva | Cola escrita |
| repartidor | Vista propia | ❌ | ❌ | ❌ | ❌ |

## Backend (Supabase)

- **Proyecto:** `https://ovlhabedefwbajrnfpup.supabase.co`
- **Tablas:** `profiles`, `notes`, `routes`
- **RLS:** Activo en las 3 tablas
- **Auth:** Email + contraseña, Confirm email OFF
- **Rutas:** Atequiza, Poncitlan, Tototlan, Ocotlan

### Agregar usuario

1. **Supabase → Authentication → Users → Add user**
2. Copiar el **UUID** del usuario creado
3. SQL Editor:
```sql
INSERT INTO profiles (id, username, role, destino) VALUES
    ('<uuid>', 'username', 'admin|planta|sucursal|repartidor', 'Atequiza|Poncitlan|Tototlan|Ocotlan|null');
```

## Deploy

```bash
# Push a main → Vercel hace deploy automático
git push origin main

# Dominio propio (opcional, al final)
# Vercel → Settings → Domains → agregar dominio
# Supabase → Authentication → URL Configuration → Site URL
```

## Costo

| Servicio | Plan | Costo |
|----------|------|-------|
| Supabase | Free (1 proyecto) | **$0** |
| Vercel | Hobby | **$0** |
| Dominio | Cloudflare Registrar | ~$8/año |
| **Total mensual** | | **~$0.67** |
