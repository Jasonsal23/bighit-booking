-- Self-serve customer accounts: sign up, view/cancel upcoming appointments,
-- reschedule (cancel + rebook), change password. Mirrors how barbers are
-- linked to auth.users, just on the customers table instead.

alter table customers add column auth_user_id uuid references auth.users(id);
alter table customers add column email text;

create index customers_auth_user_id_idx on customers (auth_user_id) where auth_user_id is not null;

create policy "customers read own row" on customers for select
  using (auth_user_id = auth.uid());
