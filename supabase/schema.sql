-- LibSpace schema
-- Run in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).

create extension if not exists "btree_gist";

-- ---------------------------------------------------------------- rooms
create table if not exists public.rooms (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null,
  capacity   int         not null check (capacity > 0),
  equipment  text[]      not null default '{}',
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------- reservations
create table if not exists public.reservations (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid        not null references public.rooms (id) on delete cascade,
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

-- Double-booking is rejected by the database, not just the UI.
-- Cancelled rows are excluded so a slot frees up when someone cancels.
alter table public.reservations
  drop constraint if exists reservations_no_overlap;

alter table public.reservations
  add constraint reservations_no_overlap
  exclude using gist (
    room_id with =,
    tstzrange(start_time, end_time, '[)') with &&
  ) where (status = 'active');

-- ------------------------------------------------------------------ RLS
alter table public.rooms        enable row level security;
alter table public.reservations enable row level security;

-- Open policies suited to an anonymous student-facing kiosk/app.
-- Tighten these once Supabase Auth is added.
drop policy if exists "rooms are readable by everyone" on public.rooms;
create policy "rooms are readable by everyone"
  on public.rooms for select using (true);

drop policy if exists "reservations are readable by everyone" on public.reservations;
create policy "reservations are readable by everyone"
  on public.reservations for select using (true);

drop policy if exists "anyone can create a reservation" on public.reservations;
create policy "anyone can create a reservation"
  on public.reservations for insert with check (status = 'active');

drop policy if exists "anyone can cancel a reservation" on public.reservations;
create policy "anyone can cancel a reservation"
  on public.reservations for update using (true) with check (status in ('active', 'cancelled'));

-- ------------------------------------------------------------- realtime
alter publication supabase_realtime add table public.reservations;
alter table public.reservations replica identity full;

-- ----------------------------------------------------------- seed rooms
insert into public.rooms (name, capacity, equipment)
values
  ('DR-101 · Quiet Study', 6,  '{Whiteboard,Outlets}'),
  ('DR-102 · Collab Pod',  8,  '{Display,Whiteboard,Outlets}'),
  ('DR-201 · Media Room',  10, '{Display,Outlets}'),
  ('DR-202 · Seminar',     12, '{Whiteboard,Display}'),
  ('DR-203 · Focus Booth', 4,  '{Outlets}')
on conflict do nothing;
