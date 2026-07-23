# Big Hit Booking

Customer-facing booking backend for Big Hit Barbershop (`book.bighitbarbershop.com`).
Next.js (App Router) + Supabase + Twilio. See `../Claude.md` at the repo root for
the full product spec — this covers build phases 1-2 (data model + backend API +
website booking flow, pay-in-person only).

## Setup

1. **Create a Supabase project.** In the SQL editor, run `supabase/migrations/0001_init.sql`,
   then optionally `supabase/seed.sql` to insert a sample shop/barbers/services.
   The seed script's final `select` prints the new shop's id — copy it.

2. **Env vars.** Copy `.env.local.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase project settings → API
   - `SUPABASE_SERVICE_ROLE_KEY` — same page; **server-only**, never expose to the client
   - `NEXT_PUBLIC_SHOP_ID` — the shop id from step 1
   - `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` — optional at first;
     booking confirmation SMS is skipped (logged only) if unset

3. **Run it:**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) for the customer booking flow.

## What's here

- `supabase/migrations/0001_init.sql` — full schema: `shops`, `shop_hours`, `barbers`,
  `services`, `customers`, `appointments`, `reminder_log`, with RLS policies and a
  Postgres exclusion constraint that prevents double-booking a barber at the DB level.
- `src/lib/availability.ts` — computes open slots for a barber (or "any barber") on a
  given date, from shop hours minus existing booked appointments.
- `src/app/api/` — `barbers`, `services`, `availability` (GET) and `appointments` (POST)
  route handlers. All reads/writes of customer and appointment data go through these
  using the service-role key; the anon key only ever reads public shop/barber/service info.
- `src/components/BookingFlow.tsx` — the customer booking UI: barber → service → time → details → confirmation.
- `src/lib/sms.ts` — thin Twilio REST wrapper used for the booking confirmation text.

## Not yet built (later phases per the spec)

- Barber/owner admin views, manual appointment entry, mark complete/no-show — these are
  **native screens in the Bighitapp Expo repo**, not a web `/admin` route, per the spec.
  This project just needs to keep exposing the REST API those screens will call.
- Twilio SMS reminder engine (per-customer 4-week-since-last-visit cron/job).
- Push notifications (`expo-notifications`, app-side).
- Online payment (deferred per spec).

## Deploy

Deploy to Vercel as its own project, then point `book.bighitbarbershop.com` at it via a
CNAME + Vercel domain setting — no changes needed on the main bighitbarbershop.com site.
