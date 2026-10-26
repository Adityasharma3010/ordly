-- =====================================================================
-- Ordly — richer invite emails (run ONCE on your live Supabase project)
--
--   • an invite can carry a short personal note (up to 300 characters) from the person
--     inviting, shown as a quote in the email
--   • an invite remembers whether the email may show a small preview of the list
--   • invite_email_begin() now also hands back those two things, so the Edge Function
--     still only ever gets what it says from the database
--
-- Dashboard → SQL Editor → New query → paste this whole file → Run.
-- Run invite-emails.sql first if you haven't. supabase/schema.sql has already been
-- updated to match. Safe to run twice; nothing existing changes.
-- =====================================================================

alter table public.list_invites
  add column if not exists message text check (message is null or char_length(message) <= 300),
  add column if not exists include_preview boolean not null default true;

create or replace function public.invite_email_begin(p_invite_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  uid uuid := auth.uid();
  inv record;
  who text;
  log_id uuid;
begin
  if uid is null then raise exception 'not_allowed'; end if;

  select i.id, i.email, i.role, i.emailed_at, i.email_count, i.message, i.include_preview,
         l.id as list_id, l.title
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
    'inviter_name', who,
    'message', inv.message,
    'include_preview', inv.include_preview
  );
end $$;

revoke execute on function public.invite_email_begin(uuid) from public, anon;
