-- Allow the apply step's lifecycle states: 'superseded' (deduped older runs) and
-- 'held' (guardrail failures awaiting manual review).
alter table public.intelligence_updates
  drop constraint intelligence_updates_status_check;

alter table public.intelligence_updates
  add constraint intelligence_updates_status_check
  check (status = any (array[
    'pending_review','approved','rejected','applied','superseded','held'
  ]));
