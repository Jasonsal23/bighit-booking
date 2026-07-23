-- Sample data for local development / a brand new Supabase project.
-- Run after 0001_init.sql, 0002_per_barber_services.sql, and
-- 0003_barber_hours.sql. Services and working hours are both per-barber (see
-- 0002/0003) since real pricing/hours vary by barber. For the actual Big Hit
-- Barbershop roster/pricing/hours, run real_barbers_services.sql and
-- real_barber_hours.sql instead of (or after clearing) this file's data.

with new_shop as (
  insert into shops (name, timezone, address)
  values ('Big Hit Barbershop', 'America/New_York', '123 Main St')
  returning id
),
shop_hours_insert as (
  insert into shop_hours (shop_id, day_of_week, open_time, close_time, is_closed)
  select id, day_of_week, open_time, close_time, is_closed
  from new_shop, (values
    (0, null::time, null::time, true),   -- Sunday: closed
    (1, '09:00'::time, '18:00'::time, false),
    (2, '09:00'::time, '18:00'::time, false),
    (3, '09:00'::time, '18:00'::time, false),
    (4, '09:00'::time, '19:00'::time, false),
    (5, '09:00'::time, '19:00'::time, false),
    (6, '09:00'::time, '17:00'::time, false)
  ) as h(day_of_week, open_time, close_time, is_closed)
),
new_barbers as (
  insert into barbers (shop_id, name, role, active)
  select new_shop.id, v.name, v.role, true
  from new_shop, (values ('Big Hit Owner', 'owner'), ('Barber One', 'barber')) as v(name, role)
  returning id, name, shop_id
),
services_insert as (
  insert into services (shop_id, barber_id, name, duration_minutes, price_cents)
  select shop_id, id, name, duration_minutes, price_cents
  from new_barbers, (values
    ('Haircut', 30, 3500),
    ('Haircut + Beard', 45, 5000),
    ('Beard Trim', 15, 2000)
  ) as s(name, duration_minutes, price_cents)
)
insert into barber_hours (barber_id, day_of_week, open_time, close_time, is_closed)
select id, day_of_week, open_time, close_time, is_closed
from new_barbers, (values
  (0, null::time, null::time, true),   -- Sunday: closed
  (1, '09:00'::time, '18:00'::time, false),
  (2, '09:00'::time, '18:00'::time, false),
  (3, '09:00'::time, '18:00'::time, false),
  (4, '09:00'::time, '19:00'::time, false),
  (5, '09:00'::time, '19:00'::time, false),
  (6, '09:00'::time, '17:00'::time, false)
) as h(day_of_week, open_time, close_time, is_closed);

select id as shop_id from shops where name = 'Big Hit Barbershop';
