# Instructivo de Desarrollo — Enote

Guía técnica para desarrolladores que trabajen sobre este proyecto.

---

## 1. Descripción

**Enote** es un sistema de notas de remisión interno para negocios con manufactura distribuida. Esta versión es un **demo estático** (HTML/CSS/JS vanilla, sin backend) diseñado para presentaciones de venta. Los datos se almacenan en `localStorage` del navegador.

**Cliente actual:** Xiera — Ocotlán, Jalisco.

---

## 2. Estructura de archivos

```
enote-xiera/
├── index.html            Shell SPA. Solo contiene el div #app y el <script>.
├── css/
│   ├── variables.css     Design tokens (colores, tipografía, espaciado).
│   ├── main.css          Todos los estilos de la aplicación.
│   └── print.css         Layout de impresión (PDF). Solo activo con media="print".
├── js/
│   ├── config.js         ← ÚNICO archivo a cambiar por cliente. Usuarios, ubicaciones, nombre.
│   ├── auth.js           Login/logout/session en localStorage.
│   ├── store.js          CRUD de notas en localStorage. Schema de nota.
│   ├── ui.js             Funciones de renderizado (retornan HTML strings).
│   └── app.js            Orquestador. Router de vistas. Todos los event handlers.
├── audit/
│   ├── package.json      Dependencia: playwright.
│   └── audit.js          Script de auditoría automatizada con Playwright.
└── INSTRUCTIVO.md        Este archivo.
```

**Regla:** `config.js` es la única dependencia de cliente. Para adaptar a un nuevo negocio, edita solo ese archivo más los design tokens de `variables.css`.

---

## 3. Correr localmente

### Opción A — VS Code Live Server (recomendado)
1. Instala la extensión **Live Server** en VS Code.
2. Abre la carpeta `enote-xiera/` en VS Code.
3. Click derecho en `index.html` → "Open with Live Server".
4. URL: `http://localhost:5500`

### Opción B — Python HTTP server
```bash
cd enote-xiera
python -m http.server 8000
# Abre http://localhost:8000
```

### Opción C — Node.js (npx)
```bash
cd enote-xiera
npx serve .
```

### Opción D — Archivo local (`file://`)
Abre `index.html` directamente en Chrome o Firefox. Funciona porque:
- No hay llamadas `fetch()` — todos los datos son `localStorage`.
- Los ES modules (`type="module"`) funcionan en `file://` en Chrome/Firefox.

> **Nota:** Safari bloquea módulos ES en `file://`. Usa un servidor local con Safari.

---

## 4. Usuarios hardcodeados (demo)

Definidos en `js/config.js`. Cambiarlos es trivial.

| Usuario  | Contraseña | Rol    | Acceso                          |
|----------|------------|--------|---------------------------------|
| admin1   | pass       | admin  | Crear, editar, eliminar, ver todo |
| planta1  | pass       | planta | Ver su ubicación, cambiar estado, reordenar |

---

## 5. Despliegue en GitHub Pages

El demo es perfectamente compatible con GitHub Pages (archivos estáticos, sin backend).

1. Crea un repositorio privado en GitHub (privado = menos exposición).
2. Sube el contenido de `enote-xiera/` a la raíz del repositorio:
   ```bash
   git init
   git add .
   git commit -m "feat: enote demo inicial"
   git remote add origin https://github.com/TU_USUARIO/enote-xiera.git
   git push -u origin main
   ```
3. En GitHub: **Settings → Pages → Source: "Deploy from a branch" → main / (root)**.
4. Espera 2-3 minutos. URL: `https://TU_USUARIO.github.io/enote-xiera/`
5. El `<meta name="robots" content="noindex, nofollow">` ya está en `index.html` para evitar indexación.

> **Seguridad:** `noindex` solo aplica a crawlers que respetan la directiva. El repositorio privado es la barrera real. Quien tenga el link puede acceder, pero deberá autenticarse.

---

## 6. Re-skinear para otro cliente

Edita **únicamente** estos 3 archivos:

### `js/config.js`
```js
export const CONFIG = {
  clientName:     'NuevoNegocio',       // Aparece en header y notas
  clientSubtitle: 'Ciudad, Estado',
  appName:        'Enote',
  storagePrefix:  'nuevonegocio_',      // IMPORTANTE: cambiar para evitar colisión de datos
  locations: ['Sucursal Centro', 'Planta Norte'],
  defaultDestino: 'Planta Norte',
  users: [
    { username: 'admin',  password: 'clave_segura', role: 'admin',  destino: null },
    { username: 'planta', password: 'clave_planta', role: 'planta', destino: 'Planta Norte' },
  ],
  // ... resto permanece igual
};
```

### `css/variables.css`
Cambia los tokens de color según la paleta del nuevo cliente:
```css
:root {
  --color-bg:      #TU_COLOR_FONDO;
  --color-primary: #TU_COLOR_ACENTO;
  /* ... */
}
```

### `index.html`
Cambia `<title>Enote — Xiera</title>` por el nombre del nuevo cliente.

Listo. No se modifica ningún otro archivo.

---

## 7. Ejecutar auditoría Playwright

```bash
cd audit
npm install        # Descarga Playwright (~100 MB, solo la primera vez)
node audit.js      # Audit contra http://localhost:5500

# Override de URL:
ENOTE_URL=http://localhost:8000 node audit.js
```

El script:
- Toma 6 screenshots en `audit/screenshots/`
- Verifica login válido e inválido
- Verifica permisos de admin vs planta
- Verifica filtros y búsqueda
- Detecta errores de consola
- Detecta imágenes sin atributo `alt`
- Imprime reporte `PASS / FAIL`

---

## 8. Migración a Supabase (producción real)

Cuando el cliente contrate el servicio, la migración preserva toda la arquitectura. Solo se reemplazan 2 archivos:

### 8.1 Reemplazar `store.js` → Supabase
Las firmas de función permanecen **idénticas** (`getNotes`, `createNote`, `updateNote`, etc.). Solo cambia la implementación interna de `localStorage` a `supabase-js`:

```js
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);

export async function getNotes() {
  const { data } = await supabase.from('notes').select('*').order('prioridad');
  return data ?? [];
}

export async function createNote(fields, user) {
  const { data } = await supabase.from('notes').insert([{ ...fields, creado_por: user.username }]).select();
  return data?.[0];
}
// ... etc.
```

> **Nota:** Las funciones se vuelven `async`. Actualiza los `await` en `app.js` con `await getNotes()`, etc.

### 8.2 Reemplazar `auth.js` → Supabase Auth
```js
export async function login(username, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: username, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, session: data.session };
}

export function getSession() {
  return supabase.auth.getSession(); // retorna Promise
}
```

### 8.3 Schema PostgreSQL
```sql
CREATE TABLE notes (
  id            SERIAL PRIMARY KEY,
  numero        TEXT NOT NULL,
  fecha         DATE NOT NULL,
  destino       TEXT NOT NULL,
  productos     JSONB NOT NULL DEFAULT '[]',
  observaciones TEXT DEFAULT '',
  estatus       TEXT DEFAULT 'Nueva',
  creado_por    TEXT,
  creado_en     TIMESTAMPTZ DEFAULT now(),
  modificado_por TEXT,
  modificado_en  TIMESTAMPTZ DEFAULT now(),
  prioridad     INT DEFAULT 0
);
```

### 8.4 Row Level Security (RLS)
```sql
-- Habilitar RLS
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Planta solo ve sus notas
CREATE POLICY planta_select ON notes FOR SELECT
  USING (destino = current_setting('app.user_destino', true));

-- Admin ve todo
CREATE POLICY admin_all ON notes FOR ALL
  USING (current_setting('app.user_role', true) = 'admin');
```

### 8.5 Sincronización en tiempo real
```js
supabase
  .channel('notes-realtime')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => {
    showDashboard(); // Re-renderiza cuando hay cambios en otros dispositivos
  })
  .subscribe();
```

---

## 9. Arquitectura futura (PWA completa)

Para cuando el negocio escale a múltiples dispositivos con offline real:

### Service Worker + Cache API
```
Cache strategy:
  Assets (CSS/JS/HTML) → cache-first
  API calls (Supabase)  → network-first con fallback a cache
```

### IndexedDB (via Dexie.js o RxDB)
Reemplaza `localStorage` con IndexedDB para datasets grandes y cola de operaciones offline. Cuando el dispositivo recupere conexión, las operaciones en cola se sincronizan.

### Web Push Notifications
1. Generar claves VAPID.
2. Supabase Edge Function como servidor de push.
3. Service worker recibe push → notifica al trabajador de planta sobre nuevas notas.

### PWA Manifest
```json
{
  "name": "Enote — Xiera",
  "short_name": "Enote",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#C4A09A",
  "theme_color": "#7A3045"
}
```

Esto permite "Agregar a pantalla de inicio" en móvil, comportamiento similar a app nativa.

---

## 10. Seguridad para producción

| Ítem | Demo | Producción |
|------|------|------------|
| Autenticación | Credenciales hardcodeadas en config.js | Supabase Auth (JWT) |
| Autorización | Checks en cliente (JS) | Row Level Security en PostgreSQL |
| HTTPS | Según hosting | GitHub Pages / Netlify / Vercel: automático |
| Credenciales en repo | ⚠ Solo en repo privado | Supabase env vars, NUNCA en código |
| noindex | ✓ En `<head>` | ✓ Mantener |

> **Regla de oro:** En producción, la autorización nunca depende solo del cliente (JavaScript). El RLS de Supabase es la barrera real. Los checks en `app.js` son solo para UX.

---

## 11. Hoja de ruta recomendada

```
Fase 0 (actual)  → Demo estático, localStorage, GitHub Pages privado
Fase 1           → Supabase + auth real + RLS (sin offline)
Fase 2           → PWA + Service Worker + IndexedDB offline queue
Fase 3           → Web Push + WhatsApp API integration
Fase 4           → Multi-tenant (configurar para N clientes desde panel)
```

Cada fase es independiente. La fase 1 no requiere reescribir el frontend — solo reemplazar `store.js` y `auth.js`.
