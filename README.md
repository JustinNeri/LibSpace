# LibSpace

Replaces the physical logbook at the campus library by letting students check
real-time discussion-room availability and reserve a slot remotely.

**Stack** — React 19 (Vite) · Tailwind CSS v4 · Supabase (Postgres + Realtime) · Vercel

---

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + publishable key
npm run dev
```

The app runs on sample data until `rooms` is seeded, so the grid is never a
blank page during development. An amber banner tells you when that's happening.

## Database

Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor. It creates:

- `rooms` — name, capacity, equipment
- `reservations` — room, student name/ID, group size, time range, status
- a **GiST exclusion constraint** so overlapping active bookings on the same
  room are rejected by Postgres, not just by the UI
- RLS policies + the `supabase_realtime` publication for live updates

## Deploying

Push to GitHub, import the repo on Vercel, and add `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` as environment variables. [`vercel.json`](vercel.json)
already rewrites every path to `index.html` for client-side routing.

## Structure

```
src/
├── App.jsx                     state owner: selected date, selected slot, toast
├── components/
│   ├── AppHeader.jsx           brand, day navigation, legend, availability count
│   ├── TimeslotGrid.jsx        rooms × half-hour grid  (RoomRow, SlotCell, ReservationBlock)
│   ├── BookingModal.jsx        controlled booking form
│   └── Toast.jsx               transient confirmation
├── hooks/
│   └── useReservations.js      fetch + realtime subscription + insert
└── lib/
    ├── supabaseClient.js       singleton client
    ├── time.js                 slot maths — single source of truth for the day
    └── demoData.js             fallback rooms/reservations
```

## Notes

- The bookable day is defined once in [`src/lib/time.js`](src/lib/time.js)
  (`START_HOUR`, `END_HOUR`, `SLOT_MINUTES`). Change it there and the grid,
  the modal and the queries all follow.
- Reservations render as a single spanning block in the same CSS grid as the
  empty cells, so a 90-minute booking reads as one card rather than three boxes.
