# PROMPT DE EJECUCIÓN — Enote v1.2 Hardening

Copia y pega esto textualmente para que otro agente (Claude Code, GPT, etc.) ejecute TODO el plan.

---

Eres un agente de ejecución. Tu tarea es aplicar el plan de hardening completo del proyecto Enote Xiera, ubicado en `C:\Users\extre\Documentos\Enote\enote-xiera` (o la ruta que corresponda). Lee el archivo `docs/PLAN-HARDENING-V1.2.md` para el contexto completo, pero las instrucciones de ejecución están aquí abajo. NO te saltes ningún paso, NO improvises — sigue las especificaciones al pie de la letra.

---

## CONTEXTO DEL PROYECTO

- **Nombre:** Enote — Sistema de notas de remisión para Xiera (panadería, Ocotlán, Jalisco)
- **Stack:** Vanilla JS SPA, ES modules, Supabase (Auth + PostgreSQL + RLS), PWA (Service Worker + IndexedDB)
- **Arquitectura:** SPA sin frameworks ni bundlers. `index.html → js/app.js (orquestador) → js/{store,auth,config}.js + js/ui/{login,dashboard,form,detail,repartidor,shared}.js`
- **Estado previo:** v1.2 con dual-mode (demo localStorage + Supabase producción). Modo demo va a ser ELIMINADO. Ahora será solo Supabase.

## DECISIONES ARQUITECTÓNICAS YA CONFIRMADAS

1. **Modo demo:** Eliminar completamente. store.js pasa a ser solo Supabase.
2. **Supabase env vars:** Script `scripts/build-config.js` que lee `SUPABASE_URL` y `SUPABASE_ANON_KEY` de `process.env` o `.env` y genera `js/supabase.js`. Esto reemplaza las credenciales hardcodeadas.
3. **Paginación:** Prioritaria ahora. Client-side (20 notas/página).
4. **Número de nota:** `createNote()` hace `SELECT numero FROM notes ORDER BY numero DESC LIMIT 1`, incrementa, formatea `#000N`.
5. **Offline queue infra:** Mantener `createNoteOffline()` y `syncPendingNotes()` como infraestructura. No tocar.
6. **JSDoc types:** Crear `js/types.js` con `@typedef`.
7. **sandbox/:** Eliminar del repo y .gitignore.
8. **Conflict detection:** Comparar `modificado_en` antes de UPDATE, mostrar ConflictView si otro usuario editó primero.

## TAREAS A EJECUTAR EN ORDEN

### FASE 1: PREPARACIÓN (hacer primero)

1. **Crear `scripts/build-config.js`** — Node script que lee SUPABASE_URL y SUPABASE_ANON_KEY de process.env (o .env), y escribe `js/supabase.js` con los valores inyectados usando template replacement. Template: `js/supabase.js.template` con placeholders `{{SUPABASE_URL}}` y `{{SUPABASE_ANON_KEY}}`. El `.gitignore` debe incluir `js/supabase.js` (generado).
   NOTA: `isSupabaseConfigured()` debe retornar `!!supabase` (no hardcodear a `true`) para que si el build falla la app degrade graciosamente.

2. **Agregar `sandbox/` a `.gitignore`** y ejecutar `git rm -r --cached sandbox/`.

### FASE 2: T10a — ELIMINAR MODO DEMO (archivos en orden de modificación)

**A. `js/config.js`:**
   - Eliminar `CONFIG.users` (líneas 14-23, 8 objetos con username/password/role/destino)
   - Eliminar `CONFIG.noteNumberFormat` (línea 32, código muerto)
   - Agregar `CONFIG.PAGE_SIZE = 20` (para paginación)

**B. `js/auth.js`:**
   - Eliminar: `isDemoMode()`, `loginDemo()`, `enableDemoMode()`, `disableDemoMode()`
   - Eliminar: `DEMO_MODE_KEY` (línea 6)
   - Renombrar: `loginSupabase()` → `login()` (el cuerpo de la función, no la que es dispatcher)
   - La función `login()` (actual dispatcher, línea 12-17) se elimina completamente. Pasa a ser solo el cuerpo de `loginSupabase()` con el nombre `login`.
   - Simplificar `logout()`: siempre llama `await supabase.auth.signOut()` (try/catch por si Supabase no responde), luego `clearSession()`. Sin rama de demo.
   - Simplificar `getCurrentUser()`: eliminar early return de `isDemoMode()`. Siempre intenta Supabase, fallback a `getSession()`.
   - Mantener: `setSession()`, `clearSession()`, `getSession()`, `requireAuth()`, `canCreate()`, `canEdit()`, `canDelete()`, `canSeeAll()`, `onAuthStateChange()`
   - **Verificar** que `clearSession()` usa `localStorage.removeItem(SESSION_KEY)` (no `sessionStorage`). Si está mal, corregir.
   - **Verificar** que `esc()` en shared.js escape comilla simple (`'` → `&#39;`). Si falta, agregar.

**C. `js/store.js`:**
   - Eliminar imports: `isDemoMode`, `login as authLogin`, `clearSession`, `requireAuth` de auth.js (línea 3).
   - Eliminar: `P`, `NOTES_KEY`, `_counter` (líneas 6-7, 107)
   - Eliminar: `delay()`, `getLocalNotes()`, `setLocalNotes()`, `getNextNumero()`, `seedDemoNotes()`, `moveNoteUp()`, `moveNoteDown()`
   - `processImages()`: eliminar rama `if (!isDemoMode())`/`else` (las líneas del bloque `if (!isDemoMode())` se quedan; el bloque `else` con `demo://` se elimina).
   - `getNotes()`: eliminar `let notes; if (!isDemoMode()){...}else{...}` → queda solo `const { data, error } = await supabase.from('notes').select('*').order(...)`
   - `getNote()`: eliminar rama demo → queda solo `supabase.from('notes').select('*').eq('id', id).single()`
   - `createNote()`:
     - Al inicio, antes de construir el objeto note, hacer query para MAX numero:
       ```js
       const { data: maxNote } = await supabase.from('notes').select('numero').order('numero', { ascending: false }).limit(1);
       const maxNum = maxNote?.[0]?.numero ? parseInt(maxNote[0].numero.replace('#', '')) : 0;
       const numero = '#' + String(maxNum + 1).padStart(4, '0');
       ```
     - El objeto `note` se construye con `numero` en vez de llamar `getNextNumero()`.
     - Eliminar `const notes = await getLocalNotes(); notes.unshift(note); await setLocalNotes(notes); return note;` (demo branch)
     - Mantener solo el bloque Supabase insert (el `if (!isDemoMode())` se elimina, el bloque interior se queda como el único camino).
     - El `return data;` se queda; el `return note;` del demo se elimina.
   - `updateNote()`:
     - Eliminar `const notes = await getLocalNotes(); const idx = ...; if (idx === -1 && isDemoMode()) return null;`
     - Eliminar `if (!isDemoMode())` → el bloque interior se queda como único camino.
     - Eliminar el bloque `else` completo (demo branch con `const old = { ...notes[idx] }; ... await setLocalNotes(notes); return { old, new: updated };`).
     - **Importante:** El bloque Supabase actual no maneja `unreadModified` para admin. En la demo branch sí se hacía. Re-implementar: si `session.role === 'admin'` y el estatus actual de la nota está en `CONFIG.confirmEditStatuses`, y los campos de contenido cambian (no solo estatus), setear `dbFields.unread_modified = true`. Esto requiere leer la nota actual primero (llamar `getNote(id)`).
     - Mantener `return { old: null, new: data };` (el `old` como null es correcto, ya no tenemos la versión anterior en cliente).
   - `deleteNote()`: eliminar `if (!isDemoMode())` → queda solo `supabase.from('notes').delete().eq('id', id)`.
   - `toggleTomada()`: no necesita cambios (usa `getNote` y `updateNote`, que ya se simplificaron).

**D. `js/app.js`:**
   - Eliminar de imports de store.js: `moveNoteUp`, `moveNoteDown`, `seedDemoNotes` (dejar solo `getNotes`, `getNote`, `createNote`, `updateNote`, `deleteNote`, `toggleTomada`).
   - Eliminar de imports de auth.js: `isDemoMode` (dejar solo `login, clearSession, requireAuth, canSeeAll, logout`).
   - Eliminar de imports de offline.js: `syncPendingNotes`, `isOnline` (solo se usan en el listener `online`, que se mantiene).
   - En `init()`: eliminar `seedDemoNotes();` (línea 44 aproximadamente).
   - En `init()`: eliminar el listener `window.addEventListener('storage', ...)` (ya no hay localStorage de notas que escuchar entre pestañas).
   - En `handleDashboardClick()`: eliminar los handlers `.btn-priority-up` y `.btn-priority-down`.
   - Agregar al state global de app.js: `let currentPage = 1;` (para paginación).
   - Agregar función `renderPaginatedGrid(notes, session)` que calcula slice según currentPage y PAGE_SIZE, llama `refreshGrid(notes.slice(...), session)`, y agrega controles de paginación debajo de `#notes-grid`.
   - En `applyFilters()`: reset `currentPage = 1` y llamar `renderPaginatedGrid()` en vez de `refreshGrid()`.
   - En `handleDashboardClick()`: agregar handler para `.btn-prev-page` y `.btn-next-page` que cambian `currentPage` y re-llaman `renderPaginatedGrid()`.
   - Mantener el listener `online` que llama `syncPendingNotes(createNote)` (aunque la cola esté vacía, es infraestructura).

**E. `js/ui/login.js`:**
   - Eliminar `import { isDemoMode } from '../auth.js';`
   - Eliminar `const demoMode = isDemoMode();` dentro de `renderLoginView()`
   - Eliminar `${demoMode ? '<div class="demo-badge">...</div>' : ''}`
   - Hardcodear siempre: label "Email", input `type="email"`, `autocomplete="email"`, `spellcheck="false"`, `autocapitalize="none"`

**F. `js/ui/dashboard.js`:**
   - En `renderNoteCard()`: eliminar el bloque `<div class="priority-controls">...</div>` (los botones `btn-priority-up` y `btn-priority-down`). Solo aplica al footer del rol planta.
   - En `renderDashboardView()`: agregar sección de paginación al final del template (después del `</section>` de notes-grid):
     ```
     <section class="pagination-bar">
       <span class="pagination-info">Página {page} de {totalPages} ({total} notas)</span>
       <button class="btn btn-ghost btn-prev-page" {disabled?}>← Anterior</button>
       <button class="btn btn-ghost btn-next-page" {disabled?}>Siguiente →</button>
     </section>
     ```
     La función `renderDashboardView()` ahora recibe `{ page, totalPages, total }` además de notes y session.

### FASE 3: T10b — SCRIPT DE ENV VARS (si no se creó en Fase 1)

**A. Crear `js/supabase.js.template`** (copia de `js/supabase.js` actual pero con placeholders):
   ```js
   // GENERATED — DO NOT EDIT
   import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
   const SUPABASE_URL = '__SUPABASE_URL__';
   const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__';
   export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
   export function isSupabaseConfigured() { return !!supabase; }
   // uploadImage() igual que antes
   ```

**B. Crear `scripts/build-config.js`:**
   - Leer `SUPABASE_URL` y `SUPABASE_ANON_KEY` de `process.env`
   - Si no existen, leer de archivo `.env` en la raíz (si existe), parsear línea por línea
   - Si no existen en ningún lado, mostrar warning y continuar con strings vacías
   - Leer `js/supabase.js.template`
   - Reemplazar `__SUPABASE_URL__` y `__SUPABASE_ANON_KEY__` con los valores reales (reemplazo literal, no regex para evitar problemas con caracteres especiales en la anon key)
   - Escribir `js/supabase.js`

**C. Agregar a `.gitignore`:**
   ```
   js/supabase.js   # Generado por scripts/build-config.js
   ```

### FASE 4: T10d — INDEXEDDB KEYPATH + DB MIGRATION

**Archivo: `js/offline.js`:**
   - `DB_VERSION`: 2 → 3
   - `onupgradeneeded`: modificar para que IMAGE_CACHE se cree con `{ keyPath: 'url' }`. Para upgrade de v2→v3, hacer `deleteObjectStore` + `createObjectStore` (se pierde caché existente — aceptable).
   - `saveImageToCache(url, blob)`: cambiar `put(blob, url)` a `put({ url, blob })` (el keyPath 'url' requiere que el objeto tenga la propiedad 'url').
   - `getImageFromCache(url)`: el valor devuelto ahora es `{ url, blob }`, no el blob plano. Quien lo consume (`resolveImageUrl` en shared.js) debe acceder a `.blob`.

### FASE 5: T10e — BLOB URL MEMORY LEAK

**Archivo: `js/ui/shared.js`:**
   - Agregar al module level: `const _blobUrls = new Set();`
   - En `resolveImageUrl()`, después de `URL.createObjectURL(blob)`, hacer `_blobUrls.add(blobUrl)`.
   - Agregar función: `export function revokeBlobUrls() { _blobUrls.forEach(url => URL.revokeObjectURL(url)); _blobUrls.clear(); }`
   - En `closeModal()`: llamar `revokeBlobUrls()` ANTES de limpiar `overlay.innerHTML` para asegurar que ninguna imagen en DOM tenga blob URLs colgando. Mejor: limpiar overlay primero (innerHTML = ''), luego revocar.

### FASE 6: T10f — cacheImages EN PARALELO

**Archivo: `js/offline.js`:**
   - Reemplazar el `for (const note of notes) { for (const img of note.imagenes) { ... } }` con:
     ```js
     const allUrls = notes.flatMap(n => (n.imagenes || []).map(img => typeof img === 'string' ? img : img.url).filter(u => u && !u.startsWith('blob:')));
     // Procesar en batches de 5
     const batch = (arr, size) => { const result = []; for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size)); return result; };
     for (const urlBatch of batch(allUrls, 5)) {
       await Promise.all(urlBatch.map(async url => {
         try {
           const cached = await getImageFromCache(url);
           if (!cached) {
             const res = await fetch(url);
             if (res.ok) await saveImageToCache(url, await res.blob());
           }
         } catch(e) { /* individual image failure — ignore */ }
       }));
     }
     ```
   - La función sigue siendo fire-and-forget (no esperada por quien la llama).

### FASE 7: T10i — JSDOC TYPES

**Crear `js/types.js`:**
   ```js
   /**
    * @typedef {Object} Note
    * @property {number} id - int, SERIAL de Supabase
    * @property {string} numero - ej. '#0001'
    * @property {string} fecha - 'YYYY-MM-DD'
    * @property {string} destino - uno de CONFIG.locations
    * @property {Array<{nombre:string, cantidad:string}>} productos
    * @property {string} estatus - 'Nueva'|'En Proceso'|'Completada'|'Cancelada'
    * @property {string} observaciones
    * @property {Array} imagenes - strings (URL) u objetos {id, url, blob}
    * @property {boolean} tomada
    * @property {string|null} tomadaPor
    * @property {string|null} tomadaEn
    * @property {boolean} unreadNew
    * @property {boolean} unreadModified
    * @property {number} prioridad
    * @property {string} creadoPor
    * @property {string} creadoEn
    * @property {string|null} modificadoPor
    * @property {string|null} modificadoEn
    * @property {string} clienteNombre
    * @property {string} clienteDireccion
    * @property {string} clienteTelefono
    * @property {number} pastelCantidad
    * @property {number|null} pisos
    * @property {string} sabor
    * @property {string} kilos
    * @property {string} modelo
    * @property {string} texto
    * @property {string} colores
    * @property {string} horaEntrega
    * @property {string} horaPeriodo
    * @property {string} direccionEntrega
    * @property {number} costoPastel
    * @property {number} depositoEquipo
    * @property {number} arreglosFigura
    * @property {number} servicioDomicilio
    * @property {number} anticipo
    * @property {string} metodoPago
    */

   /**
    * @typedef {'admin'|'planta'|'sucursal'|'repartidor'} Role
    */

   /**
    * @typedef {Object} Session
    * @property {string} username
    * @property {Role} role
    * @property {string|null} destino
    * @property {string} email
    * @property {string|null} userId
    * @property {string} loginAt
    */

   /** @typedef {{nombre:string, cantidad:string}} Product */
   /** @typedef {{id:string, url:string, blob?:Blob, width?:number, height?:number, nombre?:string}} ImageRef */
   ```

**Agregar referencia en archivos JS que usan estos tipos:**
   - `js/store.js` — `/// <reference path="./types.js" />` (primera línea del archivo)
   - `js/auth.js` — `/// <reference path="./types.js" />`
   - `js/app.js` — `/// <reference path="./types.js" />`
   - `js/ui/shared.js` — `/// <reference path="../types.js" />`
   - `js/ui/dashboard.js` — `/// <reference path="../types.js" />`
   - `js/ui/detail.js` — `/// <reference path="../types.js" />`
   - `js/ui/form.js` — `/// <reference path="../types.js" />`

### FASE 8: T10j — SW VERSION SYNC

**Archivo: `sw.js`:**
   - Opción recomendada: leer versión de una variable global. En `index.html`, justo antes del `<script type="module">`, agregar:
     ```html
     <script>self.ENOTE_VERSION = '1.2.0';</script>
     ```
   - En `sw.js`, reemplazar `const CACHE_VERSION = 'enote-v1.0.0';` por:
     ```js
     const CACHE_VERSION = 'enote-' + (typeof self.ENOTE_VERSION !== 'undefined' ? self.ENOTE_VERSION : Date.now());
     ```
   - Si `ENOTE_VERSION` no está definida (SW standalone update), usa `Date.now()` para forzar cache miss.

### FASE 9: PAGINACIÓN (Semana 3, después de todo lo anterior)

**A. `js/store.js` — `getNotes()`:**
   - Modificar para aceptar `(page = 1, pageSize = 20)`.
   - Dentro, `const start = (page - 1) * pageSize; const end = start + pageSize - 1;`
   - Cambiar el select a: `supabase.from('notes').select('*', { count: 'exact' }).order('prioridad', { ascending: true }).range(start, end)`
   - Devolver `{ notes: data.map(mapDbNote), total: count }` en vez de solo `notes`.

   **PERO** esto cambia la firma de `getNotes()`. Alternativa más simple: mantener `getNotes()` sin cambios (traer todo) y paginar en cliente. Decisión tomada: paginación CLIENT-SIDE para mantener simplicidad. NO CAMBIAR `getNotes()`.

**B. `js/app.js`:**
   - En `applyFilters()`: después de obtener filteredNotes, computar slice:
     ```js
     const start = (currentPage - 1) * PAGE_SIZE;
     const pageNotes = filteredNotes.slice(start, start + PAGE_SIZE);
     const totalPages = Math.ceil(filteredNotes.length / PAGE_SIZE) || 1;
     ```
   - Pasar `{ notes: pageNotes, total: filteredNotes.length, page: currentPage, totalPages }` a `refreshGrid()` y la UI.
   - cuando los filtros cambian: `currentPage = 1`.
   - Handler para click en `.btn-prev-page`: `currentPage--; applyFilters();`
   - Handler para click en `.btn-next-page`: `currentPage++; applyFilters();`

**C. `js/ui/dashboard.js`:**
   - `refreshGrid()` recibe params adicionales: `(notes, session, total, page, totalPages)`.
   - Después del grid, renderizar:
     ```js
     if (totalPages > 1) {
       html += `<div class="pagination-bar">
         <span>Página ${page} de ${totalPages} (${total} notas)</span>
         <button class="btn btn-ghost btn-sm btn-prev-page" ${page <= 1 ? 'disabled' : ''}>← Anterior</button>
         <button class="btn btn-ghost btn-sm btn-next-page" ${page >= totalPages ? 'disabled' : ''}>Siguiente →</button>
       </div>`;
     }
     ```
   - Este bloque debe ser parte del HTML del dashboard, no un elemento aparte.

### FASE 10: CONFLICT DETECTION (Semana 5)

**A. `js/store.js` — `updateNote()`:**
   - Antes de construir `dbFields` y hacer el update, obtener la nota actual de Supabase:
     ```js
     const { data: current } = await supabase.from('notes').select('modificado_en').eq('id', id).single();
     ```
   - Comparar `current.modificado_en` con `fields._localModifiedEn` (el valor que el cliente leyó cuando cargó la nota).
     ```js
     const serverTime = new Date(current.modificado_en).getTime();
     const clientTime = fields._localModifiedEn ? new Date(fields._localModifiedEn).getTime() : 0;
     if (serverTime > clientTime) {
       // Conflicto
       const { data: fullNote } = await supabase.from('notes').select('*').eq('id', id).single();
       return { conflict: true, serverNote: fullNote };
     }
     ```

**B. `js/app.js` — `handleFormSubmit()`:**
   - Capturar el resultado de `updateNote()`.
   - Si `result.conflict`, llamar a `showConflictView(result.serverNote, fields)` en vez de proceder normal.
   - `showConflictView()`: renderiza modal con dos columnas (versión servidor vs tus cambios), con botones "Sobrescribir" (fuerza update con flag `_force: true`) y "Mantener servidor" (descarta cambios, recarga nota).

**C. `js/store.js` — `updateNote()` con force:**
   - Si `fields._force === true`, saltar la verificación de conflicto.

### FASE 11: VALIDACIÓN BACKEND (Semana 5)

**A. `js/store.js` — agregar función:**
   ```js
   function validateNoteFields(fields) {
     const errors = [];
     if (!fields.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fields.fecha)) errors.push('Fecha inválida (YYYY-MM-DD)');
     if (!fields.destino || !CONFIG.locations.includes(fields.destino)) errors.push(`Destino inválido. Debe ser: ${CONFIG.locations.join(', ')}`);
     if (!fields.productos || !Array.isArray(fields.productos) || fields.productos.length === 0) errors.push('Debe haber al menos un producto');
     if (fields.observaciones && fields.observaciones.length > 2000) errors.push('Observaciones demasiado largas (máx 2000 caracteres)');
     return errors;
   }
   ```
   - Llamar al inicio de `createNote()` y `updateNote()`. Si hay errores, `throw new Error(errors.join('\n'))`.

### FASE 12: DOCUMENTACIÓN FINAL

**A. `README.md`:**
   - Cambiar línea de versión: `"v1.2 — En producción (Supabase-only)"`
   - En "Quick Start": quitar credenciales demo. Agregar:
     ```bash
     node scripts/build-config.js
     npx serve .
     ```
   - Agregar sección "Environment Variables":
     ```
     | Variable | Descripción |
     |----------|-------------|
     | SUPABASE_URL | URL del proyecto Supabase |
     | SUPABASE_ANON_KEY | Anon key de Supabase |

     Local: crear .env en la raíz. Producción: configurar en Vercel.
     ```
   - Actualizar tabla de "Módulos JS": quitar referencias a "demo mode" en config.js, store.js, auth.js
   - Actualizar sección "Estructura de una Nota": `id` → "SERIAL auto-increment de Supabase"
   - Agregar sección "Tipos (JSDoc)" mencionando js/types.js

**B. `CLAUDE.md`:**
   - Estado actual: `"v1.2 en producción. Supabase-only (modo demo eliminado)."`
   - Comandos: quitar login demo. Agregar `node scripts/build-config.js`
   - Tabla de módulos: actualizar config.js (sin usuarios demo), store.js (solo Supabase), auth.js (solo Supabase)
   - Flujo de datos: `store.js (Supabase)`
   - Migración v1.2: marcar todos como completados, agregar items de hardening, paginación, conflict detection
   - Agregar patrones: paginación, conflict detection, validación

**C. `docs/SPRINT-PRODUCCION-V1.2.md`:**
   - Estado General: Semana 2 a 🟢 20/20, Semana 3 a 🟡 2/8, Semana 5 a 🟡 0/4
   - Registrar actualizaciones con fechas de este execution
   - Agregar Tarea 11-20 en Semana 2 (T10a-T10j)
   - Agregar Tarea 4 (paginación) y Tarea 5 (sync dedup) en Semana 3
   - Agregar Tarea 4 (conflict detection) y Tarea 5 (validación) en Semana 5

**D. `docs/ROADMAP-PRODUCCION-V1.2.md`:**
   - Sección 8 (timeline): agregar paginación a Semana 3, conflict detection a Semana 5
   - Sección 10 (riesgos): marcar "Sync conflicts" como mitigado
   - Sección 13 (estructura): agregar scripts/build-config.js, js/types.js

**E. Actualizar/crear `docs/AUDIT-V1.1.md`:**
   - Reporte de cierre de los 11 hallazgos de SECURITY-AUDIT-V1.0.md
   - 10 resueltos, 1 postergado (SEC-010 no crítico)
   - 0 nuevos hallazgos
   - Tabla de status por cada SEC

## VERIFICACIÓN POST-EJECUCIÓN

Después de aplicar todos los cambios, verificar:

- [ ] Login como admin@xiera.com → dashboard funcional
- [ ] Login como planta → solo su destino
- [ ] Login como sucursal → solo su destino
- [ ] Login como repartidor → vista repartidor
- [ ] Crear nota → aparece en Supabase Table Editor
- [ ] Editar nota en "En Proceso" → diff view
- [ ] Subir 3 imágenes → visibles en detalle
- [ ] Paginación → Anterior/Siguiente funcionan
- [ ] `cd audit && npm run audit` → PASS
- [ ] `node scripts/build-config.js` genera js/supabase.js correctamente

## ADVERTENCIAS CRÍTICAS

1. **NO tocar** `js/offline.js` más allá de DB_VERSION, keyPath y cacheImages paralelo. Dejar `createNoteOffline()` y `syncPendingNotes()` intactos.
2. **NO eliminar** `js/supabase.js` del repo hasta que `scripts/build-config.js` exista y funcione.
3. **NO cambiar** la firma de `getNotes()` (debe seguir retornando array de notas, no objeto con paginación). La paginación es 100% client-side.
4. **Número de nota**: La query `SELECT numero FROM notes ORDER BY numero DESC LIMIT 1` tiene race condition teórica (dos creates simultáneos pueden obtener el mismo número). Para el volumen de esta app es aceptable.
5. **Conflict detection**: solo aplica a ediciones vía formulario. El auto-transition de planta (Nueva→En Proceso) NO debe mostrar ConflictView — debe sobrescribir silenciosamente con flag `_force: true` interno.

## ENTREGABLES FINALES

Al terminar, el repo debe tener:
- `scripts/build-config.js` — nuevo
- `js/supabase.js.template` — nuevo  
- `js/types.js` — nuevo
- `docs/AUDIT-V1.1.md` — nuevo
- Todos los archivos existentes modificados según las especificaciones arriba
- `sandbox/` eliminado del tracking de git
- `.gitignore` actualizado
- Documentación actualizada (README.md, CLAUDE.md, SPRINT, ROADMAP)
