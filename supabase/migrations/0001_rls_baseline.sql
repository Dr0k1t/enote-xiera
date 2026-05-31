-- RLS baseline — enote-xiera
-- Applied: 2026-05-31
-- Replaces: notes_read (true), notes_update (true), notes_insert (with_check true), profiles_all (true)

-- ================================================
-- Helper functions (security definer — no RLS recursion)
-- ================================================
create or replace function public.get_my_role()
returns text language sql stable security definer
set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.get_my_destino()
returns text language sql stable security definer
set search_path = public as $$
  select destino from public.profiles where id = auth.uid();
$$;

-- ================================================
-- profiles
-- ================================================
-- drop policy if exists "profiles_all" on public.profiles; -- already dropped
create policy "profiles_select"
  on public.profiles for select to authenticated
  using (id = auth.uid() or get_my_role() = 'admin');

create policy "profiles_insert_admin"
  on public.profiles for insert to authenticated
  with check (get_my_role() = 'admin');

create policy "profiles_update"
  on public.profiles for update to authenticated
  using (id = auth.uid() or get_my_role() = 'admin')
  with check (id = auth.uid() or get_my_role() = 'admin');

create policy "profiles_delete_admin"
  on public.profiles for delete to authenticated
  using (get_my_role() = 'admin');

-- Prevent non-admin from escalating own role
create or replace function public.prevent_role_escalation()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.role <> old.role and get_my_role() <> 'admin' then
    raise exception 'Cannot change role: insufficient permissions';
  end if;
  return new;
end; $$;

drop trigger if exists trg_prevent_role_escalation on public.profiles;
create trigger trg_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- ================================================
-- notes INSERT — admin + sucursal only
-- ================================================
-- drop policy if exists "notes_insert" on public.notes; -- already dropped
create policy "notes_insert_allowed"
  on public.notes for insert to authenticated
  with check (get_my_role() in ('admin', 'sucursal'));

-- ================================================
-- notes SELECT — planta + repartidor
-- (admin: notes_admin ALL | sucursal: "Sucursal sees own or created")
-- ================================================
create policy "notes_select_planta"
  on public.notes for select to authenticated
  using (get_my_role() = 'planta' and destino = get_my_destino());

create policy "notes_select_repartidor"
  on public.notes for select to authenticated
  using (get_my_role() = 'repartidor');

-- ================================================
-- notes UPDATE — planta + repartidor
-- (admin: notes_admin ALL | sucursal: "Sucursal updates own destino")
-- ================================================
create policy "notes_update_planta"
  on public.notes for update to authenticated
  using (get_my_role() = 'planta' and destino = get_my_destino());

create policy "notes_update_repartidor"
  on public.notes for update to authenticated
  using (get_my_role() = 'repartidor');

-- ================================================
-- Audit trigger: forzar creado_por/modificado_por desde auth.uid()
-- ================================================
create or replace function public.set_note_audit_fields()
returns trigger language plpgsql security definer
set search_path = public as $$
declare uname text;
begin
  select username into uname from public.profiles where id = auth.uid();
  if (tg_op = 'INSERT') then
    new.creado_por := coalesce(uname, new.creado_por);
  elsif (tg_op = 'UPDATE') then
    new.modificado_por := coalesce(uname, new.modificado_por);
    if (new.tomada is distinct from old.tomada) then
      new.tomada_por := case when new.tomada then uname else null end;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_note_audit on public.notes;
create trigger trg_note_audit
  before insert or update on public.notes
  for each row execute function public.set_note_audit_fields();
