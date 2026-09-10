# LibSpace

**Live at [libspace-flax.vercel.app](https://libspace-flax.vercel.app/)**

Replaces the physical logbook at the **Holy Angel University** library by
letting students check real-time discussion-room availability and reserve one
of the 10 discussion rooms remotely.

**Stack** — React 19 (Vite) · Tailwind CSS v4 · Supabase (Postgres + Auth + Realtime) · Vercel

---

## Using it

Open [libspace-flax.vercel.app](https://libspace-flax.vercel.app/) on a phone or
a desktop — it is the same app either way, no install.

**Students** register with a `@gmail.com` address. Registration emails a
six-digit code; once that is verified you set your own password and fill in
your name, student number, year and course. After that it is email + password.

**Staff** sign in the same way. An account becomes staff only when someone runs
the SQL at the bottom of [`supabase/schema.sql`](supabase/schema.sql) against
it, so signing up cannot make you an administrator.

A booking needs a group of at least five and one photo of each member's student
ID. Requests reach the front desk as *pending*; staff approve or decline them
and the student is notified in the app. Turn up and get checked in at the desk —
a room nobody claims within the grace period goes back to other students.

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
Gmail address  ->  access code emailed  ->  code verified (session created)
               ->  name, student no., year, course + password  ->  signed in
```

Registration collects **Last name, First name, M.I.** as separate fields (stored
that way so names sort correctly), the **student number**, **year level** and
**course**. `full_name` holds the rendered "Dela Cruz, Juan M." form that the
grid and reservation records display.

Year levels and the course list live in
[`src/lib/constants.js`](src/lib/constants.js) — edit that one file to change
them, along with the university name shown throughout the UI.

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

## Branding

The LibSpace mark lives in [`src/components/Logo.jsx`](src/components/Logo.jsx) as
plain SVG — a book spine beside two slot bars, the same shapes the room cards
and the sign-in background are built from. It is drawn once and reused by the
sidebar, the mobile header and the sign-in card; `public/favicon.svg` is the
same geometry so the tab icon and the in-app mark cannot drift.

**The university crest is not in this repo.** It is Holy Angel University's
trademark, so the official artwork has to come from the university rather than
be redrawn. To add it:

1. Save the official file as `public/hau-logo.png` (PNG or SVG, transparent
   background, roughly square).
2. That is all — `UNIVERSITY_LOGO` in
   [`src/lib/constants.js`](src/lib/constants.js) already points at it.

Until the file exists, `UniversityCrest` renders nothing rather than a
placeholder, so the app never shows a stand-in for the real crest. Set
`UNIVERSITY_LOGO` to `null` to leave it out deliberately.

**The campus photograph is not in this repo either**, for the same reason. The
sign-in screen washes it into the pine field behind the login card:

1. Save the photo as `public/hau-campus.jpg` — landscape, ideally 2000px wide
   or more, since it covers the whole viewport.
2. That is all — `CAMPUS_PHOTO` in
   [`src/lib/constants.js`](src/lib/constants.js) already points at it.

If the file is missing the image is dropped on error and the sign-in screen
falls back to the plain pine field and its motif, so nothing renders broken.
Set `CAMPUS_PHOTO` to `null` to leave it out deliberately.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + publishable key
npm run dev
```

## Supabase setup

**1. Run the schema.** Paste [`supabase/schema.sql`](supabase/schema.sql) into the
SQL editor. It creates `profiles`, `rooms`, `room_schedules`, `room_blocks`,
`reservations`, `notifications`, `app_settings` and `mail_config`, plus RLS
policies, the front-desk functions (`check_in_reservation`,
`check_out_reservation`, `release_no_shows`), the Realtime publication, and the
10 seeded discussion rooms open Mon–Sat 08:00–17:00.

`app_settings` holds the library's rules — no-show grace period, how many
bookings a student may hold, hours per day, how far ahead booking opens. Staff
edit them under **Manage rooms**; a database trigger enforces them, so a
client cannot skip them.

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

The live deployment is [libspace-flax.vercel.app](https://libspace-flax.vercel.app),
built from `main` on every push.

To stand up your own: push to GitHub, import the repo on Vercel, and add
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as **Config** (not Secret)
environment variables for all three environments. [`vercel.json`](vercel.json)
already rewrites every path to `index.html` for client-side routing.

`VITE_`-prefixed variables are compiled into the bundle at build time, so adding
or changing one requires a redeploy.

## Structure

```
src/
├── App.jsx                     routes: auth gate -> profile setup -> workspace
├── components/
│   ├── AuthGate.jsx            login · register · forgot password
│   ├── AccountSetup.jsx        name, student no., year, course + password
│   ├── SideNav.jsx             desktop navigation rail (lg and up)
│   ├── BottomNav.jsx           phone tab bar + "More" sheet (below lg)
│   ├── AppHeader.jsx           greeting + notifications
│   ├── DayStrip.jsx            week-at-a-time day picker
│   ├── TimeslotGrid.jsx        rooms × half-hour grid
│   ├── BookingModal.jsx        booking form — bottom sheet on a phone
│   ├── MyReservations.jsx      student's bookings, or all of them for admins
│   ├── AdminPanel.jsx          rooms · opening hours · blocked time
│   └── Toast.jsx
├── hooks/
│   ├── useAuth.jsx             session + profile + role context
│   └── useReservations.js      day fetch, realtime, insert/cancel
└── lib/
    ├── supabaseClient.js
    ├── time.js                 slot maths — single source of truth for the day
    ├── nav.js                  the view list both navs render, + page copy
    ├── constants.js            university name, year levels, course list
    └── validation.js
```

## Design

One rail, one tab bar. Every view is declared once in
[`src/lib/nav.js`](src/lib/nav.js); `SideNav` renders it as a left rail from
`lg` up and `BottomNav` renders the first four entries as phone tabs with the
rest behind a sheet, so a view can never appear in one and go missing in the
other.

The palette lives in [`src/index.css`](src/index.css). Tailwind's `slate` ramp
is overridden with a warm paper-toned grey and `brand` is a deep pine, so the
existing `text-slate-*` / `bg-brand-*` classes carry the theme without every
component naming its own colours. `accent` (warm clay) is for the few things
that must catch the eye — "today", and nothing else by default.

## Notes

- The visible day window is **derived from the admin's opening hours** for that
  weekday, widened to cover every open room, and falls back to 08:00–17:00 when
  nothing is scheduled. See `windowForWeekday` in [`src/lib/time.js`](src/lib/time.js).
- Reservations and blocks render as single spanning cards in the same CSS grid
  as the empty cells, so a 90-minute booking reads as one card, not three boxes.
- Double-booking is rejected by a **GiST exclusion constraint**, not just the
  UI — that race is unwinnable in JavaScript alone. A booking landing on an
  admin block is rejected by a trigger.
