-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- It is also appended to schema.sql, so a fresh setup gets it automatically.

-- ---------------------------------------------------------------------------
-- 1. Does this email already have an account, and is it usable?
--
-- Registration used to call signInWithOtp() blind, and Supabase mails a code
-- to an existing address just as happily as to a new one -- so signing up with
-- an address that already had an account looked like it worked.
--
-- Three answers, because "exists" is not specific enough to act on:
--   none        no auth user -- go ahead and register
--   incomplete  an auth user whose setup never finished (no profile row, or a
--               password never chosen). Registration must still be allowed
--               here, or one interrupted sign-up locks that address out for
--               good with no way back.
--   active      a finished account -- refuse, and send them to sign in
-- ---------------------------------------------------------------------------
create or replace function public.account_status(check_email text)
returns text
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  found_id uuid;
  finished boolean;
begin
  select u.id into found_id
    from auth.users u
   where lower(u.email) = lower(trim(check_email))
   limit 1;

  if found_id is null then
    return 'none';
  end if;

  select p.has_password into finished
    from public.profiles p
   where p.id = found_id;

  -- No profile row, or one that never finished setup.
  if finished is distinct from true then
    return 'incomplete';
  end if;

  return 'active';
end;
$$;

revoke all on function public.account_status(text) from public;
grant execute on function public.account_status(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Deleting a profile deletes the account.
--
-- `profiles.id references auth.users on delete cascade` only runs one way:
-- removing the auth user clears the profile, but removing the profile left the
-- real account behind, still able to sign in. The app then read the missing
-- profile as "setup unfinished" and offered to rebuild it -- so a deleted
-- account came back to life on the next sign-in.
--
-- Deleting the auth user cascades back to profiles, but by then this row is
-- already gone, so the statement below matches nothing and cannot recurse.
-- ---------------------------------------------------------------------------
create or replace function public.delete_auth_user_for_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.users where id = old.id;
  return old;
end;
$$;

drop trigger if exists profiles_delete_auth_user on public.profiles;
create trigger profiles_delete_auth_user
  after delete on public.profiles
  for each row execute function public.delete_auth_user_for_profile();
