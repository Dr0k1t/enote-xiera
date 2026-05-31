# Fase 2 — Primer cliente nuevo (prueba del producto)

Parte del plan de modularización (`~/.claude/plans/wondrous-splashing-robin.md`).

**Pre-condición:** Fase 1 completada — `enote-core` existe, tiene field-engine y columna `domain` JSONB.  
**Objetivo:** Validar que un negocio distinto se levanta **solo con config + assets**, sin tocar código de dominio.  
**Estado:** PENDIENTE (no iniciar hasta que Fase 1 esté completa y Xiera consuma el core sin regresiones).

---

## Qué construye el cliente nuevo

### Repo `enote-<cliente>`

```
enote-cliente/
├── vendor/enote-core/          ← git submodule pinado (tag semver)
├── config/
│   ├── fields.js               ← DOMAIN_FIELDS del vertical nuevo
│   ├── branding.js             ← nombre, logo, colores, redes sociales
│   └── index.js                ← roles, estatus, locations, defaultDestino
├── assets/
│   ├── fonts/                  ← fuentes self-hosted del cliente
│   ├── icons/                  ← iconos PWA generados
│   └── splash/                 ← splash screens iOS
├── manifest.json               ← PWA del cliente
├── .env                        ← SUPABASE_URL + SUPABASE_ANON_KEY del Supabase del cliente
├── vercel.json                 ← buildCommand, headers, rewrites (hereda del core)
└── supabase/
    └── migrations/
        ├── 0001_rls_baseline.sql   ← plantilla del core adaptada
        └── 0002_rls_admin_sucursal.sql
```

### Supabase del cliente

- Proyecto nuevo (1 Supabase por cliente).
- Schema del core: `notes` con columnas estables + `domain jsonb`.
- RLS: políticas del core como plantilla.
- Usuarios/profiles propios del negocio.

---

## Proceso de alta de un cliente nuevo

1. Crear repo `enote-<cliente>` con submodule al tag de core deseado.
2. Configurar `config/fields.js` con los campos del vertical (pastelería, tortillería, mueblería…).
3. Configurar `config/branding.js` y `config/index.js` (roles, estatus, locations).
4. Generar assets PWA: `node vendor/enote-core/scripts/generate-icons.js` (ajustar SVG/colores).
5. Crear Supabase, correr migraciones, crear usuarios.
6. Copiar `.env.example` → `.env`, rellenar con las keys del nuevo Supabase.
7. Deploy en Vercel: `npx vercel --prod`.

---

## Criterio de éxito

- Formulario, validación, recibo, detalle, diff y permisos funcionan para el vertical nuevo
  **sin editar nada de `vendor/enote-core/js/`**.
- Bump de versión del core en el repo-cliente y re-deploy limpio no rompe nada.
- Los campos del nuevo vertical aparecen en form, detalle, recibo y diff automáticamente por el field-engine.

---

## Migración opcional de Xiera al core

Una vez que Fase 2 valide el modelo:

1. Adaptar `enote-xiera` para consumir `enote-core` como dependencia.
2. Correr migración JSONB para mover columnas de pastel a `domain`.
3. Verificar que las 3 suites de audit pasan.
4. Retirar el código de dominio legacy de `enote-xiera`.

Esto convierte Xiera de repo legacy a cliente estándar del core.
