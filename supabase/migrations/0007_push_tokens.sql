-- Native push notifications (expo-notifications). barbers.push_token already
-- existed from the original schema; customers needs the same column. A push
-- token is tied to a specific device/app install, so this is "their most
-- recent device" — good enough for a single-device-per-user barbershop app;
-- re-registering on a new device simply overwrites it.

alter table customers add column push_token text;
