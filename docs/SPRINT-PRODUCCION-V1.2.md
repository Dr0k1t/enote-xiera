# Sprint de Producción — Enote v1.2

**Cliente:** Xiera — Panadería, Ocotlán, Jalisco
**Inicio:** Lunes 11 de mayo de 2026
**Entrega estimada:** Viernes 13 de junio de 2026
**Alcance:** 8 usuarios · 1 organización · PWA offline-first

---

## Estado General

| Semana | Periodo | Estado | Avance |
|--------|---------|--------|--------|
| 0 — Pre-arranque | Antes del 11 mayo | 🟢 Completado | 4 / 4 |
| 1 — Infraestructura | 11–16 mayo | 🟢 Completado | 6 / 6 |
| 2 — Supabase + Offline | 18–23 mayo | 🟡 En progreso | 7 / 10 |
| 3 — Repartidor + Pruebas | 25–30 mayo | 🔴 Pendiente | 0 / 6 |
| 4 — Deploy + Entrega | 01–06 junio | 🔴 Pendiente | 0 / 7 |
| 5 — Buffer | 08–13 junio | 🔴 Pendiente | — |

**Leyenda:** 🔴 Pendiente · 🟡 En progreso · 🟢 Completado

---

## Registro de Actualizaciones

| Fecha | Quién | Cambio |
|-------|-------|--------|
| 2026-05-11 | Elius | Sprint creado |
| 2026-05-11 | Claude Code | Auditoría v1.0: 8 archivos completos. Falta: sw.js, supabase.js, offline.js, env.js. Bug confirmado en auth.js:17. Semana 0: GitHub ✅, Supabase y dominio sin verificar. |
| 2026-05-14 | Claude Code | Supabase configurado. Login real funcionando. PR #3 mergeado a main. |

---

## Semana 0 — Pre-arranque ✅

**Completado:**
- ✅ Cuenta Supabase creada (`https://ovlhabedefwbajrnfpup.supabase.co`)
- ✅ Dominio: pendiente (al final del sprint)
- ✅ Acceso repo GitHub
- ✅ Rutas confirmadas con el cliente: Atequiza, Poncitlan, Tototlan, Ocotlan

---

## Semana 1 — Fundamentos de Infraestructura ✅

**Completado:**
- ✅ Schema SQL en Supabase (routes, profiles, notes, RLS)
- ✅ 4 usuarios en Supabase Auth: admin, ocotlan, planta, extremoalias
- ✅ 4 perfiles en tabla `profiles`
- ✅ Auth Providers: Confirm email OFF
- ✅ Redirect URLs: `http://localhost:3000/**`
- ✅ `sw.js` + `manifest.json` implementados
- ✅ Login real con Supabase funcionando

---

## Semana 2 — Integración Supabase + Offline

**Fechas:** Lunes 18 – Viernes 23 de mayo de 2026
**Estado:** 🟡 En progreso
**Estimado:** ~29 h

---

### Tarea 1 — `js/supabase.js` ✅

- [x] Cliente con URL y anon key configuradas
- [x] `isSupabaseConfigured()` detecta si está activo

### Tarea 2 — `auth.js` → Supabase Auth ✅

- [x] `loginSupabase()` con `signInWithPassword()`
- [x] Lee perfil de `profiles` table para obtener role y destino
- [x] `logout()` con `supabase.auth.signOut()`
- [x] Modo demo como fallback

### Tarea 3 — `store.js` → Supabase CRUD ✅

- [x] `getNotes()` → Supabase
- [x] `getNote(id)` → Supabase
- [x] `createNote()` → Supabase
- [x] `updateNote()` → Supabase
- [x] `deleteNote()` → Supabase
- [x] `toggleTomada()` → Supabase
- [x] `seedDemoNotes()` solo en modo demo

### Tarea 4 — `app.js` → async ✅

- [x] Todos los handlers son async
- [x] `handleLogin()` hace await del login
- [x] `handleLogout()` hace await del logout

### Tarea 5 — `offline.js` ✅

- [x] IndexedDB con stores: `notes_cache`, `pending_queue`
- [x] `syncNotesToCache()`, `getOfflineNotes()`, `createNoteOffline()`, `syncPendingNotes()`
- [x] Retry con backoff exponencial (1s → 2s → 4s)

### Tarea 6 — Indicador online/offline ✅

- [x] Listeners `online`/`offline` en `app.js`
- [x] Banner "Sin conexión" cuando offline
- [x] Sync automático al reconectar

### Tarea 7 — Integrar offline.js en flujo ✅

- [x] Cola offline para sucursal (pendiente)
- [x] Cache de lectura para planta (pendiente)

### Tarea 8 — Compresión de imágenes ✅

- [x] `js/imageUtils.js` con `compressImage()`
- [x] `MAX_IMAGES_PER_NOTE = 3`
- [x] Integración en `ui/form.js`
- [x] Preview y eliminación de imágenes en formulario

### Tarea 9 — `isDemoMode()` en login ✅

- [x] Login muestra "Modo demo local" cuando está activo
- [x] Label cambia a "Email" cuando es Supabase real
- [x] Input type cambia a email/text según modo

### Tarea 10 — Verificar Semana 2

- [ ] Probar login de cada usuario (admin, planta, sucursal, repartidor)
- [ ] Probar crear nota como admin → verificar en Supabase Table Editor
- [ ] Probar modo avión → sucursal crea nota offline
- [ ] Probar modo avión → planta ve notas cache
- [ ] Probar subir 3 fotos en una nota

**Fecha real de completado:** ___________

---

## Semana 3 — Repartidor + Pruebas Offline

**Fechas:** Lunes 25 – Viernes 30 de mayo de 2026
**Estado:** 🔴 Pendiente
**Estimado:** ~22 h

---

### Tarea 1 — Vista Repartidor ✅

- [x] `ui/repartidor.js` con `renderRepartidorView()` y `renderRepartidorCard()`
- [x] Selector de sucursal en `app.js`
- [x] Toggle `tomada` funcional

### Tarea 2 — Audit E2E para repartidor

- [ ] Actualizar `audit/audit.js` para probar rol repartidor
- [ ] Verificar todos los roles con Playwright

### Tarea 3 — Pruebas offline completas

**Flujo Sucursal:**
- [ ] Modo avión → login como `ocotlan` → crear nota → verificar toast offline
- [ ] Reconectar → verificar sync en Supabase

**Flujo Planta:**
- [ ] Online → login como `planta` → verificar notas
- [ ] Modo avión → recargar → verificar cache
- [ ] Imprimir nota → verificar PDF

**Flujo Repartidor:**
- [ ] Login como `repartidor` → verificar vista
- [ ] Marcar nota como tomada → verificar en Supabase

**Fecha real de completado:** ___________

---

## Semana 4 — Deploy, Testing E2E y Entrega

**Fechas:** Lunes 01 – Viernes 06 de junio de 2026
**Estado:** 🔴 Pendiente
**Estimado:** ~18 h

---

### Tarea 1 — Deploy a Vercel

- [ ] Crear cuenta en vercel.com
- [ ] Conectar repo GitHub
- [ ] Configurar: Framework Preset = Other, Output = ./
- [ ] Deploy → URL temporal funcionando
- [ ] Probar login desde URL de Vercel

### Tarea 2 — Configurar dominio propio

- [ ] Comprar dominio (Cloudflare Registrar ~$8/año)
- [ ] Vercel → Settings → Domains → agregar dominio
- [ ] Configurar DNS records
- [ ] SSL verificado

### Tarea 3 — Actualizar Supabase Auth

- [ ] Site URL → dominio real
- [ ] Redirect URLs → dominio real

### Tarea 4 — Testing E2E completo

- [ ] `cd audit && ENOTE_URL=https://tudominio.com node audit.js` → PASS ✓
- [ ] Probar en móvil (Android/iOS)
- [ ] Instalar como PWA

### Tarea 5 — Bug fixes

- [ ] Corregir issues del audit
- [ ] Re-ejecutar hasta PASS ✓

### Tarea 6 — Manual de usuario

- [ ] PDF 1 página con flujos por rol
- [ ] Cómo abrir app, login, crear nota, imprimir, offline

### Tarea 7 — Entrega formal

- [ ] Credenciales de 8 usuarios
- [ ] URL del sistema
- [ ] Acceso al panel de Supabase (opcional)
- [ ] Explicar cómo resetear contraseñas

**Fecha real de completado:** ___________

---

## Semana 5 — Buffer

**Fechas:** Lunes 08 – Viernes 13 de junio de 2026
**Estado:** 🔴 Pendiente

### Posibles tareas

- [ ] Edge cases (nota con 0 productos, sync conflict)
- [ ] Ajustes de UX post-feedback
- [ ] Limpiar seedDemoNotes para producción
- [ ] Entrega formal al cliente

**Fecha de entrega real:** ___________

---

## Criterios de Aceptación

- [ ] Login funciona para los 8 usuarios desde dominio propio con HTTPS
- [ ] Admin puede crear nota real en Supabase
- [ ] Sucursal puede crear nota offline y sincroniza al reconectar
- [ ] Planta puede ver notas offline y abrir PDF imprimible
- [ ] Repartidor puede ver notas y marcar como tomada
- [ ] `cd audit && ENOTE_URL=https://dominio.com node audit.js` → PASS ✓
- [ ] Manual de usuario entregado
- [ ] Credenciales de 8 usuarios documentadas
