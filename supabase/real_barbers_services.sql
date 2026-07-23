-- Real barber roster + per-barber services/pricing, pulled from the shop's
-- existing Squire booking page. Run this after 0002_per_barber_services.sql.
-- Replaces the placeholder barbers/services from seed.sql.

-- 0002_per_barber_services.sql already cleared out the old shop-wide
-- services rows, so it's safe to drop the placeholder barbers too.
delete from barbers where name in ('Big Hit Owner', 'Barber One');

with shop as (
  select id from shops where name = 'Big Hit Barbershop'
),
new_barbers as (
  insert into barbers (shop_id, name, role, active)
  select shop.id, v.name, 'barber', true
  from shop, (values ('Shawn L.'), ('Nick E.'), ('Adam P.')) as v(name)
  returning id, name
),
shawn as (select id from new_barbers where name = 'Shawn L.'),
nick as (select id from new_barbers where name = 'Nick E.'),
adam as (select id from new_barbers where name = 'Adam P.')

insert into services (shop_id, barber_id, name, duration_minutes, price_cents)
select shop.id, barber_id, name, duration_minutes, price_cents
from shop, (
  select shawn.id as barber_id, name, duration_minutes, price_cents from shawn, (values
    ('Beard trim', 30, 3000),
    ('Line up', 15, 2500),
    ('Line up with beard trim', 30, 4500),
    ('Senior haircut updated', 30, 4000),
    ('Head shave (foil)', 15, 2500),
    ('Haircut updated', 30, 4000),
    ('Haircut and beard trim updated', 45, 5000)
  ) as s(name, duration_minutes, price_cents)

  union all

  select nick.id, name, duration_minutes, price_cents from nick, (values
    ('Line up', 15, 2500),
    ('Long Hair', 45, 4500),
    ('Haircut & Beard trim', 45, 5500),
    ('Beard trim', 30, 3000),
    ('Line up with beard trim', 30, 4000),
    ('Regular Haircut', 30, 4000),
    ('Senior Haircut & Beard trim', 45, 4500),
    ('Senior Haircut 65+', 30, 3500),
    ('Head shave & Beard trim', 30, 4000)
  ) as s(name, duration_minutes, price_cents)

  union all

  select adam.id, name, duration_minutes, price_cents from adam, (values
    ('Regular Cut', 45, 3500),
    ('Beard trim', 30, 3000),
    ('Kids haircut', 45, 3500),
    ('Senior haircut updated', 45, 3500),
    ('Line up', 30, 2500),
    ('Line up with beard trim', 45, 4000),
    ('Head Shave (foil shaver)', 45, 3000),
    ('Beard Trim + Cut', 45, 4600),
    ('Back to school Kids cuts', 45, 2500)
  ) as s(name, duration_minutes, price_cents)
) as all_services(barber_id, name, duration_minutes, price_cents);
