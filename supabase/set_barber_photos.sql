-- Points each barber's photo_url at their headshot, served from the live
-- site's /public/barbers folder (see public/barbers/*.jpg). Uses the real
-- domain rather than the raw *.vercel.app URL so these links keep working
-- even if the Vercel project ever gets renamed or the site moves hosts.
update barbers set photo_url = 'https://book.bighitbarbershop.com/barbers/shawn.jpg' where name = 'Shawn L.';
update barbers set photo_url = 'https://book.bighitbarbershop.com/barbers/nick.jpg' where name = 'Nick E.';
update barbers set photo_url = 'https://book.bighitbarbershop.com/barbers/adam.jpg' where name = 'Adam P.';
