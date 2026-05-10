# Sprint de Producción — Enote v1.2

**Cliente:** Xiera — Panadería, Ocotlán, Jalisco  
**Inicio:** Lunes 11 de mayo de 2026  
**Entrega estimada:** Viernes 13 de junio de 2026  
**Alcance:** 8 usuarios · 1 organización · dominio propio · PWA offline-first

---

## Estado General

| Semana | Periodo | Estado | Avance |
|--------|---------|--------|--------|
| 0 — Pre-arranque | Antes del 11 mayo | 🔴 Pendiente | 0 / 4 tareas |
| 1 — Infraestructura | 11–16 mayo | 🔴 Pendiente | 0 / 6 tareas |
| 2 — Supabase + Offline | 18–23 mayo | 🔴 Pendiente | 0 / 8 tareas |
| 3 — Repartidor + Pruebas | 25–30 mayo | 🔴 Pendiente | 0 / 6 tareas |
| 4 — Deploy + Entrega | 01–06 junio | 🔴 Pendiente | 0 / 7 tareas |
| 5 — Buffer | 08–13 junio | 🔴 Pendiente | — |

**Leyenda:** 🔴 Pendiente · 🟡 En progreso · 🟢 Completado · ⚫ Bloqueado

---

## Registro de Actualizaciones

> Cada vez que completes una semana o cambies el estado de una tarea importante, agrega una entrada aquí.

| Fecha | Quién | Cambio |
|-------|-------|--------|
| — | — | Sprint creado |

---

## Semana 0 — Pre-arranque

> **⚠ Estas tareas deben completarse ANTES del lunes 11 de mayo.**  
> Son gestiones y decisiones de negocio que no puede hacer el código.

**Estado de la semana:** 🔴 Pendiente  
**Estimado:** ~2 h  
**Resultado esperado:** Credenciales de Supabase disponibles, dominio comprado, rutas definidas.

---

### Tareas (todas manuales)

- [ ] **Crear cuenta Supabase y nuevo proyecto**
  - Ir a [supabase.com](https://supabase.com) → Sign Up
  - New Project → nombre: `enote-xiera` · región: US East (o la más cercana)
  - Guardar: `Project URL` y `anon public key` (Settings → API)

- [ ] **Cliente compra dominio**
  - Recomendado: Namecheap (~$12/año) o Cloudflare Registrar (~$8/año)
  - Sugerencia de nombre: `enote-xiera.com` o `xiera-pedidos.com`
  - Confirmar que el cliente tiene acceso al panel DNS del registrador

- [ ] **Acceso al repositorio GitHub**
  - Confirmar que el desarrollador tiene permisos de push a `main`
  - Verificar que el repo está conectado o listo para conectar a Vercel

- [ ] **Definir lista exacta de rutas de reparto**
  - El roadmap propone: Guadalajara, Zamora, Ocotlán, Lagos de Moreno, Puerto Vallarta
  - Confirmar con el cliente si estas son las rutas reales o si deben modificarse
  - Las rutas van directo al SQL de la semana 1 — no se pueden cambiar fácil después sin migración

**Notas / Bloqueadores:**
> _Escribe aquí cualquier problema que surja._

---

## Semana 1 — Fundamentos de Infraestructura

**Fechas:** Lunes 11 – Viernes 16 de mayo de 2026  
**Estado de la semana:** 🔴 Pendiente  
**Estimado:** ~12 h  
**Resultado esperado:** Base de datos configurada con schema y RLS, 8 usuarios con login funcional, `sw.js` cacheando assets estáticos.

---

### Tarea 1 — Ejecutar Schema SQL en Supabase _(manual, ~1 h)_

- [ ] Abrir Supabase Dashboard → proyecto `enote-xiera`
- [ ] Ir a **SQL Editor** → **New Query**
- [ ] Copiar y ejecutar el siguiente bloque completo:

```sql
-- ═══════════════════════════════════════════════════════════
-- TABLA: RUTAS FIJAS
-- ═══════════════════════════════════════════════════════════
CREATE TABLE routes (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ⚠ Ajustar rutas según lo definido en la Semana 0
INSERT INTO routes (name) VALUES
    ('Guadalajara'),
    ('Zamora'),
    ('Ocotlán'),
    ('Lagos de Moreno'),
    ('Puerto Vallarta');

-- ═══════════════════════════════════════════════════════════
-- TABLA: PERFILES DE USUARIO
-- ═══════════════════════════════════════════════════════════
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'planta', 'sucursal', 'repartidor')),
    destino TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════
-- TABLA: NOTAS DE PEDIDO
-- ═══════════════════════════════════════════════════════════
CREATE TABLE notes (
    id SERIAL PRIMARY KEY,
    numero TEXT NOT NULL,
    fecha DATE NOT NULL,
    destino TEXT NOT NULL,
    productos JSONB NOT NULL DEFAULT '[]',
    observaciones TEXT DEFAULT '',
    estatus TEXT DEFAULT 'Nueva'
        CHECK (estatus IN ('Nueva', 'En Proceso', 'Completada', 'Cancelada')),
    route_id INT REFERENCES routes(id),
    loaded BOOLEAN DEFAULT FALSE,
    loaded_at TIMESTAMPTZ,
    loaded_by TEXT,
    unread_new BOOLEAN DEFAULT TRUE,
    unread_modified BOOLEAN DEFAULT FALSE,
    prioridad INT DEFAULT 0,
    creado_por TEXT NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    modificado_por TEXT,
    modificado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════
-- ÍNDICES
-- ═══════════════════════════════════════════════════════════
CREATE INDEX idx_notes_estatus  ON notes(estatus);
CREATE INDEX idx_notes_destino  ON notes(destino);
CREATE INDEX idx_notes_route    ON notes(route_id);
CREATE INDEX idx_notes_fecha    ON notes(fecha);
CREATE INDEX idx_profiles_role  ON profiles(role);
```

- [ ] Verificar que las 3 tablas aparecen en **Table Editor**

---

### Tarea 2 — Activar RLS y aplicar políticas _(manual, ~1 h)_

- [ ] En **SQL Editor** → **New Query**, ejecutar el siguiente bloque:

```sql
-- Activar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes   ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados ven las rutas
CREATE POLICY "Everyone sees routes"
ON routes FOR SELECT TO authenticated
USING (true);

-- Admin: acceso total a notas
CREATE POLICY "Admin full access"
ON notes FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Planta: ve notas de su destino
CREATE POLICY "Planta sees own destino"
ON notes FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'planta' AND destino = notes.destino)
);

-- Planta: actualiza notas de su destino
CREATE POLICY "Planta updates own destino"
ON notes FOR UPDATE TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'planta' AND destino = notes.destino)
);

-- Sucursal: ve notas de su destino
CREATE POLICY "Sucursal sees own destino"
ON notes FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'sucursal' AND destino = notes.destino)
);

-- Sucursal: crea notas en su destino
CREATE POLICY "Sucursal creates own notes"
ON notes FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'sucursal' AND destino = notes.destino)
);

-- Repartidor: ve notas de hoy y las ya cargadas
CREATE POLICY "Repartidor sees route notes"
ON notes FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'repartidor')
    AND (loaded = true OR fecha = CURRENT_DATE)
);

-- Repartidor: puede marcar notas como cargadas
CREATE POLICY "Repartidor marks loaded"
ON notes FOR UPDATE TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'repartidor')
);
```

- [ ] Verificar en **Authentication → Policies** que aparecen las 8 políticas

---

### Tarea 3 — Crear los 8 usuarios en Supabase Auth _(manual, ~1 h)_

Ir a **Authentication → Users → Add user → Create new user** para cada uno:

| Email (sugerido) | Password | Role | Destino |
|------------------|----------|------|---------|
| `admin@xiera.com` | `[generar segura]` | `admin` | — |
| `planta@xiera.com` | `[generar segura]` | `planta` | `Planta de Producción` |
| `sucursal1@xiera.com` | `[generar segura]` | `sucursal` | `Sucursal 1` |
| `sucursal2@xiera.com` | `[generar segura]` | `sucursal` | `Sucursal 2` |
| `sucursal3@xiera.com` | `[generar segura]` | `sucursal` | `Sucursal 3` |
| `sucursal4@xiera.com` | `[generar segura]` | `sucursal` | `Sucursal 4` |
| `sucursal5@xiera.com` | `[generar segura]` | `sucursal` | `Sucursal 5` |
| `repartidor@xiera.com` | `[generar segura]` | `repartidor` | — |

> **⚠ Importante:** Los nombres de sucursal y sus destinos deben coincidir con los valores reales acordados con el cliente.

Después de crear cada usuario en Auth, insertar su perfil en SQL Editor:

```sql
-- Reemplazar <uuid> con el ID que muestra Supabase al crear cada usuario
INSERT INTO profiles (id, username, role, destino) VALUES
    ('<uuid-admin>',       'admin',       'admin',       NULL),
    ('<uuid-planta>',      'planta',      'planta',      'Planta de Producción'),
    ('<uuid-sucursal1>',   'sucursal1',   'sucursal',    'Sucursal 1'),
    ('<uuid-sucursal2>',   'sucursal2',   'sucursal',    'Sucursal 2'),
    ('<uuid-sucursal3>',   'sucursal3',   'sucursal',    'Sucursal 3'),
    ('<uuid-sucursal4>',   'sucursal4',   'sucursal',    'Sucursal 4'),
    ('<uuid-sucursal5>',   'sucursal5',   'sucursal',    'Sucursal 5'),
    ('<uuid-repartidor>',  'repartidor',  'repartidor',  NULL);
```

- [ ] Verificar que `profiles` tiene 8 filas en Table Editor

---

### Tarea 4 — Configurar Auth Settings en Supabase _(manual, ~0.5 h)_

- [ ] Ir a **Authentication → URL Configuration**
- [ ] **Site URL:** dejar en blanco por ahora (se actualiza en Semana 4 con el dominio real)
- [ ] **Redirect URLs:** agregar `http://localhost:5500/**` para desarrollo local
- [ ] Desactivar **Confirm email** si se quiere login inmediato sin confirmar correo (recomendado para demo interna)

---

### Tarea 5 — Implementar `sw.js` _(código, ~4 h)_

- [ ] Crear `sw.js` en la raíz del proyecto con:
  - Cache-first para todos los assets estáticos (`index.html`, CSS, JS)
  - `print.css` incluido explícitamente en el cache (requerido para PDF offline)
  - Versión del cache con nombre para invalidar en deploys futuros
- [ ] Registrar el Service Worker desde `index.html` (o `app.js`) con `navigator.serviceWorker.register('/sw.js')`
- [ ] Crear `manifest.json` en raíz (mínimo: `name`, `short_name`, `display: standalone`, `start_url`)

### Tarea 6 — Verificar semana 1 _(manual, ~1 h)_

- [ ] Abrir `index.html` en browser (demo local con localStorage)
- [ ] Confirmar que el Service Worker aparece en Chrome DevTools → Application → Service Workers
- [ ] Confirmar que los assets aparecen en Cache Storage
- [ ] Abrir Supabase Table Editor y confirmar: 3 tablas, 8 usuarios en `profiles`, 5 rutas en `routes`

**Fecha real de completado:** ___________  
**Notas / Bloqueadores:**
> _Escribe aquí cualquier problema que surja._

---

## Semana 2 — Integración Supabase + Offline

**Fechas:** Lunes 18 – Viernes 23 de mayo de 2026  
**Estado de la semana:** 🔴 Pendiente  
**Estimado:** ~26 h  
**Resultado esperado:** CRUD funciona contra Supabase, planta ve notas offline (IndexedDB), sucursal crea notas offline (cola), indicador de conexión en UI.

---

### Tarea 1 — Crear `js/supabase.js` _(código, ~1 h)_

- [ ] Instalar (via CDN en `index.html`) o importar el cliente `@supabase/supabase-js`
- [ ] Crear `js/supabase.js` que exporta la instancia del cliente con `SUPABASE_URL` y `SUPABASE_ANON_KEY`
- [ ] **⚠ No hardcodear las keys en el código fuente si el repo es público.** Usar variables de entorno o un archivo `js/env.js` en `.gitignore`

---

### Tarea 2 — Adaptar `auth.js` a Supabase Auth _(código, ~4 h)_

- [ ] Reemplazar `login()` con `supabase.auth.signInWithPassword({ email, password })`
- [ ] Reemplazar `clearSession()` con `supabase.auth.signOut()`
- [ ] Reemplazar `getSession()` con `supabase.auth.getSession()`
- [ ] Después del login, leer el perfil del usuario desde `profiles` para obtener `role` y `destino`
- [ ] **Corregir bug conocido:** el `clearSession()` actual usa `sessionStorage` en lugar de `localStorage`. Al migrar a Supabase Auth esto queda resuelto automáticamente.
- [ ] Adaptar `requireAuth()` para que funcione con `async/await`

---

### Tarea 3 — Adaptar `store.js` a Supabase CRUD _(código, ~8 h)_

- [ ] Convertir todas las funciones a `async`/`await`
- [ ] `getNotes()` → `supabase.from('notes').select('*').order('prioridad')`
- [ ] `getNote(id)` → `supabase.from('notes').select('*').eq('id', id).single()`
- [ ] `createNote()` → `supabase.from('notes').insert(note).select().single()`
- [ ] `updateNote()` → `supabase.from('notes').update(fields).eq('id', id)`
- [ ] `deleteNote()` → `supabase.from('notes').delete().eq('id', id)`
- [ ] `moveNoteUp/Down()` → doble update de `prioridad`
- [ ] Eliminar `seedDemoNotes()` (la DB ya tiene datos reales)

---

### Tarea 4 — Adaptar `app.js` a async _(código, ~4 h)_

- [ ] Agregar `async` a todos los handlers que llamen a `store.js`
- [ ] Agregar `await` en cada llamada a store/auth
- [ ] Manejar errores de red: mostrar toast `'Sin conexión — reintentando...'` si falla fetch de Supabase
- [ ] Adaptar `init()` a async (esperar sesión de Supabase antes de renderizar)

---

### Tarea 5 — Implementar `offline.js` _(código, ~6 h)_

- [ ] Crear `js/offline.js` con IndexedDB (usar la API nativa o la librería `idb` vía CDN)
- [ ] Store `notes_cache`: para planta — guardar snapshot de notas al sincronizar online
- [ ] Store `pending_queue`: para sucursal — guardar notas creadas sin conexión
- [ ] Función `syncNotesToCache()`: llamar al iniciar sesión si online
- [ ] Función `getOfflineNotes()`: retornar notas de `notes_cache`
- [ ] Función `createNoteOffline(noteData)`: guardar en `pending_queue` + toast info
- [ ] Función `syncPendingNotes()`: enviar cola a Supabase al reconectar (ver Semana 3 para retry)

---

### Tarea 6 — Indicador online/offline en UI _(código, ~1 h)_

- [ ] Agregar listener `window.addEventListener('online' / 'offline')` en `app.js`
- [ ] Mostrar badge o banner en header: `'🔴 Sin conexión'` / `'🟢 Conectado'`
- [ ] Al reconectar: llamar `syncPendingNotes()` automáticamente

---

### Tarea 7 — Integrar offline.js en el flujo de store/app _(código, ~2 h)_

- [ ] En `store.js`: si `!navigator.onLine` y usuario es `sucursal`, llamar `createNoteOffline()` en lugar de insert a Supabase
- [ ] En `store.js`: si `!navigator.onLine` y usuario es `planta`, llamar `getOfflineNotes()` en lugar de query a Supabase

---

### Tarea 8 — Verificar Semana 2 _(manual, ~2 h)_

- [ ] Copiar `SUPABASE_URL` y `SUPABASE_ANON_KEY` a `js/supabase.js` (o `js/env.js`)
- [ ] Probar login de **cada uno de los 8 usuarios** por separado
- [ ] Probar crear nota como `admin` y verificar que aparece en Supabase Table Editor
- [ ] Probar: activar modo avión en Chrome → login como `sucursal1` → crear nota → reconectar → verificar sync
- [ ] Probar: activar modo avión → login como `planta` → verificar notas en cache

**Fecha real de completado:** ___________  
**Notas / Bloqueadores:**
> _Escribe aquí cualquier problema que surja._

---

## Semana 3 — Rol Repartidor + Pruebas Offline

**Fechas:** Lunes 25 – Viernes 30 de mayo de 2026  
**Estado de la semana:** 🔴 Pendiente  
**Estimado:** ~22 h  
**Resultado esperado:** Rol `repartidor` funcional con vista por tabs de rutas, cola de sync con retry automático, flujos offline probados end-to-end.

---

### Tarea 1 — Dropdown de rutas en formulario de nota _(código, ~2 h)_

- [ ] En `store.js`: agregar `getRoutes()` → `supabase.from('routes').select('*').order('name')`
- [ ] En `ui.js → renderNoteForm()`: agregar `<select id="nf-route">` poblado con las rutas
- [ ] En `store.js → createNote()` / `updateNote()`: incluir `route_id` en el payload
- [ ] Solo visible para rol `admin` (planta y sucursal no asignan ruta)

---

### Tarea 2 — Vista Repartidor en `ui.js` _(código, ~6 h)_

- [ ] Crear función `renderRepartidorView(routes, notesByRoute, session)` en `ui.js`
- [ ] Estructura: tabs horizontales por ruta → al seleccionar, lista de notas del día no cargadas
- [ ] Cada nota muestra: número, productos resumidos, checkbox `[Marcar como cargado]`
- [ ] Notas ya marcadas (`loaded: true`) muestran timestamp `loaded_at`
- [ ] En `app.js`: agregar `showRepartidorView()` para el rol `repartidor` al hacer login

---

### Tarea 3 — Funcionalidad "Marcar como cargado" _(código, ~2 h)_

- [ ] En `store.js`: agregar `markAsLoaded(noteId, username)`
  ```js
  supabase.from('notes').update({
    loaded: true,
    loaded_at: new Date().toISOString(),
    loaded_by: username
  }).eq('id', noteId)
  ```
- [ ] Al marcar: remover la nota de la lista visible sin recargar toda la vista
- [ ] Toast: `'Nota #XXXX marcada como cargada'`

---

### Tarea 4 — Sync con retry automático en `offline.js` _(código, ~4 h)_

- [ ] Modificar `syncPendingNotes()` para reintentar hasta 3 veces por nota con backoff exponencial (1s → 2s → 4s)
- [ ] Si los 3 intentos fallan: dejar la nota en `pending_queue`, mostrar toast de error con count de notas pendientes
- [ ] Al reconectar (evento `online`): disparar sync automáticamente

```js
async function syncWithRetry(note, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await createNoteAPI(note);
      await localDB.delete('pending_queue', note.id);
      return true;
    } catch {
      if (attempt < maxAttempts) {
        await sleep(1000 * Math.pow(2, attempt - 1));
      }
    }
  }
  return false;
}
```

---

### Tarea 5 — Pruebas offline completas _(manual, ~4 h)_

**Flujo Sucursal (cola de escritura):**
- [ ] Abrir Chrome → DevTools → Network → **Offline**
- [ ] Login como `sucursal1`
- [ ] Crear 2 notas → verificar toast `'Nota guardada offline'`
- [ ] Network → **Online**
- [ ] Verificar toast `'Nota sincronizada'` x2
- [ ] Abrir Supabase Table Editor → confirmar que las 2 notas están en `notes`

**Flujo Planta (cache de lectura):**
- [ ] Online → login como `planta` → verificar que las notas cargaron
- [ ] DevTools → Network → **Offline**
- [ ] Recargar la página (F5)
- [ ] Verificar que las notas siguen visibles (desde IndexedDB)
- [ ] Abrir una nota → clic en **Imprimir** → verificar que `print.css` aplica (PDF funciona)

**Flujo Repartidor:**
- [ ] Login como `repartidor`
- [ ] Verificar que aparecen tabs de rutas
- [ ] Marcar una nota como cargada → verificar `loaded_at` en Supabase

---

### Tarea 6 — Verificar semana 3 _(manual, ~1 h)_

- [ ] Ejecutar audit E2E: `cd audit && npm run audit`
- [ ] Confirmar 0 checks fallidos y 0 errores de consola (adaptar el audit para rol repartidor si es necesario)

**Fecha real de completado:** ___________  
**Notas / Bloqueadores:**
> _Escribe aquí cualquier problema que surja._

---

## Semana 4 — Deploy, Testing E2E y Entrega

**Fechas:** Lunes 01 – Viernes 06 de junio de 2026  
**Estado de la semana:** 🔴 Pendiente  
**Estimado:** ~18 h  
**Resultado esperado:** Sistema en dominio propio con SSL, audit E2E pasa limpio, manual de usuario entregado al cliente.

---

### Tarea 1 — Deploy a Vercel _(manual, ~2 h)_

- [ ] Ir a [vercel.com](https://vercel.com) → **Add New Project**
- [ ] Conectar con GitHub → seleccionar el repo `enote-xiera`
- [ ] Configuración del proyecto:
  - **Framework Preset:** Other
  - **Root Directory:** `./` (raíz del repo)
  - **Output Directory:** `./`
  - **Build Command:** *(dejar vacío — no hay build step)*
- [ ] En **Environment Variables**, agregar:
  - `SUPABASE_URL` → tu URL de Supabase
  - `SUPABASE_ANON_KEY` → tu anon key
  
  > **⚠ Nota:** Si la app es vanilla JS estático sin Node.js, estas variables no son inyectadas automáticamente. Verificar si se leen desde `js/env.js` o si están hardcodeadas en `js/supabase.js`. Para producción: el archivo `js/env.js` debe estar en `.gitignore` y copiarse manual al servidor, o usar un paso de build mínimo.

- [ ] Clic en **Deploy**
- [ ] Verificar que la URL generada por Vercel (ej. `enote-xiera.vercel.app`) carga la app correctamente
- [ ] Probar login desde esa URL con usuario `admin`

---

### Tarea 2 — Configurar dominio propio _(manual, ~1 h)_

- [ ] En Vercel → proyecto → **Settings → Domains → Add**
- [ ] Ingresar el dominio comprado (ej. `enote-xiera.com`)
- [ ] Vercel muestra los DNS records a configurar. Ir al panel del registrador (Namecheap/Cloudflare) y agregar:
  - `A` record: `@` → `76.76.21.21`
  - `CNAME` record: `www` → `cname.vercel-dns.com`
- [ ] Esperar propagación DNS (5–30 min normalmente)
- [ ] Verificar SSL activo: el ícono del candado en el browser debe aparecer verde

---

### Tarea 3 — Actualizar Site URL en Supabase _(manual, ~15 min)_

- [ ] Supabase Dashboard → **Authentication → URL Configuration**
- [ ] **Site URL:** cambiar a `https://enote-xiera.com` (dominio real)
- [ ] **Redirect URLs:** agregar `https://enote-xiera.com/**`
- [ ] Guardar cambios
- [ ] Probar login desde el dominio real — el redirect post-login debe funcionar

---

### Tarea 4 — Testing E2E completo _(manual, ~4 h)_

- [ ] Ejecutar audit contra URL de producción:
  ```bash
  cd audit
  ENOTE_URL=https://enote-xiera.com node audit.js
  ```
- [ ] Revisar screenshots en `audit/screenshots/`
- [ ] Confirmar resultado `PASS ✓` (0 checks fallidos, 0 errores de consola)
- [ ] Probar manualmente en móvil (Chrome en Android/iOS):
  - Login con cada rol
  - Crear nota
  - Instalar como PWA (banner de "Agregar a pantalla de inicio")
  - Verificar que funciona offline en móvil

---

### Tarea 5 — Bug fixes _(código, ~4 h)_

- [ ] Corregir cualquier issue encontrado en el audit o las pruebas manuales
- [ ] Re-ejecutar audit hasta `PASS ✓`
- [ ] Hacer deploy de la versión corregida (push a `main` → Vercel hace deploy automático)

---

### Tarea 6 — Manual de usuario _(manual, ~3 h)_

Crear un PDF de 1 página (o imprimir desde `window.print()` un HTML simple) con:

- [ ] Cómo abrir la app (URL + agregar a pantalla de inicio)
- [ ] Login: cada usuario con su email y contraseña
- [ ] Flujo básico Admin: crear nota → asignar ruta → ver dashboard
- [ ] Flujo básico Planta: ver nota → cambiar estatus → imprimir PDF
- [ ] Flujo básico Sucursal: crear nota offline → reconectar
- [ ] Flujo básico Repartidor: ver ruta → marcar como cargado
- [ ] Qué hacer si no hay internet (cada rol)

---

### Tarea 7 — Preparar entrega formal _(manual, ~1 h)_

- [ ] Documento con credenciales de los 8 usuarios (email + contraseña)
- [ ] URL del sistema
- [ ] Manual de usuario (PDF)
- [ ] Acceso al panel de Supabase (opcional — crear usuario con rol `admin` en Supabase Dashboard)
- [ ] Explicar al cliente cómo resetear contraseñas desde Supabase si un usuario olvida la suya

**Fecha real de completado:** ___________  
**Notas / Bloqueadores:**
> _Escribe aquí cualquier problema que surja._

---

## Semana 5 — Buffer

**Fechas:** Lunes 08 – Viernes 13 de junio de 2026  
**Estado de la semana:** 🔴 Pendiente  
**Estimado:** ~10 h reservadas (usar solo si hay incidencias)  
**Resultado esperado:** Entrega formal completada, cliente usando el sistema.

---

### Tareas posibles (según lo que surja)

- [ ] Edge cases no cubiertos (ej. nota con 0 productos, rutas duplicadas, sync conflict)
- [ ] Ajustes de UX post-feedback del cliente en semana 4
- [ ] Limpiar código de demo (remover `seedDemoNotes`, credenciales de prueba en `config.js`)
- [ ] Documentar credenciales finales y hacer handoff
- [ ] Entrega formal al cliente

**Fecha de entrega real:** ___________  
**Notas finales:**
> _Escribe aquí el estado final al cerrar el sprint._

---

## Resumen de Estimados por Semana

| Semana | Horas estimadas | Horas reales |
|--------|-----------------|--------------|
| 0 — Pre-arranque | ~2 h | ___ h |
| 1 — Infraestructura | ~12 h | ___ h |
| 2 — Supabase + Offline | ~26 h | ___ h |
| 3 — Repartidor + Pruebas | ~22 h | ___ h |
| 4 — Deploy + Entrega | ~18 h | ___ h |
| 5 — Buffer | ~10 h (reserva) | ___ h |
| **Total** | **~90 h** | **___ h** |

---

## Criterios de Aceptación (Definition of Done)

El sprint se cierra cuando todos estos puntos están en verde:

- [ ] Login funciona para los 8 usuarios desde dominio propio con HTTPS
- [ ] Admin puede crear nota con ruta asignada
- [ ] Sucursal puede crear nota offline (modo avión) y sincroniza al reconectar
- [ ] Planta puede ver notas offline (sin internet) y abrir PDF imprimible
- [ ] Repartidor puede ver tabs por ruta y marcar notas como cargadas
- [ ] `cd audit && ENOTE_URL=https://dominio.com node audit.js` → `PASS ✓`
- [ ] Manual de usuario entregado al cliente
- [ ] Credenciales de 8 usuarios documentadas y entregadas
