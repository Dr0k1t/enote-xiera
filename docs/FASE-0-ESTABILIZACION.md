# Fase 0 — Estabilización de Xiera (reporte de ejecución)

Parte del plan de modularización (`~/.claude/plans/wondrous-splashing-robin.md`). Esta fase cierra bugs móvil/PWA de alta severidad y endurece seguridad en lo que es **código puro** (sin tocar Supabase). Lo que requiere acción en el dashboard de Supabase queda listado en "Pendiente para ti".

Fecha: 2026-05-31. Rama: `main`.

---

## 1. Lo que se hizo (código)

### 1.A Bugs móvil / PWA

| Fix | Archivo(s) | Detalle |
|-----|-----------|---------|
| Zoom iOS al enfocar inputs | `css/main.css` | `font-size` de inputs/select/textarea y inputs de producto subido a `1rem` (16px). iOS Safari ya no fuerza zoom. |
| `100vh` se rompe con teclado/barra | `css/main.css`, `offline.html` | Añadido fallback `100dvh` (body, `#loading`, login, detail, `.modal-card`). Navegadores sin `dvh` siguen con `vh`. |
| IndexedDB `onblocked` rompía offline | `js/offline.js` | `onblocked` ya no rechaza de inmediato: espera a que la otra pestaña cierre; si sigue bloqueada 5s, degrada a online-only (`_dbBlocked`) en vez de romper la app. Lecturas devuelven vacío/`null`; auto-recupera cuando se libera. |
| Notas offline borradas en silencio | `js/offline.js`, `js/app.js` | `syncPendingNotes` ya **no elimina** notas tras 9 fallos: las conserva en cola marcadas (`_permanentError`) y avisa con el motivo real. Distingue error permanente (validación/permiso) de transitorio (red). |
| **Post-review fix:** Items marcados `_permanentError` re-sincronizaban infinitamente | `js/offline.js` | `getPendingNotes` ahora filtra items con `_permanentError` definido. Antes cada ciclo de sync los re-leía, re-intentaba, y re-notificaba al usuario. |
| **Post-review fix:** `_dbBlocked` nunca se reseteaba tras timeout | `js/offline.js` | El `setTimeout(5s)` que rechaza `openDB()` ahora limpia `_dbBlocked = false`. Sin esto, la app quedaba en online-only permanente hasta reload de página. |
| Falta teclado numérico | `js/ui/form.js` | `inputmode="numeric"` en cantidad de producto; `inputmode="decimal"` en los 5 campos financieros. |
| Doble listener `controllerchange` (perdía borrador) | `js/boot.js` (nuevo), `index.html`, `js/app.js` | Unificado: `boot.js` solo recarga si `app.js` no cargó (recovery); si la app está viva, delega en su handler que **respeta borradores** (`window.__enoteAppLoaded`). |
| Cierre accidental de modal al arrastrar | `js/app.js` | El modal solo cierra por overlay si el `pointerdown` **inició** en el overlay (`_downOnOverlay`). Arrastrar desde dentro hacia afuera ya no descarta el borrador. |
| WebP no soportado en Safari iOS viejo | `js/imageUtils.js` | Si `toBlob('image/webp')` devuelve `null`, cae a `image/jpeg`. |
| Safe-area iOS faltante | `css/main.css` | Toasts, `.modal-footer` y barra offline ahora descuentan `env(safe-area-inset-*)`. |
| Toasts largos desbordaban | `css/main.css` | `white-space: normal` + `max-width` + centrado. |

### 1.B Seguridad (código puro)

| Fix | Archivo(s) | Detalle |
|-----|-----------|---------|
| Mass-assignment en `updateNote` | `js/store.js` | Whitelist explícita de columnas actualizables. Claves desconocidas del cliente se ignoran (antes: toda clave entrante iba al `update`). |
| Sin validación de `estatus`/`metodoPago`/`horaPeriodo` | `js/store.js` | Validados contra whitelist en `validateNoteFields` y en `updateNote`. |
| Validación incompleta | `js/store.js` | Añadidos límites de longitud (texto ≤500, producto ≤200, máx 50 productos) y numéricos ≥0. |
| PII en logs | `js/logger.js` | Eliminados `username`, `tomadaPor` y `originalName` (nombre de archivo). Solo se loguea rol, ids y tamaños. |
| `/api/log` sin límites | `api/log.js` | Cap de payload a 4 KB (evita log-spam/DoS de coste). |
| `script-src 'unsafe-inline'` | `vercel.json`, `index.html`, `offline.html`, `js/boot.js`, `sw.js` | CSP endurecida a `script-src 'self'`. Único script inline (`index.html`) movido a `js/boot.js`; `onclick` de `offline.html` → enlace. `boot.js` añadido al precache del SW. |

**Verificación local hecha:** `node --check` sobre todos los `.js` editados (OK), JSON de `vercel.json`/`manifest.json` válido, `node scripts/build-config.js` corre sin error y no pisa el precache.

---

## 2. Pendiente para ti (no se puede desde el repo)

### 2.A Supabase — keystone de seguridad (PRIORIDAD ALTA)

Todo el modelo de autorización descansa en RLS, que **no está en el repo** y no pude auditar. Hay que:

**1. Versionar las políticas actuales.** En el SQL Editor de Supabase:
```sql
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('notes','profiles','routes')
order by tablename, cmd;
```
Copia el resultado a `supabase/migrations/0001_rls_baseline.sql` y commitéalo. Confirma que hay políticas para **SELECT/INSERT/UPDATE/DELETE** en cada tabla y que reflejan la matriz de `js/config.js` (admin todo; sucursal solo su destino; planta y repartidor **no escriben**).

**2. Derivar identidad en el servidor.** Hoy `creado_por`/`modificado_por`/`tomada_por` los manda el cliente (`session.username`) → falsificables. Trigger que los fuerza desde el usuario autenticado (verifica nombres de columna antes de correr):
```sql
create or replace function public.set_note_audit_fields()
returns trigger language plpgsql security definer
set search_path = public as $$
declare uname text;
begin
  select username into uname from public.profiles where id = auth.uid();
  if (tg_op = 'INSERT') then
    new.creado_por := coalesce(uname, new.creado_por);
  elsif (tg_op = 'UPDATE') then
    new.modificado_por := coalesce(uname, new.modificado_por);
    if (new.tomada is distinct from old.tomada) then
      new.tomada_por := case when new.tomada then uname else null end;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_note_audit on public.notes;
create trigger trg_note_audit
  before insert or update on public.notes
  for each row execute function public.set_note_audit_fields();
```

**3. (Opcional) Constraints de columna** para `estatus`/`metodo_pago` como defensa extra a la validación de cliente (`check (estatus in (...))`).

### 2.B Probar y desplegar

1. **Prueba el boot en un dispositivo real (iOS Safari).** Es lo más crítico: cambié CSP y el script de arranque. Verifica:
   - La app carga (sin errores CSP en consola).
   - Enfocar un input **no** hace zoom; abrir el teclado **no** recorta login ni modal.
   - El SW se actualiza y recarga sin loop; con un borrador abierto, avisa en vez de recargar.
2. **Corre las suites** (tus comandos):
   ```bash
   node scripts/build-config.js
   npx serve .                      # en otra terminal
   node audit-offline.js http://localhost:3000
   node audit-prod.js               # tras desplegar
   node audit-v2.js
   node scripts/pw-verify.js
   ```
3. **Deploy:** `npx vercel --prod`.
   4. **Post-review (v1.3.3→v1.3.4):** Verifica que items en cola con `_permanentError` no reaparecen al reconectar (ya no hacen re-sync infinito). y que `_dbBlocked` se resetea tras timeout para recuperar online-only.

> Sugerencia: si quieres correr un login interactivo o un comando en esta sesión, usa el prefijo `!` en el prompt (ej. `! npx serve .`).

### 2.C Follow-ups diferidos (medio/bajo — no bloquean)

- **Lock multi-pestaña** en `syncPendingNotes` (Web Locks API) para evitar duplicados si el mismo usuario sincroniza desde 2 pestañas. Hoy `_syncing` es por pestaña.
- **Rate-limit real de `/api/log`** vía Vercel Firewall/BotID o un store (KV). El cap de 4 KB ayuda pero no limita frecuencia.
- **SW network-first con timeout** para redes "lie-fi" (`sw.js`): hoy espera el fetch colgado en vez de servir cache.
- **Bucket de imágenes privado + signed URLs** si las fotos contienen PII (hoy es público).
- **`graphify-out/`**: si está en el repo, excluirlo del deploy (`outputDirectory: "."` sube todo y su `graph.html` usa inline scripts que la nueva CSP bloquea).

---

## 3. Siguiente fase

Con Xiera estabilizada y desplegada, sigue **Fase 1: construir `enote-core`** (repo nuevo) — field-engine dirigido por datos + columna `domain` JSONB + parametrizar branding/estatus/roles. Detalle en el plan. Recomendado: validar primero que esta Fase 0 corre limpia en producción antes de arrancar el core.
