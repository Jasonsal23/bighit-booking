-- Ordering barbers by created_at turned out to be unreliable: all three were
-- inserted in the same batch with effectively identical timestamps, so ties
-- were broken by incidental row storage order, which can shift after any
-- later UPDATE (e.g. changing a role). Use an explicit sort column instead.

alter table barbers add column sort_order int not null default 0;
