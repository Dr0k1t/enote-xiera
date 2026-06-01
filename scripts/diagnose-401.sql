-- diagnose-401.sql — Función de diagnóstico para investigar 401 en POST /notes
-- Ejecutar UNA VEZ en Supabase SQL Editor antes de correr scripts/diagnose-401.js

create or replace function public.diagnose_enote_401()
returns jsonb
language plpgsql security definer
set search_path = public as $$
declare
  result jsonb;
  grants jsonb;
  policies jsonb;
  rls_status boolean;
  profile_info jsonb;
  triggers_info jsonb;
  constraints_info jsonb;
  functions_info jsonb;
  notes_count integer;
begin
  -- 1. Table privileges (la causa más probable del 401)
  select jsonb_agg(jsonb_build_object(
    'grantee', grantee,
    'privilege', privilege_type
  ))
  into grants
  from information_schema.role_table_grants
  where table_name = 'notes' and table_schema = 'public';

  -- 2. RLS status
  select rowsecurity into rls_status
  from pg_tables
  where schemaname = 'public' and tablename = 'notes';

  -- 3. Políticas aplicadas
  select jsonb_agg(jsonb_build_object(
    'name', policyname,
    'command', cmd,
    'roles', roles,
    'using', qual,
    'with_check', with_check
  ))
  into policies
  from pg_policies
  where schemaname = 'public' and tablename = 'notes';

  -- 4. Perfil de ocotlan
  select jsonb_build_object(
    'id', id,
    'username', username,
    'role', role,
    'destino', destino
  )
  into profile_info
  from public.profiles
  where username = 'ocotlan';

  -- 5. Triggers en notes
  select jsonb_agg(jsonb_build_object(
    'name', trigger_name,
    'timing', action_timing,
    'event', event_manipulation
  ))
  into triggers_info
  from information_schema.triggers
  where event_object_schema = 'public' and event_object_table = 'notes';

  -- 6. Constraints en notes
  select jsonb_agg(jsonb_build_object(
    'name', constraint_name,
    'type', constraint_type
  ))
  into constraints_info
  from information_schema.table_constraints
  where table_schema = 'public' and table_name = 'notes';

  -- 7. Funciones helper del repo
  select jsonb_agg(jsonb_build_object(
    'name', proname,
    'returns', pg_get_function_result(oid),
    'security', case when prosecdef then 'definer' else 'invoker' end
  ))
  into functions_info
  from pg_proc
  where proname in ('get_my_role', 'get_my_destino', 'set_note_audit_fields', 'prevent_role_escalation');

  -- 8. Conteo de notas
  select count(*) into notes_count from public.notes;

  -- 9. Veredicto automático
  result := jsonb_build_object(
    'diagnosed_at', now()::text,
    'table_privileges', coalesce(grants, '[]'::jsonb),
    'rls_enabled', rls_status,
    'policies', coalesce(policies, '[]'::jsonb),
    'profile_ocotlan', coalesce(to_jsonb(profile_info), 'null'::jsonb),
    'triggers', coalesce(triggers_info, '[]'::jsonb),
    'constraints', coalesce(constraints_info, '[]'::jsonb),
    'functions', coalesce(functions_info, '[]'::jsonb),
    'notes_count', notes_count,
    'verdict', case
      when not rls_status then 'RLS NOT ENABLED on notes — ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;'
      when profile_info is null then 'Profile "ocotlan" MISSING from public.profiles'
      when profile_info->>'role' <> 'sucursal' then 'Profile "ocotlan" has wrong role: ' || coalesce(profile_info->>'role', 'NULL')
      when profile_info->>'destino' is null then 'Profile "ocotlan" has destino=NULL — needs a destination'
      when grants is null or not exists (
        select 1 from jsonb_array_elements(grants) g
        where g->>'grantee' = 'authenticated' and g->>'privilege' = 'INSERT'
      ) then 'MISSING GRANT: INSERT ON notes TO authenticated — GRANT INSERT ON public.notes TO authenticated;'
      when policies is null or not exists (
        select 1 from jsonb_array_elements(policies) p
        where p->>'command' in ('INSERT', 'ALL') and coalesce(p->>'with_check', '') like '%sucursal%'
      ) then 'MISSING POLICY for sucursal INSERT — check migration 0001_rls_baseline.sql'
      else 'ALL CHECKS PASSED — 401 is a client-side JWT race condition, not a server config issue'
    end
  );

  return result;
end;
$$;

-- Verificación rápida
select diagnose_enote_401()->'verdict' as verdict;
