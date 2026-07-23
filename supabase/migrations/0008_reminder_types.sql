-- reminder_log needs to track which kind of reminder was sent, since a
-- single appointment can get both a 24-hour and a 1-hour reminder (two
-- separate log rows), and the "come back" nudge is a third, unrelated type
-- anchored to a customer's last past appointment.

alter table reminder_log add column type text not null default 'comeback';
alter table reminder_log add constraint reminder_log_type_check
  check (type in ('24h_reminder', '1h_reminder', 'comeback'));

alter table reminder_log drop constraint reminder_log_customer_id_appointment_id_key;
alter table reminder_log add constraint reminder_log_unique unique (customer_id, appointment_id, type);
