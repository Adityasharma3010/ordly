-- =====================================================================
-- Ordly — saved templates (run ONCE on your live Supabase project)
--
--   "Save as template" on a list keeps its items (with sub-items) so you can start
--   a new list from it later. Templates are private: only their owner can see them.
--
-- Dashboard → SQL Editor → New query → paste this whole file → Run.
-- supabase/schema.sql has already been updated to match, so a brand-new
-- project only needs schema.sql. Safe to run twice.
-- =====================================================================

create table if not exists public.list_templates (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  icon        text not null default '' check (char_length(icon) <= 16),
  color       text not null default 'amber' check (char_length(color) <= 24),
  description text not null default '' check (char_length(description) <= 2000),
  -- A tree: [{ "text": "...", "notes": "...", "has_checkbox": true, "children": [ ... ] }]
  items       jsonb not null default '[]'::jsonb
              check (jsonb_typeof(items) = 'array' and pg_column_size(items) < 262144),
  created_at  timestamptz not null default now()
);

create index if not exists list_templates_owner_idx on public.list_templates (owner_id, created_at desc);

alter table public.list_templates enable row level security;
revoke all on public.list_templates from anon;

drop policy if exists "templates_owner_all" on public.list_templates;
create policy "templates_owner_all" on public.list_templates for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
