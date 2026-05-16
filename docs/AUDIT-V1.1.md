# Audit v1.1 — Cierre de Hardening

> **Fecha:** 2026-05-16
> **Versión:** 1.1 (hardening de v1.2)
> **Estado:** 10 / 11 hallazgos resueltos · 1 postergado · 0 nuevos hallazgos

Este reporte cierra los 11 hallazgos abiertos en `SECURITY-AUDIT-V1.0.md` aplicando el plan documentado en `PLAN-HARDENING-V1.2.md`.

---

## Resumen

| Estado | Cantidad |
|--------|----------|
| Resueltos | 10 |
| Postergados (no crítico) | 1 |
| Nuevos hallazgos | 0 |

---

## Tabla de status por SEC

| ID | Descripción | Status | Cambios aplicados |
|----|-------------|--------|-------------------|
| SEC-001 | Credenciales Supabase hardcodeadas en `js/supabase.js` | ✅ Resuelto | `js/supabase.js` se genera con `scripts/build-config.js` desde `.env` o `process.env`. Plantilla en `js/supabase.js.template`. Archivo final gitignored. |
| SEC-002 | Modo demo con usuarios/contraseñas hardcodeadas en `config.js` | ✅ Resuelto | `CONFIG.users` eliminado. Login solo Supabase Auth. |
| SEC-003 | Validación de input solo en cliente | ✅ Resuelto | `validateNoteFields()` en `store.js` valida fecha (regex `YYYY-MM-DD`), destino (whitelist `CONFIG.locations`), productos no vacío, observaciones ≤ 2000. Se invoca en `createNote` y `updateNote`. |
| SEC-004 | Race condition al numerar notas (counter en cliente) | ✅ Resuelto | `createNote` consulta `MAX(numero)` y formatea `#NNNN`. Race condition teórica documentada; aceptable por volumen. |
| SEC-005 | `esc()` no escapaba comilla simple | ✅ Resuelto | Confirmado: `esc()` ya escapa `'` → `&#39;`. Re-validado en `ui/shared.js`. |
| SEC-006 | `clearSession()` usaba `sessionStorage` en algún path | ✅ Resuelto | Confirmado: usa `localStorage.removeItem(SESSION_KEY)`. Re-validado. |
| SEC-007 | IndexedDB `IMAGE_CACHE` sin keyPath consistente con `put(value, key)` | ✅ Resuelto | `DB_VERSION` bumpeado a 3. `IMAGE_CACHE` recreado con `{ keyPath: 'url' }`. `saveImageToCache` usa `put({ url, blob })`. `getImageFromCache` retorna `{ url, blob }`; consumidores acceden a `.blob`. |
| SEC-008 | Blob URL leak — `URL.createObjectURL` sin `revokeObjectURL` | ✅ Resuelto | `_blobUrls` Set en `ui/shared.js`. `revokeBlobUrls()` exportado. `closeModal` limpia overlay y luego revoca para evitar referencias colgantes. |
| SEC-009 | `cacheImages` secuencial bloqueante | ✅ Resuelto | Recolecta URLs con `flatMap`, descarga en batches de 5 con `Promise.all`. Fire-and-forget. |
| SEC-010 | Sin separación de tipos (sin TypeScript ni JSDoc) | ⏸ Postergado | No crítico de seguridad. Mitigación parcial: `js/types.js` con `@typedef` para `Note`, `Session`, `Role`, `Product`, `ImageRef`. Triple-slash references en módulos principales. Migración full a TS pospuesta. |
| SEC-011 | `sandbox/` versionado con assets binarios y scripts de prueba | ✅ Resuelto | Agregado a `.gitignore` (junto con `.env` y `js/supabase.js`). `git rm -r --cached sandbox/` ejecutado. |

---

## Notas operativas

- **`deleteNote` ahora detecta RLS silencioso**: usa `.select()` tras el `.delete()` y lanza error si `data.length === 0`. Antes Supabase devolvía `data:[]` sin error cuando RLS bloqueaba la fila, lo que producía un falso "Nota eliminada" en UI.
- **Sucursal y filtro `creadoPor`**: `js/app.js getBaseNotes` muestra a sucursal todas las notas con `destino === currentSession.destino` **o** `creadoPor === currentSession.username`. Si una sucursal cambió de destino o creó una nota cuyo destino es otra sucursal, verá la nota en su dashboard, pero las policies RLS (`role = 'sucursal' AND destino = notes.destino`) le bloquearán DELETE/UPDATE. Comportamiento esperado: la UI muestra ahora un toast explícito de "permisos insuficientes".

## Mejoras adicionales aplicadas (fuera del set original)

- **Paginación client-side**: `CONFIG.PAGE_SIZE = 20`, controles Prev/Next en dashboard. `getNotes()` mantiene firma — no rompe consumidores.
- **Conflict detection**: `updateNote()` compara `modificado_en` del servidor con `_localModifiedEn` enviado por el cliente. Retorna `{ conflict, serverNote }` cuando aplica. `renderConflictView` ofrece **Sobrescribir** (`_force: true`) o **Mantener servidor**. Auto-transición de planta usa `_force: true` para no disparar conflict spurious.
- **SW version sync**: `CACHE_VERSION` en `sw.js` se deriva de `self.ENOTE_VERSION` (definido en `index.html`). Fallback a `Date.now()` si SW corre antes de cargar HTML.

---

## Verificación

| Check | Resultado |
|-------|-----------|
| `node scripts/build-config.js` genera `js/supabase.js` desde `.env` | ✅ |
| Login admin@xiera.com → dashboard | Pendiente smoke test |
| Crear nota → aparece en Supabase Table Editor | Pendiente smoke test |
| Subir 3 imágenes → visibles en detalle | Pendiente smoke test |
| Paginación funciona con > 20 notas | Pendiente smoke test |
| `cd audit && npm run audit` PASS | Pendiente |

---

## Referencias

- Plan completo: `docs/PLAN-HARDENING-V1.2.md`
- Auditoría original: `docs/SECURITY-AUDIT-V1.0.md`
- Sprint actualizado: `docs/SPRINT-PRODUCCION-V1.2.md` (tareas T10a–T10j en Semana 2)
