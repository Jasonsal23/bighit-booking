-- The shop was seeded with 'America/New_York' by mistake; Big Hit Barbershop
-- is in Las Vegas (Pacific time), which was throwing every computed
-- availability slot off by 3 hours.
update shops set timezone = 'America/Los_Angeles' where name = 'Big Hit Barbershop';
