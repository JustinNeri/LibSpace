# LibSpace

Replaces the physical logbook at the campus library by letting students check
real-time discussion-room availability and reserve a slot remotely.

**Stack** — React 19 (Vite) · Tailwind CSS v4 · Supabase (Postgres + Auth + Realtime) · Vercel

---

## Roles

| | Student | Admin |
|---|---|---|
| Sign in | email + password | email + password |
| Availability grid | view + book | view + book |
| Own bookings | view, cancel | sees **all** bookings |
| Rooms | — | add, edit, retire |
| Opening hours | — | set per room, per weekday |
| Blocked time | — | block a room for maintenance |

### Sign-up flow

Registration verifies the Gmail address with a one-time code, then the user
chooses their own password:

```
Gmail address  ->  6-digit code emailed  ->  code verified (session created)
               ->  set password + name + student number  ->  signed in
```

From then on they sign in with **email + password**. "Forgot password" reuses
the same code path and lands on the same password screen.

`profiles.has_password` records whether that final step happened, so a user who
closes the tab mid-registration is asked to finish it on their next visit
rather than being left with an unusable account.

Everyone signs up as a student. Promote a staff account by running this once,
after they have signed in at least one time:

```sql
update public.profiles set role = 'admin' where email = 'staff@example.com';
```

Students are restricted to `@gmail.com` in the sign-in form **and** by a check
constraint on `profiles`, so the rule survives a forged client.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + publishable key
npm run dev
```

## Supabase setup

**1. Run the schema.** Paste [`supabase/schema.sql`](supabase/schema.sql) into the
SQL editor. It creates `profiles`, `rooms`, `room_schedules`, `room_blocks` and
`reservations`, plus RLS policies, the Realtime publication, and 5 seeded rooms
open Mon–Sat 08:00–17:00.

**2. Switch the email template to a code.** By default Supabase emails a magic
*link*, but this app asks for a 6-digit *code*. Go to
**Authentication → Email Templates → Magic Link** and make the body use the
token instead of the URL:

```html
<h2>Your LibSpace access code</h2>
<p>Enter this code to sign in. It expires in one hour.</p>
<p style="font-size:28px;letter-spacing:6px;"><strong>{{ .Token }}</strong></p>
```

Without this change the email still arrives, but it contains a link rather than
the code the form expects.

**3. Mind the email rate limit.** Supabase's built-in SMTP allows only a
handful of messages per hour and is meant for testing. Before real students use
this, add your own SMTP provider under **Authentication → SMTP Settings**.

## Deploying

Push to GitHub, import the repo on Vercel, and add `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` as **Config** (not Secret) environment variables for
all three environments. [`vercel.json`](vercel.json) already rewrites every path
to `index.html` for client-side routing.

`VITE_`-prefixed variables are compiled into the bundle at build time, so adding
or changing one requires a redeploy.

## Structure

```
src/
├── App.jsx                     routes: auth gate -> profile setup -> workspace
├── components/
│   ├── AuthGate.jsx            login · register · forgot password
│   ├── AccountSetup.jsx        choose password (+ name, student number)
│   ├── AppHeader.jsx           day nav, view switch, account menu
│   ├── TimeslotGrid.jsx        rooms × half-hour grid
│   ├── BookingModal.jsx        controlled booking form
│   ├── MyReservations.jsx      student's bookings, or all of them for admins
│   ├── AdminPanel.jsx          rooms · opening hours · blocked time
│   └── Toast.jsx
├── hooks/
│   ├── useAuth.jsx             session + profile + role context
│   └── useReservations.js      day fetch, realtime, insert/cancel
└── lib/
    ├── supabaseClient.js
    ├── time.js                 slot maths — single source of truth for the day
    └── validation.js
```

## Notes

- The visible day window is **derived from the admin's opening hours** for that
  weekday, widened to cover every open room, and falls back to 08:00–17:00 when
  nothing is scheduled. See `windowForWeekday` in [`src/lib/time.js`](src/lib/time.js).
- Reservations and blocks render as single spanning cards in the same CSS grid
  as the empty cells, so a 90-minute booking reads as one card, not three boxes.
- Double-booking is rejected by a **GiST exclusion constraint**, not just the
  UI — that race is unwinnable in JavaScript alone. A booking landing on an
  admin block is rejected by a trigger.
