-- Owner notes previously carried fuel inside the free-text `variant`
-- ("XZ+ Diesel MT"), so the feed printed it as one run-on title line. Storing
-- the author's stated fuel separately lets the feed show "Tata Nexon • XZ+"
-- with a distinct, labelled fuel chip, and omit the chip when it is unknown.
alter table public.owner_posts
  add column if not exists fuel text;

alter table public.owner_posts
  drop constraint if exists owner_posts_fuel_check;
alter table public.owner_posts
  add constraint owner_posts_fuel_check
  check (fuel is null or fuel in ('Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'));

comment on column public.owner_posts.fuel is 'Fuel type as stated by the note author; null when not provided. Never inferred from the variant string.';
