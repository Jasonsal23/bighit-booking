-- One-off exceptions to a barber's recurring weekly hours (barber_hours):
-- a single day off, or working different hours than usual on a specific
-- date. Distinct from barber_hours, which is the repeating weekly pattern.

create table barber_time_off (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references barbers(id) on delete cascade,
  date date not null,
  is_closed boolean not null default true,
  open_time time,
  close_time time,
  reason text,
  created_at timestamptz not null default now(),
  unique (barber_id, date),
  constraint open_close_present_when_not_closed check (
    is_closed or (open_time is not null and close_time is not null)
  )
);

create index barber_time_off_barber_date_idx on barber_time_off (barber_id, date);

alter table barber_time_off enable row level security;

create policy "public read barber_time_off" on barber_time_off for select using (true);

create policy "barbers manage own time off" on barber_time_off for all
  using (
    exists (
      select 1 from barbers b
      where b.id = barber_time_off.barber_id
        and b.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from barbers b
      where b.id = barber_time_off.barber_id
        and b.auth_user_id = auth.uid()
    )
  );

create policy "owners manage shop time off" on barber_time_off for all
  using (
    exists (
      select 1 from barbers b, barbers owner
      where b.id = barber_time_off.barber_id
        and owner.auth_user_id = auth.uid()
        and owner.role = 'owner'
        and owner.shop_id = b.shop_id
    )
  )
  with check (
    exists (
      select 1 from barbers b, barbers owner
      where b.id = barber_time_off.barber_id
        and owner.auth_user_id = auth.uid()
        and owner.role = 'owner'
        and owner.shop_id = b.shop_id
    )
  );
