-- Fuel, transmission and ownership were previously folded into the free-text
-- `variant` string (e.g. "XZ+ Diesel MT"), which forced the UI to guess fuel by
-- substring matching and to print a guess as if it were verified. Storing them
-- as their own nullable columns lets the interface show each field separately
-- and stay silent when a value is genuinely unknown.
alter table public.garage_vehicles
  add column if not exists fuel text,
  add column if not exists transmission text,
  add column if not exists ownership text;

-- Null means "not recorded"; empty strings are normalised away by the client
-- mappers so the two cannot drift apart.
alter table public.garage_vehicles
  drop constraint if exists garage_vehicles_fuel_check;
alter table public.garage_vehicles
  add constraint garage_vehicles_fuel_check
  check (fuel is null or fuel in ('Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'));

alter table public.garage_vehicles
  drop constraint if exists garage_vehicles_transmission_check;
alter table public.garage_vehicles
  add constraint garage_vehicles_transmission_check
  check (transmission is null or transmission in ('MT', 'AMT', 'CVT', 'DCT', 'AT', 'eCVT', 'Single Speed'));

alter table public.garage_vehicles
  drop constraint if exists garage_vehicles_ownership_check;
alter table public.garage_vehicles
  add constraint garage_vehicles_ownership_check
  check (ownership is null or ownership in ('First owner', 'Second owner', 'Third owner or later'));

comment on column public.garage_vehicles.fuel is 'Verified fuel type; null when the owner has not confirmed it. Never inferred from the variant string.';
comment on column public.garage_vehicles.transmission is 'Verified transmission; null when not confirmed.';
comment on column public.garage_vehicles.ownership is 'Ownership position; null when not confirmed.';
