-- Working hours turned out to be per-barber too (Shawn, Nick, and Adam all
-- work different days/hours), not just shop-wide. Availability now checks
-- barber_hours instead of shop_hours; shop_hours stays around purely as
-- shop-level display info (e.g. "we're closed Sun/Mon" on a contact page).

create table barber_hours (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references barbers(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  open_time time,
  close_time time,
  is_closed boolean not null default false,
  unique (barber_id, day_of_week)
);

alter table barber_hours enable row level security;
create policy "public read barber_hours" on barber_hours for select using (true);
