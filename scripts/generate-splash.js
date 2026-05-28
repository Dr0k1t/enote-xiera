const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'icons', 'splash');

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

// ─── PNG de color sólido RGBA ────────────────────────────────────────────────
function generateSolidPNG(width, height, r, g, b) {
  // Una fila: byte de filtro (0=None) + width*4 bytes RGBA
  const rowBuf = Buffer.alloc(1 + width * 4);
  rowBuf[0] = 0;
  for (let x = 0; x < width; x++) {
    rowBuf[1 + x * 4 + 0] = r;
    rowBuf[1 + x * 4 + 1] = g;
    rowBuf[1 + x * 4 + 2] = b;
    rowBuf[1 + x * 4 + 3] = 255;
  }
  // Repetir la misma fila 'height' veces
  const rows = [];
  for (let y = 0; y < height; y++) rows.push(rowBuf);
  const rawData = Buffer.concat(rows);
  const compressed = zlib.deflateSync(rawData);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Tamaños requeridos por iOS ───────────────────────────────────────────────
const SPLASHES = [
  { w: 1125, h: 2436 }, // iPhone X, XS, 11 Pro, 12/13 mini
  { w: 1170, h: 2532 }, // iPhone 12, 13, 14
  { w: 1179, h: 2556 }, // iPhone 14 Pro, 15, 16
  { w: 1284, h: 2778 }, // iPhone 12/13/14 Pro Max
  { w: 1290, h: 2796 }, // iPhone 15/16 Pro Max
  { w: 1536, h: 2048 }, // iPad, iPad mini
  { w: 2048, h: 2732 }, // iPad Pro 12.9"
];

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const { w, h } of SPLASHES) {
    const png = generateSolidPNG(w, h, 122, 48, 69); // #7A3045
    const name = `splash-${w}x${h}.png`;
    fs.writeFileSync(path.join(OUT, name), png);
    console.log(`  ${name} ✓`);
  }
  console.log(`\n  → ${SPLASHES.length} splash screens en icons/splash/`);
}

main();
