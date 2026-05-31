-- RLS políticas faltantes: admin + sucursal
-- Fecha: 2026-05-31
-- Contexto: 0001_rls_baseline.sql solo versionó planta/repartidor.
-- Esta migración completa la baseline con admin y sucursal para reproducibilidad.
-- IMPORTANTE: correr en el SQL Editor de Supabase (no hay CLI conectada al repo).

-- ================================================
-- notes — admin (acceso total)
-- ================================================
-- Una sola política ALL es más fácil de mantener que cuatro políticas separadas.
create policy "notes_admin_all"
  on public.notes for all to authenticated
  using (get_my_role() = 'admin')
  with check (get_my_role() = 'admin');

-- ================================================
-- notes SELECT — sucursal (solo su destino O notas que creó)
-- ================================================
create policy "notes_select_sucursal"
  on public.notes for select to authenticated
  using (
    get_my_role() = 'sucursal'
    and (destino = get_my_destino() or creado_por = (
      select username from public.profiles where id = auth.uid()
    ))
  );

-- ================================================
-- notes INSERT — sucursal
-- (Ya cubierta por notes_insert_allowed de 0001, pero la explicitamos aquí por claridad)
-- ================================================
-- Nota: notes_insert_allowed en 0001 ya permite admin + sucursal.
-- No se duplica; esta migración agrega solo SELECT, UPDATE, DELETE.

-- ================================================
-- notes UPDATE — sucursal (solo notas de su destino o propias)
-- ================================================
create policy "notes_update_sucursal"
  on public.notes for update to authenticated
  using (
    get_my_role() = 'sucursal'
    and (destino = get_my_destino() or creado_por = (
      select username from public.profiles where id = auth.uid()
    ))
  )
  with check (
    get_my_role() = 'sucursal'
    and (destino = get_my_destino() or creado_por = (
      select username from public.profiles where id = auth.uid()
    ))
  );

-- ================================================
-- notes DELETE — sucursal (solo notas de su destino o propias)
-- ================================================
create policy "notes_delete_sucursal"
  on public.notes for delete to authenticated
  using (
    get_my_role() = 'sucursal'
    and (destino = get_my_destino() or creado_por = (
      select username from public.profiles where id = auth.uid()
    ))
  );

-- ================================================
-- notes DELETE — planta y repartidor
-- Planta y repartidor NO deben borrar. Si no existe política, RLS bloquea por defecto.
-- Se documenta explícitamente para dejar claro que es intencional.
-- No se necesita política: la ausencia de política DELETE para estos roles = denegado.
-- ================================================

-- ================================================
-- Verificación sugerida (correr tras aplicar)
-- ================================================
-- select tablename, policyname, cmd, roles
-- from pg_policies
-- where schemaname = 'public' and tablename = 'notes'
-- order by policyname;
--
-- Resultado esperado (7 políticas en notes):
--   notes_admin_all          | ALL        | {authenticated}
--   notes_delete_sucursal    | DELETE     | {authenticated}
--   notes_insert_allowed     | INSERT     | {authenticated}   ← de 0001
--   notes_select_planta      | SELECT     | {authenticated}   ← de 0001
--   notes_select_repartidor  | SELECT     | {authenticated}   ← de 0001
--   notes_select_sucursal    | SELECT     | {authenticated}
--   notes_update_planta      | UPDATE     | {authenticated}   ← de 0001
--   notes_update_repartidor  | UPDATE     | {authenticated}   ← de 0001
--   notes_update_sucursal    | UPDATE     | {authenticated}
