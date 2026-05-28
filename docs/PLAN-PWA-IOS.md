# Plan: PWA iOS Ready + fix offline.html

**Versión:** 1.3.2 | **Fecha:** 2026-05-28

## Resumen de cambios

| # | Archivo | Acción | Líneas afectadas |
|---|---|---|---|
| 1 | `scripts/generate-splash.js` | **Nuevo** | ~100 líneas |
| 2 | `icons/splash/` (7 archivos `.png`) | **Generados** | No se editan manualmente |
| 3 | `index.html` | Editar | Líneas 5, 16, 18–21 |
| 4 | `css/main.css` | Editar | Líneas 197–209, ~1225–1280, 1302 |
| 5 | `offline.html` | Editar | Líneas 7–9, 14, 37 |

## Cambio 1: Script generador de splash screens

**Archivo:** `scripts/generate-splash.js` (nuevo)

**Objetivo:** Generar PNGs de color sólido `#7A3045` en los tamaños exactos que iOS requiere para `apple-touch-startup-image`. Sin dependencias externas — solo `fs`, `path`, `zlib` (mismo patrón que `scripts/generate-icons.js`).

**Justificación:** Sin splash screen, iOS muestra pantalla blanca al abrir la PWA en frío hasta que carga JavaScript. Con los PNGs correctos, iOS muestra una pantalla del color de la marca instantáneamente. Se eligió color sólido sin ícono por simplicidad — la transición del splash al app es aceptable con `background_color: #C4A09A` del manifest + el header `#FFFAF9`.

**Tamaños a generar (7 archivos):**

| Nombre archivo | Dimensión (física) | Dispositivos que cubre |
|---|---|---|
| `splash-1125x2436.png` | 1125 × 2436 | iPhone X, XS, 11 Pro, 12/13 mini |
| `splash-1170x2532.png` | 1170 × 2532 | iPhone 12, 13, 14 |
| `splash-1179x2556.png` | 1179 × 2556 | iPhone 14 Pro, 15, 16 |
| `splash-1284x2778.png` | 1284 × 2778 | iPhone 12/13/14 Pro Max |
| `splash-1290x2796.png` | 1290 × 2796 | iPhone 15/16 Pro Max |
| `splash-1536x2048.png` | 1536 × 2048 | iPad, iPad mini |
| `splash-2048x2732.png` | 2048 × 2732 | iPad Pro 12.9" |

**Salida esperada:** `icons/splash/` con 7 archivos PNG. El script usa la misma maquinaria de generación PNG que `generate-icons.js` (CRC32, zlib.deflateSync, chunks IHDR/IDAT/IEND) pero simplificada — solo escribe píxeles RGBA sólidos `[122, 48, 69, 255]` en cada fila.

**Dependencias de build:** Ninguna. Los PNGs se generan una vez y se commitean al repo (igual que los iconos). No se necesita modificar `vercel.json` ni `build-config.js`.

## Cambio 2: index.html — splash screens, viewport, y status bar

**Archivo:** `index.html`

### 2a. Agregar `viewport-fit=cover` (línea 5)

**Antes:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```
**Después:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

**Justificación:** Sin `viewport-fit=cover`, iOS no extiende el contenido bajo el notch ni la barra de home indicator. Esto es necesario para que las reglas `safe-area-inset-*` del Cambio 4 tengan efecto.

**Compatibilidad:** Android Chrome 69+ también respeta `viewport-fit=cover`. En escritorio y navegadores que no lo soportan, se ignora sin efectos secundarios.

### 2b. Cambiar status bar style (línea 16)

**Antes:**
```html
<meta name="apple-mobile-web-app-status-bar-style" content="default">
```
**Después:**
```html
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```

**Justificación:** `default` muestra barra de estado con fondo blanco y texto negro, lo cual choca con el tema oscuro de Xiera. `black-translucent` hace transparente la barra de estado con texto blanco, dejando visible el color de fondo de la página (`#C4A09A` del `<body>`).

**Compatibilidad:** Solo afecta iOS Safari en modo standalone. Ignorado completamente en Android, Windows y macOS.

### 2c. Agregar splash screen `<link>` tags (después de línea 19)

**Insertar después de:**
```html
<link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512.png">
```

**Insertar 7 líneas:**
```html
<link rel="apple-touch-startup-image" media="screen and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" href="/icons/splash/splash-1125x2436.png">
<link rel="apple-touch-startup-image" media="screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" href="/icons/splash/splash-1170x2532.png">
<link rel="apple-touch-startup-image" media="screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" href="/icons/splash/splash-1179x2556.png">
<link rel="apple-touch-startup-image" media="screen and (device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)" href="/icons/splash/splash-1284x2778.png">
<link rel="apple-touch-startup-image" media="screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" href="/icons/splash/splash-1290x2796.png">
<link rel="apple-touch-startup-image" media="screen and (device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)" href="/icons/splash/splash-1536x2048.png">
<link rel="apple-touch-startup-image" media="screen and (device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)" href="/icons/splash/splash-2048x2732.png">
```

**Dispositivos emparejados (lógicos → físicos):**

| `device-width` × `device-height` | `device-pixel-ratio` | Imagen física |
|---|---|---|
| 375 × 812 | 3 | 1125 × 2436 |
| 390 × 844 | 3 | 1170 × 2532 |
| 393 × 852 | 3 | 1179 × 2556 |
| 428 × 926 | 3 | 1284 × 2778 |
| 430 × 932 | 3 | 1290 × 2796 |
| 768 × 1024 | 2 | 1536 × 2048 |
| 1024 × 1366 | 2 | 2048 × 2732 |

**Justificación:** iOS Safari selecciona el `<link>` cuyo `media` coincida exactamente con la pantalla del dispositivo y muestra esa imagen como splash screen durante el cold launch. Sin estos tags, iOS muestra pantalla blanca/negra genérica.

**Compatibilidad:** Ignorado en Android, Windows, macOS. Solo iOS Safari/webclip los interpreta.

**CSP:** Las imágenes de splash se sirven desde `/icons/splash/` (origen propio). El CSP actual ya permite `img-src 'self'` — no se requiere cambio.

## Cambio 3: css/main.css — safe-area insets para notch y home indicator

**Archivo:** `css/main.css`

**Objetivo:** Asegurar que el contenido no quede oculto detrás del notch (superior) ni del home indicator (inferior) en iPhones con `viewport-fit=cover`.

### 3a. `body` — padding seguro inferior

**Agregar al final del bloque `body` (línea 6–11), dentro de las llaves:**

```css
body {
  ...
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

**Justificación:** El home indicator (barra horizontal en la parte inferior de iPhones sin botón físico) se superpone al contenido. Sin `padding-bottom`, los elementos al final de la página quedan detrás del indicador y son difíciles de tocar.

### 3b. `.app-header` — padding superior para notch

**Modificar el padding del bloque `.app-header` (línea 200):**

**Antes:**
```css
padding: var(--space-3) var(--space-5);
```

**Después:**
```css
padding: calc(var(--space-3) + env(safe-area-inset-top, 0px)) var(--space-5) var(--space-3);
```

**Justificación:** El header (`position: sticky; top: 0`) es el primer elemento visible. Con `viewport-fit=cover`, el notch invade el área superior. El `padding-top` extra empuja el contenido del header por debajo del notch. El `background: var(--color-warm-white)` del header cubre el área detrás del notch.

### 3c. `.repartidor-main` — padding inferior extra

**Modificar el padding del bloque `.repartidor-main` (línea 1141):**

**Antes:**
```css
padding: var(--space-6) var(--space-5);
```

**Después:**
```css
padding: var(--space-6) var(--space-5) calc(var(--space-6) + env(safe-area-inset-bottom, 0px));
```

**Justificación:** La vista repartidor (`max-width: 580px`) puede tener múltiples tarjetas. El último elemento debe ser accesible sin tapar el home indicator.

**Compatibilidad:** `env(safe-area-inset-*, 0px)` devuelve 0 en dispositivos sin notch o navegadores que no soportan `viewport-fit=cover`. Cero impacto visual en plataformas sin notch. Soportado en Chrome 69+, Safari 11+, Edge 79+.

## Cambio 4: offline.html — eliminar dependencia de Google Fonts CDN

**Archivo:** `offline.html`

### 4a. Eliminar líneas CDN (líneas 7–9)

**Eliminar:**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
```

### 4b. Reemplazar `font-family` en los selectores relevantes

**Línea 14 — `body` font-family:**

**Antes:**
```css
font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
```
**Después:**
```css
font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

**Línea 37 — `h1` font-family:**

**Antes:**
```css
font-family: 'Cormorant Garamond', Georgia, serif;
```
**Después:**
```css
font-family: Georgia, 'Times New Roman', serif;
```

**Justificación dual:**
1. **CSP:** El CSP en `vercel.json` bloquea `font-src 'self'`. Las fuentes de Google Fonts CDN nunca se cargan — la página usaba el fallback del sistema de todas formas.
2. **Offline real:** Si el usuario está genuinamente sin conexión, las fuentes CDN no se pueden descargar aunque el CSP las permitiera. El fallback a fuentes del sistema garantiza que la página se renderiza correctamente sin dependencias externas.

**Compatibilidad:** Universal. Las fuentes del sistema están disponibles en todos los dispositivos. La apariencia será distinta a la app principal (que usa fuentes self-hosted), pero es una página de fallback — la legibilidad es el único requisito.

## Verificación cruzada de compatibilidad

| Funcionalidad | iOS | Android | Windows Chrome | macOS Safari |
|---|---|---|---|---|
| Splash screen | `apple-touch-startup-image` nativo | `background_color: #C4A09A` del manifest | `background_color` del manifest | `background_color` del manifest |
| Notch / safe area | `safe-area-inset-*` + `viewport-fit=cover` activos | `env()` = 0 si no hay notch | `env()` = 0 | `env()` = 0 |
| Status bar | `black-translucent` con texto blanco | `theme_color: #7A3045` del manifest | `theme_color` del manifest | `theme_color: #7A3045` |
| Install prompt | "Compartir → Añadir a inicio" | `beforeinstallprompt` (ya implementado) | `beforeinstallprompt` en Chrome/Edge | Sin soporte PWA estándar |
| Almacenamiento offline | IndexedDB (ya implementado) | IndexedDB | IndexedDB | IndexedDB |
| offline.html fallback | Carga desde SW cache (ya implementado) | SW cache | SW cache | SW cache |

## Orden de ejecución

1. `node scripts/generate-splash.js` — generar los 7 PNGs en `icons/splash/`
2. Editar `index.html` (3 cambios)
3. Editar `css/main.css` (3 cambios)
4. Editar `offline.html` (eliminar 3 líneas + modificar 2 font-family)
5. `node scripts/build-config.js` — regenerar `js/supabase.js` y verificar `sw.js`
6. Probar `npx serve .` localmente
7. `npx vercel --prod` — deploy
