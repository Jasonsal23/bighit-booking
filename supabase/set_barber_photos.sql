-- Points each barber's photo_url at their headshot, now served from the
-- live site's /public/barbers folder (see public/barbers/*.jpg).
update barbers set photo_url = 'https://bighit-booking-three.vercel.app/barbers/shawn.jpg' where name = 'Shawn L.';
update barbers set photo_url = 'https://bighit-booking-three.vercel.app/barbers/nick.jpg' where name = 'Nick E.';
update barbers set photo_url = 'https://bighit-booking-three.vercel.app/barbers/adam.jpg' where name = 'Adam P.';
