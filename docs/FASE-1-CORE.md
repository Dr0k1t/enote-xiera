# Fase 1 — Construir `enote-core` (plan)

Parte del plan de modularización (`~/.claude/plans/wondrous-splashing-robin.md`).

**Pre-condición:** Fase 0 completada y desplegada en producción con usuarios reales sin regresiones.  
**Objetivo:** Extraer el motor genérico en un repo versionado que cualquier cliente pueda consumir.  
**Estado:** PENDIENTE (no iniciar hasta que Fase 0 esté desplegada y estable).

---

## Decisión de arquitectura (confirmada)

**Instancia-por-cliente, config-driven.** Cada cliente = 1 repo + 1 deploy Vercel + 1 Supabase.
El core es una dependencia versionada (git submodule / subtree con pin de versión semver).
Un fix en el core **no se auto-propaga**: cada cliente lo adopta explícitamente con bump + test.

---

## 1.A — Scaffold del repo `enote-core`

- Crear repo nuevo `enote-core`.
- Copiar el código ya estabilizado de `enote-xiera` (post Fase 0): `js/`, `css/`, `sw.js`,
  `scripts/`, `api/`, `vercel.json`.
- Separar **genérico (core)** de **cliente (overlay)**:
  - El repo-cliente aporta: `config/`, `assets/` (fuentes/iconos/splash), branding, `manifest.json`,
    `.env`, migraciones RLS propias de su Supabase.
  - El core expone: motor de formulario, validación, store, offline, auth, UI base.
- Incluir `enote-core` como submodule/subtree en el repo-cliente (p.ej. `vendor/enote-core/`).
- `scripts/build-config.js` se extiende para ensamblar core + overlay en el output de build.

---

## 1.B — Field-engine dirigido por datos (el refactor central)

Reemplazar los campos de dominio hardcodeados por un **esquema en config** que genera todo.

### Esquema en config

```js
// config/fields.js (repo-cliente)
export const DOMAIN_FIELDS = [
  {
    key: 'clienteNombre',
    label: 'Nombre del cliente',
    type: 'text',
    group: 'cliente',
    showIn: ['form', 'detail', 'receipt'],
    validate: { maxLength: 500 },
  },
  {
    key: 'sabor',
    label: 'Sabor',
    type: 'text',
    group: 'pastel',
    showIn: ['form', 'detail', 'receipt'],
    validate: { maxLength: 500 },
  },
  {
    key: 'costoPastel',
    label: 'Costo pastel',
    type: 'currency',
    group: 'financiero',
    showIn: ['form', 'detail', 'receipt'],
    validate: { min: 0 },
  },
  // ... resto de campos
];
```

### Generadores (core itera `DOMAIN_FIELDS`)

| Módulo | Genera |
|--------|--------|
| `js/ui/form.js` | Fieldsets/inputs dinámicos con `inputmode` correcto por `type`. |
| `js/store.js → validateNoteFields` | Valida según `validate` de cada field. Sin hardcodear campos. |
| `js/store.js → createNote/updateNote` | Lee/escribe `domain` JSONB en vez de columnas fijas. |
| `js/app.js → computeDiff` | Diff iterando `DOMAIN_FIELDS` (elimina los `add(...)` manuales). |
| `js/ui/detail.js` | Secciones generadas por `group` + `showIn`. |
| `js/ui/print.js` | Recibo generado por `group` + `showIn`. |

### Totales financieros como expresión en config

```js
{
  key: 'total',
  type: 'computed',
  formula: 'costoPastel + depositoEquipo + arreglosFigura + servicioDomicilio',
}
```

Elimina la fórmula triplicada en `form.js`, `detail.js` y `print.js`.

---

## 1.C — Parametrizar lo semi-acoplado

| Item | Hoy | En core |
|------|-----|---------|
| Branding en recibo | `X I E R A`, SVG corazón, `PAL' ALMA` hardcodeados en `print.js` | Mover a `config/branding.js` del repo-cliente |
| Colores del recibo | Hex crudos en `css/print.css` | Variables CSS en `variables.css` del cliente |
| Estatus como array | `['Nueva', 'En Proceso', 'Completada', 'Cancelada']` hardcodeado | `config.statuses: [{key, label, color, allowedTransitions}]` |
| Roles como flags | `if role === 'planta'` en múltiples archivos | `config.roles: {planta: {canCreate, canEdit, autoTransition, ...}}` |
| Destino por defecto | `'Planta de Producción'` literal en varios archivos | `config.defaultDestino` (ya existe, ampliar uso) |

---

## 1.D — Schema del core + columna `domain` JSONB

### Schema estable del core (columnas fijas)

```sql
id, numero, fecha, destino, estatus, imagenes,
tomada, tomada_por, tomada_en,
unread_new, unread_modified, prioridad,
creado_por, creado_en, modificado_por, modificado_en,
domain   jsonb default '{}'  -- campos de dominio del cliente
```

### Migración desde Xiera

```sql
-- Mover columnas de pastel actuales a domain
update public.notes set domain = jsonb_build_object(
  'clienteNombre',    cliente_nombre,
  'clienteDireccion', cliente_direccion,
  'clienteTelefono',  cliente_telefono,
  'pastelCantidad',   pastel_cantidad,
  'pisos',            pisos,
  'sabor',            sabor,
  'kilos',            kilos,
  'modelo',           modelo,
  'texto',            texto,
  'colores',          colores,
  'horaEntrega',      hora_entrega,
  'horaPeriodo',      hora_periodo,
  'direccionEntrega', direccion_entrega,
  'costoPastel',      costo_pastel,
  'depositoEquipo',   deposito_equipo,
  'arreglosFigura',   arreglos_figura,
  'servicioDomicilio',servicio_domicilio,
  'anticipo',         anticipo,
  'metodoPago',       metodo_pago
);
-- Luego drop de columnas individuales tras verificar
```

### RLS del core

Las políticas de `0001_rls_baseline.sql` y `0002_rls_admin_sucursal.sql` se vuelven plantillas
parametrizables (el repo-cliente las incluye con sus propias tablas y Supabase).

---

## Verificación (criterio de éxito de Fase 1)

- Cambiar un field en `DOMAIN_FIELDS` → aparece/desaparece en form, detalle, recibo y diff
  **sin tocar `js/`**.
- Migración JSONB: nota creada pre-migración se lee igual post-migración (datos intactos en `domain`).
- Xiera (primer consumidor del core) pasa las 3 suites de audit sin regresión.

---

## Siguiente fase

→ **Fase 2: primer cliente nuevo** — ver `docs/FASE-2-CLIENTE-NUEVO.md`.
