-- ============================================================================
-- LibSpace schema — rooms, admin-managed schedules, reservations, auth roles
-- Run in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- Safe to re-run.
-- ============================================================================

create extension if not exists "btree_gist";

-- ============================================================================
-- PROFILES — one row per auth user, carrying the role
-- ============================================================================
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text        not null,
  -- Name is stored in parts so it can be sorted and displayed consistently.
  -- `full_name` holds the rendered "Dela Cruz, Juan M." form the app writes.
  last_name      text    not null default '',
  first_name     text    not null default '',
  middle_initial text    not null default '',
  full_name      text    not null default '',
  student_id     text    not null default '',
  year_level     text    not null default '',
  course         text    not null default '',
  role       text        not null default 'student'
               check (role in ('student', 'admin')),
  -- Set once the user chooses their own password after OTP verification.
  -- Drives the "finish your account" step on the next sign-in.
  has_password boolean   not null default false,
  created_at timestamptz not null default now(),

  -- Students must register with a Gmail address; staff accounts may use
  -- any domain. Enforced in the database, not just the sign-up form.
  constraint students_must_use_gmail
    check (role <> 'student' or email ilike '%@gmail.com')
);

-- Idempotent upgrades for projects created before these columns existed.
alter table public.profiles
  add column if not exists has_password   boolean not null default false,
  add column if not exists last_name      text    not null default '',
  add column if not exists first_name     text    not null default '',
  add column if not exists middle_initial text    not null default '',
  add column if not exists year_level     text    not null default '',
  add column if not exists course         text    not null default '';

-- Role lookup used by every policy below. SECURITY DEFINER so that reading
-- the caller's own role does not recurse through profiles' own RLS.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Every new auth user gets a profile automatically.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Never let a profile problem block sign-up: account setup upserts the
  -- row anyway, so a warning is preferable to a failed registration.
  begin
    insert into public.profiles (id, email, role, has_password)
    values (new.id, new.email, 'student', false)
    on conflict (id) do nothing;
  exception when others then
    raise warning 'handle_new_user: could not create profile for %: %',
      new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Accounts created before this schema ran never fired the trigger, so give
-- them a profile too. They land on the "finish your account" screen.
insert into public.profiles (id, email, role, has_password)
select u.id, u.email, 'student', false
from auth.users u
on conflict (id) do nothing;

-- A student must never be able to promote themselves to admin.
create or replace function public.guard_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only an admin can change a role';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_role_change();

-- ============================================================================
-- ROOMS
-- ============================================================================
create table if not exists public.rooms (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null,
  capacity   int         not null check (capacity > 0),
  equipment  text[]      not null default '{}',
  is_active  boolean     not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- ROOM SCHEDULES — the weekly opening hours an admin sets per room
-- weekday: 0 = Sunday … 6 = Saturday (matches JS getDay())
-- ============================================================================
create table if not exists public.room_schedules (
  id        uuid primary key default gen_random_uuid(),
  room_id   uuid not null references public.rooms (id) on delete cascade,
  weekday   int  not null check (weekday between 0 and 6),
  opens_at  time not null,
  closes_at time not null,
  constraint room_schedules_time_order check (closes_at > opens_at),
  unique (room_id, weekday)
);

-- ============================================================================
-- ROOM BLOCKS — one-off closures (maintenance, reserved for a class)
-- ============================================================================
create table if not exists public.room_blocks (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid        not null references public.rooms (id) on delete cascade,
  start_time timestamptz not null,
  end_time   timestamptz not null,
  reason     text        not null default 'Unavailable',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint room_blocks_time_order check (end_time > start_time)
);

create index if not exists room_blocks_room_start_idx
  on public.room_blocks (room_id, start_time);

-- ============================================================================
-- RESERVATIONS
-- ============================================================================
create table if not exists public.reservations (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid        not null references public.rooms (id) on delete cascade,
  user_id      uuid        references auth.users (id) on delete set null,
  student_name text        not null,
  student_id   text        not null,
  group_size   int         not null default 5,
  purpose      text,
  -- Storage paths of one student-ID photo per group member.
  id_photos    text[]      not null default '{}',
  start_time   timestamptz not null,
  end_time     timestamptz not null,
  status       text        not null default 'pending'
                 check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  rejection_reason text,
  reviewed_by  uuid        references auth.users (id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  constraint reservations_time_order check (end_time > start_time)
);

alter table public.reservations
  add column if not exists id_photos text[] not null default '{}';

-- Holy Angel University requires a group of at least 5 to reserve a room.
alter table public.reservations drop constraint if exists reservations_min_group;
alter table public.reservations
  add constraint reservations_min_group check (group_size >= 5);

create index if not exists reservations_room_start_idx
  on public.reservations (room_id, start_time);
create index if not exists reservations_user_idx
  on public.reservations (user_id);

-- Double-booking is rejected by the database, not just the UI.
-- Cancelled rows are excluded so a slot frees up when someone cancels.
alter table public.reservations drop constraint if exists reservations_no_overlap;
alter table public.reservations
  add constraint reservations_no_overlap
  exclude using gist (
    room_id with =,
    tstzrange(start_time, end_time, '[)') with &&
  ) where (status in ('pending', 'approved'));

-- A booking may not land on top of an admin block.
create or replace function public.reject_blocked_reservation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- 'active' was never a status this table allows, so this guard silently
  -- did nothing: every booking landing on an admin block was accepted.
  if new.status in ('pending', 'approved') and exists (
    select 1 from public.room_blocks b
    where b.room_id = new.room_id
      and tstzrange(b.start_time, b.end_time, '[)')
          && tstzrange(new.start_time, new.end_time, '[)')
  ) then
    raise exception 'That time is blocked off by the library staff';
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_check_blocks on public.reservations;
create trigger reservations_check_blocks
  before insert or update on public.reservations
  for each row execute function public.reject_blocked_reservation();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles        enable row level security;
alter table public.rooms           enable row level security;
alter table public.room_schedules  enable row level security;
alter table public.room_blocks     enable row level security;
alter table public.reservations    enable row level security;

-- ---------------------------------------------------------------- profiles
drop policy if exists "insert own profile"    on public.profiles;
drop policy if exists "read own profile"      on public.profiles;
drop policy if exists "admins read profiles"  on public.profiles;
drop policy if exists "update own profile"    on public.profiles;
drop policy if exists "admins update profiles" on public.profiles;

-- Without an INSERT policy, RLS denies every insert -- including the
-- upsert the app performs during account setup.
create policy "insert own profile" on public.profiles
  for insert to authenticated with check (id = auth.uid());

create policy "read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());

create policy "admins read profiles" on public.profiles
  for select to authenticated using (public.is_admin());

-- The guard_role_change trigger stops a student flipping their own role.
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "admins update profiles" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------------- rooms
drop policy if exists "anyone reads rooms"  on public.rooms;
drop policy if exists "admins manage rooms" on public.rooms;

create policy "anyone reads rooms" on public.rooms
  for select to authenticated using (true);

create policy "admins manage rooms" on public.rooms
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------- room_schedules
drop policy if exists "anyone reads schedules"  on public.room_schedules;
drop policy if exists "admins manage schedules" on public.room_schedules;

create policy "anyone reads schedules" on public.room_schedules
  for select to authenticated using (true);

create policy "admins manage schedules" on public.room_schedules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------ room_blocks
drop policy if exists "anyone reads blocks"  on public.room_blocks;
drop policy if exists "admins manage blocks" on public.room_blocks;

create policy "anyone reads blocks" on public.room_blocks
  for select to authenticated using (true);

create policy "admins manage blocks" on public.room_blocks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------- reservations
drop policy if exists "anyone reads reservations" on public.reservations;
drop policy if exists "students book for self"    on public.reservations;
drop policy if exists "students cancel own"       on public.reservations;
drop policy if exists "admins manage reservations" on public.reservations;

-- Everyone signed in can see the day's occupancy — that is the whole point
-- of the grid. Only the owner and admins can change a row.
create policy "anyone reads reservations" on public.reservations
  for select to authenticated using (true);

-- Students may only ever file a pending request; staff decide the rest.
create policy "students book for self" on public.reservations
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

create policy "students cancel own" on public.reservations
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "admins manage reservations" on public.reservations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- APPROVAL WORKFLOW + IN-APP NOTIFICATIONS
-- ============================================================================
create table if not exists public.notifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  kind           text not null check (kind in ('approved', 'rejected', 'cancelled', 'info')),
  title          text not null,
  body           text not null default '',
  reservation_id uuid references public.reservations (id) on delete set null,
  read_at        timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "update own notifications" on public.notifications;
create policy "update own notifications" on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "delete own notifications" on public.notifications;
create policy "delete own notifications" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- The notice is raised in the database, so a client cannot skip it.
create or replace function public.notify_reservation_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  room_name text;
  when_text text;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status not in ('approved', 'rejected') then return new; end if;
  if new.user_id is null then return new; end if;

  select name into room_name from public.rooms where id = new.room_id;

  when_text := to_char(new.start_time at time zone 'Asia/Manila', 'Mon DD, HH12:MI AM')
    || ' – ' || to_char(new.end_time at time zone 'Asia/Manila', 'HH12:MI AM');

  insert into public.notifications (user_id, kind, title, body, reservation_id)
  values (
    new.user_id,
    new.status,
    case when new.status = 'approved'
      then coalesce(room_name, 'Your room') || ' is confirmed'
      else coalesce(room_name, 'Your room') || ' request was declined' end,
    case when new.status = 'approved'
      then when_text || '. Bring the student IDs you uploaded.'
      else when_text || '. '
        || coalesce(nullif(new.rejection_reason, ''), 'No reason was given.') end,
    new.id
  );

  return new;
end;
$$;

drop trigger if exists reservations_notify_decision on public.reservations;
create trigger reservations_notify_decision
  after update on public.reservations
  for each row execute function public.notify_reservation_decision();

-- A student must not approve their own booking.
create or replace function public.guard_reservation_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('approved', 'rejected')
     and not public.is_admin() then
    raise exception 'Only library staff can approve or reject a reservation';
  end if;

  if new.status in ('approved', 'rejected')
     and old.status is distinct from new.status then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_guard_status on public.reservations;
create trigger reservations_guard_status
  before update on public.reservations
  for each row execute function public.guard_reservation_status();

-- ============================================================================
-- STORAGE — private bucket for the student-ID photos
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reservation-ids', 'reservation-ids', false, 5242880,
  '{image/jpeg,image/jpg,image/png,image/webp,image/heic}'
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Files live at <user id>/<booking ref>/<n>.<ext>, so the first path segment
-- is the owner. Students touch only their own folder; admins may read all.
drop policy if exists "upload own reservation ids" on storage.objects;
create policy "upload own reservation ids" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'reservation-ids'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "read own reservation ids" on storage.objects;
create policy "read own reservation ids" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'reservation-ids'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists "delete own reservation ids" on storage.objects;
create policy "delete own reservation ids" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'reservation-ids'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ============================================================================
-- REALTIME
-- ============================================================================
alter table public.reservations  replica identity full;
alter table public.room_blocks   replica identity full;
alter table public.notifications replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.reservations;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.room_blocks;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

-- ============================================================================
-- SEED — Holy Angel University: 10 discussion rooms, Mon–Sat 08:00–17:00
-- ============================================================================
insert into public.rooms (name, capacity, equipment)
values
  ('DR-1',  5,  '{Outlets}'),
  ('DR-2',  5,  '{Whiteboard,Outlets}'),
  ('DR-3',  6,  '{Whiteboard,Outlets}'),
  ('DR-4',  6,  '{Whiteboard,Display,Outlets}'),
  ('DR-5',  8,  '{Whiteboard,Outlets}'),
  ('DR-6',  8,  '{Whiteboard,Display,Outlets}'),
  ('DR-7',  10, '{Display,Outlets}'),
  ('DR-8',  10, '{Whiteboard,Display,Outlets}'),
  ('DR-9',  12, '{Display,Outlets}'),
  ('DR-10', 12, '{Whiteboard,Display,Outlets}')
on conflict do nothing;

insert into public.room_schedules (room_id, weekday, opens_at, closes_at)
select r.id, d.weekday, time '08:00', time '17:00'
from public.rooms r
cross join generate_series(1, 6) as d(weekday)  -- Mon–Sat, closed Sunday
on conflict (room_id, weekday) do nothing;

-- ============================================================================
-- FRONT DESK, LIBRARY RULES AND MAIL
--
-- Everything below was added to the running database after the first version
-- of this file was written, and is transcribed from it so a fresh project
-- built from this script behaves like the live one. Without it the app calls
-- release_no_shows() on every day load, check-in and check-out fail, and the
-- status column rejects the two statuses the front desk writes.
-- ============================================================================

-- ---------------------------------------------------------------- settings
-- One row of library policy, editable by staff without a deploy.
create table if not exists public.app_settings (
  id                    int         primary key default 1 check (id = 1),
  no_show_grace_minutes int         not null default 15
                          check (no_show_grace_minutes between 0 and 120),
  max_active_bookings   int         not null default 2
                          check (max_active_bookings between 1 and 20),
  max_hours_per_day     numeric     not null default 4
                          check (max_hours_per_day between 0.5 and 24),
  advance_days          int         not null default 14
                          check (advance_days between 1 and 180),
  updated_at            timestamptz not null default now()
);

insert into public.app_settings (id) values (1) on conflict (id) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "anyone reads settings" on public.app_settings;
create policy "anyone reads settings" on public.app_settings
  for select to authenticated using (true);

drop policy if exists "admins change settings" on public.app_settings;
create policy "admins change settings" on public.app_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- -------------------------------------------------------------- mail hook
-- Where to POST when a decision is made, and the shared secret that proves
-- the call came from here. RLS is enabled and deliberately has NO policies:
-- nothing reachable through the API may read the secret. Only the
-- security-definer trigger below, which bypasses RLS, can see it.
create table if not exists public.mail_config (
  id           int  primary key default 1 check (id = 1),
  function_url text,
  hook_secret  text,
  enabled      boolean not null default false
);

insert into public.mail_config (id) values (1) on conflict (id) do nothing;

alter table public.mail_config enable row level security;

-- ------------------------------------------------- attendance on bookings
alter table public.reservations
  add column if not exists checked_in_at    timestamptz,
  add column if not exists checked_out_at   timestamptz,
  add column if not exists checked_in_by    uuid references auth.users (id) on delete set null,
  add column if not exists created_by_admin boolean not null default false;

-- 'completed' (checked out) and 'no_show' (nobody turned up) are written by
-- the functions below, so the check constraint has to allow them.
alter table public.reservations drop constraint if exists reservations_status_check;
alter table public.reservations
  add constraint reservations_status_check
  check (status in ('pending', 'approved', 'rejected', 'cancelled', 'no_show', 'completed'));

-- A completed booking still occupied its slot, so it keeps blocking overlap;
-- check_out_reservation shortens end_time to now, which is what actually
-- hands the remaining time back.
alter table public.reservations drop constraint if exists reservations_no_overlap;
alter table public.reservations
  add constraint reservations_no_overlap
  exclude using gist (
    room_id with =,
    tstzrange(start_time, end_time, '[)') with &&
  ) where (status in ('pending', 'approved', 'completed'));

-- --------------------------------------------------------- booking limits
-- The caps in app_settings, enforced where a client cannot skip them.
create or replace function public.enforce_booking_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rules       public.app_settings;
  active_now  int;
  hours_that_day numeric;
  booking_hours  numeric;
begin
  -- Staff booking a walk-in at the desk are not subject to student limits.
  if public.is_admin() then
    return new;
  end if;

  select * into rules from public.app_settings where id = 1;
  if not found then
    return new;
  end if;

  if new.start_time > now() + make_interval(days => rules.advance_days) then
    raise exception 'Bookings open only % days ahead', rules.advance_days;
  end if;

  select count(*) into active_now
  from public.reservations
  where user_id = new.user_id
    and status in ('pending', 'approved')
    and end_time > now()
    and id is distinct from new.id;

  if active_now >= rules.max_active_bookings then
    raise exception 'You already have % active bookings. Cancel one first.',
      rules.max_active_bookings;
  end if;

  booking_hours := extract(epoch from (new.end_time - new.start_time)) / 3600.0;

  select coalesce(sum(extract(epoch from (end_time - start_time)) / 3600.0), 0)
    into hours_that_day
  from public.reservations
  where user_id = new.user_id
    and status in ('pending', 'approved', 'completed')
    and (start_time at time zone 'Asia/Manila')::date
        = (new.start_time at time zone 'Asia/Manila')::date
    and id is distinct from new.id;

  if hours_that_day + booking_hours > rules.max_hours_per_day then
    raise exception 'That would put you over % hours for the day',
      rules.max_hours_per_day;
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_enforce_limits on public.reservations;
create trigger reservations_enforce_limits
  before insert on public.reservations
  for each row execute function public.enforce_booking_limits();

-- ------------------------------------------------------------- front desk
create or replace function public.check_in_reservation(reservation_id uuid)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.reservations;
begin
  if not public.is_admin() then
    raise exception 'Only library staff can check a group in';
  end if;

  update public.reservations
  set checked_in_at = coalesce(checked_in_at, now()),
      checked_in_by = auth.uid(),
      status = case when status = 'no_show' then 'approved' else status end
  where id = reservation_id
  returning * into row;

  return row;
end;
$$;

-- Checking out hands the unused time back by pulling end_time in to now.
create or replace function public.check_out_reservation(reservation_id uuid)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.reservations;
begin
  select * into row from public.reservations where id = reservation_id;
  if not found then
    raise exception 'Reservation not found';
  end if;

  if not public.is_admin() and row.user_id is distinct from auth.uid() then
    raise exception 'That is not your booking';
  end if;

  update public.reservations
  set checked_out_at = now(),
      status = 'completed',
      end_time = greatest(start_time + interval '1 minute', least(end_time, now()))
  where id = reservation_id
  returning * into row;

  return row;
end;
$$;

-- Rooms nobody claimed within the grace period go back to other students.
-- The app calls this on every day load; a cron job runs it in the background.
create or replace function public.release_no_shows()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  grace int;
  released int;
begin
  select no_show_grace_minutes into grace from public.app_settings where id = 1;
  grace := coalesce(grace, 15);

  with swept as (
    update public.reservations
    set status = 'no_show'
    where status = 'approved'
      and checked_in_at is null
      and start_time + make_interval(mins => grace) < now()
      and end_time > now()
    returning id, user_id, room_id
  )
  insert into public.notifications (user_id, kind, title, body, reservation_id)
  select
    s.user_id,
    'cancelled',
    coalesce(r.name, 'Your room') || ' was released',
    'Nobody checked in within ' || grace || ' minutes, so the room went back to other students.',
    s.id
  from swept s
  left join public.rooms r on r.id = s.room_id
  where s.user_id is not null;

  get diagnostics released = row_count;
  return released;
end;
$$;

-- ------------------------------------------------------------------ email
-- Optional: posts the decision to an edge function that sends the mail.
-- Does nothing until a row in mail_config is filled in and enabled.
create extension if not exists pg_net;

create or replace function public.email_reservation_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg       public.mail_config;
  student   record;
  when_text text;
  room_name text;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status not in ('approved', 'rejected') then return new; end if;
  if new.user_id is null then return new; end if;

  select * into cfg from public.mail_config where id = 1;
  if not found or not cfg.enabled or cfg.function_url is null then
    return new;
  end if;

  select p.email, p.full_name into student
  from public.profiles p where p.id = new.user_id;

  if student.email is null then return new; end if;

  select name into room_name from public.rooms where id = new.room_id;

  when_text := to_char(new.start_time at time zone 'Asia/Manila', 'FMDay, FMMon DD')
    || ' at ' || to_char(new.start_time at time zone 'Asia/Manila', 'FMHH12:MI AM')
    || ' – ' || to_char(new.end_time at time zone 'Asia/Manila', 'FMHH12:MI AM');

  perform net.http_post(
    url     := cfg.function_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object(
      'secret', cfg.hook_secret,
      'email',  student.email,
      'name',   coalesce(nullif(student.full_name, ''), 'there'),
      'room',   coalesce(room_name, 'Your room'),
      'when',   when_text,
      'status', new.status,
      'reason', new.rejection_reason
    )
  );

  return new;
exception when others then
  -- Never let mail trouble roll back a decision.
  raise warning 'email_reservation_decision failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists reservations_email_decision on public.reservations;
create trigger reservations_email_decision
  after update on public.reservations
  for each row execute function public.email_reservation_decision();

-- ============================================================================
-- PROMOTE AN ADMIN
-- Sign in once with the staff account so the profile row exists, then run:
--
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- ============================================================================
