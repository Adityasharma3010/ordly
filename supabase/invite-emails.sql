-- =====================================================================
-- Ordly — invite emails (run ONCE on your live Supabase project)
--
--   • remembers when each pending invite was last emailed
--   • invite_email_begin(): the one place that decides whether an invite email may be sent
--     right now (you own the list, your own email is confirmed, not too often) and hands back
--     what the email says. The Edge Function "send-invite" calls it before it sends anything.
--   • invite_email_undo(): takes a send back if the email service failed, so a broken setup
--     doesn't use up your sending allowance while you fix it
--
-- Dashboard → SQL Editor → New query → paste this whole file → Run.
-- supabase/schema.sql has already been updated to match, so a brand-new project only needs
-- schema.sql. Safe to run twice; nothing existing changes.
-- =====================================================================

alter table public.list_invites
  add column if not exists emailed_at  timestamptz,
  add column if not exists email_count smallint not null default 0;

-- A private log of sends, used for the limits below. Nobody can read or write it through the
-- API (RLS on, no policies): only the functions below touch it.
create table if not exists public.invite_email_log (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users (id) on delete cascade,
  invite_id        uuid references public.list_invites (id) on delete set null,
  prev_emailed_at  timestamptz,
  sent_at          timestamptz not null default now()
);
alter table public.invite_email_log enable row level security;
create index if not exists invite_email_log_owner_idx on public.invite_email_log (owner_id, sent_at desc);

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

revoke execute on function public.invite_email_begin(uuid) from public, anon;
revoke execute on function public.invite_email_undo(uuid)  from public, anon;
