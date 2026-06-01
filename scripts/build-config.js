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
    ENOTE_VERSION: stripBom(process.env.ENOTE_VERSION || envFile.ENOTE_VERSION || '1.4.2'),
  };
}

function replaceLiteral(haystack, needle, replacement) {
  return haystack.split(needle).join(replacement);
}

function main() {
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
}

main();
