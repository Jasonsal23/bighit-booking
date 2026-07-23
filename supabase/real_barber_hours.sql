-- Real per-barber working hours. Run after 0003_barber_hours.sql and after
-- real_barbers_services.sql (barbers must already exist).
-- day_of_week: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday,
-- 5=Friday, 6=Saturday. Shop is closed Sun/Mon for everyone.

-- Shop-level hours are informational only now (booking uses barber_hours),
-- but keep them accurate: closed Sun/Mon, spanning the earliest open to
-- latest close across all three barbers the other five days.
update shop_hours set is_closed = true, open_time = null, close_time = null
where shop_id = (select id from shops where name = 'Big Hit Barbershop') and day_of_week in (0, 1);
update shop_hours set is_closed = false, open_time = '05:30', close_time = '16:45'
where shop_id = (select id from shops where name = 'Big Hit Barbershop') and day_of_week in (2, 3, 4, 5);
update shop_hours set is_closed = false, open_time = '07:15', close_time = '16:15'
where shop_id = (select id from shops where name = 'Big Hit Barbershop') and day_of_week = 6;

with shawn as (select id from barbers where name = 'Shawn L.'),
     nick as (select id from barbers where name = 'Nick E.'),
     adam as (select id from barbers where name = 'Adam P.')

insert into barber_hours (barber_id, day_of_week, open_time, close_time, is_closed)
select shawn.id, d.day_of_week, d.open_time, d.close_time, d.is_closed from shawn, (values
  (0, null::time, null::time, true),               -- Sun: closed
  (1, null::time, null::time, true),                -- Mon: closed
  (2, '05:30'::time, '15:30'::time, false),         -- Tue
  (3, '05:30'::time, '15:30'::time, false),         -- Wed
  (4, '05:30'::time, '15:30'::time, false),         -- Thu
  (5, '05:30'::time, '15:30'::time, false),         -- Fri
  (6, null::time, null::time, true)                 -- Sat: closed
) as d(day_of_week, open_time, close_time, is_closed)

union all

select nick.id, d.day_of_week, d.open_time, d.close_time, d.is_closed from nick, (values
  (0, null::time, null::time, true),
  (1, null::time, null::time, true),
  (2, '09:00'::time, '16:30'::time, false),
  (3, '09:00'::time, '16:30'::time, false),
  (4, '09:00'::time, '16:30'::time, false),
  (5, '09:00'::time, '16:30'::time, false),
  (6, '09:00'::time, '14:30'::time, false)          -- Sat, shorter day
) as d(day_of_week, open_time, close_time, is_closed)

union all

select adam.id, d.day_of_week, d.open_time, d.close_time, d.is_closed from adam, (values
  (0, null::time, null::time, true),
  (1, null::time, null::time, true),
  (2, '07:00'::time, '16:45'::time, false),
  (3, '07:00'::time, '16:45'::time, false),
  (4, '07:00'::time, '16:45'::time, false),
  (5, '07:00'::time, '16:45'::time, false),
  (6, '07:15'::time, '16:15'::time, false)          -- Sat, shorter day
) as d(day_of_week, open_time, close_time, is_closed);
