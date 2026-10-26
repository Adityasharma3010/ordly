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

-- Tags are a list of short words. At most 20 per list/item, each 1–40 characters.
create or replace function public.tags_ok(t text[])
returns boolean language sql immutable as $$
  select coalesce(cardinality(t), 0) <= 20
     and not exists (
       select 1 from unnest(t) as x where x is null or char_length(x) not between 1 and 40
     )
$$;

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
  updated_at  timestamptz not null default now(),
  parent_list_id uuid,
  -- Enhanced lists: a type, a due date (+ optional time), a priority (0 none … 3 high) and tags.
  list_type   text not null default 'checklist' constraint lists_list_type_check
              check (list_type in ('checklist', 'notes', 'numbered')),
  due_date    date,
  due_time    time,
  priority    smallint not null default 0 constraint lists_priority_check check (priority between 0 and 3),
  tags        text[] not null default '{}' constraint lists_tags_check check (public.tags_ok(tags)),
  -- A list can sit inside another list of the SAME owner (sub-lists, any depth).
  constraint lists_id_owner_key unique (id, owner_id),
  constraint lists_parent_fk foreign key (parent_list_id, owner_id)
    references public.lists (id, owner_id) on delete cascade
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
  updated_at    timestamptz not null default now(),
  -- Sub-items: the item this one sits under (null = top level). The composite key makes
  -- the parent live in the SAME list; deleting a parent deletes everything under it.
  parent_id     uuid,
  due_date      date,
  due_time      time,
  priority      smallint not null default 0 constraint list_items_priority_check check (priority between 0 and 3),
  tags          text[] not null default '{}' constraint list_items_tags_check check (public.tags_ok(tags)),
  constraint list_items_id_list_key unique (id, list_id),
  constraint list_items_parent_fk foreign key (parent_id, list_id)
    references public.list_items (id, list_id) on delete cascade
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

-- People with access to a list besides the owner: those who redeemed the share
-- link while signed in (share_id is the link they came through) and people the
-- owner added by hand (share_id is null). Drives editing and "Shared with me".
create table public.list_members (
  list_id    uuid not null references public.lists (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('viewer', 'editor')),
  share_id   uuid references public.list_shares (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

-- "This email may open this list." Claimed by claim_invites() when the person
-- signs in with that confirmed email. Nothing about other users is looked up,
-- so owners can't use it to discover who has an account.
create table public.list_invites (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.lists (id) on delete cascade,
  email      text not null check (
               email = lower(email)
               and char_length(email) <= 254
               and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role       text not null check (role in ('viewer', 'editor')),
  invited_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  emailed_at  timestamptz,
  email_count smallint not null default 0,
  unique (list_id, email)
);

-- A private log of invite emails, used for the sending limits. Nobody can read or write it
-- through the API (RLS on, no policies): only invite_email_begin / invite_email_undo touch it.
create table public.invite_email_log (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users (id) on delete cascade,
  invite_id        uuid references public.list_invites (id) on delete set null,
  prev_emailed_at  timestamptz,
  sent_at          timestamptz not null default now()
);
create index invite_email_log_owner_idx on public.invite_email_log (owner_id, sent_at desc);

-- Saved templates ("Save as template" on a list): a private tree of items to start new
-- lists from.
create table public.list_templates (
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

-- ---------- Indexes --------------------------------------------------

create index lists_owner_idx          on public.lists (owner_id);
create index lists_parent_idx         on public.lists (parent_list_id);
create index list_items_list_pos_idx  on public.list_items (list_id, position);
create index list_items_parent_idx    on public.list_items (list_id, parent_id);
create index list_templates_owner_idx on public.list_templates (owner_id, created_at desc);
create index list_shares_list_idx     on public.list_shares (list_id);
create index list_members_user_idx    on public.list_members (user_id);
-- At most one active link per list (its permission can be switched view <-> edit).
create unique index list_shares_one_active_per_list
  on public.list_shares (list_id) where revoked_at is null;

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

create trigger list_items_check_parent before update of parent_id on public.list_items
  for each row execute function public.check_item_parent();

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

create trigger lists_check_parent before update of parent_list_id on public.lists
  for each row execute function public.check_list_parent();

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

-- A person who joined through a link only has access while that link is live (not
-- revoked, not expired). People added individually have no link, so they are always live.
create or replace function public.share_is_live(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select sid is null or exists (
    select 1 from public.list_shares s
     where s.id = sid and s.revoked_at is null
       and (s.expires_at is null or s.expires_at > now())
  )
$$;

create or replace function public.list_access(lid uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.lists where id = lid and owner_id = auth.uid()) then 'owner'
    else (select m.role from public.list_members m
           where m.list_id = lid and m.user_id = auth.uid() and public.share_is_live(m.share_id))
  end
$$;

-- Membership check used by the lists SELECT policy. It deliberately looks at list_members
-- (a different table), never at `lists` itself: a policy that re-reads the row being inserted
-- through a function cannot see it yet, which made INSERT ... ON CONFLICT fail with
-- "new row violates row-level security policy".
create or replace function public.is_list_member(lid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.list_members m
     where m.list_id = lid and m.user_id = auth.uid() and public.share_is_live(m.share_id)
  )
$$;

-- ---------- Row Level Security ---------------------------------------

alter table public.profiles     enable row level security;
alter table public.lists        enable row level security;
alter table public.list_items   enable row level security;
alter table public.list_shares  enable row level security;
alter table public.list_members enable row level security;
alter table public.list_invites enable row level security;
alter table public.invite_email_log enable row level security;
alter table public.list_templates enable row level security;

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

-- list_invites: owner only, for everything.
create policy "invites_owner_all" on public.list_invites for all to authenticated
  using (public.list_access(list_id) = 'owner')
  with check (public.list_access(list_id) = 'owner');

-- list_templates: private to the owner, for everything.
create policy "templates_owner_all" on public.list_templates for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

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
-- Opening a link never lowers or re-attaches someone who already has access: an invited
-- editor opening a view link stays an editor, and an invited person is never tied to the
-- link, so switching the link off cannot remove them. The one change it can make is
-- lifting a viewer to editor when the link is an edit link.
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

  insert into public.list_members (list_id, user_id, role, share_id)
  values (s.list_id, uid, new_role, s.id)
  on conflict (list_id, user_id) do update
    set role = excluded.role
    where public.list_members.role = 'viewer' and excluded.role = 'editor';

  return jsonb_build_object(
    'list_id', s.list_id,
    'role', (select role from public.list_members where list_id = s.list_id and user_id = uid));
end $$;

-- Owner-only: who currently has access to a list, with display names. `via_link` is true
-- for people who came through the share link; people whose link has expired are left out.
create or replace function public.list_collaborators(p_list_id uuid)
returns table (user_id uuid, display_name text, role text, via_link boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.list_access(p_list_id) is distinct from 'owner' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select m.user_id, coalesce(p.display_name, ''), m.role, (m.share_id is not null), m.created_at
      from public.list_members m
      left join public.profiles p on p.id = m.user_id
     where m.list_id = p_list_id and public.share_is_live(m.share_id)
     order by m.created_at;
end $$;

-- Owner changes a person's role. Also detaches them from the link, so turning the link
-- off later won't remove someone you set up by hand.
create or replace function public.set_member_role(p_list_id uuid, p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.list_access(p_list_id) is distinct from 'owner' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_role not in ('viewer', 'editor') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  update public.list_members
     set role = p_role, share_id = null
   where list_id = p_list_id and user_id = p_user_id;
end $$;

-- Signed-in users call this on load: any invites for their confirmed email become real
-- access (individually added, so not tied to the link).
create or replace function public.claim_invites()
returns integer language plpgsql security definer set search_path = public, auth as $$
declare
  uid uuid := auth.uid();
  mail text;
  n integer := 0;
begin
  if uid is null then return 0; end if;

  select lower(u.email) into mail
    from auth.users u
   where u.id = uid and u.email_confirmed_at is not null;
  if mail is null then return 0; end if;

  with taken as (
    delete from public.list_invites where email = mail returning list_id, role
  ),
  added as (
    insert into public.list_members (list_id, user_id, role, share_id)
    select t.list_id, uid, t.role, null
      from taken t
      join public.lists l on l.id = t.list_id
     where l.owner_id <> uid
    on conflict (list_id, user_id) do update
      set role = case when excluded.role = 'editor' then 'editor' else public.list_members.role end,
          share_id = null
    returning 1
  )
  select count(*) into n from added;

  return n;
end $$;

-- Limits: 1 minute between emails for the same invite, 5 emails per invite, 20 an hour and
-- 60 a day per person. Raise them here if you ever need to.
create or replace function public.invite_email_begin(p_invite_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  uid uuid := auth.uid();
  inv record;
  who text;
  log_id uuid;
begin
  if uid is null then raise exception 'not_allowed'; end if;

  select i.id, i.email, i.role, i.emailed_at, i.email_count, l.id as list_id, l.title
    into inv
    from public.list_invites i
    join public.lists l on l.id = i.list_id
   where i.id = p_invite_id and l.owner_id = uid;
  if not found then raise exception 'not_allowed'; end if;

  -- Only people with a confirmed email can send, so throwaway accounts can't be used to spam.
  if not exists (select 1 from auth.users u where u.id = uid and u.email_confirmed_at is not null) then
    raise exception 'unverified';
  end if;

  if inv.emailed_at is not null and inv.emailed_at > now() - interval '1 minute' then
    raise exception 'cooldown';
  end if;
  if inv.email_count >= 5 then raise exception 'too_many_for_invite'; end if;
  if (select count(*) from public.invite_email_log where owner_id = uid and sent_at > now() - interval '1 hour') >= 20 then
    raise exception 'hourly_limit';
  end if;
  if (select count(*) from public.invite_email_log where owner_id = uid and sent_at > now() - interval '1 day') >= 60 then
    raise exception 'daily_limit';
  end if;

  select coalesce(nullif(btrim(p.display_name), ''), split_part(u.email, '@', 1))
    into who
    from auth.users u
    left join public.profiles p on p.id = u.id
   where u.id = uid;

  insert into public.invite_email_log (owner_id, invite_id, prev_emailed_at)
  values (uid, inv.id, inv.emailed_at)
  returning id into log_id;

  update public.list_invites
     set emailed_at = now(), email_count = email_count + 1
   where id = inv.id;

  return jsonb_build_object(
    'log_id', log_id,
    'list_id', inv.list_id,
    'list_title', inv.title,
    'invitee', inv.email,
    'role', inv.role,
    'inviter_name', who
  );
end $$;

create or replace function public.invite_email_undo(p_log_id uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  uid uuid := auth.uid();
  entry record;
begin
  if uid is null then return; end if;
  select * into entry from public.invite_email_log where id = p_log_id and owner_id = uid;
  if not found then return; end if;
  update public.list_invites
     set emailed_at = entry.prev_emailed_at,
         email_count = greatest(email_count - 1, 0)
   where id = entry.invite_id;
  delete from public.invite_email_log where id = entry.id;
end $$;

-- ---------- Function permissions -------------------------------------
-- Supabase grants EXECUTE on new functions to anon and authenticated by default, and
-- `revoke ... from public` does not remove those explicit grants, so name the roles.
-- Trigger functions never need to be callable through the API.
revoke execute on function public.handle_new_user()      from public, anon, authenticated;
revoke execute on function public.touch_list()           from public, anon, authenticated;
revoke execute on function public.sync_share_members()   from public, anon, authenticated;
-- Only used inside other functions.
revoke execute on function public.share_is_live(uuid)    from public, anon, authenticated;
revoke execute on function public.check_item_parent()    from public, anon, authenticated;
revoke execute on function public.check_list_parent()    from public, anon, authenticated;
-- Only signed-in users need these (RLS policies and the app call them).
revoke execute on function public.list_access(uuid)        from public, anon;
revoke execute on function public.is_list_member(uuid)     from public, anon;
revoke execute on function public.list_collaborators(uuid) from public, anon;
revoke execute on function public.redeem_share(text)       from public, anon;
revoke execute on function public.claim_invites()                   from public, anon;
revoke execute on function public.invite_email_begin(uuid)          from public, anon;
revoke execute on function public.invite_email_undo(uuid)           from public, anon;
revoke execute on function public.set_member_role(uuid, uuid, text) from public, anon;
-- get_shared_list is intentionally callable without signing in (anonymous view links).
revoke execute on function public.get_shared_list(text) from public;
grant  execute on function public.get_shared_list(text) to anon, authenticated;
grant  execute on function public.list_access(uuid)        to authenticated;
grant  execute on function public.is_list_member(uuid)     to authenticated;
grant  execute on function public.list_collaborators(uuid) to authenticated;
grant  execute on function public.redeem_share(text)       to authenticated;
grant  execute on function public.claim_invites()                   to authenticated;
grant  execute on function public.set_member_role(uuid, uuid, text) to authenticated;

-- ---------- Realtime (live updates for collaborators) ----------------
alter publication supabase_realtime add table public.lists, public.list_items, public.list_members;

-- ---------- To reset during development -----------------------------
-- drop table if exists public.list_templates, public.list_invites, public.list_members, public.list_shares, public.list_items,
--   public.lists, public.profiles cascade;
-- drop function if exists public.get_shared_list(text), public.redeem_share(text),
--   public.claim_invites(), public.set_member_role(uuid, uuid, text), public.share_is_live(uuid),
--   public.list_collaborators(uuid), public.list_access(uuid), public.is_list_member(uuid), public.sync_share_members(),
--   public.touch_list(), public.check_item_parent(), public.check_list_parent(), public.set_updated_at(), public.handle_new_user() cascade;