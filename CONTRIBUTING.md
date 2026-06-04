# Guía de contribución — Enote Xiera

Bienvenido al proyecto. Este documento cubre todo lo que necesitas para continuar el desarrollo sin fricción.

---

## Setup rápido

```bash
git clone https://github.com/<owner>/enote-xiera.git
cd enote-xiera

# Variables de entorno
cp .env.example .env
# Editar .env con SUPABASE_URL y SUPABASE_ANON_KEY (pedir al equipo anterior)

# Generar archivos de configuración
node scripts/build-config.js

# Servir local
npx serve .
```

Abre http://localhost:3000. Usa las credenciales de una cuenta de prueba (pedir al administrador de Supabase).

---

## Documentación técnica

Toda la arquitectura está documentada en **`CLAUDE.md`** en la raíz. Es el documento técnico principal:
- Historia de versiones detallada (v1.3 → v1.8.0)
- Descripción de cada módulo JS
- Patrones clave del proyecto
- Configuración de Supabase y RLS
- SQL de migraciones

También útil:
- `DESIGN.md` — design system (colores, tipografía, componentes)
- `PRODUCT.md` — propósito del producto y principios UX

---

## Convenciones de código

Este proyecto usa **vanilla JS sin frameworks ni bundlers**. No introducir React, Vue, ni herramientas de build como Vite o Webpack.

- `snake_case` para nombres de archivo Python/scripts
- `camelCase` para variables y funciones JS
- HTML como strings en las funciones de renderizado (no JSX, no templates externos)
- Sin comentarios que expliquen qué hace el código — solo los que expliquen por qué

### Seguridad
- Toda entrada de usuario pasa por `esc()` de `js/ui/shared.js` antes de insertarse en el DOM
- No construir SQL ni queries con interpolación de strings del usuario

---

## Archivos generados — no editar directamente

| Archivo | Generado por |
|---------|-------------|
| `js/supabase.js` | `node scripts/build-config.js` |
| `js/typstAssets.js` | `node scripts/build-config.js` |
| `assets/typst/typst_ts_web_compiler_bg.wasm` | `build-config.js` (descarga automática) |

Si necesitas cambiar la configuración de Supabase, edita `.env` y vuelve a correr `node scripts/build-config.js`.
Si necesitas cambiar el template del PDF, edita `templates/nota.typ` y vuelve a correr `build-config.js`.

---

## Deploy

```bash
# Deploy manual
npx vercel --prod

# O push a main — Vercel hace deploy automáticamente
git push origin main
```

Vercel ejecuta `node scripts/build-config.js` como build step (configurado en `vercel.json`). Las env vars deben estar seteadas en Vercel → Project Settings → Environment Variables.

Para verificar que el deploy quedó bien:
```bash
node scripts/pw-verify.js https://xiera.site
```

---

## Agregar usuarios al sistema

1. Supabase Dashboard → Authentication → Users → **Add user**
2. Copiar el UUID generado
3. SQL Editor:

```sql
INSERT INTO profiles (id, username, role, destino)
VALUES ('<uuid>', 'nombre_usuario', 'admin|planta|sucursal|repartidor', '<destino o NULL>');
```

Roles disponibles: `admin`, `planta`, `sucursal`, `repartidor`. El campo `destino` solo aplica para rol `sucursal`.

---

## Testing

```bash
cd audit && npm install

# Sin internet — no requiere credenciales
node audit-offline.js

# Producción — requiere credenciales
AUDIT_PASS=<contraseña> node audit-prod.js https://xiera.site

# Suite v2 (pastelería, financiero, PDF)
node audit-v2.js https://xiera.site

# Con navegador visible (debug)
HEADLESS=0 AUDIT_PASS=<contraseña> node audit-prod.js
```

> `audit.js` en la raíz de `audit/` está obsoleto.

---

## Estructura del proyecto

```
enote-xiera/
├── index.html              entrypoint SPA
├── sw.js                   Service Worker (PWA)
├── manifest.json           manifest PWA
├── offline.html            página fallback offline
├── vercel.json             build, rewrites, headers de seguridad
├── js/                     módulos JS (ver CLAUDE.md para descripción de cada uno)
│   ├── app.js              orquestador principal
│   ├── ui/                 vistas
│   └── vendor/             Supabase JS + Typst loader (self-hosted)
├── css/                    estilos (main, print, variables)
├── assets/
│   ├── fonts/              fuentes self-hosted
│   └── typst/              template PDF + fonts + compiler WASM
├── templates/
│   └── nota.typ            template Typst del recibo
├── scripts/                utilidades de build y verificación
├── audit/                  suite de tests E2E (Playwright)
├── api/
│   └── log.js              endpoint de logging
├── icons/                  iconos PWA
└── docs/
    └── GUIA-USUARIO.md     manual de uso para el equipo de Xiera
```

---

## Checklist al tomar el proyecto

- [ ] Pedir `SUPABASE_URL` y `SUPABASE_ANON_KEY` al equipo anterior
- [ ] Verificar acceso al proyecto Supabase (`ovlhabedefwbajrnfpup`)
- [ ] Verificar acceso al proyecto Vercel (`dr0k1ts-projects/enote-xiera`)
- [ ] Verificar que el dominio `xiera.site` apunta a Vercel
- [ ] Correr `node scripts/build-config.js` y confirmar que `js/supabase.js` se genera sin errores
- [ ] Correr `npx serve .` y confirmar login funcional
- [ ] Correr `node scripts/pw-verify.js https://xiera.site` para verificar producción
