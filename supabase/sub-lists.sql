-- =====================================================================
-- Ordly — sub-lists (run ONCE on your live Supabase project)
--
--   • a list can sit inside another list of YOURS (folder-like), at any depth
--   • a sub-list keeps its own sharing; nothing is inherited from the parent
--   • deleting a list deletes the lists inside it
--   • a list can't be moved inside itself (or one of its own sub-lists)
--
-- Dashboard → SQL Editor → New query → paste this whole file → Run.
-- supabase/schema.sql has already been updated to match, so a brand-new
-- project only needs schema.sql. Safe to run twice.
-- =====================================================================

alter table public.lists add column if not exists parent_list_id uuid;

-- (parent_list_id, owner_id) must point at a list with the SAME owner, so nobody can
-- hang a list under somebody else's. A null parent_list_id means a top-level list,
-- which is every list you have today.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'lists_id_owner_key') then
    alter table public.lists add constraint lists_id_owner_key unique (id, owner_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lists_parent_fk') then
    alter table public.lists add constraint lists_parent_fk
      foreign key (parent_list_id, owner_id) references public.lists (id, owner_id) on delete cascade;
  end if;
end $$;

create index if not exists lists_parent_idx on public.lists (parent_list_id);

-- Refuse to move a list underneath itself (or one of its own sub-lists).
create or replace function public.check_list_parent()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.parent_list_id is null then return new; end if;
  if new.parent_list_id = new.id or exists (
    with recursive up as (
      select id, parent_list_id from public.lists where id = new.parent_list_id
      union all
      select l.id, l.parent_list_id from public.lists l join up on l.id = up.parent_list_id
    )
    select 1 from up where id = new.id
  ) then
    raise exception 'list_cycle' using errcode = '23514';
  end if;
  return new;
end $$;
revoke execute on function public.check_list_parent() from public, anon, authenticated;

drop trigger if exists lists_check_parent on public.lists;
create trigger lists_check_parent before update of parent_list_id on public.lists
  for each row execute function public.check_list_parent();
