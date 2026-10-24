-- =====================================================================
-- Ordly — enhanced lists (run ONCE on your live Supabase project)
--
--   • lists AND items get: a due date (+ optional time), a priority (none/low/medium/high)
--     and tags
--   • lists get a type: checklist, notes or numbered
--
-- Dashboard → SQL Editor → New query → paste this whole file → Run.
-- supabase/schema.sql has already been updated to match, so a brand-new
-- project only needs schema.sql. Safe to run twice; nothing existing changes.
-- =====================================================================

-- Tags are a list of short words. At most 20 per list/item, each 1–40 characters.
create or replace function public.tags_ok(t text[])
returns boolean language sql immutable as $$
  select coalesce(cardinality(t), 0) <= 20
     and not exists (
       select 1 from unnest(t) as x where x is null or char_length(x) not between 1 and 40
     )
$$;

alter table public.lists
  add column if not exists list_type text not null default 'checklist',
  add column if not exists due_date  date,
  add column if not exists due_time  time,
  add column if not exists priority  smallint not null default 0,
  add column if not exists tags      text[] not null default '{}';

alter table public.list_items
  add column if not exists due_date date,
  add column if not exists due_time time,
  add column if not exists priority smallint not null default 0,
  add column if not exists tags     text[] not null default '{}';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'lists_list_type_check') then
    alter table public.lists add constraint lists_list_type_check
      check (list_type in ('checklist', 'notes', 'numbered'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lists_priority_check') then
    alter table public.lists add constraint lists_priority_check check (priority between 0 and 3);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lists_tags_check') then
    alter table public.lists add constraint lists_tags_check check (public.tags_ok(tags));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'list_items_priority_check') then
    alter table public.list_items add constraint list_items_priority_check check (priority between 0 and 3);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'list_items_tags_check') then
    alter table public.list_items add constraint list_items_tags_check check (public.tags_ok(tags));
  end if;
end $$;
