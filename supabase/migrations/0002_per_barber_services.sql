-- Services turned out to be priced and timed per-barber (confirmed against the
-- real Squire booking data), not shop-wide. Move `services` from a shared
-- shop-wide list to one row per barber per service.

-- Sample shop-wide services from the seed script are being replaced by real
-- per-barber data, so clear them out before making barber_id required.
-- Any test appointments booked against those sample services during
-- development get cleared too (nothing production-real exists yet).
delete from appointments where service_id in (select id from services);
delete from services;

alter table services add column barber_id uuid references barbers(id) on delete cascade;
alter table services alter column barber_id set not null;

create index services_barber_idx on services (barber_id) where active = true;
