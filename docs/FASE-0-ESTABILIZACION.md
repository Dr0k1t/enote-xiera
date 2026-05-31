# Fase 0 — Estabilización de Xiera (reporte final)

Parte del plan de modularización (`~/.claude/plans/wondrous-splashing-robin.md`).
Esta fase cierra bugs móvil/PWA de alta severidad, endurece seguridad en código puro y
alinea el formulario de edición con el recibo impreso físico.

**Estado:** COMPLETADO  
**Versión:** v1.3.5  
**Rama:** `main`  
**Fecha cierre:** 2026-05-31

---

## 1. Lo que se hizo (código)

### 1.A Bugs móvil / PWA

| Fix | Archivo(s) | Detalle |
|-----|-----------|---------|
| Zoom iOS al enfocar inputs | `css/main.css` | `font-size` de inputs/select/textarea subido a `1rem` (16 px). iOS Safari ya no fuerza zoom. |
| `100vh` con teclado/barra | `css/main.css`, `offline.html` | `dvh` con fallback `vh` en body, `#loading`, login, detail, `.modal-card`. |
| IndexedDB `onblocked` rompía offline | `js/offline.js` | `onblocked` espera 5 s antes de degradar a online-only (`_dbBlocked`). Se resetea al expirar el timeout. Auto-recupera al liberar. |
| Notas offline borradas en silencio | `js/offline.js`, `js/app.js` | `syncPendingNotes` conserva notas en cola marcadas `_permanentError`. Distingue error permanente (validación/permiso) de transitorio (red). `getPendingNotes` filtra items con `_permanentError` para evitar re-sync infinito. |
| Falta teclado numérico | `js/ui/form.js` | `inputmode="decimal"` en campos financieros. |
| Doble listener `controllerchange` | `js/boot.js` (nuevo), `index.html`, `js/app.js` | Unificado: `boot.js` solo recarga si la app no cargó; si está viva delega al handler que respeta borradores. |
| Cierre accidental de modal al arrastrar | `js/app.js` | El modal solo cierra por overlay si `pointerdown` inició en el overlay (`_downOnOverlay`). |
| WebP no soportado en Safari iOS viejo | `js/imageUtils.js` | Fallback a `image/jpeg` si `toBlob('image/webp')` devuelve `null`. |
| Safe-area iOS faltante | `css/main.css` | Toasts, `.modal-footer`, barra offline descuentan `env(safe-area-inset-*)`. |
| Toasts largos desbordaban | `css/main.css` | `white-space: normal` + `max-width` + centrado. |

### 1.B Seguridad (código puro)

| Fix | Archivo(s) | Detalle |
|-----|-----------|---------|
| Mass-assignment en `updateNote` | `js/store.js` | Whitelist explícita de columnas actualizables. |
| Sin validación de `estatus`/`metodoPago`/`horaPeriodo` | `js/store.js` | Validados contra whitelist en `validateNoteFields` y `updateNote`. |
| Validación incompleta | `js/store.js` | Límites de longitud (texto ≤ 500, máx 50 productos), numéricos ≥ 0. |
| PII en logs | `js/logger.js` | Eliminados `username`, `tomadaPor`, `originalName`. Solo se loguea rol, ids y tamaños. |
| `/api/log` sin límites | `api/log.js` | Cap de payload a 4 KB. |
| `script-src 'unsafe-inline'` | `vercel.json`, `index.html`, `offline.html`, `js/boot.js`, `sw.js` | CSP endurecida a `script-src 'self'`. Único script inline movido a `js/boot.js`. |
| RLS versionado (baseline) | `supabase/migrations/0001_rls_baseline.sql` | Helpers `get_my_role`/`get_my_destino`, trigger auditoría `set_note_audit_fields`, anti-escalada de rol, políticas planta/repartidor. |
| RLS faltante admin/sucursal | `supabase/migrations/0002_rls_admin_sucursal.sql` | Políticas admin ALL; sucursal SELECT/UPDATE/DELETE por destino. Completa la baseline reproducible. |

### 1.C Recorte del formulario al recibo (v1.3.5)

El formulario "editar nota" tenía una tabla genérica de `productos` (residuo del concepto
original de remisión de logística). El recibo impreso físico es un pedido de pastel; no existe
una sección de "lista de productos" en él. Para pedidos que no son pasteles, el cliente
escribe a mano en los campos de texto/observaciones (preserva la "nostalgia" de la nota física).

| Fix | Archivo(s) | Detalle |
|-----|-----------|---------|
| Tabla de productos eliminada del form | `js/ui/form.js` | Se remueve `Lista de productos` (tabla + botón + `renderProductRow`). `getFormData` ya no extrae `productos`. |
| Columna `notes.productos` dormida | `js/store.js` | `createNote` escribe `productos: []`; `updateNote` y `CONTENT_FIELDS` la excluyen. `mapDbNote` la omite del objeto JS. La columna y datos viejos quedan intactos en Supabase. |
| Validación de contenido actualizada | `js/store.js` | `validateNoteFields` requiere al menos un campo de texto (clienteNombre, sabor, modelo, texto, observaciones) o `costoPastel > 0`. |
| Sección "Productos" eliminada del detalle | `js/ui/detail.js` | Se remueve la tabla de productos y la fila en el conflict view. |
| Dashboard sin fallback de productos | `js/ui/dashboard.js` | Se remueve `prodCount`/`prodLabel`/`productosRow`; tarjeta muestra cliente/pastel/total. |
| Tarjeta repartidor sin productos | `js/ui/repartidor.js` | Se remueve `prodSummary`; tarjeta muestra cliente, dirección, hora, fecha. |
| Búsqueda ampliada | `js/app.js` | Busca por `clienteNombre`, `sabor`, `modelo`, `texto` en lugar de `productos[]`. |
| Suites E2E actualizadas | `audit/audit-prod.js`, `audit/audit-v2.js` | `fillNoteForm` usa sabor/clienteNombre en lugar de prod-nombre-inp/prod-cantidad-inp. |
| `Product` typedef eliminado | `js/types.js` | Unreferenced tras el recorte. `productos` marcada como columna dormida. |

---

## 2. Pendiente para ti (no se puede desde el repo)

### 2.A Correr migración RLS en Supabase — PRIORIDAD ALTA

`supabase/migrations/0002_rls_admin_sucursal.sql` está listo. Cópialo y córrelo en el SQL
Editor de Supabase. Verifica que las 9 políticas esperadas existan:

```sql
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'notes'
order by policyname;
```

Resultado esperado (9 políticas):

| policyname | cmd |
|-----------|-----|
| notes_admin_all | ALL |
| notes_delete_sucursal | DELETE |
| notes_insert_allowed | INSERT |
| notes_select_planta | SELECT |
| notes_select_repartidor | SELECT |
| notes_select_sucursal | SELECT |
| notes_update_planta | UPDATE |
| notes_update_repartidor | UPDATE |
| notes_update_sucursal | UPDATE |

### 2.B (Opcional) Constraints de columna en Supabase

Añadir constraints de BD como defensa extra a la validación de cliente:
```sql
alter table public.notes
  add constraint notes_estatus_check
    check (estatus in ('Nueva', 'En Proceso', 'Completada', 'Cancelada'));
```

### 2.C Probar y desplegar v1.3.5

1. **iOS Safari real:**  
   - La app carga sin errores CSP.  
   - Enfocar input no hace zoom; el teclado no recorta login ni modal.  
   - Crear nota: no aparece tabla de productos; guardar con solo datos de pastel funciona.  
   - Editar nota en "En Proceso": diff visible sin fila de productos y sin crash.  
   - Vista repartidor: tarjeta muestra cliente/dirección/hora, sin línea de productos.

2. **Correr suites:**
   ```bash
   node scripts/build-config.js
   npx serve .                        # en otra terminal
   node audit/audit-offline.js http://localhost:3000
   node audit/audit-v2.js http://localhost:3000
   # Con credenciales reales en prod:
   node audit/audit-prod.js https://enote-xiera.vercel.app
   node scripts/pw-verify.js https://enote-xiera.vercel.app
   ```

3. **Deploy:** `npx vercel --prod`

---

## 3. Follow-ups diferidos (medio/bajo — no bloquean Fase 1)

- **Lock multi-pestaña** en `syncPendingNotes` (Web Locks API) para evitar duplicados.
- **Rate-limit real de `/api/log`** vía Vercel Firewall/BotID.
- **SW network-first con timeout** para lie-fi (`sw.js`).
- **Bucket de imágenes privado + signed URLs** si hay PII en fotos.
- **`graphify-out/`**: excluir del deploy si está en el repo (inline scripts → bloquea CSP).

---

## 4. Siguiente fase

→ **Fase 1: construir `enote-core`** — ver `docs/FASE-1-CORE.md`.
