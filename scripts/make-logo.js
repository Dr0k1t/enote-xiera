// Genera assets/typst/logo-xiera.png: recorta una variante del logo de marca
// (docs/aplicaciones_Mesa de trabajo 1 copia 4.png, 4 variantes apiladas) y la
// recolorea a tinta #2b2b2b conservando el alpha (antialiasing). Headless via Playwright.
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.resolve(__dirname, '../audit/node_modules/playwright'));

const SRC = path.resolve(__dirname, '../docs/aplicaciones_Mesa de trabajo 1 copia 4.png');
const OUT = path.resolve(__dirname, '../assets/typst/logo-xiera.png');
const VARIANT_INDEX = Number(process.env.VARIANT ?? 2); // 0..3 (default: 3ª, vino oscuro)
const INK = [0x2b, 0x2b, 0x2b];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const dataUrl = 'data:image/png;base64,' + fs.readFileSync(SRC).toString('base64');

  const result = await page.evaluate(async ({ dataUrl, variantIndex, ink }) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const W = c.width, H = c.height;
    const data = ctx.getImageData(0, 0, W, H).data;

    const ALPHA = 24; // umbral de contenido
    const rowHas = new Array(H).fill(false);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (data[(y * W + x) * 4 + 3] > ALPHA) { rowHas[y] = true; break; }
      }
    }
    // Segmentar variantes por bandas de filas con contenido separadas por huecos.
    const bands = [];
    let start = -1;
    const GAP = Math.round(H * 0.015);
    let gap = 0;
    for (let y = 0; y < H; y++) {
      if (rowHas[y]) { if (start < 0) start = y; gap = 0; }
      else if (start >= 0) { gap++; if (gap > GAP) { bands.push([start, y - gap]); start = -1; } }
    }
    if (start >= 0) bands.push([start, H - 1]);

    const idx = Math.min(variantIndex, bands.length - 1);
    const [y0, y1] = bands[idx];
    // bbox horizontal dentro de la banda
    let x0 = W, x1 = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = 0; x < W; x++) {
        if (data[(y * W + x) * 4 + 3] > ALPHA) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
      }
    }
    const pad = 6;
    x0 = Math.max(0, x0 - pad); x1 = Math.min(W - 1, x1 + pad);
    const cy0 = Math.max(0, y0 - pad), cy1 = Math.min(H - 1, y1 + pad);
    const cw = x1 - x0 + 1, ch = cy1 - cy0 + 1;

    const out = document.createElement('canvas');
    out.width = cw; out.height = ch;
    const octx = out.getContext('2d');
    const oimg = octx.createImageData(cw, ch);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const si = ((cy0 + y) * W + (x0 + x)) * 4;
        const di = (y * cw + x) * 4;
        oimg.data[di] = ink[0]; oimg.data[di + 1] = ink[1]; oimg.data[di + 2] = ink[2];
        oimg.data[di + 3] = data[si + 3]; // conservar alpha
      }
    }
    octx.putImageData(oimg, 0, 0);
    return { png: out.toDataURL('image/png'), bands: bands.length, idx, cw, ch };
  }, { dataUrl, variantIndex: VARIANT_INDEX, ink: INK });

  await browser.close();
  const b64 = result.png.replace(/^data:image\/png;base64,/, '');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(b64, 'base64'));
  console.log(`[make-logo] variantes=${result.bands} usada=${result.idx} → ${result.cw}x${result.ch}px → ${OUT}`);
})();
