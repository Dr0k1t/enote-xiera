# PLAN DE HARDENING — Enote v1.2

**Versión:** 1.2
**Plan generado:** 16 de mayo de 2026
**Auditoría base:** graphify-out/GRAPH_REPORT.md, AUDIT-V1.1.md
**Objetivo:** Corregir bugs, eliminar modo demo, agregar paginación, mejorar integridad de datos, actualizar documentación.

---

## Decisiones Arquitectónicas

| Decisión | Resolución | Justificación |
|----------|-----------|---------------|
| Estructura del sprint | Integrar fixes en semanas existentes | No interrumpe el flujo de producción; Semana 2 absorbe cleanup, Semana 3 performance, Semana 5 integridad |
| Supabase env vars | Script Node.js de reemplazo simple | Sin build step; `npx serve .` sigue funcionando |
| Paginación | Prioritaria ahora | Prevenir problemas de performance a futuro |
| Modo demo | **Eliminar completamente** | Elimina de raíz SEC-002, SEC-003, SEC-006, SEC-007, SEC-008; simplifica ~40% del código |
| JSDoc types | Incluir como tarea | Sin TypeScript compiler; solo comentarios para autocompletado |
| sandbox/ | Eliminar del repo + .gitignore | Limpieza del repo de producción |
| Offline queue infra | **Mantener createNoteOffline/syncPendingNotes** | Infraestructura para futuro offline queue de sucursal, aunque actualmente no se usa |
| Generación de número de nota | **Query Supabase MAX(numero)** | Reemplazar getNextNumero() con SELECT MAX(numero) en createNote() |
| T10c statusClass | **Verificación, no fix** | `esc()` ya está aplicado en detail.js:66 — no requiere cambios |

---

## Semana 2 (May 18–23) — Security + Cleanup

### T10a — Eliminar modo demo completamente (⭐ crítica, ~4h)

**Archivos afectados:**

| Archivo | Cambio |
|---------|--------|
| `js/config.js` | Eliminar `CONFIG.users` (8 objetos con credenciales hardcodeadas). Mantener `CONFIG.roles` (siguen siendo usados por `canCreate()`, `canEdit()`, etc. en client-side como capa de UI). |
| `js/auth.js` | Eliminar `isDemoMode()`, `loginDemo()`, `enableDemoMode()`, `disableDemoMode()`. `DEMO_MODE_KEY` ya no existe. `login()` ahora siempre llama `loginSupabase()` directamente. `loginSupabase()` se renombra a `login()`. |
| `js/store.js` | Eliminar TODAS las ramas `if (isDemoMode())` / `if (!isDemoMode())`. Eliminar `getLocalNotes()`, `setLocalNotes()`, `seedDemoNotes()`, `_counter`, `getNextNumero()`, `delay()`, `moveNoteUp()`, `moveNoteDown()`. `getNotes()` siempre hace `supabase.from('notes').select('*')`. `createNote()` siempre hace Supabase insert. `updateNote()` siempre hace Supabase update. `deleteNote()` siempre hace Supabase delete. El ID de nota ahora lo genera Supabase (SERIAL), no `Date.now()` — `createNote()` debe devolver el `data` con el ID real. |
| `js/app.js` | Eliminar import de `seedDemoNotes()` y su llamada en `init()`. Eliminar import de `isDemoMode()` (ya no existe). Eliminar `moveNoteUp()` y `moveNoteDown()` y los handlers de botones de prioridad en `handleDashboardClick()`. |
| `js/ui/login.js` | Eliminar la variable `demoMode` y el bloque del badge "Modo demo local". El campo siempre es `type="email"`, label siempre "Email". El formulario se simplifica. |
| `js/supabase.js` | Eliminar las líneas con URL y anon key hardcodeadas. El script `build-config.js` generará este archivo. |
| `js/offline.js` | **Mantener** `createNoteOffline()` y `syncPendingNotes()` como infraestructura futura. No se eliminan ni modifican — forman la base para cola offline de sucursal. |

**Nuevos imports/export:**
- `auth.js` exporta solo: `login`, `logout`, `getSession`, `setSession`, `clearSession`, `requireAuth`, `canCreate`, `canEdit`, `canDelete`, `canSeeAll`, `getCurrentUser`, `onAuthStateChange`
- `store.js` exporta solo: `getNotes`, `getNote`, `createNote`, `updateNote`, `deleteNote`, `toggleTomada`
- `app.js` limpia referencia a `isDemoMode`, `seedDemoNotes`, `moveNoteUp`, `moveNoteDown`

**Esquema de número de nota (usando MAX(numero) query):**
```
createNote() → SELECT numero FROM notes ORDER BY numero DESC LIMIT 1
             → extraer el número, incrementar, formatear como '#000N'
             → supabase.insert([...numero...]).select().single()
```
El frontend sigue generando `numero` antes del insert, consultando el máximo actual en Supabase. Esto reemplaza `getNextNumero()` que antes leía de localStorage.

**Riesgos:**
- Si se elimina `moveNoteUp/moveNoteDown`, los botones de prioridad en el dashboard (solo visibles para rol planta) deben desaparecer o deshabilitarse.
- `syncPendingNotes()` se mantiene como infraestructura; el listener `online` en `app.js` sigue llamándola, pero actualmente nunca encuentra items en la cola (sin efecto).
- `cacheImages()` en offline.js sigue siendo necesaria para caché offline de imágenes (planta).

**Dependencias:** T10a requiere que T10b (env vars script) esté listo para probar, a menos que se use el modo demo forzado con localStorage para pruebas locales (pero eso contradice la eliminación del demo). **Solución:** mantener temporalmente un flag `ENOTE_DEV_MODE` que permite usar localStorage para desarrollo local, pero no es "demo mode" — es un flag técnico.

---

### T10b — Script de reemplazo de env vars (~2h)

**Archivos afectados:** `scripts/build-config.js` (nuevo), `js/supabase.js` (template)

**Comportamiento del script:**
```
scripts/build-config.js
  → Lee SUPABASE_URL y SUPABASE_ANON_KEY de:
     1. process.env (Vercel injecta estas automáticamente)
     2. .env file (local dev, si existe)
     3. Default values (opcional, para desarrollo)
  → Escribe js/supabase.js con los valores inyectados
  → Se ejecuta con: node scripts/build-config.js
  → Se integra en: "vercel-build": "node scripts/build-config.js" (package.json)
```

**Template de supabase.js (lo que el script genera):**
```js
// GENERATED by scripts/build-config.js — DO NOT EDIT
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = '{{SUPABASE_URL}}';
const SUPABASE_ANON_KEY = '{{SUPABASE_ANON_KEY}}';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function isSupabaseConfigured() {
  return true;  // Siempre true ahora
}

export async function uploadImage(blob, fileName) {
  const { data, error } = await supabase.storage
    .from('imagenes')
    .upload(fileName, blob, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data: publicData } = supabase.storage.from('imagenes').getPublicUrl(data.path);
  return publicData.publicUrl;
}
```

**Nota:** `isSupabaseConfigured()` ahora siempre retorna `true` porque sin Supabase la app no funciona. La condición `!SUPABASE_URL || !SUPABASE_ANON_KEY` ya no aplica.

**El script debe:**
1. Leer `SUPABASE_URL` del entorno, si no existe leer de `.env` (si existe)
2. Leer `SUPABASE_ANON_KEY` del entorno, si no existe leer de `.env` (si existe)
3. Si ninguno existe, usar defaults de desarrollo (opcional — warning en consola)
4. Leer `js/supabase.js.template` (o el template hardcodeado en el script)
5. Reemplazar `{{SUPABASE_URL}}` y `{{SUPABASE_ANON_KEY}}`
6. Escribir `js/supabase.js`

**Riesgos:** El template debe mantenerse sincronizado con el código de uploadImage. Si se agregan funciones a supabase.js, hay que actualizar el template.

---

### T10c — Fix XSS residual detail.js (F1) — VERIFICACIÓN (~0.1h)

**Archivo:** `js/ui/detail.js`

**Estado:** ✅ **YA CORREGIDO.** El agente de análisis confirmó que `esc()` está presente en la línea 66 de `detail.js`:

```js
<span class="badge badge--${esc(note.estatus.toLowerCase().replace(/\s+/g, '-'))}">
```

El `esc()` convierte `"` a `&quot;`, previniendo attribute injection en el `class`. SEC-004 está completamente resuelto.

**Acción:** No hay cambios de código necesarios. Solo verificación.

---

### T10d — Fix IMAGE_CACHE keyPath + DB upgrade (F2) (~0.5h)

**Archivo:** `js/offline.js`

**Estado actual:**
```js
const DB_VERSION = 2;
...
if (!database.objectStoreNames.contains(STORES.IMAGE_CACHE)) {
  database.createObjectStore(STORES.IMAGE_CACHE);  // Sin keyPath
}
```

**Fix:**
```js
const DB_VERSION = 3;
...
if (!database.objectStoreNames.contains(STORES.IMAGE_CACHE)) {
  database.createObjectStore(STORES.IMAGE_CACHE, { keyPath: 'url' });
}
// Migración v2 → v3: crear IMAGE_CACHE con keyPath si no existe
if (e.oldVersion < 3) {
  if (!database.objectStoreNames.contains(STORES.IMAGE_CACHE)) {
    database.createObjectStore(STORES.IMAGE_CACHE, { keyPath: 'url' });
  }
}
```

**Consideraciones de migración:** IndexedDB version upgrade es non-destructive. Los datos existentes en `NOTES_CACHE` y `PENDING_QUEUE` no se pierden. IMAGE_CACHE se crea vacío con la nueva estructura.

**Riesgos:** Si hay datos existentes en IMAGE_CACHE (v2, sin keyPath), la migración a v3 crea un nuevo store vacío. Los datos viejos quedan huérfanos pero no causan error — `getImageFromCache()` busca en el nuevo store. Esto significa que **la caché de imágenes existente se pierde en la migración**. Aceptable porque es caché, no datos críticos.

---

### T10e — Fix Blob URL memory leak (F3) (~0.75h)

**Archivo:** `js/ui/shared.js`

**Estado actual:**
```js
export async function resolveImageUrl(url) {
  ...
  const blob = await getImageFromCache(url);
  if (blob) {
    return URL.createObjectURL(blob);  // Creada pero nunca revocada
  }
  return url;
}
```

**Fix propuesto:**
```js
const _createdBlobUrls = new Set();

export async function resolveImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  try {
    const blob = await getImageFromCache(url);
    if (blob) {
      const blobUrl = URL.createObjectURL(blob);
      _createdBlobUrls.add(blobUrl);
      return blobUrl;
    }
  } catch (err) { ... }
  return url;
}

export function revokeBlobUrls() {
  _createdBlobUrls.forEach(url => URL.revokeObjectURL(url));
  _createdBlobUrls.clear();
}
```

**Llamar `revokeBlobUrls()` en:**
- `closeModal()` en shared.js — cuando se cierra el formulario o diff view
- Cuando se desmonta `view-detail` (en `handleDetailClick` con `.btn-volver`)

**Riesgos:** Si una blob URL está siendo usada por un `<img>` en el DOM y se revoca, la imagen desaparece. Asegurar que `revokeBlobUrls()` se llame **después** de que el DOM se haya limpiado (no antes).

---

### T10f — cacheImages en paralelo (F4) (~1h)

**Archivo:** `js/offline.js`

**Estado actual (secuencial):**
```js
for (const note of notes) {
  for (const img of note.imagenes) {
    if (!cached) {
      const res = await fetch(url);
      const blob = await res.blob();
      await saveImageToCache(url, blob);
    }
  }
}
```

**Fix:** Paralelizar descargas con `Promise.all`:
```js
const promises = notes.flatMap(note =>
  (note.imagenes || [])
    .filter(img => {
      const url = typeof img === 'string' ? img : img.url;
      return url && !url.startsWith('blob:');
    })
    .map(async img => {
      const url = typeof img === 'string' ? img : img.url;
      const cached = await getImageFromCache(url);
      if (!cached) {
        const res = await fetch(url);
        if (res.ok) {
          await saveImageToCache(url, await res.blob());
        }
      }
    })
);
await Promise.all(promises);
```

**Riesgos:** Con muchas imágenes, `Promise.all` sobrecarga el navegador con N requests simultáneas. Considerar un límite de concurrencia:
```js
async function* batch(arr, size = 6) {
  for (let i = 0; i < arr.length; i += size) {
    yield arr.slice(i, i + size);
  }
}
```
Batch de 6 requests simultáneas. Suficiente para la mayoría de conexiones y no satura al navegador.

---

### T10g — Eliminar sandbox/ + .gitignore (F13) (~0.25h)

**Comandos:**
```bash
git rm -r sandbox/
# .gitignore: agregar 'sandbox/' si no existe
```

**Archivos en sandbox/ (después de eliminar):**
- `sandbox/image-compress.js` — pruebas de compresión
- `sandbox/run-test.js` — test runner
- `sandbox/server.js` — servidor de pruebas
- `sandbox/index.html` — HTML de pruebas
- Imágenes de prueba (.png, .jpg, .jpeg)

**Acción:** Eliminar del repo y del disco (git rm). Agregar `sandbox/` al `.gitignore`.

---

### T10h — Eliminar código muerto: noteNumberFormat (F12) (~0.1h)

**Archivo:** `js/config.js`

**Línea actual:**
```js
noteNumberFormat: (id) => `#${String(id).padStart(4, '0')}`,
```

**Análisis:** Esta función no es importada ni referenciada por ningún módulo. Es código muerto. El formateo real se hace en `getNextNumero()` en store.js con la misma lógica inline.

**Acción:** Eliminar la propiedad `noteNumberFormat` del objeto `CONFIG`.

**Riesgo:** Cero. No hay referencias a esta propiedad en ningún archivo del proyecto.

---

### T10i — JSDoc types (types.js) (~1.5h)

**Archivo nuevo:** `js/types.js`

**Propósito:** Definir las estructuras de datos compartidas como JSDoc `@typedef` para autocompletado en VS Code y otros IDEs.

**Tipos a documentar:**

```js
/**
 * @typedef {Object} Note
 * @property {number} id - Supabase SERIAL id (antes: Date.now())
 * @property {string} numero - '#0001'
 * @property {string} fecha - 'YYYY-MM-DD'
 * @property {string} destino - Una de CONFIG.locations
 * @property {Array<{nombre:string, cantidad:string}>} productos
 * @property {string} estatus - 'Nueva'|'En Proceso'|'Completada'|'Cancelada'
 * @property {string} observaciones
 * @property {Array<string|{id:string, url:string}>} imagenes
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
 * @property {string} horaPeriodo - 'AM'|'PM'
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

/**
 * @typedef {Object} Product
 * @property {string} nombre
 * @property {string} cantidad
 */

/**
 * @typedef {Object} ImageRef
 * @property {string} id - crypto.randomUUID()
 * @property {string} url - Supabase public URL o demo:// URL
 * @property {number} [width]
 * @property {number} [height]
 * @property {string} [nombre]
 */

/**
 * @typedef {Object} DiffChange
 * @property {string} field
 * @property {string} label
 * @property {string} old
 * @property {string} new
 */
```

**Archivos que referencian types.js:**
- `js/store.js`: `/// <reference path="./types.js" />`
- `js/auth.js`: `/// <reference path="./types.js" />`
- `js/app.js`: `/// <reference path="./types.js" />`
- `js/config.js`: `/// <reference path="./types.js" />`
- `js/ui/shared.js`: `/// <reference path="../types.js" />`

**Nota:** Las referencias `/// <reference path="..." />` son puramente para el IDE. No afectan el runtime.

---

### T10j — SW cache version sync (F14) (~0.5h)

**Archivo:** `sw.js`

**Estado actual:**
```js
const CACHE_VERSION = 'enote-v1.0.0';
```

**Propuesta 1 (recomendada):** Leer versión desde una variable global definida en el HTML o en un script inline:
```js
// En index.html, antes del module script:
// <script>self.ENOTE_APP_VERSION = '1.2.0';</script>

// En sw.js:
const CACHE_VERSION = 'enote-' + (self.ENOTE_APP_VERSION || '1.0.0');
```

**Propuesta 2 (alternativa):** Definir un archivo `version.js` con la versión actual y cachearlo:
```js
// js/version.js
export const APP_VERSION = '1.2.0';
```

**Riesgos:** Cambiar la versión del SW invalida la caché completa. Los usuarios existentes descargan todos los assets de nuevo. Esto es deseable en cada deploy.

---

## Semana 3 (May 25–30) — Performance + Reliability

### Paginación en dashboard (F6) (~6h)

**Archivos afectados:**

| Archivo | Cambio |
|---------|--------|
| `js/store.js` | `getNotes()` acepta `{ page, pageSize }`. Llama `supabase.from('notes').select('*', { count: 'exact' }).range(start, end).order(...)`. Devuelve `{ notes, total }`. |
| `js/ui/dashboard.js` | `renderDashboardView()` recibe `total` y renderiza controles de paginación. `refreshGrid()` actualiza solo la página actual. |
| `js/app.js` | Mantiene `currentPage` en el estado global. `applyFilters()` respeta la página actual. Los filtros reset a page 1. |

**Detalles de implementación:**

**store.js — getNotes con paginación:**
```js
export async function getNotes(page = 1, pageSize = 20) {
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;
  
  const { data, error, count } = await supabase
    .from('notes')
    .select('*', { count: 'exact' })
    .order('prioridad', { ascending: true })
    .order('creado_en', { ascending: false })
    .range(start, end);
  
  if (error) throw error;
  
  // Seguir cacheando imágenes en segundo plano
  cacheImages(data || []);
  
  return { notes: (data || []).map(mapDbNote), total: count || 0 };
}
```

**dashboard.js — Controles de paginación:**
```
<div class="pagination">
  <span class="pagination-info">Página ${page} de ${totalPages} (${total} notas)</span>
  <button class="btn-prev" ${page === 1 ? 'disabled' : ''}>← Anterior</button>
  <button class="btn-next" ${page === totalPages ? 'disabled' : ''}>Siguiente →</button>
</div>
```

**app.js — Estado de paginación:**
```js
let currentPage = 1;
const PAGE_SIZE = 20;

async function applyFilters() {
  const { notes, total } = await getFilteredNotes(currentPage, PAGE_SIZE);
  refreshGrid(notes, currentSession, total, currentPage, PAGE_SIZE);
}
```

**Manejo de filtros:**
- Cuando el usuario cambia un filtro (estatus, destino, búsqueda), reset a `page = 1`
- El botón "Nueva nota" no afecta la paginación
- Después de crear/editar una nota, volver a la página 1 (o a la página donde estaba la nota)

**Riesgos:**
- El conteo exacto (`count: 'exact'`) tiene overhead en PostgreSQL. Para tablas pequeñas (<10K rows) es despreciable.
- Los filtros de búsqueda (texto) se aplican en Supabase query o en cliente? **Decisión:** mantener el filtro de texto en cliente por ahora (porque usa `.includes()` sobre múltiples campos que no son triviales en SQL). La paginación se aplica sobre el resultado filtrado.

**Flujo con filtros + paginación:**
1. `getBaseNotes()` trae notas con `.range()` para la página actual (sin filtros)
2. Si hay filtros activos (estatus, destino, búsqueda), se necesita decidir: ¿paginación server-side o client-side?

**Decisión crítica sobre filtros:** Si los filtros son pocos (<200 notas), paginación client-side (traer todo y paginar en cliente) es más simple. Si >200 notas, paginación server-side (cada filtro cambia la query de Supabase).

**Recomendación:** Paginación client-side por ahora (traer notas SIN límite, paginar en JS). Cuando haya >200 notas, migrar a server-side. Esto simplifica la implementación y evita cambios en la lógica de filtros.

**Corrección de la propuesta:** Teniendo en cuenta el timeline, implementar paginación CLIENT-SIDE:
```js
// store.js: getNotes() trae todo (sin cambios en la firma)
// app.js: currentPage es estado local
// dashboard.js: renderNotesGridSlice() recorta notes según currentPage

function paginateNotes(notes, page, pageSize) {
  const start = (page - 1) * pageSize;
  return notes.slice(start, start + pageSize);
}
```
Esto requiere cambiar solo `app.js` y `dashboard.js`, sin tocar `store.js`.

---

### syncPendingNotes con dedup (F10) (~2h)

**Archivo:** `js/offline.js`

**Problema:** `syncPendingNotes()` no detecta duplicados. Si la sync falla parcialmente (3 notas en cola, 2 OK, 1 falla), al reintentar las 3, las 2 primeras se crean duplicadas.

**Fix - Agregar campo `noteContentHash` a la cola:**
```js
// En createNoteOffline():
async function createNoteOffline(noteData) {
  const contentHash = await computeHash(noteData);
  await dbAdd(STORES.PENDING_QUEUE, {
    ...noteData,
    noteContentHash: contentHash,
    synced: false,
    createdAt: new Date().toISOString()
  });
}

// En syncPendingNotes():
async function syncPendingNotes(createNoteFn) {
  const pending = await getPendingNotes();
  for (const item of pending) {
    if (await noteExistsInSupabase(item.noteContentHash)) {
      await deletePendingNote(item.localId);
      continue;  // Ya se creó, solo limpiar cola
    }
    // ... existing retry logic ...
  }
}
```

**Implementación de `computeHash()`:**
```js
async function computeHash(noteData) {
  const relevant = { fecha: noteData.fecha, destino: noteData.destino, productos: noteData.productos, observaciones: noteData.observaciones };
  const encoded = new TextEncoder().encode(JSON.stringify(relevant));
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

**Riesgos:**
- `crypto.subtle.digest` no está disponible en HTTP (requiere HTTPS). En localhost funciona en Chrome/Firefox.
- Si la nota fue creada exactamente igual por dos usuarios distintos (misma fecha, mismo destino, mismos productos), el hash coincide y una nota se descarta. Esto es un edge case muy improbable pero **diseñado**: si dos usuarios crean la misma nota exacta, probablemente es un duplicado accidental.

---

## Semana 5 (Jun 8–13) — Data Integrity (Buffer)

### Last-write-wins con conflict detection (F11) (~4h)

**Archivo:** `js/store.js`, `js/app.js`

**Problema:** Cuando dos usuarios (ej: admin y sucursal) editan la misma nota simultáneamente, la última escritura gana sin notificación. Datos perdidos silenciosamente.

**Fix - Comparar `modificadoEn` antes de update:**
```js
export async function updateNote(id, fields, session) {
  // 1. Leer estado actual de la BD
  const { data: current } = await supabase
    .from('notes')
    .select('modificado_en')
    .eq('id', id)
    .single();
  
  // 2. Comparar timestamps
  const currentModified = new Date(current.modificado_en).getTime();
  const localModified = fields._localModifiedEn 
    ? new Date(fields._localModifiedEn).getTime() 
    : 0;
  
  if (currentModified > localModified) {
    // Conflicto: la BD tiene cambios más recientes
    throw new ConflictError(id, 'La nota fue modificada por otro usuario');
  }
  
  // 3. Si no hay conflicto, proceder con el update
  // ... existing update logic ...
}
```

**Nota:** El frontend debe enviar `_localModifiedEn` con cada update para que el servidor pueda comparar. Esto se obtiene de `note.modificadoEn` cuando se carga la nota en `showForm()`.

**app.js — Manejo del conflicto:**
```js
try {
  await updateNote(noteId, fields, currentSession);
} catch (err) {
  if (err instanceof ConflictError) {
    // Mostrar diff view forzada
    const currentNote = await getNote(noteId);
    openModal(renderConflictView(fields, currentNote));
    return;
  }
  throw err;
}
```

**ConflictView UI:**
```
┌────────────────────────────────────────────┐
│  ⚠ Conflicto de edición                    │
│                                            │
│  Esta nota fue modificada por otro usuario │
│  mientras la editabas.                     │
│                                            │
│  ┌──────────────┐ ┌─────────────────────┐  │
│  │ TUS CAMBIOS  │ │ CAMBIOS DEL SERVIDOR │ │
│  │ ...          │ │ ...                  │ │
│  └──────────────┘ └─────────────────────┘  │
│                                            │
│  [Sobrescribir] [Recargar y perder mis cambios] │
└────────────────────────────────────────────┘
```

---

### Validación backend-side en store.js (~2h)

**Archivo:** `js/store.js`

**Validaciones a agregar en `createNote()` y `updateNote()`:**

```js
function validateNoteFields(fields) {
  const errors = [];
  if (!fields.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fields.fecha)) {
    errors.push('Fecha inválida');
  }
  if (!fields.destino || !CONFIG.locations.includes(fields.destino)) {
    errors.push('Destino inválido');
  }
  if (!fields.productos || fields.productos.length === 0) {
    errors.push('Debe haber al menos un producto');
  }
  if (fields.observaciones && fields.observaciones.length > 2000) {
    errors.push('Observaciones demasiado largas (máx 2000 caracteres)');
  }
  return errors;
}
```

Llamar `validateNoteFields(fields)` al inicio de `createNote()` y `updateNote()`. Si hay errores, lanzar error con mensaje completo.

---

## Documentación Final (después de aplicar todo)

### README.md (~1.5h)

**Cambios:**

1. **Quick Start** — Remover login demo. Dejar solo login real.
   ```
   # Desarrollo local
   npx serve .
   
   # Login real (Supabase)
   admin@xiera.com / tu-contraseña
   
   # Tests E2E
   cd audit && npm install && npm run audit
   ```

2. **Sección modo demo** — Eliminar completamente.

3. **Variables de entorno** — Nueva sección:
   ```md
   ## Configuración
   
   El proyecto requiere dos variables de entorno:
   - `SUPABASE_URL` — URL del proyecto Supabase
   - `SUPABASE_ANON_KEY` — Anon key de Supabase
   
   ### Desarrollo local
   Crear archivo `.env` en la raíz:
   ```
   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_ANON_KEY=tu-anon-key
   ```
   Ejecutar: `node scripts/build-config.js` antes de `npx serve .`
   
   ### Vercel (producción)
   Las variables se configuran en Vercel Dashboard → Settings → Environment Variables.
   ```

4. **Estructura de Nota** — Actualizar el campo `id` a SERIAL (int, no Date.now()).

5. **Roles y Permisos** — Sin cambios (sigue siendo igual).

6. **Agregar sección de tipos JSDoc**:
   ```md
   ## Tipos (JSDoc)
   
   Las estructuras de datos están documentadas con JSDoc en `js/types.js`.
   Los archivos `.js` del proyecto usan `/// <reference path="./types.js" />`
   para autocompletado en VS Code.
   ```

---

### CLAUDE.md (~1h)

**Secciones a modificar:**

1. `## Proyecto` — Cambiar "v1.2 en producción. Supabase configurado y live. Modo demo local disponible en paralelo" a:
   "**Estado actual:** v1.2 en producción. Supabase-only (modo demo eliminado)."

2. `## Comandos` — Remover login demo. Simplificar a:
   ```bash
   # Desarrollo local
   npx serve .
   
   # Tests E2E (Playwright)
   cd audit && npm install && npm run audit
   
   # Login real: admin@xiera.com / contraseña
   ```

3. `## Módulos JS` — Actualizar tabla:
   - `config.js`: "Constantes: roles, estatus válidos, destinos." (sin CONFIG.users)
   - `store.js`: "CRUD sobre Supabase. Sin modo demo."
   - `auth.js`: "Login/logout solo Supabase Auth. Demo eliminado."
   - Eliminar párrafo sobre `isDemoMode()`

4. `## Estructura de una Nota` — Actualizar field `id` (SERIAL int).

5. `## Migración v1.2` — Marcar todos como ✅:
   ```md
   - ✅ `sw.js` — Service Worker cache-first
   - ✅ `manifest.json` — PWA instalable
   - ✅ `js/supabase.js` — cliente Supabase configurado
   - ✅ `js/auth.js` — login/logout async con Supabase Auth
   - ✅ `js/store.js` — CRUD async con Supabase
   - ✅ `js/offline.js` — IndexedDB cache + cola
   - ✅ Indicador online/offline en UI
   - ✅ Script env vars (`scripts/build-config.js`)
   - ✅ JSDoc types (`js/types.js`)
   - ✅ Hardening: XSS, Blob leak, IndexedDB keyPath, SW version
   - ✅ Paginación en dashboard
   - ✅ Conflict detection en edición simultánea
   ```

6. Agregar nota sobre build-config:
   ```md
   ### Build
   Antes del deploy: `node scripts/build-config.js`
   ```

---

### SPRINT-PRODUCCION-V1.2.md (~1h)

- T10a–T10j marcar como completados
- Agregar tareas de paginación y conflict detection en Semanas 3 y 5
- Agregar registro de actualización:
  ```
  | 2026-05-16 | [nombre] | Plan de Hardening generado y documentado |
  | 2026-05-16 | [nombre] | Semana 2 T10a–T10j: Cleanup + Security completados |
  | 2026-05-xx | [nombre] | Semana 3: Paginación + Sync dedup completados |
  | 2026-05-xx | [nombre] | Semana 5: Conflict detection + Validación completados |
  ```

---

### ROADMAP-PRODUCCION-V1.2.md (~0.5h)

- Sección 5 (offline): reflejar que demo mode no existe
- Sección 8 (timeline): agregar paginación a Semana 3, conflict detection a Semana 5
- Sección 10 (riesgos): agregar conflict resolution como mitigado

---

### AUDIT-V1.1.md — Crear reporte final (~1h)

Documentar:
- Resolución de SEC-001 a SEC-011
- SEC-001: ✅ Corregido (localStorage, no sessionStorage)
- SEC-002: ✅ Resuelto estructuralmente (demo mode eliminado)
- SEC-003: ✅ Resuelto arquitectónicamente (sin demo mode, RLS en producción)
- SEC-004: ✅ Corregido (esc() en statusClass en dashboard.js)
- SEC-005: ✅ Corregido (esc() incluye comillas simples)
- SEC-006: ✅ Partialmente resuelto (validación en store.js)
- SEC-007: ✅ Resuelto (demo eliminated, Supabase Auth maneja TTL)
- SEC-008: ✅ Resuelto (demo eliminated, Supabase Auth tiene rate limiting)
- SEC-009: ✅ Verificado (parseInt con NaN check)
- SEC-010: ⚠️ No crítico, postergado
- SEC-011: ✅ Resuelto (datos en PostgreSQL, no localStorage)

---

## Estimación Total de Esfuerzo

| Semana | Tareas | Horas |
|--------|--------|-------|
| 2 (adicional) | T10a–T10j (10 tareas) | ~10.85h |
| 3 (adicional) | Paginación + Sync dedup | ~8h |
| 5 (buffer) | Conflict detection + Validación | ~6h |
| Post-implementación | Documentación (5 archivos) | ~5h |
| **Total** | | **~29.85h** |

---

## Orden de Ejecución Recomendado

```
Step 1: T10b (env vars script) → permite que el resto funcione sin creds hardcodeadas
Step 2: T10a (demo removal) → cambia store.js, auth.js, app.js, config.js
Step 3: T10c–T10j (en paralelo, no dependen entre sí)
  ├── T10c: XSS fix detail.js
  ├── T10d: IndexedDB keyPath
  ├── T10e: Blob URL leak
  ├── T10f: cacheImages parallel
  ├── T10g: sandbox removal
  ├── T10h: dead code
  ├── T10i: JSDoc types
  └── T10j: SW version sync
Step 4: Verificación T10 (probar que todo funcione integrado)
Step 5: Paginación (Semana 3)
Step 6: Sync dedup (Semana 3)
Step 7: Conflict detection + Validación (Semana 5)
Step 8: Documentación final
```

---

## Verificación Post-Fixes

Checklist de verificación después de cada fase:

- [ ] Login como admin@xiera.com → dashboard con todas las notas
- [ ] Login como planta → solo notas de su destino
- [ ] Login como sucursal → solo notas de su destino
- [ ] Login como repartidor → vista repartidor funcional
- [ ] Crear nota nueva → aparece en Supabase Table Editor
- [ ] Editar nota en "Nueva" → sin confirmación
- [ ] Editar nota en "En Proceso" → diff view aparece
- [ ] Eliminar nota → confirmación → eliminada
- [ ] Subir 3 imágenes en una nota → se ven en detalle
- [ ] Modo offline → planta ve notas cacheadas
- [ ] Modo offline → mensaje "Sin conexión" visible
- [ ] Paginación → botones Anterior/Siguiente funcionan
- [ ] Sync concurrente → dos usuarios editando → aparece diff de conflicto
- [ ] `cd audit && npm run audit` → PASS

---

*Fin del plan. Este documento es la especificación de implementación.*
