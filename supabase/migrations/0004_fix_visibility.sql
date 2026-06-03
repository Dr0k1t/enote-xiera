-- Fix visibilidad de notas por rol — v1.7.1
-- Fecha: 2026-06-02
-- Sucursal: ahora ve/edita/elimina TODAS las notas (sucursal=admin, sin filtro destino).
-- Planta: ve y actualiza TODAS las notas (necesario para auto-transición Nueva→En Proceso).
-- IMPORTANTE: correr en el SQL Editor de Supabase.

-- ================================================
-- Sucursal = admin: ve/edita/elimina TODAS las notas (sin filtro de destino).
-- Diseño v1.7.1: sucursal es alias de admin en la UI (canSeeAll = true).
-- ================================================
DROP POLICY IF EXISTS "notes_select_sucursal" ON public.notes;
CREATE POLICY "notes_select_sucursal" ON public.notes FOR SELECT TO authenticated
  USING (get_my_role() = 'sucursal');

DROP POLICY IF EXISTS "notes_update_sucursal" ON public.notes;
CREATE POLICY "notes_update_sucursal" ON public.notes FOR UPDATE TO authenticated
  USING (get_my_role() = 'sucursal')
  WITH CHECK (get_my_role() = 'sucursal');

DROP POLICY IF EXISTS "notes_delete_sucursal" ON public.notes;
CREATE POLICY "notes_delete_sucursal" ON public.notes FOR DELETE TO authenticated
  USING (get_my_role() = 'sucursal');

-- ================================================
-- Bug 2: Planta — ve y puede actualizar TODAS las notas (sin filtro de destino)
-- UPDATE necesario para auto-transición Nueva→En Proceso al abrir detalle
-- ================================================
DROP POLICY IF EXISTS "notes_select_planta" ON public.notes;
CREATE POLICY "notes_select_planta" ON public.notes FOR SELECT TO authenticated
  USING (get_my_role() = 'planta');

DROP POLICY IF EXISTS "notes_update_planta" ON public.notes;
CREATE POLICY "notes_update_planta" ON public.notes FOR UPDATE TO authenticated
  USING (get_my_role() = 'planta');

-- ================================================
-- Verificación sugerida
-- ================================================
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'notes'
-- ORDER BY policyname;
