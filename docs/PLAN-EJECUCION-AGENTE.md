# Enote v1.2 — Plan de Ejecución para Agente Autónomo

> **Objetivo:** Commit del working tree → Deploy Vercel → Cablear offline-first (B.1–B.5)
> **Contexto:** Enote es una SPA vanilla JS (ES modules, sin bundler) con Supabase backend y PWA.
> **Reglas:** NO escribir código en este plan. Solo describir qué hacer y dónde. El agente escribe el código.

---

## 0. Antes de empezar — Lecturas obligatorias

El agente DEBE leer estos archivos para entender el estado actual antes de modificar nada:

| Archivo | Por qué leerlo |
|---------|----------------|
| `js/offline.js` | Infraestructura offline existente (createNoteOffline, syncPendingNotes, getOfflineNotes, isOnline, syncNotesToCache, cacheImages, DB stores, helpers DB) |
| `js/app.js` | Orquestador — ahí se modifican handleFormSubmit y getNotes; online/offline listeners ya existen en init() |
| `js/store.js` | CRUD Supabase — getNotes(), createNote() que recibe syncPendingNotes como callback |
| `js/ui/shared.js` | renderHeader, renderToast — ahí se añade badge offline |
| `js/config.js` | PAGE_SIZE, roles, locations |
| `docs/ROADMAP-PRODUCCION-V1.2.md` | §5.3 cola escritura, §8 timeline |
| `docs/PLAN-HARDENING-V1.2.md` | Contexto (cualquier detalle adicional) |

---

## 1. Commit del working tree (sin subagente — tarea única)

### 1.1 Verificar el estado

Ejecutar `git status --short` para confirmar que todo está como espera el plan. Deben aparecer ~40 archivos modificados, ~13 eliminados (sandbox/*, js/supabase.js), y nuevos archivos (docs/, scripts/, js/types.js, js/supabase.js.template, graphify-out/).

### 1.2 Crear .gitignore si hace falta

Asegurar que `.gitignore` ya contiene:
- `.env`
- `js/supabase.js`
- `sandbox/`
- `graphify-out/`

### 1.3 Staging y commit

```bash
git add -A
git commit -m "chore: harden v1.2 — demo removal, pagination, conflict detection, PWA, bug fixes
```

Mensaje orientativo: debe reflejar que es un commit de hardening que elimina el modo demo, añade paginación client-side, conflict detection, validación backend, PWA fixes, y bug fixes de overlay/delete/RLS.

### 1.4 Verificar

`git status` debe mostrar working tree limpio. `git log --oneline -1` debe mostrar el commit nuevo.

---

## 2. Deploy Vercel — 3 subagentes en paralelo 🚀

### 2.1 Subagente A: Build script y env vars

**Archivos a tocar:** solo verificar que `scripts/build-config.js` funciona.

**Qué hacer:**
1. Verificar que `.env` existe en la raíz del proyecto (gitignorado) con las variables `SUPABASE_URL` y `SUPABASE_ANON_KEY`.
2. Verificar que `js/supabase.js.template` existe con placeholders `__SUPABASE_URL__` y `__SUPABASE_ANON_KEY__`.
3. Ejecutar `node scripts/build-config.js` y verificar que genera `js/supabase.js` correctamente.
4. Verificar que `js/supabase.js` está en `.gitignore`.
5. Confirmar que el build command para Vercel será: `node scripts/build-config.js`

**Output:** Confirmación de que el build script funciona y el build command correcto.

### 2.2 Subagente B: Deploy en Vercel (pasos manuales / CLI)

**Qué hacer:**
1. Verificar que `vercel --version` está disponible (global o npx).
2. Si no, indicar que instale `npm i -g vercel`.
3. Ejecutar `vercel --cwd .` o `npx vercel` e interactuar con el CLI:
   - Auth: login con GitHub
   - Project: link al repo existente
   - Framework: `Other`
   - Root: `.`
   - Output: `.`
   - Build command: `node scripts/build-config.js`
   - Environment variables: agregar `SUPABASE_URL` y `SUPABASE_ANON_KEY` desde `.env`
4. Deploy inicial: `vercel --prod`
5. Copiar la URL de producción (ej: `https://enote-xiera.vercel.app`)

**Output:** URL de producción de Vercel.

### 2.3 Subagente C: Supabase Auth URL Configuration (pasos manuales)

**Qué hacer:**
1. Obtener la URL de producción del Subagente B.
2. Ir a Supabase Dashboard → Authentication → URL Configuration.
3. Agregar la URL de Vercel a:
   - **Site URL** (poner la URL de Vercel)
   - **Redirect URLs** (agregar `https://<vercel-url>/**`)
4. Verificar que el login funcione abriendo la URL en el navegador.

**Output:** Confirmación de que el login funciona en producción.

---

## 3. Cablear offline-first — 3 subagentes en paralelo 🚀

Cada subagente trabaja en una porción independiente del código. TODOS DEBEN leer `js/offline.js` primero para entender la API existente.

### 3.1 Subagente D: B.1 — Creación offline (app.js handleFormSubmit)

**Archivo a modificar:** `js/app.js`

**Qué hacer:**
- En `handleFormSubmit()`, en la rama `else` (creación, línea ~421), antes del bloque `try/catch` existente:
  1. Verificar si `isOnline()` retorna `false` (importar `isOnline` y `createNoteOffline` de `./offline.js`).
  2. Si está offline: llamar `createNoteOffline({ fields, session })`, mostrar toast "Nota guardada sin conexión — se enviará automáticamente al reconectar", cerrar modal, resetear estado, retornar.
  3. Si está online: mantener el flujo existente (llamar `createNote`).
- Verificar que el import de `isOnline` y `createNoteOffline` se agregue en la línea de imports de `offline.js` (línea 7).
- Verificar que `syncPendingNotes` ya está importado (línea 7 — existe).

**Patrón a seguir:**
- Usar `renderToast('mensaje', 'info')` para feedback offline.
- Resetear `editingNoteId = null` y `pendingImages = []` después de guardar offline.
- Cerrar modal con `closeModal()` antes de retornar.

**Verificación:** Ejecutar la app, poner DevTools → Network → Offline, crear una nota, confirmar toast "offline". Reconectar, confirmar que la nota se sincroniza.

### 3.2 Subagente E: B.2 — Carga offline getNotes (app.js + store.js)

**Archivos a modificar:** `js/app.js` y `js/store.js`

**Qué hacer en `store.js` (`getNotes()`):**
- Dentro de `getNotes()`, antes de llamar a Supabase:
  1. Importar `isOnline` de `./offline.js`.
  2. Si `!isOnline()`: retornar `getOfflineNotes()` inmediatamente (importar de `./offline.js`).
  3. Si está online: continuar con el flujo normal (consulta Supabase + `cacheImages` fire-and-forget).

**Qué hacer en `app.js` (`getBaseNotes()`):**
- Después de `let notes = await getNotes();`, añadir un bloque que si está online, llame `syncNotesToCache(notes)` de forma fire-and-forget (sin `await`, o con `void`). Esto asegura que las notas se actualicen en IndexedDB cuando hay conexión.
- Ya existe `cacheImages(notes)` en `store.js`, no modificarlo.

**Verificación:** Poner offline, abrir dashboard (notas deben cargarse de caché). Poner online, las notas frescas deben reemplazar la caché.

### 3.3 Subagente F: B.4 + B.5 — Badge offline + sync dedup (offline.js + shared.js + app.js)

**Archivos a modificar:** `js/offline.js`, `js/ui/shared.js`, `js/app.js`

**Qué hacer en `js/offline.js` (`syncPendingNotes()`):**
- Antes de ejecutar `deletePendingNote(item.localId)`, marcar la nota como `synced: true` con un `dbPut(STORES.PENDING_QUEUE, { ...item, synced: true })`. Esto evita que si la app crashea entre `deletePendingNote` y el siguiente paso, la nota quede en un estado inconsistente.
- Luego borrar con `deletePendingNote` como antes.
- Exportar la función nueva `getPendingCount()` que retorna la longitud de `getPendingNotes()`.

**Qué hacer en `js/ui/shared.js` (`renderHeader()`):**
- Aceptar un nuevo parámetro `pendingCount = 0` al final de la firma.
- Si `pendingCount > 0`, agregar un badge en el header:
  ```
  <span class="offline-badge" title="Notas pendientes de sincronizar">
    ⟳ {pendingCount}
  </span>
  ```
  Usar `esc(pendingCount)` para seguridad.

**Qué hacer en `js/app.js`:**
- En `init()`, al cargar la app, calcular `getPendingCount()` y actualizar el header con el badge.
- Escuchar el evento `online` (ya existe en `init()` línea ~60) y después de `syncPendingNotes(createNote)`, refrescar el badge (re-renderear header si el badge cambió).
- En `getBaseNotes()`, después de obtener notas, actualizar el badge.
- Después de crear una nota offline (Subagente D), refrescar el badge.

**Verificación:** Crear nota offline → badge muestra "⟳ 1". Reconectar → badge desaparece tras sync exitoso.

---

## 4. Smoke test final (tarea única post-subagentes)

**Qué hacer:**

1. Ejecutar `node scripts/build-config.js` para regenerar `js/supabase.js`.
2. Iniciar servidor local: `npx serve .` (o el método que uses).
3. Probar con cuenta **admin@xiera.com**:
   - Login funciona
   - Dashboard muestra notas con paginación
   - Crear nota, editar, eliminar (flujo completo)
4. Probar con cuenta **planta**:
   - Abrir detalle → auto-transiciona Nueva→En Proceso
   - Confirmar/cancelar cambio de estatus en dashboard
5. Probar con cuenta **sucursal**:
   - Eliminar nota → toast "eliminado" o "permisos insuficientes"
6. Probar **offline**:
   - DevTools → Network → Offline
   - Crear nota → toast offline + badge
   - Reconectar → sync automático + badge desaparece
7. Probar **overlay detalle**:
   - Scroll interno, padding, gap en imágenes
8. Probar **conflict detection** (opcional):
   - Dos ventanas, misma nota, editar simultáneo → aparece conflict view

---

## 5. Estructura de subagentes — Resumen de paralelismo

```
Fase 1 (secuencial): Commit
  └─ [Agente único] git add/commit

Fase 2 (3 paralelos):
  ├─ Agente A: Build script verification
  ├─ Agente B: Vercel deploy CLI
  └─ Agente C: Supabase Auth URLs

Fase 3 (3 paralelos):
  ├─ Agente D: B.1 offline creation (app.js)
  ├─ Agente E: B.2 offline getNotes (store.js + app.js)
  └─ Agente F: B.4+B.5 badge+dedup (offline.js + shared.js + app.js)

Fase 4 (secuencial): Smoke test
  └─ [Agente único] Smoke test + verificación
```

Cada subagente debe:
1. Leer los archivos que va a modificar.
2. Leer `js/offline.js` para entender la API disponible.
3. Leer los archivos vecinos para replicar el estilo de código (sin comentarios, sin TypeScript, ES modules).
4. Hacer los cambios descritos.
5. Verificar con las pruebas descritas en cada sección.

---

## 6. Notas técnicas para el agente ejecutor

- **Stack:** Vanilla JS ES modules, sin bundler. `index.html` → `js/app.js`
- **Supabase URL:** `https://ovlhabedefwbajrnfpup.supabase.co` (desde `.env`)
- **Estilo:** Sin comentarios, clases CSS con BEM, `esc()` para toda interpolación HTML, `camelCase` en JS, `snake_case` en columnas DB
- **Import path:** `./offline.js` (módulos ES, rutas relativas, con extensión `.js`)
- **Conflict detection:** `_force: true` salta check; `_localModifiedEn` para comparación
- **Paginación:** `CONFIG.PAGE_SIZE = 20`, `getNotes()` retorna todas, filtrado/slice en `app.js`
- **IndexedDB v3:** IMAGE_CACHE con `keyPath: 'url'`
- **No demo:** El modo demo fue eliminado en hardening v1.1 — solo Supabase Auth

### Archivos clave y su rol

| Archivo | Rol en offline-first |
|---------|---------------------|
| `js/offline.js` | Contiene `createNoteOffline`, `syncPendingNotes`, `getOfflineNotes`, `syncNotesToCache`, `isOnline`, `getPendingNotes`, `deletePendingNote`, `cacheImages` |
| `js/app.js` | Orquestador. Modificar: handleFormSubmit (creación offline), getBaseNotes (fire-and-forget sync), init (badge inicial) |
| `js/store.js` | Modificar: getNotes (si offline → getOfflineNotes) |
| `js/ui/shared.js` | Modificar: renderHeader (aceptar pendingCount, renderizar badge) |
| `js/config.js` | Solo lectura — PAGE_SIZE 20 |
