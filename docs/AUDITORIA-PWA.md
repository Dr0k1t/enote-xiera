# Auditoría PWA — Estado Actual (v1.3.2)

**Versión:** 1.3.3 — **Cierre:** 2026-05-28

## 1. Web App Manifest

**Archivo:** `manifest.json` (38 líneas) — **COMPLETO**

| Campo | Valor |
|---|---|
| `name` | `Enote — Xiera` |
| `short_name` | `Enote` |
| `start_url` | `/` |
| `display` | `standalone` |
| `background_color` | `#C4A09A` (coincide con `--color-bg`) |
| `theme_color` | `#7A3045` (coincide con `--color-primary`) |
| `orientation` | `portrait-primary` |
| `lang` | `es-MX` |

## 2. Iconos

**Directorio:** `icons/` — **COMPLETO**

| Archivo | Tipo |
|---|---|
| `icon-192.png` | Any |
| `icon-192-maskable.png` | Maskable (safe zone) |
| `icon-512.png` | Any |
| `icon-512-maskable.png` | Maskable (safe zone) |
| `icon.svg` | Fuente SVG |

- Generados por `scripts/generate-icons.js` (0 dependencias, Node puro)
- Maskable usa `pad=0` para llenar todo el canvas — compatible con cropping adaptativo de Android

## 3. Service Worker

**Archivo:** `sw.js` (142 líneas) — **COMPLETO**

| Evento | Estrategia |
|---|---|
| `install` | Pre-cache de 53 STATIC_ASSETS con `fetch({cache:'reload'})` + `skipWaiting()` |
| `activate` | Borra caches viejos no versionados + `clients.claim()` |
| `fetch` (navegación) | Network-first → fallback cache → `/offline.html` |
| `fetch` (assets) | Stale-while-revalidate |
| `fetch` (`*.supabase.co`) | Passthrough (no interceptado) |

- Cache versionado: `enote-` + `ENOTE_VERSION` (inyectado por `build-config.js`)
- `ENOTE_VERSION = '1.3.3'`
- `message({type: 'SKIP_WAITING'})` para activación inmediata

## 4. Offline Fallback

**Archivo:** `offline.html` (83 líneas) — **COMPLETO**

- Estilizado con colores Xiera
- Mensaje "Sin conexión" + botón "Reintentar"
- Tiene su propio `<link rel="manifest">` y `<meta viewport>`

## 5. Install Prompt

**Archivo:** `js/app.js` (líneas 66–94, 908–928) — **COMPLETO**

| Evento | Comportamiento |
|---|---|
| `beforeinstallprompt` | Captura `deferredPrompt`, muestra botón "Instalar app" |
| `appinstalled` | Limpia `deferredPrompt`, oculta botón |
| Click en `.install-btn` | `deferredPrompt.prompt()` → `userChoice.outcome` |

- `updateInstallButton()` crea/elimina dinámicamente el botón en `.app-header`
- Se llama desde: `beforeinstallprompt`, `online`, dashboard render, repartidor render

## 6. iOS PWA Meta Tags

**Archivo:** `index.html` (líneas 14–20) — **COMPLETO**

| Tag | Estado |
|---|---|
| `apple-mobile-web-app-capable` | `yes` ✓ |
| `apple-mobile-web-app-title` | `Enote` ✓ |
| `apple-touch-icon` 192×192 + 512×512 | Presente ✓ |
| `apple-mobile-web-app-status-bar-style` | `black-translucent` ✓ |
| `apple-touch-startup-image` | 7 tamaños iOS ✓ |
| `viewport-fit=cover` | Presente ✓ |

## 7. Caching Strategy

**3 capas:**

| Capa | Mecanismo |
|---|---|
| SW Cache | 53 assets pre-cacheados, stale-while-revalidate, network-first para HTML |
| HTTP Headers (`vercel.json`) | JS/CSS `immutable` 1 año, `supabase.js` `no-cache`, `sw.js` y `manifest.json` `max-age=0` |
| IndexedDB (`offline.js`) | `IMAGE_CACHE` (FIFO 500), `PENDING_QUEUE` (scoped `_userId`), `NOTES_CACHE` |

## 8. Online/Offline Detection

**Archivos:** `js/app.js` + `js/offline.js` — **COMPLETO**

| Evento | Comportamiento |
|---|---|
| `window.online` | Oculta barra offline, sync pendientes, recachea notas |
| `window.offline` | Barra ámbar "Sin conexión", toast |

- "Lie-fi" handling en `store.js`: si Supabase inalcanzable pese a `navigator.onLine`, fallback a cache
- Badge `⟳ N` en header para notas pendientes de sync

## 9. SW Registration + Update Flow

**Archivos:** `js/app.js` (líneas 34–63) + `index.html` (líneas 29–35) — **COMPLETO**

- `controllerchange` en `index.html` (inline, antes de que cargue app.js)
- `_sw_reloading` flag en `sessionStorage` previene loop de recarga
- En `app.js`: guards para no recargar si hay modal abierto o formulario en edición
- `updatefound` → `skipWaiting` automático + toast "Nueva versión disponible"

## 10. CSP

**Archivo:** `vercel.json` — **COMPLETO**

```
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
font-src 'self'; img-src 'self' https://ovlhabedefwbajrnfpup.supabase.co blob: data:;
connect-src 'self' https://ovlhabedefwbajrnfpup.supabase.co wss://ovlhabedefwbajrnfpup.supabase.co;
manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self';
```

- Sin CDNs externos para scripts, estilos, o fuentes
- `manifest-src 'self'` y `worker-src 'self'` explícitos

## 11. Safe Area / Notch Handling

**Archivos:** `css/main.css` — **COMPLETO**

- `safe-area-inset-bottom` en `body` y `.repartidor-main`
- `safe-area-inset-top` en `.app-header`
- `viewport-fit=cover` activo en `<meta viewport>`

## Resumen

| # | Requisito PWA | Estado |
|---|---|---|
| 1 | Web App Manifest | COMPLETO |
| 2 | Iconos (192 + 512, any + maskable) | COMPLETO |
| 3 | Service Worker | COMPLETO |
| 4 | Offline Fallback Page | COMPLETO |
| 5 | Install Prompt | COMPLETO |
| 6 | iOS Meta Tags | COMPLETO |
| 7 | Caching Strategy | COMPLETO |
| 8 | Online/Offline Detection | COMPLETO |
| 9 | SW Registration + Updates | COMPLETO |
| 10 | CSP Headers | COMPLETO |
| 11 | iOS Splash Screen | COMPLETO |
| 12 | Safe Area / Notch CSS | COMPLETO |
| 13 | iOS Status Bar Style | COMPLETO |
