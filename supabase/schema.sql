-- =====================================================================
-- Ordly — database schema, Row Level Security, and sharing functions
-- Run this whole file once in Supabase: Dashboard → SQL Editor → New query.
-- It is safe to re-run on an empty project; on an existing one, drop the
-- objects first (see the bottom of the file).
-- =====================================================================

-- ---------- Tables ---------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url   text,
  created_at   timestamptz not null default now()
);

create table public.lists (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null default 'Untitled list' check (char_length(title) between 1 and 200),
  description text not null default '' check (char_length(description) <= 2000),
  icon        text not null default '' check (char_length(icon) <= 16),
  color       text not null default 'amber' check (char_length(color) <= 24),
  favorite    boolean not null default false,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.list_items (
  id            uuid primary key default gen_random_uuid(),
  list_id       uuid not null references public.lists (id) on delete cascade,
  text          text not null default '' check (char_length(text) <= 2000),
  notes         text not null default '' check (char_length(notes) <= 10000),
  has_checkbox  boolean not null default true,
  completed     boolean not null default false,
  position      double precision not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.list_shares (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references public.lists (id) on delete cascade,
  -- ~244 bits of randomness; unguessable. Only the list owner can read this column.
  token       text not null unique
              default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  permission  text not null check (permission in ('view', 'edit')),
  expires_at  timestamptz,
  revoked_at  timestamptz,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- People who redeemed a share link while signed in (needed for editing, and
-- for the "Shared with me" view).
create table public.list_members (
  list_id    uuid not null references public.lists (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('viewer', 'editor')),
  share_id   uuid references public.list_shares (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

-- ---------- Indexes --------------------------------------------------

create index lists_owner_idx          on public.lists (owner_id);
create index list_items_list_pos_idx  on public.list_items (list_id, position);
create index list_shares_list_idx     on public.list_shares (list_id);
create index list_members_user_idx    on public.list_members (user_id);
-- At most one active link per permission level per list.
create unique index list_shares_one_active_per_permission
  on public.list_shares (list_id, permission) where revoked_at is null;

-- ---------- Triggers -------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger lists_set_updated_at      before update on public.lists
  for each row execute function public.set_updated_at();
create trigger list_items_set_updated_at before update on public.list_items
  for each row execute function public.set_updated_at();

-- Editing an item bumps its list's "last updated" (runs as definer so that
-- editors, who cannot update the list row directly, still bump it).
create or replace function public.touch_list()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.lists set updated_at = now()
   where id = coalesce(new.list_id, old.list_id);
  return null;
end $$;

create trigger list_items_touch_list
  after insert or update or delete on public.list_items
  for each row execute function public.touch_list();

-- Create a profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1))
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Revoking a link removes everyone who joined through it; changing a link's
-- permission changes their role.
create or replace function public.sync_share_members()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.revoked_at is not null and old.revoked_at is null then
    delete from public.list_members where share_id = new.id;
  elsif new.permission <> old.permission then
    update public.list_members
       set role = case new.permission when 'edit' then 'editor' else 'viewer' end
     where share_id = new.id;
  end if;
  return new;
end $$;

create trigger list_shares_sync_members after update on public.list_shares
  for each row execute function public.sync_share_members();

-- ---------- Access helper (used by every policy) ---------------------
-- Returns 'owner' | 'editor' | 'viewer' | null for the current user.
-- SECURITY DEFINER avoids infinite recursion between lists <-> list_members policies.

create or replace function public.list_access(lid uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.lists where id = lid and owner_id = auth.uid()) then 'owner'
    else (select role from public.list_members where list_id = lid and user_id = auth.uid())
  end
$$;

-- Membership check used by the lists SELECT policy. It deliberately looks at list_members
-- (a different table), never at `lists` itself: a policy that re-reads the row being inserted
-- through a function cannot see it yet, which made INSERT ... ON CONFLICT fail with
-- "new row violates row-level security policy".
create or replace function public.is_list_member(lid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.list_members where list_id = lid and user_id = auth.uid())
$$;

-- ---------- Row Level Security ---------------------------------------

alter table public.profiles     enable row level security;
alter table public.lists        enable row level security;
alter table public.list_items   enable row level security;
alter table public.list_shares  enable row level security;
alter table public.list_members enable row level security;

revoke all on all tables in schema public from anon;

-- profiles: you can see and edit only your own. (Collaborator names are
-- returned by list_collaborators() below.)
create policy "profiles_select_own" on public.profiles for select to authenticated
  using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- lists: owners and members can read; only owners can change list details.
create policy "lists_select" on public.lists for select to authenticated
  using (owner_id = auth.uid() or public.is_list_member(id));
create policy "lists_insert" on public.lists for insert to authenticated
  with check (owner_id = auth.uid());
create policy "lists_update" on public.lists for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "lists_delete" on public.lists for delete to authenticated
  using (owner_id = auth.uid());

-- list_items: owners and members read; owners and editors write.
create policy "items_select" on public.list_items for select to authenticated
  using (public.list_access(list_id) is not null);
create policy "items_insert" on public.list_items for insert to authenticated
  with check (public.list_access(list_id) in ('owner', 'editor'));
create policy "items_update" on public.list_items for update to authenticated
  using (public.list_access(list_id) in ('owner', 'editor'))
  with check (public.list_access(list_id) in ('owner', 'editor'));
create policy "items_delete" on public.list_items for delete to authenticated
  using (public.list_access(list_id) in ('owner', 'editor'));

-- list_shares: owner only, for everything. Tokens never reach anyone else.
create policy "shares_owner_all" on public.list_shares for all to authenticated
  using (public.list_access(list_id) = 'owner')
  with check (public.list_access(list_id) = 'owner');

-- list_members: you can see your own memberships (owners see all for their
-- lists) and leave a list; owners can remove people. Joining only happens
-- through redeem_share() — there is deliberately no INSERT policy.
create policy "members_select" on public.list_members for select to authenticated
  using (user_id = auth.uid() or public.list_access(list_id) = 'owner');
create policy "members_delete" on public.list_members for delete to authenticated
  using (user_id = auth.uid() or public.list_access(list_id) = 'owner');

-- ---------- Sharing functions ----------------------------------------

-- Anonymous-friendly read of a shared list by token. Returns NULL when the
-- link is unknown, revoked, or expired.
create or replace function public.get_shared_list(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s public.list_shares;
  l public.lists;
begin
  select * into s from public.list_shares
   where token = p_token and revoked_at is null
     and (expires_at is null or expires_at > now());
  if not found then return null; end if;

  select * into l from public.lists where id = s.list_id;
  if not found then return null; end if;

  return jsonb_build_object(
    'permission', s.permission,
    'owner_name', (select display_name from public.profiles where id = l.owner_id),
    'list', jsonb_build_object(
      'id', l.id, 'title', l.title, 'description', l.description,
      'icon', l.icon, 'color', l.color, 'updated_at', l.updated_at),
    'items', coalesce(
      (select jsonb_agg(to_jsonb(i) - 'list_id' order by i.position)
         from public.list_items i where i.list_id = l.id),
      '[]'::jsonb)
  );
end $$;

-- Signed-in users redeem a link to become a viewer/editor of the list.
create or replace function public.redeem_share(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s public.list_shares;
  list_owner uuid;
  new_role text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into s from public.list_shares
   where token = p_token and revoked_at is null
     and (expires_at is null or expires_at > now());
  if not found then
    raise exception 'invalid_link' using errcode = 'P0002';
  end if;

  select owner_id into list_owner from public.lists where id = s.list_id;
  if list_owner = uid then
    return jsonb_build_object('list_id', s.list_id, 'role', 'owner');
  end if;

  new_role := case s.permission when 'edit' then 'editor' else 'viewer' end;

  -- Never downgrade an existing editor.
  insert into public.list_members (list_id, user_id, role, share_id)
  values (s.list_id, uid, new_role, s.id)
  on conflict (list_id, user_id) do update
    set role = excluded.role, share_id = excluded.share_id
    where public.list_members.role <> 'editor';

  return jsonb_build_object(
    'list_id', s.list_id,
    'role', (select role from public.list_members where list_id = s.list_id and user_id = uid));
end $$;

-- Owner-only: who has access to a list, with display names.
create or replace function public.list_collaborators(p_list_id uuid)
returns table (user_id uuid, display_name text, role text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.list_access(p_list_id) is distinct from 'owner' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select m.user_id, coalesce(p.display_name, ''), m.role, m.created_at
      from public.list_members m
      left join public.profiles p on p.id = m.user_id
     where m.list_id = p_list_id
     order by m.created_at;
end $$;

-- ---------- Function permissions -------------------------------------
-- Supabase grants EXECUTE on new functions to anon and authenticated by default, and
-- `revoke ... from public` does not remove those explicit grants, so name the roles.
-- Trigger functions never need to be callable through the API.
revoke execute on function public.handle_new_user()      from public, anon, authenticated;
revoke execute on function public.touch_list()           from public, anon, authenticated;
revoke execute on function public.sync_share_members()   from public, anon, authenticated;
-- Only signed-in users need these (RLS policies and the app call them).
revoke execute on function public.list_access(uuid)        from public, anon;
revoke execute on function public.is_list_member(uuid)     from public, anon;
revoke execute on function public.list_collaborators(uuid) from public, anon;
revoke execute on function public.redeem_share(text)       from public, anon;
-- get_shared_list is intentionally callable without signing in (anonymous view links).
revoke execute on function public.get_shared_list(text) from public;
grant  execute on function public.get_shared_list(text) to anon, authenticated;
grant  execute on function public.list_access(uuid)        to authenticated;
grant  execute on function public.is_list_member(uuid)     to authenticated;
grant  execute on function public.list_collaborators(uuid) to authenticated;
grant  execute on function public.redeem_share(text)       to authenticated;

-- ---------- Realtime (live updates for collaborators) ----------------
alter publication supabase_realtime add table public.lists, public.list_items, public.list_members;

-- ---------- To reset during development -----------------------------
-- drop table if exists public.list_members, public.list_shares, public.list_items,
--   public.lists, public.profiles cascade;
-- drop function if exists public.get_shared_list(text), public.redeem_share(text),
--   public.list_collaborators(uuid), public.list_access(uuid), public.is_list_member(uuid), public.sync_share_members(),
--   public.touch_list(), public.set_updated_at(), public.handle_new_user() cascade;