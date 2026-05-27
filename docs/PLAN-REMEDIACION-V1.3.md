# Plan de Remediación v1.3 — Enote

> **Versión:** 1.3
> **Fecha:** 2026-05-26
> **Alcance:** Corrección de ~120 hallazgos de auditoría completa (8 categorías)
> **Input:** Auditoría completa 2026-05-26 (ver `docs/INFORME-AUDITORIA-V1.3.md`)

---

## Índice

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Fase 1 — Bugs Críticos (Code)](#2-fase-1--bugs-críticos-code)
3. [Fase 2 — Seguridad](#3-fase-2--seguridad)
4. [Fase 3 — Offline e IndexedDB](#4-fase-3--offline-e-indexeddb)
5. [Fase 4 — PWA y Service Worker](#5-fase-4--pwa-y-service-worker)
6. [Fase 5 — CSS y Accesibilidad](#6-fase-5--css-y-accesibilidad)
7. [Fase 6 — Error Handling y Logging](#7-fase-6--error-handling-y-logging)
8. [Fase 7 — Configuración y Deploy](#8-fase-7--configuración-y-deploy)
9. [Fase 8 — Tests y Cobertura](#9-fase-8--tests-y-cobertura)
10. [Calendario Estimado](#10-calendario-estimado)

---

## 1. Resumen Ejecutivo

### 1.1 Distribución de hallazgos

| Categoría | HIGH | MEDIUM | LOW | TOTAL |
|-----------|------|--------|-----|-------|
| JS Modules & Logic | 7 | 10 | 10 | 27 |
| CSS & Design System | 8 | 9 | 13 | 30 |
| PWA & Service Worker | 4 | 7 | 10 | 21 |
| Seguridad & RBAC | 5 | 11 | 6 | 22 |
| Tests & E2E | 5 | 10 | 21 | 36 |
| Docs & Configuración | 7 | 9 | 14 | 30 |
| Offline & IndexedDB | 6 | 8 | 10 | 24 |
| Error Handling & Logging | 9 | 14 | 16 | 39 |

**Total: ~51 HIGH, ~78 MEDIUM, ~100 LOW** (con solapamiento entre categorías).

### 1.2 Top 5 — Más Urgentes

| # | Severidad | Issue | Archivo |
|---|-----------|-------|---------|
| 1 | CRÍTICO | Anon key en git history — rotar key en Supabase | `js/supabase.js:6` |
| 2 | CRÍTICO | Sin handlers globales de error — ~70% errores perdidos | todos |
| 3 | ALTO | TypeError crash para planta al limpiar filtros | `js/app.js:337-339` |
| 4 | ALTO | Detección de conflictos rota — no verifica error | `js/store.js:210-216` |
| 5 | ALTO | Memory leak — blob URLs nunca revocados | `js/imageUtils.js:50,60` `js/app.js:717` |

### 1.3 Estrategia

Las fases se ordenan por impacto en el usuario final. Cada issue tiene:
- **Problema:** descripción precisa
- **Archivo:Línea:** localización exacta
- **Causa raíz:** por qué ocurre
- **Fix:** código o configuración concreta

---

## 2. Fase 1 — Bugs Críticos (Code)

### F1.1 — TypeError crash al limpiar filtros (planta)

**Problema:** Para rol `planta` (que tiene `canSeeAll: false`), el filtro `.filter-destino` nunca se renderiza. Al hacer clic en "Limpiar filtros", se intenta acceder a `.value` de un elemento `null` → crash.

**Archivo:** `js/app.js:337-339`
**Causa raíz:** Acceso directo a `document.querySelector('.filter-destino').value` sin null guard.
**Fix:**
```js
// js/app.js:337-339 — antes:
document.querySelector('.filter-search').value  = '';
document.querySelector('.filter-estatus').value = '';
document.querySelector('.filter-destino').value = '';

// después:
const s = document.querySelector('.filter-search');
if (s) s.value = '';
const est = document.querySelector('.filter-estatus');
if (est) est.value = '';
const dest = document.querySelector('.filter-destino');
if (dest) dest.value = '';
```

### F1.2 — Detección de conflictos rota

**Problema:** En `updateNote()`, el query de `modificado_en` no destructurea `error`. Si el query falla, `current` es `undefined`, el `if` se salta, y el update procede sin detección de conflictos — sobrescritura silenciosa.

**Archivo:** `js/store.js:210-216`
**Causa raíz:** `{ data: current }` no incluye `error`.
**Fix:**
```js
// js/store.js:211-215 — antes:
const { data: current } = await supabase
  .from('notes')
  .select('modificado_en')
  .eq('id', id)
  .single();
if (current?.modificado_en) {

// después:
const { data: current, error: conflictErr } = await supabase
  .from('notes')
  .select('modificado_en')
  .eq('id', id)
  .single();
if (conflictErr) {
  console.warn('Conflict check failed:', conflictErr);
  // En caso de error, abortar con advertencia en vez de sobrescribir
  throw new Error('No se pudo verificar si la nota fue modificada. Intenta de nuevo.');
}
if (current?.modificado_en) {
```

### F1.3 — Memory leak: blob URLs de compressImage nunca revocados

**Problema:** `compressImage()` crea blob URLs (líneas 50 y 60) que nunca se agregan al `_blobUrls` Set ni se revocan. Cada nota con imágenes produce leaks.

**Archivos:** `js/imageUtils.js:50,60` + `js/ui/shared.js:6`
**Causa raíz:** Las URLs de `compressImage` no pasan por `resolveImageUrl()` (que sí trackea en `_blobUrls`). Son URLs temporales que sobreviven hasta que la página se cierra.

**Fix (parte 1 — imageUtils.js):** Agregar cada blob URL al Set de tracking y revocar la del Image temporal:
```js
// js/imageUtils.js:50 — después del createObjectURL(blob):
url: URL.createObjectURL(blob),

// Añadir esto justo después (nueva línea 51):
window.__enoteBlobUrls = window.__enoteBlobUrls || new Set();
window.__enoteBlobUrls.add(result.url);

// Nuevo — revocar la URL del Image temporal:
// js/imageUtils.js:60 — después de img.onerror:
img.src = URL.createObjectURL(file);
// Añadir en img.onload y img.onerror:
img.addEventListener('load', () => URL.revokeObjectURL(img.src), { once: true });
img.addEventListener('error', () => URL.revokeObjectURL(img.src), { once: true });
```

**Fix (parte 2 — shared.js):** Agregar cleanup al Set global en `closeModal()`:
```js
// js/ui/shared.js:15-18 — modificar revokeBlobUrls:
export function revokeBlobUrls() {
  _blobUrls.forEach(url => URL.revokeObjectURL(url));
  _blobUrls.clear();
  // También limpiar blob URLs creadas por compressImage
  if (window.__enoteBlobUrls) {
    window.__enoteBlobUrls.forEach(url => URL.revokeObjectURL(url));
    window.__enoteBlobUrls.clear();
  }
}
```

### F1.4 — Memory leak: showImagePreview nunca revoca blob URLs

**Problema:** `showImagePreview` llama `resolveImageUrl()` que sí trackea en `_blobUrls`, pero al cerrar el preview (`overlay.remove()`) no se llama `revokeBlobUrls()`.

**Archivo:** `js/app.js:717-738`
**Causa raíz:** Solo `closeModal()` llama `revokeBlobUrls()`. El preview no usa el sistema de modales.
**Fix:**
```js
// js/app.js — en el cierre del image preview (línea ~736), añadir:
import { revokeBlobUrls } from './ui/shared.js';

// ... en el handler que cierra el preview:
overlay.remove();
revokeBlobUrls(); // <-- añadir esta línea
currentDetailNoteId = null;
```

### F1.5 — Falsy number bug: pastelCantidad y pisos

**Problema:** `pastelCantidad: 0` se convierte en `1` porque `0` es falsy. `pisos: 0` se convierte en `null` por la misma razón.

**Archivo:** `js/ui/form.js:100,105`
**Causa raíz:** Checks truthy (`if (val)` en vez de `if (val != null)`).
**Fix:**
```js
// js/ui/form.js:100 — antes:
value="${isEdit && note.pastelCantidad ? note.pastelCantidad : 1}"

// después:
value="${isEdit && note.pastelCantidad != null ? note.pastelCantidad : 1}"

// js/ui/form.js:105 — antes:
value="${esc(isEdit && note.pisos ? note.pisos : '')}"

// después:
value="${esc(isEdit && note.pisos != null ? note.pisos : '')}"
```

### F1.6 — TypeError al obtener campos del formulario

**Problema:** `getFormData()` accede a `.value` sin optional chaining en `fecha` y `destino`.

**Archivo:** `js/ui/form.js:290-291`
**Causa raíz:** `form.querySelector('[name="fecha"]').value` sin `?.`.
**Fix:**
```js
// js/ui/form.js:290-291 — antes:
const fecha = form.querySelector('[name="fecha"]').value;
const destino = form.querySelector('[name="destino"]').value;

// después:
const fecha = form.querySelector('[name="fecha"]')?.value || '';
const destino = form.querySelector('[name="destino"]')?.value || '';
```

### F1.7 — Timezone bug en formatFecha

**Problema:** `new Date(isoDate + 'T00:00:00')` interpreta la fecha como hora local, lo que puede desplazar la fecha un día en zonas horarias distintas a UTC-06:00.

**Archivo:** `js/ui/shared.js:57`, `js/ui/print.js:5`
**Causa raíz:** Sin offset explícito, ECMAScript trata `YYYY-MM-DDTHH:MM:SS` como local time.
**Fix:**
```js
// js/ui/shared.js:57 — antes:
return new Date(isoDate + 'T00:00:00').toLocaleDateString('es-MX', ...);

// después:
// Usar T00:00:00-06:00 para fijar el huso de México
// O parsear manualmente con Date.UTC para evitar ambigüedad
const parts = isoDate.split('-');
const dt = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
return dt.toLocaleDateString('es-MX', { timeZone: 'UTC', ... });
```

### F1.8 — Mutation del objeto fields del caller en updateNote

**Problema:** `delete fields._force; delete fields._localModifiedEn;` muta el parámetro de entrada.

**Archivo:** `js/store.js:190-194`
**Fix:**
```js
// js/store.js:190-194 — antes:
const force = fields._force === true;
const localModifiedEn = fields._localModifiedEn;
delete fields._force;
delete fields._localModifiedEn;

// después:
const { _force: forceRaw, _localModifiedEn: localModifiedEn, ...cleanFields } = fields;
const force = forceRaw === true;
// Usar cleanFields en vez de fields en el resto de la función
```

---

## 3. Fase 2 — Seguridad

### F2.1 — Rotar anon key expuesta en git

**Problema:** La anon key de Supabase está en el historial de git (commit `40c4051` y posteriores). Si el repo es o fue público, está comprometida.

**Acción:**
1. Supabase Dashboard → Settings → API → Generate new JWT secret (esto invalida todas las keys existentes).
2. Copiar la nueva anon key.
3. Actualizar `.env` local y las env vars en Vercel.
4. Correr `node scripts/build-config.js` localmente.
5. Verificar que el deploy funcione.

### F2.2 — Agregar headers de seguridad en vercel.json

**Problema:** `vercel.json` no tiene CSP, HSTS, X-Frame-Options, X-Content-Type-Options.

**Archivo:** `vercel.json`
**Fix:**
```json
{
  "buildCommand": "node scripts/build-config.js",
  "outputDirectory": ".",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https://ovlhabedefwbajrnfpup.supabase.co blob: data:; connect-src 'self' https://ovlhabedefwbajrnfpup.supabase.co; manifest-src 'self';" }
      ]
    }
  ]
}
```

### F2.3 — Agregar checks de autorización en store.js

**Problema:** `getNote()`, `updateNote()`, `deleteNote()`, `toggleTomada()` dependen exclusivamente de RLS. Sin defensa en profundidad.

**Archivo:** `js/store.js:77-283`
**Fix:** Agregar un helper y validar antes de cada operación:
```js
// js/auth.js — nuevo export:
export function canModifyNote(session, note) {
  if (!session || !note) return false;
  if (session.role === 'admin') return true;
  if (session.role === 'sucursal' && (note.destino === session.destino || note.creadoPor === session.username)) return true;
  if (session.role === 'planta' && note.destino === session.destino) return true;
  return false;
}

// js/store.js — en updateNote:
// ... al inicio de la función:
const existing = await getNote(id);
if (!existing) throw new Error('Nota no encontrada');
if (!canModifyNote(session, existing)) throw new Error('Permisos insuficientes');
```

### F2.4 — Agregar guards de rol en handlers de UI

**Problema:** `handleDashboardClick`, `handleStatusChangeInit`, `handleFormSubmit` no verifican roles antes de ejecutar operaciones sensibles.

**Archivo:** `js/app.js:331-557`
**Fix:** Agregar checks al inicio de cada handler sensible:
```js
// js/app.js — handleDashboardClick:
if (e.target.closest('.btn-editar')) {
  if (!canEdit(currentSession)) { renderToast('Permisos insuficientes', 'error'); return; }
  await showForm(noteId); return;
}
if (e.target.closest('.btn-eliminar')) {
  if (!canDelete(currentSession)) { renderToast('Permisos insuficientes', 'error'); return; }
  await confirmDelete(noteId); return;
}
```

### F2.5 — Agregar .gitignore para js/supabase.js

**Problema:** `js/supabase.js` ya está en `.gitignore` pero la key está en el historial. Confirmar que está correctamente excluido.

**Archivo:** `.gitignore:9`
**Acción:** Verificar. Ya está presente. Después de rotar la key (F2.1), el historial ya no es relevante para la key nueva.

### F2.6 — Logout no limpia IndexedDB

**Problema:** Al hacer logout, los datos de notas (PII) quedan en IndexedDB accesibles al siguiente usuario.

**Archivo:** `js/auth.js:33-40`
**Fix:**
```js
// js/auth.js — nuevo import:
import { clearAllOfflineData } from './offline.js';

// js/auth.js:33-40 — modificar logout:
export async function logout() {
  try { if (supabase) await supabase.auth.signOut(); }
  catch (err) { console.warn('supabase signOut failed:', err); }
  clearSession();
  await clearAllOfflineData().catch(() => {}); // fire-and-forget cleanup
}

// js/offline.js — nueva función:
export async function clearAllOfflineData() {
  const database = await openDB();
  for (const store of Object.values(STORES)) {
    try {
      await new Promise((resolve, reject) => {
        const req = database.transaction(store, 'readwrite').objectStore(store).clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch { /* ignorar errores por store */ }
  }
}
```

### F2.7 — Sesión en localStorage → sessionStorage

**Problema:** La sesión persiste entre reinicios del navegador. En dispositivos compartidos, esto es un riesgo.

**Archivo:** `js/auth.js:29,47,52`
**Fix:** Reemplazar `localStorage` por `sessionStorage`:
```js
// js/auth.js:5 — cambiar:
const SESSION_KEY = 'enote-session';
// js/auth.js:29,47,52 — reemplazar localStorage.setItem/getItem/removeItem
// por sessionStorage.setItem/getItem/removeItem
```
**Nota:** Esto implica que al cerrar la pestaña, el usuario debe re-login. Evaluar con el cliente si es aceptable para el flujo de trabajo.

### F2.8 — Mensajes de error: no exponer detalles internos

**Problema:** `throw error` expone mensajes de Supabase con nombres de tablas y constraints.

**Archivo:** `js/store.js:82,171,255,266`
**Fix:** Mapear errores a mensajes amigables:
```js
// Helper en store.js:
function mapStoreError(err) {
  const code = err?.code || '';
  if (code === 'PGRST301' || /JWT/i.test(err?.message || '')) return 'Sesión expirada — inicia sesión de nuevo';
  if (code === '42501') return 'Permisos insuficientes';
  if (code === '23505') return 'El registro ya existe';
  return 'Error del servidor — intenta de nuevo';
}
// Usar en cada throw: throw new Error(mapStoreError(error));
```

### F2.9 — Logger requiere autenticación (o aceptar riesgo)

**Problema:** `/api/log` acepta POSTs sin token.

**Opciones:**
- **A:** Agregar header `Authorization: Bearer <token>` en `logger.js`.
- **B:** Crear un endpoint en Supabase Edge Functions que valide el token.
- **C:** Aceptar que es un endpoint de analytics público y no enviar datos sensibles.

**Recomendación:** Opción C para v1.3 (bajo riesgo). Revisar en v1.4.

### F2.10 — CSP: agregar meta tag en index.html (defensa adicional)

**Archivo:** `index.html`
**Fix:** Agregar después de `<meta charset="UTF-8">`:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https://ovlhabedefwbajrnfpup.supabase.co blob: data:; connect-src 'self' https://ovlhabedefwbajrnfpup.supabase.co;">
```

### F2.11 — Agregar robots.txt

**Nuevo archivo:** `robots.txt`
```
User-agent: *
Disallow: /
```

### F2.12 — PII hardcodeada en print.js → config.js

**Problema:** Teléfono y dirección de Xiera hardcodeados en el template de impresión.

**Archivo:** `js/ui/print.js:40-48`
**Fix:** Mover a `js/config.js`:
```js
// js/config.js — nuevo:
export const BUSINESS_INFO = {
  instagram: 'xiera.xiera',
  phone: '392 92 2 42 29',
  address: 'Ramón Corona 423, Centro, Ocotlán, Jalisco',
};
```
Y referenciar `BUSINESS_INFO.phone` en `print.js`.

---

## 4. Fase 3 — Offline e IndexedDB

### F4.1 — Cola pending compartida entre usuarios

**Problema:** `PENDING_QUEUE` es un store global. User B sincroniza notas creadas offline por User A cuando reconecta.

**Archivos:** `js/offline.js:105-107`, `js/app.js:114-116,530-532`
**Causa raíz:** El store no tiene scope por usuario.
**Fix:** Agregar `userId` como key en la queue y filtrar:
```js
// js/offline.js:105-107 — modificar createNoteOffline:
export async function createNoteOffline(noteData, userId) {
  await dbAdd(STORES.PENDING_QUEUE, {
    ...noteData,
    _userId: userId,  // scope por usuario
    synced: false,
    createdAt: new Date().toISOString()
  });
}

// js/offline.js:109-111 — modificar getPendingNotes:
export async function getPendingNotes(userId) {
  const all = await dbGetAll(STORES.PENDING_QUEUE);
  return userId ? all.filter(item => item._userId === userId) : all;
}

// js/app.js — al iniciar syncPendingNotes, pasar currentSession.userId:
await syncPendingNotes(async (item) => { ... }, currentSession.userId);
```

### F4.2 — Duplicados en servidor por sync no atómico

**Problema:** `syncPendingNotes` hace put (synced:true) + delete en transacciones separadas. Crash entre ambas = re-sync = duplicado.

**Archivo:** `js/offline.js:134-136`
**Fix:** Eliminar el paso de marcar synced:true. Ir directo al delete:
```js
// js/offline.js:134-136 — antes:
if (success) {
  await dbPut(STORES.PENDING_QUEUE, { ...item, synced: true });
  await deletePendingNote(item.localId);
}

// después:
if (success) {
  await deletePendingNote(item.localId);
  // Si el delete falla, el item se re-procesará en la próxima sync.
  // Esto es aceptable: createNote genera un nuevo numero único cada vez.
}
```

### F4.3 — Deadlock multi-tab (onblocked)

**Problema:** `openDB()` no tiene handler `onblocked`. Dos tabs con diferente DB version = deadlock.

**Archivo:** `js/offline.js:12-34`
**Fix:**
```js
// js/offline.js:12-34 — añadir onblocked y onclose:
async function openDB() {
  if (db) return db;
  db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onblocked = () => {
      // Otra pestaña tiene una versión anterior abierta.
      // Cerrar esta solicitud y reintentar o notificar al usuario.
      console.warn('IndexedDB open blocked by another tab');
      reject(new Error('DB bloqueada por otra pestaña — cierra otras pestañas de Enote'));
    };
    req.onupgradeneeded = e => { /* ... igual ... */ };
  });
  // Escuchar cierre externo
  db.onclose = () => { db = null; };
  db.onversionchange = () => { db.close(); db = null; };
  return db;
}
```

### F4.4 — Lie-fi: navigator.onLine false positive

**Problema:** En captive portal, `navigator.onLine` = true pero Supabase es inalcanzable. No hay fallback a caché.

**Archivos:** `js/store.js:73-76`, `js/offline.js:145-147`
**Fix:** Agregar try/catch con fallback a caché en las funciones de lectura:
```js
// js/store.js:73-88 — getNotes:
export async function getNotes() {
  if (!isOnline()) {
    return getOfflineNotes();
  }
  try {
    const { data, error } = await supabase.from('notes').select('*')...;
    if (error) throw error;
    // ...
    return notes;
  } catch (err) {
    // Lie-fi: fallback a caché
    console.warn('Supabase inalcanzable, usando caché offline:', err.message);
    return getOfflineNotes();
  }
}
```
Aplicar el mismo patrón a `getNote()`.

### F4.5 — syncNotesToCache no atómico

**Problema:** 200+ transacciones separadas. Crash = caché incompleto.

**Archivo:** `js/offline.js:90-95`
**Fix:** Usar una sola transacción con múltiples puts:
```js
// js/offline.js:90-95 — antes:
export async function syncNotesToCache(notes) {
  await dbClear(STORES.NOTES_CACHE);
  for (const note of notes) {
    await dbPut(STORES.NOTES_CACHE, note);
  }
}

// después:
export async function syncNotesToCache(notes) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORES.NOTES_CACHE, 'readwrite');
    const store = tx.objectStore(STORES.NOTES_CACHE);
    store.clear();
    for (const note of notes) {
      store.put(note);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
```

### F4.6 — syncPendingNotes sin guardia de concurrencia

**Problema:** Dos eventos `online` rápidos → doble sync → duplicados.

**Archivo:** `js/app.js:110-121`
**Fix:**
```js
// js/offline.js — nuevo flag:
let _syncing = false;

export async function syncPendingNotes(createNoteFn, userId) {
  if (_syncing) return;
  _syncing = true;
  try {
    const pending = await getPendingNotes(userId);
    // ... lógica existente ...
  } finally {
    _syncing = false;
  }
}
```

### F4.7 — IMAGE_CACHE sin evicción

**Problema:** El caché de imágenes crece sin límite.

**Archivo:** `js/offline.js:150-197`
**Fix:** Agregar límite de entradas (ej. 500) con LRU básico:
```js
// js/offline.js — constante:
const MAX_IMAGE_CACHE = 500;

// js/offline.js — en saveImageToCache:
export async function saveImageToCache(url, blob) {
  const count = await countStore(STORES.IMAGE_CACHE);
  if (count >= MAX_IMAGE_CACHE) {
    // Eliminar la entrada más antigua (first-in-first-out)
    const oldest = await getOldestImage();
    if (oldest) await dbDelete(STORES.IMAGE_CACHE, oldest.url);
  }
  return dbPut(STORES.IMAGE_CACHE, { url, blob, cachedAt: Date.now() });
}
```

### F4.8 — Resolver promesas en tx.oncomplete, no en req.onsuccess

**Problema:** Las funciones de escritura de IndexedDB (`dbPut`, `dbAdd`, `dbDelete`, `dbClear`) resuelven la promesa en `req.onsuccess`, pero los datos pueden no haberse commiteado aún.

**Archivo:** `js/offline.js:54-88`
**Fix:** Resolver en `tx.oncomplete` y rechazar en `tx.onerror`:
```js
// js/offline.js — patrón corregido para dbPut (aplicar a dbAdd, dbDelete, dbClear):
async function dbPut(storeName, data) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(data);
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}
```

### F4.9 — fetch sin timeout en cacheImages

**Problema:** Conexión lenta = fetch cuelga por minutos.

**Archivo:** `js/offline.js:188`
**Fix:**
```js
// js/offline.js:188 — antes:
const res = await fetch(url);

// después:
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
try {
  const res = await fetch(url, { signal: controller.signal });
  clearTimeout(timeout);
  if (res.ok) { ... }
} catch (err) {
  clearTimeout(timeout);
  // ignorar timeout y otros fallos
}
```

---

## 5. Fase 4 — PWA y Service Worker

### F5.1 — self.ENOTE_VERSION nunca definido en SW

**Problema:** `self` en la página es `window`, en el SW es `ServiceWorkerGlobalScope`. No se comparten variables. El versionado siempre cae a `Date.now()`.

**Archivos:** `sw.js:1`, `index.html:28`
**Fix:** Hardcodear la versión en `sw.js`:
```js
// sw.js:1 — antes:
const CACHE_VERSION = 'enote-' + (typeof self.ENOTE_VERSION !== 'undefined' ? self.ENOTE_VERSION : Date.now());

// después:
const ENOTE_VERSION = '1.3.0';
const CACHE_VERSION = 'enote-' + ENOTE_VERSION;
```
Extender `scripts/build-config.js` para inyectar `ENOTE_VERSION` desde `.env` en `sw.js` si se desea versionado dinámico.

### F5.2 — Actualización de SW sin botón de acción

**Problema:** El toast "Nueva versión disponible" no tiene botón para actualizar. El mensaje `SKIP_WAITING` nunca se envía desde la página.

**Archivos:** `js/app.js:34-42`, `sw.js:85-87`
**Fix:**
```js
// js/app.js:39 — modificar el renderToast del updatefound:
// En vez de solo texto, incluir un botón inline:
const toastEl = renderToast('', 'info', 12000); // <-- modificar renderToast para retornar el elemento
// O mejor: usar un banner persistente en el header

// Alternativa más simple: al detectar updatefound, forzar skipWaiting:
if (reg.installing) {
  reg.installing.addEventListener('statechange', () => {
    if (reg.waiting && navigator.serviceWorker.controller) {
      // Enviar SKIP_WAITING al nuevo worker
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  });
}
// Y escuchar controllerchange para recargar:
navigator.serviceWorker.addEventListener('controllerchange', () => {
  window.location.reload();
});
```

### F5.3 — Fetch handler no cachea manifest

**Problema:** `request.destination === 'manifest'` no está en `isAsset`.

**Archivo:** `sw.js:52`
**Fix:**
```js
// sw.js:52 — antes:
const isAsset = ['style', 'script', 'font', 'image'].includes(request.destination);

// después:
const isAsset = ['style', 'script', 'font', 'image', 'manifest'].includes(request.destination);
```

### F5.4 — cache.addAll falla por completo si un asset falla

**Problema:** Google Fonts no disponible = ningún asset pre-cacheado.

**Archivo:** `sw.js:26-31`
**Fix:**
```js
// sw.js:26-31 — antes:
caches.open(CACHE_VERSION)
  .then(cache => cache.addAll(STATIC_ASSETS))

// después:
caches.open(CACHE_VERSION)
  .then(cache => Promise.allSettled(
    STATIC_ASSETS.map(url =>
      cache.add(url).catch(err => console.warn('Failed to cache:', url, err))
    )
  ))
```

### F5.5 — Agregar assets faltantes a STATIC_ASSETS

**Archivo:** `sw.js:2-24`
**Fix:** Agregar:
- `'/manifest.json'`
- `'/js/ui/print.js'`
- `'/icons/icon-192.png'`
- `'/icons/icon-192-maskable.png'`
- `'/icons/icon-512.png'`
- `'/icons/icon-512-maskable.png'`
- `'/robots.txt'`

### F5.6 — Cambiar estrategia de assets a stale-while-revalidate

**Problema:** Cache-first en assets sin hash → cambios en CSS/JS no se propagan hasta que el SW se actualiza.

**Archivo:** `sw.js:68-81`
**Fix:** Cambiar a stale-while-revalidate:
```js
// sw.js:68-81 — modificar estrategia de assets:
} else if (isAsset) {
  e.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(request, clone));
        }
        return res;
      });
      return cached || fetchPromise;
    })
  );
}
```

### F5.7 — Fallback para imágenes offline

**Problema:** `.catch(() => caches.match(request))` re-consulta el caché que ya devolvió undefined.

**Archivo:** `sw.js:80`
**Fix:**
```js
// sw.js:80 — antes:
.catch(() => caches.match(request))

// después:
.catch(() => new Response('', { status: 503, statusText: 'Offline — image not cached' }))
```

### F5.8 — Sincronizar notas offline al arrancar (no solo en evento online)

**Problema:** Si el usuario cierra la pestaña y la reabre, las notas offline no se sincronizan.

**Archivo:** `js/app.js:80-108`
**Fix:** En `init()`, si `isOnline()`, llamar `syncPendingNotes`:
```js
// js/app.js — dentro de init(), después de routeByRole():
if (currentSession && isOnline()) {
  syncPendingNotes(async (item) => {
    const { _session, synced, localId, createdAt, ...fields } = item;
    return createNote(fields, _session || currentSession);
  }, currentSession.userId).catch(err => console.warn('Initial sync failed:', err));
}
```

---

## 6. Fase 5 — CSS y Accesibilidad

### F6.1 — Agregar CSS para .status-static-text

**Problema:** Usuarios planta ven texto sin estilo en notas Canceladas/Nuevas.

**Archivo:** `css/main.css`
**Fix:**
```css
/* css/main.css — nueva regla: */
.status-static-text {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--color-text-muted);
  white-space: nowrap;
}
```

### F6.2 — Eliminar reglas CSS muertas

**Archivo:** `css/main.css`
- **`.priority-controls`** — líneas 425-429: borrar (nunca usado).
- **`.role-chip--repartidor`** — línea 253: borrar (nunca aplicado en JS).
- **`.detail-body`** — línea 749: borrar (la clase real es `.detail-card-body`).

### F6.3 — Agregar vendor prefixes

**Archivo:** `css/main.css`
```css
/* línea 487 y 665 — backdrop-filter: */
-webkit-backdrop-filter: blur(3px); /* línea 487 */
backdrop-filter: blur(3px);
-webkit-backdrop-filter: blur(2px); /* línea 665 */
backdrop-filter: blur(2px);

/* línea 101 — appearance: */
-webkit-appearance: none;
appearance: none;
```

### F6.4 — Agregar focus-visible en cards y botones

**Archivo:** `css/main.css`
```css
/* Nueva regla: */
.note-card:focus-visible,
.repartidor-card:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 2px;
}
.btn-close-preview:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 2px;
}
```

### F6.5 — Layout de detalle responsive en móvil

**Archivo:** `css/main.css:1040-1049`
**Fix:**
```css
/* En @media (max-width: 640px): */
@media (max-width: 640px) {
  .detail-layout {
    flex-direction: column;
  }
}
```

### F6.6 — Mejorar contraste en estados vacíos y loading

**Archivo:** `css/main.css:872-877`
**Fix:**
```css
/* Cambiar color de texto en empty-state y loading: */
.empty-state, #loading {
  color: var(--color-text-deep); /* #2C1810 en vez de #8B6E6A */
  /* o: color: #5A3A2A; — un marrón más oscuro que cumpla AA */
}
```

### F6.7 — Remover @import inválido en print.css

**Archivo:** `css/print.css:1-2`
**Fix:** Eliminar el `@import` dentro de `@media print`. Las fuentes ya se cargan en `index.html`.

### F6.8 — Agregar role="alert" a toasts

**Archivo:** `js/ui/shared.js:126-143`
**Fix:**
```js
// shared.js:133 — añadir:
el.setAttribute('role', 'alert');
el.setAttribute('aria-live', 'polite');
```

### F6.9 — Agregar límite de toasts visibles

**Archivo:** `js/ui/shared.js:126-143`
**Fix:**
```js
// shared.js:126 — al inicio de renderToast:
export function renderToast(message, type = 'info', duration = 3000) {
  const container = document.querySelector('.toast-container') || /* crear */;
  // Limitar a 3 toasts visibles
  while (container.children.length >= 3) {
    container.firstChild.remove();
  }
  // ... resto igual
}
```

### F6.10 — Agregar object-fit a image preview

**Archivo:** `css/main.css:1105-1111`
**Fix:**
```css
.image-preview-container img {
  /* ... existente ... */
  object-fit: contain;
}
```

### F6.11 — Agregar pointer-events a modal overlay

**Archivo:** `css/main.css:483-501`
**Fix:**
```css
.modal-overlay {
  /* ... existente ... */
  pointer-events: none;
}
.modal-overlay.visible {
  pointer-events: auto;
}
```

---

## 7. Fase 6 — Error Handling y Logging

### F7.1 — Agregar handlers globales de error

**Problema:** ~70% de errores se pierden en silencio.

**Archivo:** `js/app.js` (init)
**Fix:**
```js
// js/app.js — al inicio de init():
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error || event.message);
  if (event.error) {
    // Enviar a logger (mejor esfuerzo)
    try { void log.error('unhandled', { message: event.error.message, stack: event.error.stack?.slice(0, 500) }); } catch {}
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
  try {
    void log.error('unhandledrejection', { message: event.reason?.message || String(event.reason) });
  } catch {}
  // Mostrar toast genérico
  try { renderToast('Ocurrió un error inesperado. Intenta de nuevo.', 'error', 6000); } catch {}
  event.preventDefault(); // Evitar que el browser muestre el error en consola (ya lo logueamos)
});
```

### F7.2 — init() no traga errores no-auth

**Archivo:** `js/app.js:94-108`
**Fix:** Agregar else branch:
```js
// js/app.js:94-108 — modificar catch:
} catch (err) {
  const msg = String(err?.message || err || '').toLowerCase();
  const code = err?.status || err?.code || '';
  const isAuth = /jwt|token.*expir|refresh.*token|invalid.*token|unauthorized/i.test(msg) || code === 401 || code === 403;
  if (isAuth && isOnline()) {
    clearSession();
    currentSession = null;
    showLoginView();
    renderToast('Sesión expirada — inicia sesión de nuevo', 'info');
  } else {
    // Nuevo: mostrar error y opción de reintentar
    console.error('init failed:', err);
    renderToast('Error al cargar la aplicación. Verifica tu conexión.', 'error', 8000);
    // Intentar mostrar dashboard offline si hay sesión en caché
    if (currentSession) {
      try { await routeByRole(); } catch {}
    }
  }
}
```

### F7.3 — Interceptar errores de auth en todas las llamadas a API

**Archivo:** `js/store.js`
**Fix:** Crear un wrapper:
```js
// js/store.js — nuevo:
function handleApiError(err, fallbackMsg) {
  const msg = String(err?.message || err || '');
  const code = err?.code || err?.status || '';
  if (code === 401 || code === 403 || /JWT|token.*expir/i.test(msg)) {
    // Disparar evento para que app.js maneje el re-login
    window.dispatchEvent(new CustomEvent('enote:auth-expired'));
    throw new Error('Sesión expirada — inicia sesión de nuevo');
  }
  throw new Error(fallbackMsg || 'Error del servidor');
}
// Usar en cada catch de store.js
```

### F7.4 — Envolver handlers de eventos en try/catch

**Archivo:** `js/app.js` (múltiples)
**Fix:** Crear un wrapper:
```js
// js/app.js — nuevo:
function safeHandler(fn) {
  return async (...args) => {
    try { await fn(...args); }
    catch (err) { console.error('Handler error:', err); renderToast('Error: ' + (err.message || 'inesperado'), 'error'); }
  };
}
// Envolver los handlers principales:
// handleDashboardClick → safeHandler(handleDashboardClick)
// handleStatusChangeInit → safeHandler(handleStatusChangeInit)
// etc.
```

### F7.5 — Feedback en syncPendingNotes cuando falla permanentemente

**Archivo:** `js/offline.js:121-139`
**Fix:** Después de 3 intentos fallidos, notificar:
```js
// js/offline.js:121-139 — en syncPendingNotes:
if (success) {
  await deletePendingNote(item.localId);
} else {
  // Nuevo: marcar como fallido permanentemente después de N reintentos totales
  item._failCount = (item._failCount || 0) + 1;
  if (item._failCount >= 9) { // 3 reconexiones × 3 intentos
    console.error('Pending note permanently failed:', item);
    // Opcional: toast de error
  }
  await dbPut(STORES.PENDING_QUEUE, item); // actualizar contador
}
```

### F7.6 — orfaned images on partial upload

**Archivo:** `js/store.js:6-33` (processImages)
**Fix:** Subir imágenes después de crear la nota, con cleanup:
```js
// Opción A: Subir después del insert (aceptar imágenes huérfanas con log)
// Opción B: Usar un flag images_uploaded=false y reintentar
// Para v1.3, aceptar huérfanas y loguear:
```
**Nota:** No requiere cambio urgente. Documentar como known issue.

### F7.7 — ValidateForm vs validateNoteFields duplicación

**Archivo:** `js/app.js:498-499` + `js/store.js:100-117`
**Fix:** Consolidar validación en `store.js` y llamar desde app.js:
```js
// js/app.js — handleFormSubmit:
const errors = validateNoteFields(fields); // usar la de store.js
if (errors.length) {
  renderToast(errors.join('\n'), 'error');
  return;
}
// Eliminar validateForm() de app.js
```

---

## 8. Fase 7 — Configuración y Deploy

### F8.1 — Agregar Cache-Control en vercel.json

**Archivo:** `vercel.json`
**Fix (añadir a la sección headers):**
```json
{ "source": "/css/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
{ "source": "/js/(.*)",  "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
{ "source": "/icons/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
{ "source": "/manifest.json", "headers": [{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }] }
```

### F8.2 — Extender build-config.js para inyectar versión en SW

**Archivo:** `scripts/build-config.js`
**Acción:** Agregar paso que lea `ENOTE_VERSION` del `.env` y reemplace un placeholder en `sw.js`:
```js
// Similar al patrón existente para supabase.js:
const version = process.env.ENOTE_VERSION || '1.3.0';
let swContent = fs.readFileSync('sw.js', 'utf-8');
swContent = swContent.replace(/const ENOTE_VERSION = '[\d.]+'/, `const ENOTE_VERSION = '${version}'`);
fs.writeFileSync('sw.js', swContent);
```

### F8.3 — Remover descripción "demo" en audit/package.json

**Archivo:** `audit/package.json:5`
**Fix:**
```json
"description": "Playwright audit script for Enote production"
```

### F8.4 — Actualizar .env.example con versión

**Archivo:** `.env.example` (ya actualizado en esta fase).

### F8.5 — Marcar audit.js como obsoleto

**Archivo:** `audit/audit.js`
**Acción:** Agregar comentario al inicio:
```js
/**
 * OBSOLETO — Este script usaba credenciales demo que ya no existen.
 * Usar audit-prod.js o audit-v2.js para pruebas en producción.
 */
```

---

## 9. Fase 8 — Tests y Cobertura

### F9.1 — Eliminar passwords hardcodeados de audit scripts

**Archivo:** `audit/audit-prod.js:17`, `audit/audit-v2.js:23`
**Fix:** Reemplazar el default value con un valor que claramente falle:
```js
// audit/audit-prod.js:17 — antes:
const PASS = process.env.AUDIT_PASS || 'passss';

// después:
const PASS = process.env.AUDIT_PASS;
if (!PASS) {
  console.error('ERROR: AUDIT_PASS env var is required');
  process.exit(1);
}
```

### F9.2 — Agregar cleanup en audit-v2.js

**Archivo:** `audit/audit-v2.js`
**Acción:** Implementar `deleteAuditNotes()` similar al de `audit-prod.js` y llamarlo al final de la suite.

### F9.3 — Agregar tests para repartidor

**Nueva sección en audit-prod.js:**
1. Login como repartidor
2. Verificar que la vista repartidor carga
3. Filtrar por sucursal
4. Toggle tomada en una nota y verificar cambio visual
5. Verificar que el toggle persiste tras recargar

### F9.4 — Agregar tests para imágenes

**Nueva sección en audit-v2.js:**
1. Crear nota con 1 imagen (verificar que se muestra en detalle)
2. Crear nota con 3 imágenes (límite)
3. Verificar que compressImage rechaza >5MB

### F9.5 — Agregar tests para conflicto end-to-end

**Nuevo archivo:** `audit/audit-conflict.js`
1. Login como admin en dos páginas (contextos separados)
2. Admin A abre nota en edición
3. Admin B edita y guarda la misma nota
4. Admin A intenta guardar → verificar que aparece conflict view
5. Admin A elige "Sobrescribir" → verificar que la nota se actualiza
6. Repetir con "Mantener servidor"

### F9.6 — Reemplazar waitForTimeout con waitForSelector/waitForFunction

**Archivos:** Todos los audit scripts
**Acción:** Reemplazar `waitForTimeout(N)` por esperas basadas en estado (ej. `waitForSelector('.toast--success', { state: 'visible' })`).

---

## 10. Calendario Estimado

| Fase | Descripción | Issues | Días est. | Prioridad |
|------|-------------|--------|-----------|-----------|
| F1 | Bugs críticos (code) | 8 | 2 | CRÍTICO |
| F2 | Seguridad | 12 | 2 | ALTO |
| F3 | Offline e IndexedDB | 9 | 3 | ALTO |
| F4 | PWA y Service Worker | 8 | 2 | ALTO |
| F5 | CSS y Accesibilidad | 11 | 2 | MEDIO |
| F6 | Error Handling y Logging | 7 | 2 | ALTO |
| F7 | Configuración y Deploy | 5 | 1 | MEDIO |
| F8 | Tests y Cobertura | 6 | 2 | MEDIO |
| **TOTAL** | | **~66 issues** | **~16 días** | |

### Orden de ejecución

1. **Fase 1** (Bugs críticos) — 2 días
2. **Fase 6** (Error handling) — 2 días (habilita diagnóstico para el resto)
3. **Fase 3** (Offline) — 3 días
4. **Fase 2** (Seguridad) — 2 días
5. **Fase 4** (PWA) — 2 días
6. **Fase 5** (CSS) — 2 días
7. **Fase 7** (Config) — 1 día
8. **Fase 8** (Tests) — 2 días

---

## Apéndice A — Issues postergados para v1.4

| Issue | Razón |
|-------|-------|
| RLS enforcement en tests | Requiere configuración de múltiples usuarios en Supabase |
| Dark mode (`prefers-color-scheme: dark`) | Baja prioridad para herramienta interna |
| Migración a TypeScript | Esfuerzo alto, beneficio marginal para el tamaño actual |
| Background Sync API en SW | Soporte limitado en navegadores (Chromium-only) |
| End-to-end encryption de datos offline | Complejidad alta, riesgo bajo para panadería |
| CSV/Excel export | Feature no construido, pospuesto a v1.4 |
| WAI-ARIA completo en todos los componentes | Iterativo — empezar con los fixes de F5 |

## Apéndice B — Issues de documentación ya corregidos

Estos issues se resolvieron en esta misma sesión (2026-05-26):

- `PRODUCT.md` — Corregido "planta crea notas" → "planta procesa notas"
- `DESIGN.md` — Eliminada referencia a violation ya corregida de `.diff-alert`
- `CLAUDE.md` — Versión actualizada a v1.3, añadido `ui/print.js`, docs actualizados
- `README.md` — Versión actualizada, docs actualizados, añadido `ui/print.js`
- `docs/AUDIT-V1.1.md` — Marcado como [ARCHIVADO] con banner
- `docs/SPRINT-PRODUCCION-V1.2.md` — Marcado como [ARCHIVADO], estados corregidos
- `docs/ROADMAP-PRODUCCION-V1.2.md` — Marcado como [ARCHIVADO] con nota de schema mismatch
- `docs/COTIZACION*` — Eliminados (obsoletos, inconsistentes)
- `docs/nota.jpeg` — Eliminado (imagen suelta sin contexto)
- `.env.example` — Añadido `ENOTE_VERSION` y documentación
