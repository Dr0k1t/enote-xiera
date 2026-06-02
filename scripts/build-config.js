#!/usr/bin/env node
// Genera js/supabase.js a partir de js/supabase.js.template inyectando
// SUPABASE_URL y SUPABASE_ANON_KEY desde process.env o desde .env en la raíz.
// Uso: node scripts/build-config.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATE_PATH = path.join(ROOT, 'js', 'supabase.js.template');
const OUTPUT_PATH = path.join(ROOT, 'js', 'supabase.js');
const ENV_PATH = path.join(ROOT, '.env');

function parseDotEnv(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function stripBom(str) {
  return (typeof str === 'string') ? str.replace(/^\ufeff/, '') : str;
}
function loadEnv() {
  const envFile = fs.existsSync(ENV_PATH) ? parseDotEnv(fs.readFileSync(ENV_PATH, 'utf8')) : {};
  return {
    SUPABASE_URL: stripBom(process.env.SUPABASE_URL || envFile.SUPABASE_URL || ''),
    SUPABASE_ANON_KEY: stripBom(process.env.SUPABASE_ANON_KEY || envFile.SUPABASE_ANON_KEY || ''),
    ENOTE_VERSION: stripBom(process.env.ENOTE_VERSION || envFile.ENOTE_VERSION || '1.6.1'),
  };
}

// El compiler WASM de Typst (~27MB) NO se commitea (ver .gitignore). Se descarga
// en build/setup desde jsdelivr (versión pinneada). En Vercel el build tiene red;
// localmente queda cacheado tras la primera ejecución.
const TYPST_WASM_VERSION = '0.7.0';
const TYPST_WASM_URL = `https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler@${TYPST_WASM_VERSION}/pkg/typst_ts_web_compiler_bg.wasm`;

// Genera js/typstAssets.js inlineando el template Typst + el logo (base64).
// Así typstReceipt.js es autocontenido: no fetch de /templates/nota.typ ni del
// logo (assets cacheables que podían quedar desincronizados del JS → el warm-cache
// con {cache:'reload'} metía un template nuevo en una caché con JS viejo → bug v1.6.0).
function genTypstAssets() {
  const tplPath = path.join(ROOT, 'templates', 'nota.typ');
  const logoPath = path.join(ROOT, 'assets', 'typst', 'logo-xiera.png');
  if (!fs.existsSync(tplPath)) { console.warn('[build-config] Falta templates/nota.typ, skip typstAssets'); return; }
  const tpl = fs.readFileSync(tplPath, 'utf8');
  const logoB64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
  const out =
    '// GENERADO por scripts/build-config.js — no editar.\n' +
    '// Template Typst + logo (base64) inlineados para que typstReceipt.js sea autocontenido.\n' +
    `export const NOTA_TEMPLATE = ${JSON.stringify(tpl)};\n` +
    `export const LOGO_B64 = ${JSON.stringify(logoB64)};\n`;
  fs.writeFileSync(path.join(ROOT, 'js', 'typstAssets.js'), out, 'utf8');
  console.log('[build-config] Escrito js/typstAssets.js (template', tpl.length, 'chars, logo', (logoB64.length / 1024).toFixed(0), 'KB b64)');
}

async function ensureTypstWasm() {
  const dest = path.join(ROOT, 'assets', 'typst', 'typst_ts_web_compiler_bg.wasm');
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1_000_000) {
    console.log('[build-config] Typst WASM ya presente, skip descarga.');
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  console.log('[build-config] Descargando Typst WASM:', TYPST_WASM_URL);
  const res = await fetch(TYPST_WASM_URL);
  if (!res.ok) throw new Error(`Typst WASM HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  console.log('[build-config] Typst WASM escrito:', (buf.length / 1024 / 1024).toFixed(1), 'MB');
}

function replaceLiteral(haystack, needle, replacement) {
  return haystack.split(needle).join(replacement);
}

async function main() {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error('[build-config] Falta template:', TEMPLATE_PATH);
    process.exit(1);
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY, ENOTE_VERSION } = loadEnv();

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[build-config] WARNING: SUPABASE_URL o SUPABASE_ANON_KEY no definidas.');
    console.warn('[build-config] Genera js/supabase.js con strings vacíos. La app degradará a estado no configurado.');
  }

  let out = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  out = replaceLiteral(out, '__SUPABASE_URL__', SUPABASE_URL);
  out = replaceLiteral(out, '__SUPABASE_ANON_KEY__', SUPABASE_ANON_KEY);

  fs.writeFileSync(OUTPUT_PATH, out, 'utf8');
  console.log('[build-config] Escrito', OUTPUT_PATH);
  console.log('[build-config] URL configurada:', SUPABASE_URL ? 'sí' : 'no');
  console.log('[build-config] ANON KEY configurada:', SUPABASE_ANON_KEY ? 'sí' : 'no');

  // Inyectar ENOTE_VERSION en sw.js para versionado de caché determinista.
  const SW_PATH = path.join(ROOT, 'sw.js');
  if (fs.existsSync(SW_PATH)) {
    let sw = fs.readFileSync(SW_PATH, 'utf8');
    const next = sw.replace(/const ENOTE_VERSION = '[^']+'/, `const ENOTE_VERSION = '${ENOTE_VERSION}'`);
    if (next !== sw) {
      fs.writeFileSync(SW_PATH, next, 'utf8');
      console.log('[build-config] sw.js ENOTE_VERSION =>', ENOTE_VERSION);
    }
  }

  // Inyectar ENOTE_VERSION en js/config.js para exponerla al runtime (badge de versión).
  const CONFIG_PATH = path.join(ROOT, 'js', 'config.js');
  if (fs.existsSync(CONFIG_PATH)) {
    let cfg = fs.readFileSync(CONFIG_PATH, 'utf8');
    const next = cfg.replace(/export const ENOTE_VERSION = '[^']+'/, `export const ENOTE_VERSION = '${ENOTE_VERSION}'`);
    if (next !== cfg) {
      fs.writeFileSync(CONFIG_PATH, next, 'utf8');
      console.log('[build-config] config.js ENOTE_VERSION =>', ENOTE_VERSION);
    }
  }

  genTypstAssets();
  await ensureTypstWasm();
}

main().catch(err => {
  console.error('[build-config] ERROR:', err.message);
  process.exit(1);
});
