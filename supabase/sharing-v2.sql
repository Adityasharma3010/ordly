-- =====================================================================
-- Ordly — sharing v2 (run ONCE on your live Supabase project)
--
--   • one share link per list, with a Viewer / Editor setting (like Google Docs)
--   • link expiry that really cuts access when it passes
--   • invite specific people by email (they get access when they sign in)
--   • owners can change a person's role
--
-- Dashboard → SQL Editor → New query → paste this whole file → Run.
-- supabase/schema.sql has already been updated to match, so a brand-new
-- project only needs schema.sql.
-- =====================================================================

-- ---------- 1. One active link per list --------------------------------
-- If a list currently has two active links (the old separate view + edit
-- links), keep the newest one and switch the other off. People who joined
-- through the one being switched off are NOT removed: they stay on the list
-- as individually-added people with the same role.
with ranked as (
  select id, row_number() over (partition by list_id order by created_at desc, id) as rn
    from public.list_shares
   where revoked_at is null
)
update public.list_members
   set share_id = null
 where share_id in (select id from ranked where rn > 1);

with ranked as (
  select id, row_number() over (partition by list_id order by created_at desc, id) as rn
    from public.list_shares
   where revoked_at is null
)
update public.list_shares
   set revoked_at = now()
 where id in (select id from ranked where rn > 1);

drop index if exists public.list_shares_one_active_per_permission;
create unique index if not exists list_shares_one_active_per_list
  on public.list_shares (list_id) where revoked_at is null;

-- ---------- 2. Link expiry cuts access ---------------------------------
-- A person who joined through a link only has access while that link is live
-- (not revoked, not expired). People added individually have no link, so they
-- are always live.
create or replace function public.share_is_live(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select sid is null or exists (
    select 1 from public.list_shares s
     where s.id = sid and s.revoked_at is null
       and (s.expires_at is null or s.expires_at > now())
  )
$$;
revoke execute on function public.share_is_live(uuid) from public, anon, authenticated;

create or replace function public.list_access(lid uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.lists where id = lid and owner_id = auth.uid()) then 'owner'
    else (select m.role from public.list_members m
           where m.list_id = lid and m.user_id = auth.uid() and public.share_is_live(m.share_id))
  end
$$;

-- Still never reads `lists` (see the note in schema.sql about INSERT ... ON CONFLICT).
create or replace function public.is_list_member(lid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.list_members m
     where m.list_id = lid and m.user_id = auth.uid() and public.share_is_live(m.share_id)
  )
$$;

-- Opening a link never lowers or re-attaches someone who already has access:
-- an invited editor opening a view link stays an editor, and an invited person
-- is never tied to the link, so switching the link off cannot remove them.
-- The one change it can make is lifting a viewer to editor when the link is an
-- edit link.
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

-- ---------- 3. Invite people by email ----------------------------------
-- An invite is just a note "this email may open this list". It is claimed
-- when the person signs in with that (confirmed) email. Nothing is looked up
-- about other users, so owners cannot use it to discover who has an account.
create table if not exists public.list_invites (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.lists (id) on delete cascade,
  email      text not null check (
               email = lower(email)
               and char_length(email) <= 254
               and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role       text not null check (role in ('viewer', 'editor')),
  invited_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (list_id, email)
);

alter table public.list_invites enable row level security;
revoke all on public.list_invites from anon;

drop policy if exists "invites_owner_all" on public.list_invites;
create policy "invites_owner_all" on public.list_invites for all to authenticated
  using (public.list_access(list_id) = 'owner')
  with check (public.list_access(list_id) = 'owner');

-- Signed-in users call this on load: any invites for their confirmed email
-- become real access (individually added, so not tied to the link).
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

-- ---------- 4. Owners change a person's role -----------------------------
-- Also detaches them from the link, so turning the link off later won't
-- remove someone you set up by hand.
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

-- Owner-only list of people who currently have access (adds `via_link`;
-- hides people whose link has expired).
drop function if exists public.list_collaborators(uuid);
create function public.list_collaborators(p_list_id uuid)
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

-- ---------- 5. Function permissions --------------------------------------
revoke execute on function public.claim_invites()                       from public, anon;
revoke execute on function public.set_member_role(uuid, uuid, text)     from public, anon;
revoke execute on function public.list_collaborators(uuid)              from public, anon;
grant  execute on function public.claim_invites()                       to authenticated;
grant  execute on function public.set_member_role(uuid, uuid, text)     to authenticated;
grant  execute on function public.list_collaborators(uuid)              to authenticated;
