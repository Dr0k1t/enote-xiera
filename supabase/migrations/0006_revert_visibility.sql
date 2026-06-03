-- Revertir visibilidad: sucursal herede todos los privilegios de admin
-- Fecha: 2026-06-02
-- IMPORTANTE: correr en el SQL Editor de Supabase.

-- 1. Ampliar política ALL de admin para cubrir sucursal
DROP POLICY IF EXISTS "notes_admin_all" ON public.notes;
CREATE POLICY "notes_admin_all" ON public.notes FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'sucursal'))
  WITH CHECK (get_my_role() IN ('admin', 'sucursal'));

-- 2. Eliminar políticas individuales de sucursal (cubiertas por notes_admin_all)
DROP POLICY IF EXISTS "notes_select_sucursal" ON public.notes;
DROP POLICY IF EXISTS "notes_update_sucursal" ON public.notes;
DROP POLICY IF EXISTS "notes_delete_sucursal" ON public.notes;

-- 3. Agregar columna concepto para transferencias
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS concepto text DEFAULT '';

-- 4. Verificación
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'notes'
ORDER BY policyname;
