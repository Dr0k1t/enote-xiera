-- Security remediation — Supabase linter WARN (2026-06-04)
-- Fixes: function_search_path_mutable, anon/authenticated SECURITY DEFINER RPC exposure,
--        legacy bucket SELECT policy

-- Fix 1: assign_folio con search_path fijo
-- Previene que un schema malicioso intercepte nextval u otros objetos
CREATE OR REPLACE FUNCTION public.assign_folio()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := '#' || lpad(nextval('public.notes_folio_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Fix 2: REVOKE anon EXECUTE de todas las funciones SECURITY DEFINER expuestas
-- Sin esto, visitantes sin login pueden llamarlas vía /rest/v1/rpc/<nombre>
REVOKE EXECUTE ON FUNCTION public.diagnose_enote_401() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_destino() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.prevent_role_escalation() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_note_audit_fields() FROM anon;

-- Fix 3: REVOKE authenticated EXECUTE de funciones que no son helpers de RLS
-- IMPORTANTE: get_my_role() y get_my_destino() se mantienen para authenticated
--             porque las políticas RLS en 'notes' las invocan internamente.
--             PostgreSQL requiere EXECUTE del rol llamante para funciones en RLS policies.
REVOKE EXECUTE ON FUNCTION public.diagnose_enote_401() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_role_escalation() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_note_audit_fields() FROM authenticated;

-- Fix 4: Eliminar policy legacy del bucket imagenes
-- Creada automáticamente por Supabase al crear el bucket, ya no es necesaria
-- La policy 'imagenes_select_public' (de 0003_storage_imagenes.sql) sigue activa
DROP POLICY IF EXISTS "Give anon users access to JPG images in folder 1ktc4f5_1"
  ON storage.objects;

-- PENDIENTE (manual): Activar leaked password protection en Supabase Dashboard
-- Authentication → Providers → Email → Password strength
-- → Enable "Block compromised passwords" (consulta HaveIBeenPwned.org)
