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
  group_size   int         not null default 1 check (group_size > 0),
  purpose      text,
  start_time   timestamptz not null,
  end_time     timestamptz not null,
  status       text        not null default 'active'
                 check (status in ('active', 'cancelled')),
  created_at   timestamptz not null default now(),
  constraint reservations_time_order check (end_time > start_time)
);

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
  ) where (status = 'active');

-- A booking may not land on top of an admin block.
create or replace function public.reject_blocked_reservation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'active' and exists (
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

create policy "students book for self" on public.reservations
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'active');

create policy "students cancel own" on public.reservations
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "admins manage reservations" on public.reservations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- REALTIME
-- ============================================================================
alter table public.reservations replica identity full;
alter table public.room_blocks  replica identity full;

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

-- ============================================================================
-- SEED — Holy Angel University: 10 discussion rooms, Mon–Sat 08:00–17:00
-- ============================================================================
insert into public.rooms (name, capacity, equipment)
values
  ('DR-01 · Quiet Study',    6,  '{Whiteboard,Outlets}'),
  ('DR-02 · Collab Pod',     8,  '{Display,Whiteboard,Outlets}'),
  ('DR-03 · Focus Booth',    4,  '{Outlets}'),
  ('DR-04 · Group Study',    8,  '{Whiteboard,Outlets}'),
  ('DR-05 · Media Room',     10, '{Display,Outlets}'),
  ('DR-06 · Seminar Room',   12, '{Whiteboard,Display,Outlets}'),
  ('DR-07 · Thesis Room',    6,  '{Whiteboard,Display,Outlets}'),
  ('DR-08 · Review Room',    10, '{Whiteboard,Outlets}'),
  ('DR-09 · Presentation',   12, '{Display,Outlets}'),
  ('DR-10 · Consultation',   4,  '{Whiteboard,Outlets}')
on conflict do nothing;

insert into public.room_schedules (room_id, weekday, opens_at, closes_at)
select r.id, d.weekday, time '08:00', time '17:00'
from public.rooms r
cross join generate_series(1, 6) as d(weekday)  -- Mon–Sat, closed Sunday
on conflict (room_id, weekday) do nothing;

-- ============================================================================
-- PROMOTE AN ADMIN
-- Sign in once with the staff account so the profile row exists, then run:
--
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- ============================================================================
