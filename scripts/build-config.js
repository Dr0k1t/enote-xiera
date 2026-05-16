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

function loadEnv() {
  const envFile = fs.existsSync(ENV_PATH) ? parseDotEnv(fs.readFileSync(ENV_PATH, 'utf8')) : {};
  return {
    SUPABASE_URL: process.env.SUPABASE_URL || envFile.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || envFile.SUPABASE_ANON_KEY || '',
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

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = loadEnv();

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
}

main();
