# Enote — Roadmap de Producción v1.2

> **Versión:** 1.2 (Offline-First / PWA Básico)
> **Alcance:** 8 usuarios, 1 organización, dominio propio
> **Timeline:** 5 semanas

---
## Nota: Todo código presentado es sugerencia, no deberá ser implementado sin antes ser analizado y revisado con cautela.

## 1. Resumen Ejecutivo

### 1.1 Objetivo

Convertir el demo actual (localStorage) en una aplicación web **PWA offline-first** que funcione incluso sin conexión a internet, con sincronización automática cuando se restablezca la conexión.

### 1.2 Stack Tecnológico

| Componente | Tecnología | Justificación |
|------------|------------|---------------|
| Backend | Supabase (PostgreSQL + Auth) | Free tier suficiente, RLS nativo, Auth incluido |
| Frontend | Vanilla JS | Código actual ya funciona, no reescribir |
| PWA | Service Worker + IndexedDB | Cache de lectura/escritura offline básico |
| Hosting | Vercel | SSL automático, CDN, dominio propio |
| Storage | Supabase Storage (opcional) | Snapshots JSON, si se requiere |

### 1.3 Usuarios (8 total)

| Rol | Cantidad | Funcionalidad Principal |
|-----|----------|------------------------|
| Admin | 1 | Crear/editar/eliminar notas, reportes, gestión completa |
| Planta | 1 | Ver notas, actualizar estatus, **funciona offline (lectura)** |
| Sucursal | 5 | Crear notas, **cola offline (escritura diferida)** |
| Repartidor | 1 | Ver rutas, marcar notas cargadas (solo online) |

---

## 2. Arquitectura del Sistema

### 2.1 Diagrama de Componentes

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTE (PWA)                                    │
│  ┌────────────────────────────────────────────────────────────────────┐      │
│  │  Frontend (Vanilla JS)                                            │      │
│  │  ├── index.html + CSS                                             │      │
│  │  ├── js/app.js (orquestador)                                      │      │
│  │  ├── js/ui.js (vistas)                                            │      │
│  │  ├── js/auth.js (Supabase Auth)                                   │      │
│  │  ├── js/store.js (API calls + offline queue)                     │      │
│  │  ├── js/offline.js ← NUEVO: cache y sync                         │      │
│  │  └── js/supabase.js (cliente)                                     │      │
│  └────────────────────────────────────────────────────────────────────┘      │
│                                    │                                          │
│  ┌────────────────────────────────────────────────────────────────────┐      │
│  │  Service Worker (sw.js)                                          │      │
│  │  ├── Cache-first para assets estáticos                           │      │
│  │  └── Intercepta requests para fallback offline                   │      │
│  └────────────────────────────────────────────────────────────────────┘      │
│                                    │                                          │
│  ┌────────────────────────────────────────────────────────────────────┐      │
│  │  IndexedDB (via idb wrapper)                                     │      │
│  │  ├── notas_cached (lectura offline para planta)                  │      │
│  │  └── pending_queue (escritura offline para sucursal)             │      │
│  └────────────────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │ HTTPS
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              VERCEL (Hosting)                                 │
│  • Frontend estático                                                         │
│  • SSL automático                                                            │
│  • Dominio: enote.tu-dominio.com                                             │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              SUPABASE (Backend)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Auth     │  │  Database   │  │  Realtime   │  │  Storage   │         │
│  │  (Users)   │  │(PostgreSQL) │  │ (Opcional)  │  │ (Snapshots)│         │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘         │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Flujo Offline por Rol

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MODO ONLINE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ADMIN → Control total(create, read, update, delete)                    │
│  PLANTA → Descarga notas a IndexedDB + trabajando normalmente              │
│  SUCURSAL → Crea notas + Cola se envía inmediatamente                     │
│  REPARTIDOR → Revisión y orden (sin necesidad offline)                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                             MODO OFFLINE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  PLANTA → ✓ Puede ver notas en cache (solo lectura)                      │
│           ✗ No puede crear/editar notas                                    │
│           ✓ PDF funciona (print.css cacheado)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  SUCURSAL → ✓ Puede crear notas (se guardan en cola)                      │
│             ✗ No ve notas de otras sucursales (sin sync)                   │
│             ⚠ Al reconnectar: cola se envía automáticamente               │
├─────────────────────────────────────────────────────────────────────────────┤
│  REPARTIDOR → ✗ No funciona offline (solo online)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  ADMIN → ✗ No funciona offline (solo online)                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Estructura de Base de Datos

### 3.1 Schema SQL (Ejecutar en Supabase SQL Editor)


```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- TABLA: RUTAS FIJAS
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE routes (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rutas iniciales
INSERT INTO routes (name) VALUES
    ('Guadalajara'),
    ('Zamora'),
    ('Ocotlán'),
    ('Lagos de Moreno'),
    ('Puerto Vallarta');

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLA: PERFILES DE USUARIO
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'planta', 'sucursal', 'repartidor')),
    destino TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLA: NOTAS DE PEDIDO
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE notes (
    id SERIAL PRIMARY KEY,
    numero TEXT NOT NULL,
    fecha DATE NOT NULL,
    destino TEXT NOT NULL,
    productos JSONB NOT NULL DEFAULT '[]',
    observaciones TEXT DEFAULT '',
    estatus TEXT DEFAULT 'Nueva' CHECK (estatus IN ('Nueva', 'En Proceso', 'Completada', 'Cancelada')),
    route_id INT REFERENCES routes(id),
    loaded BOOLEAN DEFAULT FALSE,
    loaded_at TIMESTAMPTZ,
    loaded_by TEXT,
    prioridad INT DEFAULT 0,
    creado_por TEXT NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    modificado_por TEXT,
    modificado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- ÍNDICES PARA RENDIMIENTO
-- ═══════════════════════════════════════════════════════════════════════════
CREATE INDEX idx_notes_estatus ON notes(estatus);
CREATE INDEX idx_notes_destino ON notes(destino);
CREATE INDEX idx_notes_route ON notes(route_id);
CREATE INDEX idx_notes_fecha ON notes(fecha);
CREATE INDEX idx_profiles_role ON profiles(role);
```

### 3.2 Row Level Security (RLS)

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- HABILITAR RLS
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- POLÍTICAS DE ACCESO
-- ═══════════════════════════════════════════════════════════════════════════

-- Todos ven rutas
CREATE POLICY "Everyone sees routes"
ON routes FOR SELECT TO authenticated
USING (true);

-- Admin: ve y modifica todo
CREATE POLICY "Admin full access"
ON notes FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Planta: solo notas de su destino
CREATE POLICY "Planta sees own destino"
ON notes FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'planta' AND destino = notes.destino)
);

CREATE POLICY "Planta updates own destino"
ON notes FOR UPDATE TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'planta' AND destino = notes.destino)
);

-- Sucursal: solo notas de su destino
CREATE POLICY "Sucursal sees own destino"
ON notes FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'sucursal' AND destino = notes.destino)
);

CREATE POLICY "Sucursal creates own notes"
ON notes FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'sucursal' AND destino = notes.destino)
);

-- Repartidor: notas de hoy + ya cargadas
CREATE POLICY "Repartidor sees route notes"
ON notes FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'repartidor')
    AND (loaded = true OR fecha = CURRENT_DATE)
);

CREATE POLICY "Repartidor marks loaded"
ON notes FOR UPDATE TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'repartidor')
);
```

---

## 4. Funcionalidad por Rol

### 4.1 Admin (1 usuario)

| Funcionalidad | Descripción |
|---------------|-------------|
| Crear notas | ✅ Completo, incluye selección de ruta |
| Editar notas | ✅ Todas, incluso en "En Proceso" |
| Eliminar notas | ✅ Todas |
| Ver dashboard | ✅ Todas las notas |
| Reportes | ✅ Exportar a CSV/Excel |
| Gestión usuarios | ✅ Via Supabase Dashboard |

### 4.2 Planta (1 usuario)

| Funcionalidad | Online | Offline |
|---------------|--------|---------|
| Ver notas | ✅ | ✅ (cached) |
| Actualizar estatus | ✅ | ❌ |
| Ver PDF | ✅ | ✅ (print.css cacheado) |
| Crear/editar notas | ❌ | ❌ |

**Nota:** El PDF funciona offline porque usa `window.print()` con `print.css` cacheado por Service Worker.

### 4.3 Sucursal (5 usuarios)

| Funcionalidad | Online | Offline |
|---------------|--------|---------|
| Crear notas | ✅ | ✅ (cola) |
| Ver sus notas | ✅ | ⚠️ (puede verse cache) |
| Eliminar solo "Nueva" en "Proceso" requiere confirmación del admin | ✅ | ❌ |
| Editar "Nueva" | ✅ | ❌ |

**Flujo offline para sucursal:**
1. Usuario crea nota sin internet
2. Nota se guarda en `pending_queue` (IndexedDB)
3. Al detectar conexión, se envía automáticamente
4. Si falla, reintenta hasta 3 veces, luego alerta con log del error

### 4.4 Repartidor (1 usuario)

| Funcionalidad | Descripción |
|---------------|-------------|
| Ver rutas | ✅ Tabs por cada ruta |
| Ver notas del día | ✅ Solo notas de hoy |
| Marcar como cargado | ✅ Checkbox, registra loaded_at + loaded_by |
| Solo online | ⚠️ No funciona offline (no es requisito) |

---

## 5. Implementación Offline

### 5.1 IndexedDB - Estructura

```javascript
// js/offline.js - Esquema de almacenamiento local

const DB_NAME = 'enote-local';
const DB_VERSION = 1;

// Stores
const STORES = {
    NOTES_CACHE: 'notes_cache',      // Notas descargadas (planta)
    PENDING_QUEUE: 'pending_queue',  // Notas creadas offline (sucursal)
    SETTINGS: 'settings'            // Configuración local
};
```

### 5.2 Cache de Lectura (Planta)

```javascript
// Al iniciar, planta descarga todas sus notas
async function syncNotesToLocal() {
    const notes = await getNotesFromAPI(); // Supabase
    await localDB.put(STORES.NOTES_CACHE, notes);

    // Al estar offline, leer desde IndexedDB
    async function getOfflineNotes() {
        return await localDB.getAll(STORES.NOTES_CACHE);
    }
}
```

### 5.3 Cola de Escritura (Sucursal)

```javascript
// Al crear nota sin conexión
async function createNoteOffline(noteData) {
    // 1. Guardar en cola local
    await localDB.add(STORES.PENDING_QUEUE, {
        ...noteData,
        created_at: new Date().toISOString(),
        synced: false
    });

    // 2. Mostrar toast "Nota guardada, se envía al reconectar"
    renderToast('Nota guardada offline', 'info');
}

// Al recuperar conexión
async function syncPendingNotes() {
    const pending = await localDB.getAll(STORES.PENDING_QUEUE);

    for (const note of pending) {
        try {
            await createNoteAPI(note); // Supabase
            await localDB.delete(STORES.PENDING_QUEUE, note.id);
            renderToast('Nota sincronizada', 'success');
        } catch (e) {
            console.error('Sync failed:', e);
            // Reintentar en siguiente conexión
        }
    }
}
```

### 5.4 Service Worker

```javascript
// sw.js - Cache estático

const CACHE_NAME = 'enote-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/variables.css',
    '/css/main.css',
    '/css/print.css',  // ← Importante para PDF offline
    '/js/app.js',
    '/js/ui.js',
    '/js/config.js',
    '/js/auth.js',
    '/js/store.js',
    '/js/offline.js',
    '/js/supabase.js'
];

// Install: precache todos los assets
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
    );
});

// Fetch: cache-first para estáticos
self.addEventListener('fetch', e => {
    if (e.request.destination === 'document' ||
        e.request.destination === 'style' ||
        e.request.destination === 'script') {
        e.respondWith(
            caches.match(e.request)
                .then(r => r || fetch(e.request))
        );
    }
});
```

---

## 6. Flujo del Repartidor

### 6.1 UI del Repartidor

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ENOTE — REPARTIDOR                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐            │
│  │ Guadalajara │   Zamora    │   Ocotlán   │ Lagos de M. │  ...        │
│  └──────┬───────┴──────┬───────┴──────┬───────┴──────┬───────┘            │
│         │              │              │              │                    │
│         ▼              ▼              ▼              ▼                    │
│  ┌────────────────────────────────────────────────────────────────┐       │
│  │  📦 Nota #0001 — 20 Conchas                                    │       │
│  │  📦 Nota #0003 — 15 Cuernos                                   │       │
│  │  📦 Nota #0007 — 50 Polvorones                                │       │
│  └────────────────────────────────────────────────────────────────┘       │
│         │                                                            │
│         ▼                                                            │
│  [ ] Marcar todas como cargadas                                       │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────┐       │
│  │ ☐ #0001 Conchas ×20 ─────────────────────── [CARGADO ✓]        │       │
│  │ ☑ #0003 Cuernos ×15 ─────────────────────── [CARGADO ✓]      │       │
│  │ ☐ #0007 Polvorones ×50 ───────────────────── [CARGAR]        │       │
│  └────────────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Lógica de Carga

```javascript
// Marcar nota como cargada
async function markAsLoaded(noteId) {
    await supabase
        .from('notes')
        .update({
            loaded: true,
            loaded_at: new Date().toISOString(),
            loaded_by: currentSession.username
        })
        .eq('id', noteId);
}
```

---

## 7. Deployment y Dominio Propio

### 7.1 Comprar Dominio

| Proveedor | Costo Aproximado | Recomendación |
|-----------|------------------|---------------|
| Namecheap | ~$12/año | ⭐ Mejor DNS |
| GoDaddy | ~$15/año | Popular pero caro |
| Cloudflare | ~$8/año | Más técnico |

### 7.2 Conectar a Vercel

**Paso 1:** Deploy frontend
```
1. Conectar repo de GitHub a Vercel
2. Framework Preset: Other
3. Output Directory: ./
4. Deploy automático en push a main
```

**Paso 2:** Configurar dominio
```
1. Vercel → Settings → Domains → Add Domain
2. Agregar dominio comprado
3. Agregar DNS records que Vercel indique:
   - A Record: @ → 76.76.21.21
   - CNAME: www → cname.vercel-dns.com
```

**Paso 3:** Actualizar Supabase
```
Supabase → Authentication → Settings → Site URL
Cambiar a: https://tudominio.com
```

---

## 8. Timeline por Semana

### Semana 1 — Fundamentos

| Tarea | Entregable |
|-------|------------|
| Crear proyecto Supabase | Proyecto creado |
| Ejecutar schema SQL | DB configurada |
| Configurar RLS | Políticas activas |
| Crear 8 usuarios iniciales | Usuarios en Supabase |
| Configurar Auth settings | Login funcional |
| **NUEVO:** Configurar Service Worker | sw.js funcionando |

### Semana 2 — Frontend + Offline

| Tarea | Entregable |
|-------|------------|
| Crear cliente Supabase | js/supabase.js |
| Adaptar auth.js | Login con Supabase Auth |
| Adaptar store.js | CRUD con Supabase |
| **NUEVO:** Implementar offline.js | IndexedDB + cola |
| **NUEVO:** Detectar online/offline | Indicator en UI |
| Probar login todos los roles | 8 usuarios funcionan |

### Semana 3 — Repartidor + Offline

| Tarea | Entregable |
|-------|------------|
| Añadir funcionalidad rutas | Dropdown en formulario |
| Crear UI repartidor | Vista por tabs |
| Marcar notas como cargadas | Checkbox funcional |
| **NUEVO:** Sync de cola | Envío automático |
| **NUEVO:** Retry automático | 3 intentos si falla |
| Probar flujos offline | Sucursal/planta sin internet |

### Semana 4 — Testing + Deploy

| Tarea | Entregable |
|-------|------------|
| Deploy a Vercel | URL funcionando |
| Configurar dominio propio | https://enote.dominio.com |
| Testing E2E | Todos los roles |
| Testing offline | Sin conexión funciona |
| Documentación usuario | PDF 1 página |
| Bug fixes | Ajustes finales |

### Semana 5 (Buffer)

| Tarea | Descripción |
|-------|-------------|
| Ajustes finales | Edge cases |
| Entrega final | Sistema listo |

---

## 9. Análisis de Costos

### 9.1 Costos Únicos (Desarrollo)

| Rol | Horas Est. | Tarifa $25/h | Tarifa $45/h | Tarifa $80/h |
|-----|------------|--------------|--------------|--------------|
| Junior (~2 años) | 120-160h | $3,000-$4,000 | - | - |
| Mid (~4 años) | 100-140h | - | $4,500-$6,300 | - |
| Senior (~6+ años) | 80-120h | - | - | $6,400-$9,600 |

### 9.2 Costos Recurrentes Mensuales

| Servicio | Plan | Costo |
|----------|------|-------|
| Dominio | .com/.mx | ~$15/año = **$1.25/mes** |
| Vercel | Free | **$0** |
| Supabase | Free | **$0** |
| Supabase Storage | Free (5GB) | **$0** |
| **Total** | | **~$1.25/mes** |

### 9.3 Costo por Usuario

| Escenario | Costo/Usuario/Mes |
|-----------|-------------------|
| Mínimo | $0.16 |
| Con dominio | $0.16 |
| Con backup (opcional) | +$0.50 |

---

## 10. Riesgos y Mitigaciones

| Riesgo | Impacto | Probabilidad | Mitigación |
|--------|---------|--------------|------------|
| Sync conflicts (sucursal + admin editan) | Bajo | Baja | Last-write-wins simple |
| IndexedDB lleno | Medio | Media | Limpiar notas >30 días |
| Supabase downtime | Medio | Baja | UI muestra "sin conexión" |
| Usuario olvida contraseña | Bajo | Media | Admin resetea desde panel |
| PDF no carga offline | Bajo | Baja | Verificar print.css en cache |

---

## 11. Pendientes para el Equipo

### Semana 0 (Pre-arranque)

- [ ] Obtener cuenta Supabase
- [ ] Cliente compra dominio
- [ ] Acceso a repo GitHub
- [ ] Definir lista de rutas exactas

### Durante Desarrollo

- [ ] NO exponer service_role_key en frontend
- [ ] Probar cada rol con cuenta real
- [ ] Documentar credenciales para entrega
- [ ] Probar en móvil (Chrome DevTools)

### Entrega Final

- [ ] Credenciales 8 usuarios
- [ ] URL del sistema (dominio propio)
- [ ] Manual de usuario (1 página PDF)
- [ ] Acceso al panel de Supabase (opcional)

---

## 12. Métricas de Éxito

Al final de la Semana 4, el sistema debe cumplir:

- [ ] Login funciona para los 8 usuarios
- [ ] Admin puede crear nota y asignar ruta
- [ ] Sucursal puede crear nota offline (cola)
- [ ] Planta puede ver notas offline (cache)
- [ ] Repartidor puede marcar notas cargadas
- [ ] PDF funciona sin internet (planta)
- [ ] Dominio propio activo (https://)
- [ ] Todos los flujos probados sin errores críticos
- [ ] Cola de sync funciona al reconectar

---

## 13. Estructura de Archivos Final

```
enote-production/
├── docs/
│   └── ROADMAP-PRODUCCION-V1.2.md
├── frontend/
│   ├── index.html
│   ├── manifest.json              ← PWA manifest
│   ├── sw.js                      ← Service Worker
│   ├── css/
│   │   ├── variables.css
│   │   ├── main.css
│   │   └── print.css
│   └── js/
│       ├── config.js              ← Dinámico
│       ├── auth.js                ← Supabase Auth
│       ├── store.js              ← CRUD API
│       ├── supabase.js           ← Cliente Supabase
│       ├── offline.js            ← IndexedDB + cola
│       ├── ui.js                 ← Sin cambios
│       └── app.js                ← Adaptado async
├── supabase/
│   └── migrations/
│       └── 001_schema.sql
└── README.md
```

---

## 14. Justificaciones Clave

### ¿Por qué Supabase + PWA en lugar de solo snapshots JSON?

| Factor | Decisión | Justificación |
|--------|-----------|---------------|
| Datos | PostgreSQL + Cache | Más robusto que JSON; queries complejas posibles |
| Offline | PWA básico | Simple de mantener; no requiere sync complejo |
| Costo | $0/mes | Free tier suficiente |
| Tiempo | 4-5 semanas | Equipo puede completar |

### ¿Por qué cola simple y no sync complexo?

- Solo necesitamos "guardar y enviar después"
- No hay casos de edición conflictiva real (sucursal solo crea)
- Last-write-wins es suficiente
- Complejidad reducida de 30h a ~15h

### ¿Por qué PDF offline funciona?

- `print.css` ya existe y funciona con `window.print()`
- Solo necesita estar cacheado por Service Worker
- El navegador convierte HTML a PDF localmente
- No requiere internet, no requiere librerías extras

---

> **Documento generado por el arquitecto de desarrollo.**
> **Equipo de desarrollo: seguir este roadmap para la implementación.**
> **Versión 1.2 — Offline-First / PWA Básico**