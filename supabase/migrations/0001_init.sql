-- Big Hit Barbershop booking system schema

create extension if not exists "pgcrypto";

create table shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'America/New_York',
  address text,
  -- 0 = Sunday ... 6 = Saturday, one row-per-day handled in shop_hours
  created_at timestamptz not null default now()
);

create table shop_hours (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  open_time time,
  close_time time,
  is_closed boolean not null default false,
  unique (shop_id, day_of_week)
);

-- One barber = one Supabase Auth user (auth.users.id), nullable until they
-- have an app login. Owner/admin role distinguishes shop-wide master view.
create table barbers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  photo_url text,
  role text not null default 'barber' check (role in ('barber', 'owner')),
  active boolean not null default true,
  push_token text,
  created_at timestamptz not null default now()
);

create table services (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null,
  duration_minutes int not null check (duration_minutes > 0),
  price_cents int not null check (price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null,
  phone text not null,
  last_visit_at timestamptz,
  created_at timestamptz not null default now(),
  unique (shop_id, phone)
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  barber_id uuid not null references barbers(id) on delete restrict,
  service_id uuid not null references services(id) on delete restrict,
  customer_id uuid references customers(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'booked'
    check (status in ('booked', 'completed', 'no_show', 'cancelled')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid')),
  source text not null default 'online' check (source in ('online', 'manual')),
  created_at timestamptz not null default now(),
  constraint end_after_start check (end_time > start_time)
);

create index appointments_barber_time_idx on appointments (barber_id, start_time);
create index appointments_shop_time_idx on appointments (shop_id, start_time);

create table reminder_log (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  appointment_id uuid not null references appointments(id) on delete cascade,
  sent_at timestamptz not null default now(),
  unique (customer_id, appointment_id)
);

-- Prevent double-booking a barber for overlapping time ranges (booked status only).
create extension if not exists btree_gist;
alter table appointments
  add constraint no_overlapping_appointments
  exclude using gist (
    barber_id with =,
    tstzrange(start_time, end_time) with &&
  ) where (status = 'booked');

-- Row Level Security
alter table shops enable row level security;
alter table shop_hours enable row level security;
alter table barbers enable row level security;
alter table services enable row level security;
alter table customers enable row level security;
alter table appointments enable row level security;
alter table reminder_log enable row level security;

-- Public (anon) can read shop/barber/service info needed to build a booking UI.
create policy "public read shops" on shops for select using (true);
create policy "public read shop_hours" on shop_hours for select using (true);
create policy "public read active barbers" on barbers for select using (active = true);
create policy "public read active services" on services for select using (active = true);

-- Appointments/customers are never exposed directly to anon clients.
-- All writes and any read of customer/appointment data go through the
-- Next.js API routes using the service-role key (bypasses RLS server-side).
create policy "barbers read own appointments" on appointments for select
  using (
    exists (
      select 1 from barbers b
      where b.id = appointments.barber_id
        and b.auth_user_id = auth.uid()
    )
  );

create policy "owners read all shop appointments" on appointments for select
  using (
    exists (
      select 1 from barbers b
      where b.shop_id = appointments.shop_id
        and b.auth_user_id = auth.uid()
        and b.role = 'owner'
    )
  );

create policy "barbers update own appointments" on appointments for update
  using (
    exists (
      select 1 from barbers b
      where b.id = appointments.barber_id
        and b.auth_user_id = auth.uid()
    )
  );
