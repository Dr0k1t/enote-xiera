-- Storage: bucket imagenes público + políticas
-- Applied: 2026-05-31
-- Causa: getPublicUrl solo funciona si el bucket es público.
--        Las imágenes se subían correctamente (INSERT ok) pero la URL
--        devuelta por getPublicUrl retornaba 403/404 al leerla.
-- Ejecutar en: Supabase SQL Editor (mismo proyecto que 0001 y 0002)

-- ================================================
-- 1. Marcar bucket como público
-- ================================================
update storage.buckets
  set public = true
  where id = 'imagenes';

-- ================================================
-- 2. Policy INSERT — solo usuarios autenticados
--    (idempotente: drop previo por si ya existe)
-- ================================================
drop policy if exists "imagenes_insert_authenticated" on storage.objects;
create policy "imagenes_insert_authenticated"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'imagenes');

-- ================================================
-- 3. Policy SELECT — público (redundante con bucket
--    público pero explícito para auditoría)
-- ================================================
drop policy if exists "imagenes_select_public" on storage.objects;
create policy "imagenes_select_public"
  on storage.objects for select to public
  using (bucket_id = 'imagenes');
