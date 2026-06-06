-- Capture the user's country at signup so we can auto-bootstrap a provisional benchmark region
-- for countries the platform has no data for yet (see api/bootstrap-region.js).
alter table public.profiles add column if not exists country text;
