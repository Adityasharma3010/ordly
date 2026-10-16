-- =====================================================================
-- Ordly — sub-items (run ONCE on your live Supabase project)
--
--   • an item can sit under another item of the SAME list, at any depth
--   • deleting an item deletes everything under it
--   • an item can't be moved inside itself
--
-- Dashboard → SQL Editor → New query → paste this whole file → Run.
-- supabase/schema.sql has already been updated to match, so a brand-new
-- project only needs schema.sql. Safe to run twice.
-- =====================================================================

alter table public.list_items add column if not exists parent_id uuid;

-- (parent_id, list_id) must point at an item in the SAME list. A null parent_id
-- means a top-level item, which is every item you have today.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'list_items_id_list_key') then
    alter table public.list_items add constraint list_items_id_list_key unique (id, list_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'list_items_parent_fk') then
    alter table public.list_items add constraint list_items_parent_fk
      foreign key (parent_id, list_id) references public.list_items (id, list_id) on delete cascade;
  end if;
end $$;

create index if not exists list_items_parent_idx on public.list_items (list_id, parent_id);

-- Refuse to move an item underneath itself (or one of its own sub-items).
create or replace function public.check_item_parent()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.parent_id is null then return new; end if;
  if new.parent_id = new.id or exists (
    with recursive up as (
      select id, parent_id from public.list_items where id = new.parent_id
      union all
      select i.id, i.parent_id from public.list_items i join up on i.id = up.parent_id
    )
    select 1 from up where id = new.id
  ) then
    raise exception 'item_cycle' using errcode = '23514';
  end if;
  return new;
end $$;
revoke execute on function public.check_item_parent() from public, anon, authenticated;

drop trigger if exists list_items_check_parent on public.list_items;
create trigger list_items_check_parent before update of parent_id on public.list_items
  for each row execute function public.check_item_parent();
