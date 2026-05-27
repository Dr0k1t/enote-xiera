/**
 * Generador de iconos PNG para Enote PWA.
 * Dependencias cero — solo módulos nativos de Node.js (fs, zlib, path).
 *
 * Uso: node scripts/generate-icons.js
 *
 * Genera en icons/:
 *   icon-192.png, icon-512.png
 *   icon-192-maskable.png, icon-512-maskable.png
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'icons');

// ─── CRC32 ───────────────────────────────────────────────────────────────────
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ─── Chunk PNG ───────────────────────────────────────────────────────────────
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcInput = Buffer.concat([Buffer.from(type), data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([len, Buffer.from(type), data, crcBuf]);
}

// ─── Signed distance a rounded rect ─────────────────────────────────────────
function sdRoundedRect(x, y, w, h, r) {
  const halfX = x - w / 2;
  const halfY = y - h / 2;
  const dx = Math.abs(halfX) - (w / 2 - r);
  const dy = Math.abs(halfY) - (h / 2 - r);
  if (dx > 0 && dy > 0) return Math.sqrt(dx * dx + dy * dy) - r;
  return Math.max(Math.min(dx, 0), Math.min(dy, 0)) - r;
}

// ─── Smoothstep ─────────────────────────────────────────────────────────────
function smoothstep(edge0, edge1, val) {
  const t = Math.max(0, Math.min(1, (val - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// ─── Generar PNG ─────────────────────────────────────────────────────────────
function generatePNG(size, bgColor, fgColor, drawLetter, bgPad) {
  const pixels = Buffer.alloc(size * size * 4, 0);
  const cx = size / 2;
  const cy = size / 2;
  const pad = bgPad ?? Math.round(size * 0.14);
  const rectW = size - pad * 2;
  const rectH = size - pad * 2;
  const radius = pad > 0 ? Math.round(size * 0.18) : 0;

  const [br, bg, bb, ba] = bgColor;
  const [fr, fg, fb, fa] = fgColor;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const sd = sdRoundedRect(x + 0.5, y + 0.5, rectW, rectH, radius);
      const alpha = smoothstep(0.5, -0.5, sd);

      pixels[i + 0] = Math.round(br + (0 - br) * alpha);
      pixels[i + 1] = Math.round(bg + (0 - bg) * alpha);
      pixels[i + 2] = Math.round(bb + (0 - bb) * alpha);
      pixels[i + 3] = Math.round((1 - alpha) * ba);
    }
  }

  if (drawLetter) {
    const inner = Math.round(size * 0.14);
    const innerW = size - inner * 2;
    const innerH = size - inner * 2;

    const barW = Math.round(innerW * 0.16);
    const midBarW = Math.round(innerW * 0.45);
    const barH = Math.round(innerH * 0.18);

    const left = inner;
    const right = inner + innerW;
    const top = inner;
    const bot = inner + innerH;
    const midY = Math.round((top + bot) / 2 - barH / 2);

    // Función para dibujar rectángulo relleno con antialiasing
    function fillRect(rx, ry, rw, rh) {
      const x0 = Math.max(0, Math.floor(rx));
      const y0 = Math.max(0, Math.floor(ry));
      const x1 = Math.min(size - 1, Math.ceil(rx + rw));
      const y1 = Math.min(size - 1, Math.ceil(ry + rh));
      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          const bx = Math.max(0, Math.min(1, px + 0.5 - rx)) * Math.max(0, Math.min(1, rx + rw - (px + 0.5)));
          const by = Math.max(0, Math.min(1, py + 0.5 - ry)) * Math.max(0, Math.min(1, ry + rh - (py + 0.5)));
          const coverage = bx * by;
          if (coverage <= 0) continue;
          const i = (py * size + px) * 4;
          pixels[i + 0] = Math.round(pixels[i + 0] + (fr - pixels[i + 0]) * coverage);
          pixels[i + 1] = Math.round(pixels[i + 1] + (fg - pixels[i + 1]) * coverage);
          pixels[i + 2] = Math.round(pixels[i + 2] + (fb - pixels[i + 2]) * coverage);
          pixels[i + 3] = Math.min(255, Math.round(pixels[i + 3] + (fa - pixels[i + 3]) * coverage));
        }
      }
    }

    // Vertical bar (left side)
    fillRect(left, top, barW, innerH);
    // Top horizontal bar
    fillRect(left + barW, top, innerW - barW, barH);
    // Middle horizontal bar (shorter)
    fillRect(left + barW, midY, midBarW, barH);
    // Bottom horizontal bar
    fillRect(left + barW, bot - barH, innerW - barW, barH);
  }

  // Construir PNG
  const rawRows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0; // filter None
    pixels.copy(row, 1, y * size * 4, (y + 1) * size * 4);
    rawRows.push(row);
  }

  const rawData = Buffer.concat(rawRows);
  const compressed = zlib.deflateSync(rawData);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); // width
  ihdr.writeUInt32BE(size, 4); // height
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Main ────────────────────────────────────────────────────────────────────
function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const BG = [122, 48, 69, 255];     // #7A3045
  const FG = [245, 237, 235, 255];   // #F5EDEB

  const sizes = [192, 512];
  for (const size of sizes) {
    // Normal
    const png = generatePNG(size, BG, FG, true);
    fs.writeFileSync(path.join(OUT, `icon-${size}.png`), png);

    // Maskable: fondo llena todo el canvas (pad=0) para plataformas
    // que recortan el ícono (circle/squircle). El letter "E" conserva
    // el padding de 14% interno para la safe zone.
    const maskableBg = [122, 48, 69, 255];
    const mpng = generatePNG(size, maskableBg, FG, true, 0);
    fs.writeFileSync(path.join(OUT, `icon-${size}-maskable.png`), mpng);

    console.log(`  icon-${size}.png ✓`);
    console.log(`  icon-${size}-maskable.png ✓`);
  }
}

main();
