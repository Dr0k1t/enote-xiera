# Enote — Sistema de Notas de Remisión

> **Cliente:** Xiera — Panadería, Ocotlán, Jalisco
> **Versión:** v1.8.0 — En producción
> **URL:** https://xiera.site

Sistema de notas de remisión digital para operaciones multi-planta. Reemplaza el papel carbón con un flujo digital offline-first, PDF vectorial y workflow de estatus por roles.

---

## Setup local

```bash
# 1. Clonar
git clone https://github.com/<owner>/enote-xiera.git
cd enote-xiera

# 2. Variables de entorno
cp .env.example .env
# Editar .env con las keys de Supabase (ver sección Backend)

# 3. Generar archivos de configuración (obligatorio antes de servir)
node scripts/build-config.js

# 4. Servir local
npx serve .
# Abrir http://localhost:3000
```

> `scripts/build-config.js` genera dos archivos **gitignoreados**:
> - `js/supabase.js` — cliente Supabase con las keys inyectadas
> - `js/typstAssets.js` — template Typst + logo en base64
>
> También descarga el compiler WASM de Typst (~27 MB) si no existe en `assets/typst/`.
> No editar esos archivos manualmente.

---

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `SUPABASE_URL` | URL del proyecto Supabase (`https://xxxx.supabase.co`) |
| `SUPABASE_ANON_KEY` | Anon/public key de Supabase |
| `ENOTE_VERSION` | Versión para el Service Worker (default: valor en `config.js`) |

**Local:** crear `.env` en la raíz (gitignoreado).
**Vercel (producción):** configurar en Project Settings → Environment Variables del proyecto `dr0k1ts-projects/enote-xiera`.

---

## Deploy

```bash
# Deploy manual a producción
npx vercel --prod

# O simplemente hacer push — Vercel ejecuta el build automáticamente
git push origin main
```

`vercel.json` tiene configurado `buildCommand: node scripts/build-config.js`. Vercel inyecta las env vars antes del build.

---

## Arquitectura

SPA vanilla JS sin frameworks ni bundlers. `index.html` carga `js/app.js` como ES module. Supabase JS vendorizado localmente (sin CDN).

```
index.html
└── js/app.js (orquestador — estado global, delegación de eventos)
    ├── js/auth.js          login/logout, helpers de permisos
    ├── js/store.js         CRUD Supabase, conflict detection, validación
    ├── js/config.js        constantes: roles, estatus, destinos, PAGE_SIZE=20
    ├── js/offline.js       IndexedDB v4 — IMAGE_CACHE + PENDING_QUEUE
    ├── js/logger.js        POST silencioso a /api/log
    ├── js/imageUtils.js    compressImage → WebP 40%
    ├── js/boot.js          recovery SW, failsafe 8s
    ├── js/typstReceipt.js  generación PDF con Typst WASM
    └── js/ui/
        ├── shared.js       esc(), openModal(), formatFecha(), renderToast()
        ├── login.js        vista login
        ├── dashboard.js    grid + filtros + paginación client-side
        ├── form.js         formulario crear/editar
        ├── detail.js       detalle + diff + conflict view
        ├── repartidor.js   vista repartidor, toggle tomada
        ├── print.js        orquestador PDF (Typst → fallback window.print)
        └── weekPicker.js   selector de semana tipo calendario
```

### Archivos generados (no editar)

| Archivo | Generado por |
|---------|-------------|
| `js/supabase.js` | `scripts/build-config.js` |
| `js/typstAssets.js` | `scripts/build-config.js` |
| `assets/typst/typst_ts_web_compiler_bg.wasm` | `scripts/build-config.js` (descarga) |

### Vendor

| Archivo | Descripción |
|---------|-------------|
| `js/vendor/supabase-js.esm.js` | Supabase JS v2 (44 KB, self-hosted) |
| `js/vendor/typst.ts.esm.js` | Typst WASM loader (206 KB, self-hosted) |

---

## Roles y permisos

| Rol | Ve | Crear | Editar | Eliminar | Offline |
|-----|----|-------|--------|----------|---------|
| `admin` | Todas las notas | ✅ | ✅ | ✅ | Cache lectura |
| `planta` | Todas las notas | ❌ | Solo estatus | ❌ | Cache lectura |
| `sucursal` | Solo su destino | ✅ | Solo `Nueva` | ❌ | Cola escritura |
| `repartidor` | Vista propia | ❌ | Toggle `tomada` | ❌ | ❌ |

---

## Backend (Supabase)

- **Proyecto:** `https://ovlhabedefwbajrnfpup.supabase.co`
- **Auth:** Email + contraseña. Confirm email: OFF
- **RLS:** Activo en tablas `profiles`, `notes`, `routes`

### Agregar usuario

1. Supabase → Authentication → Users → **Add user**
2. Copiar el UUID del usuario creado
3. SQL Editor:

```sql
INSERT INTO profiles (id, username, role, destino)
VALUES ('<uuid>', 'nombre', 'admin|planta|sucursal|repartidor', '<destino o NULL>');
```

### Migración v1.8.0 — Folio atómico

> Debe aplicarse en Supabase SQL Editor **antes** de deployar v1.8.0. Sin este trigger todos los INSERTs fallan (`not_null_violation` en columna `numero`).

```sql
-- 1. Secuencia desde el folio máximo actual
CREATE SEQUENCE IF NOT EXISTS notes_folio_seq;
SELECT setval('notes_folio_seq',
  COALESCE(
    (SELECT MAX(NULLIF(regexp_replace(numero, '\D', '', 'g'), '')::int) FROM notes),
    0
  )
);

-- 2. Función que asigna folio si viene vacío
CREATE OR REPLACE FUNCTION assign_folio() RETURNS trigger AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := '#' || lpad(nextval('notes_folio_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- 3. Trigger BEFORE INSERT
CREATE TRIGGER trg_assign_folio
  BEFORE INSERT ON notes
  FOR EACH ROW EXECUTE FUNCTION assign_folio();

-- 4. Constraint UNIQUE como defensa
ALTER TABLE notes ADD CONSTRAINT notes_numero_unique UNIQUE (numero);
```

Verificar: `SELECT nextval('notes_folio_seq');` debe devolver el siguiente folio libre.

---

## Testing

```bash
cd audit && npm install

# Suite offline (no requiere login)
node audit-offline.js [URL]

# Suite producción (3 roles, CRUD, offline, reconexión, PWA, a11y)
AUDIT_PASS=<contraseña> node audit-prod.js [URL]

# Suite v2 (pastelería, financiero, PDF)
node audit-v2.js [URL]

# Verificar PWA y config post-deploy
node scripts/pw-verify.js [URL]
```

Variables opcionales para `audit-prod.js`: `ENOTE_URL`, `AUDIT_PASS`, `HEADLESS=0`.

> `audit.js` está obsoleto — usaba credenciales demo que ya no existen.

---

## Scripts de utilidad

| Script | Uso |
|--------|-----|
| `scripts/build-config.js` | Genera archivos de config (ejecutar antes de servir) |
| `scripts/generate-icons.js` | Regenera iconos PWA desde `icons/icon.svg` |
| `scripts/generate-splash.js` | Regenera splash screens iOS en `icons/splash/` |
| `scripts/make-logo.js` | Recoloriza logo para PDF (tinta negra) |
| `scripts/pw-verify.js` | Verificación post-deploy (PWA, headers, config) |
| `scripts/diagnose-401.js` | Debug de errores 401 de Supabase |

---

## Notas de versión

### v1.8.0
- **Cache en memoria:** `_dashboardNotes` — filtros/búsqueda/paginación son client-side. 1 fetch al entrar al dashboard; invalidación tras mutaciones, refresh, reconexión o logout.
- **Folio atómico:** trigger `trg_assign_folio` en Supabase asigna el número con `SEQUENCE`. Elimina race condition del `MAX(numero)+1` anterior.
- **Notas offline visibles:** aparecen en el dashboard con folio "— Sin folio" y badge punteado; solo permiten "Ver".
- **Cola offline FIFO:** `syncPendingNotes` ordena por `createdAt` ascendente — folios quedan en orden de creación.

### v1.7.1
- Selector de semana tipo calendario (`js/ui/weekPicker.js`) reemplaza dropdowns año/mes.

### v1.7.0
- Rol `planta` ahora ve **todas** las notas (antes solo su destino).

### v1.5.0
- PDF vectorial con Typst WASM. Fallback a `window.print()` si Typst falla.

---

## Costo de infraestructura

| Servicio | Plan | Costo |
|----------|------|-------|
| Supabase | Free | $0 |
| Vercel | Hobby | $0 |
| Dominio `xiera.site` | Registrar | ~$8/año |
| **Total mensual** | | **~$0.67** |

---

## Documentación adicional

| Archivo | Contenido |
|---------|-----------|
| `CLAUDE.md` | Documentación técnica completa para Claude Code (arquitectura detallada, patrones, RLS) |
| `CONTRIBUTING.md` | Guía de contribución para el nuevo desarrollador |
| `DESIGN.md` | Design system (colores, tipografía, componentes) |
| `PRODUCT.md` | Propósito del producto, roles de usuario, principios UX |
| `docs/GUIA-USUARIO.md` | Manual de uso para el equipo de Xiera (no técnico) |
