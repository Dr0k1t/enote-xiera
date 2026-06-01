#!/usr/bin/env node
// diagnose-401.js — Diagnóstico automatizado del 401 en POST /notes
// Prerrequisito: ejecutar scripts/diagnose-401.sql en Supabase SQL Editor (una vez)
// Uso:   node scripts/diagnose-401.js <SUPABASE_URL> <SERVICE_ROLE_KEY>
//        o set SUPABASE_URL y SUPABASE_ROLE_KEY en variables de entorno

const SUPABASE_URL = (process.argv[2] || process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_ROLE_KEY = process.argv[3] || process.env.SUPABASE_ROLE_KEY || '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Uso: node scripts/diagnose-401.js <SUPABASE_URL> <SERVICE_ROLE_KEY>');
  console.error('  Alternativa: set SUPABASE_URL y SUPABASE_ROLE_KEY en entorno');
  process.exit(1);
}

const BASE = `${SUPABASE_URL}/rest/v1`;
const AUTH = { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY };

function ok(icon, label, detail) {
  const d = detail != null ? `: ${detail}` : '';
  return `${icon} ${label}${d}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function rpc(fnName) {
  const res = await fetch(`${BASE}/rpc/${fnName}`, {
    method: 'POST',
    headers: { ...AUTH, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`RPC ${fnName} failed HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function getNotesCount() {
  const res = await fetch(`${BASE}/notes?select=id&limit=1`, {
    headers: { ...AUTH, Accept: 'application/json' },
  });
  const data = await res.json().catch(() => []);
  return { ok: res.ok, status: res.status, count: Array.isArray(data) ? data.length : 0 };
}

async function testInsert() {
  const testNumero = '#D' + Date.now().toString(36).toUpperCase().slice(-4);
  const res = await fetch(`${BASE}/notes`, {
    method: 'POST',
    headers: {
      ...AUTH,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      numero: testNumero,
      fecha: new Date().toISOString().split('T')[0],
      destino: 'Planta de Producción',
      estatus: 'Nueva',
      observaciones: '[DIAGNÓSTICO AUTOMÁTICO — eliminar si persiste]',
      creado_por: 'diagnose-script',
    }),
  });

  const body = await res.text().catch(() => '');
  let insertedId = null;

  if (res.ok) {
    const loc = res.headers.get('location') || res.headers.get('Content-Location');
    if (loc) {
      const id = loc.split('/').pop();
      if (id && /^[a-f0-9-]{36}$/i.test(id)) insertedId = id;
    }
  }

  return { ok: res.ok, status: res.status, body: body.slice(0, 300), insertedId };
}

async function deleteNote(id) {
  if (!id) return false;
  const res = await fetch(`${BASE}/notes?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: AUTH,
  });
  return res.ok;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('══════════════════════════════════════════════');
  console.log('  Enote Diagnóstico 401 — POST /notes');
  console.log('══════════════════════════════════════════════\n');

  // 0. Connectivity
  console.log('── Conectividad ──');
  const conn = await getNotesCount();
  console.log(ok(conn.ok ? '✓' : '✗', 'GET /notes?limit=1', `HTTP ${conn.status}`));
  if (!conn.ok) {
    console.log('\n  ERROR: No se pudo conectar. Verifica SUPABASE_URL y SERVICE_ROLE_KEY.\n');
    process.exit(1);
  }
  console.log();

  // 1. RPC diagnostic function
  console.log('── Ejecutando diagnose_enote_401() ──');
  let diag;
  try {
    diag = await rpc('diagnose_enote_401');
    console.log(ok('✓', 'Función RPC responde OK'));
  } catch (err) {
    console.log(ok('✗', 'Función no encontrada', err.message));
    console.log('\n  PRIMERO ejecuta scripts/diagnose-401.sql en:');
    console.log('  https://supabase.com/dashboard/project/ovlhabedefwbajrnfpup/sql/new');
    console.log();
    process.exit(1);
  }
  console.log();

  // 2. Table Privileges
  console.log('── Privilegios de tabla (notes) ──');
  const privs = Array.isArray(diag.table_privileges) ? diag.table_privileges : [];
  const has = (grantee, priv) => privs.some(p => p.grantee === grantee && p.privilege === priv);
  console.log(ok(has('authenticated', 'INSERT') ? '✓' : '✗', 'GRANT INSERT TO authenticated'));
  console.log(ok(has('authenticated', 'SELECT') ? '✓' : '✗', 'GRANT SELECT TO authenticated'));
  console.log(ok(has('authenticated', 'UPDATE') ? '✓' : '✗', 'GRANT UPDATE TO authenticated'));
  console.log(ok(has('authenticated', 'DELETE') ? '✓' : '✗', 'GRANT DELETE TO authenticated'));
  if (privs.length > 0) {
    for (const p of privs) console.log(`    ${p.grantee}: ${p.privilege}`);
  } else {
    console.log('    (sin grants — la tabla probablemente usa ALTER DEFAULT PRIVILEGES)');
  }
  console.log();

  // 3. RLS
  console.log('── Row Level Security ──');
  console.log(ok(diag.rls_enabled ? '✓' : '✗', 'RLS habilitado en notes'));
  console.log();

  // 4. Policies
  console.log('── Políticas en notes ──');
  const policies = Array.isArray(diag.policies) ? diag.policies : [];
  const cmdCount = {};
  for (const p of policies) cmdCount[p.command] = (cmdCount[p.command] || 0) + 1;
  console.log(`  Total: ${policies.length}  (${Object.entries(cmdCount).map(([c,n]) => `${c}:${n}`).join(', ')})`);

  const insertOk = policies.some(p =>
    (p.command === 'INSERT' || p.command === 'ALL') &&
    (p.with_check || '').includes('sucursal')
  );
  console.log(ok(insertOk ? '✓' : '✗', 'Política INSERT cubre sucursal'));

  for (const p of policies) {
    console.log(`    ${p.name} [${p.command}]`);
  }
  console.log();

  // 5. Profile
  console.log('── Perfil "ocotlan" ──');
  const profile = diag.profile_ocotlan;
  if (profile && profile !== null && typeof profile === 'object') {
    console.log(ok('✓', 'Existe en profiles', `role=${profile.role}, destino=${profile.destino || 'NULL'}`));
    console.log(ok(profile.role === 'sucursal' ? '✓' : '✗', `Rol es "sucursal"`, profile.role === 'sucursal' ? 'OK' : `es "${profile.role}"`));
    console.log(ok(profile.destino ? '✓' : '✗', 'Tiene destino asignado'));
  } else {
    console.log(ok('✗', 'Existe en profiles', 'NO ENCONTRADO'));
  }
  console.log();

  // 6. Triggers
  console.log('── Triggers en notes ──');
  const triggers = Array.isArray(diag.triggers) ? diag.triggers : [];
  if (triggers.length > 0) {
    for (const t of triggers) console.log(`    ${t.name}: ${t.timing} ${t.event}`);
  } else {
    console.log('    (ninguno — el trigger de auditoría podría faltar)');
  }
  console.log();

  // 7. Helper functions
  console.log('── Funciones helper del repo ──');
  const funcs = Array.isArray(diag.functions) ? diag.functions : [];
  if (funcs.length > 0) {
    for (const f of funcs) console.log(`    ${f.name}() → ${f.returns} [${f.security}]`);
  } else {
    console.log('    (ninguna encontrada — verificar migrations 0001 y 0002)');
  }
  console.log();

  // 8. Test INSERT with service_role
  console.log('── Prueba INSERT con service_role ──');
  const insert = await testInsert();
  console.log(ok(insert.ok ? '✓' : '✗', `INSERT test`, `HTTP ${insert.status}`));
  if (!insert.ok) console.log(`    Body: ${insert.body}`);
  if (insert.insertedId) {
    const deleted = await deleteNote(insert.insertedId);
    console.log(ok(deleted ? '✓' : '✗', 'DELETE cleanup'));
  }
  console.log();

  // 9. Constraints
  console.log('── Constraints en notes ──');
  const constraints = Array.isArray(diag.constraints) ? diag.constraints : [];
  if (constraints.length > 0) {
    for (const c of constraints) console.log(`    ${c.name}: ${c.type}`);
  } else {
    console.log('    (ninguno visible)');
  }
  console.log();

  // ─── VEREDICTO ──────────────────────────────────────────────────────────────

  console.log('══════════════════════════════════════════════');
  console.log('  VEREDICTO');
  console.log('══════════════════════════════════════════════');
  console.log(`  ${diag.verdict || 'No disponible — revisar salida manualmente'}`);
  console.log();

  // Recommendations
  console.log('── Acción recomendada ──');
  const v = (diag.verdict || '').toLowerCase();

  if (v.includes('rls not enabled')) {
    console.log('  ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;');
  } else if (v.includes('missing from')) {
    console.log('  INSERT INTO public.profiles (id, username, role, destino)');
    console.log(`  VALUES ('<uuid>', 'ocotlan', 'sucursal', 'Sucursal 1');`);
  } else if (v.includes('wrong role')) {
    console.log(`  UPDATE public.profiles SET role = 'sucursal' WHERE username = 'ocotlan';`);
  } else if (v.includes('destino')) {
    console.log(`  UPDATE public.profiles SET destino = 'Sucursal 1' WHERE username = 'ocotlan';`);
  } else if (v.includes('missing grant')) {
    console.log('  GRANT INSERT ON public.notes TO authenticated;');
  } else if (v.includes('missing policy')) {
    console.log('  Revisa y re-ejecuta supabase/migrations/0001_rls_baseline.sql en SQL Editor.');
  } else {
    console.log('  El servidor está correcto. El 401 es intermitente del cliente.');
    console.log('  Para prevenirlo: agrega await supabase.auth.getSession() antes del');
    console.log('  POST en createNote() y updateNote() (js/store.js).');
  }
  console.log();
}

main().catch(err => {
  console.error('\nError inesperado:', err.message);
  process.exit(1);
});
