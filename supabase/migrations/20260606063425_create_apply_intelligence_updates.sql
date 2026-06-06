-- Self-sharpening intelligence loop: auto-apply step.
-- Takes the newest pending_review signal per (country, field_path), applies it to the
-- matching benchmark when confidence=HIGH and guardrails pass, supersedes older duplicates,
-- holds guardrail failures for manual review, and leaves signals without a benchmark target
-- (e.g. fx_risk -> LOGISTICS.import_cost.*) as standing risk signals.
create or replace function public.apply_intelligence_updates()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_applied    int := 0;
  v_held       int := 0;
  v_superseded int := 0;
  v_no_target  int := 0;
  rec    record;
  v_bench record;
  v_ok    boolean;
  v_reason text;
begin
  -- 1) Dedup: supersede older pending duplicates, keep only the newest per (country, field_path)
  with ranked as (
    select id,
           row_number() over (partition by country, field_path
                              order by run_date desc, id desc) as rn
    from public.intelligence_updates
    where status = 'pending_review'
  )
  update public.intelligence_updates u
     set status = 'superseded',
         notes  = left(coalesce(u.notes,'') || ' [auto: superseded by newer run]', 1000)
    from ranked r
   where u.id = r.id and r.rn > 1;
  get diagnostics v_superseded = row_count;

  -- 2) Evaluate the newest remaining candidate per group
  for rec in
    select s.* from (
      select u.*,
             row_number() over (partition by u.country, u.field_path
                                order by u.run_date desc, u.id desc) as rn
      from public.intelligence_updates u
      where u.status = 'pending_review'
    ) s where s.rn = 1
  loop
    select * into v_bench
      from public.intelligence_benchmarks b
     where b.field_path = rec.field_path;

    if not found then
      -- No benchmark target: keep as active standing signal (consumed by impact-calculator).
      v_no_target := v_no_target + 1;
      continue;
    end if;

    -- Guardrails
    v_ok := true; v_reason := null;
    if rec.confidence is distinct from 'HIGH' then
      v_ok := false; v_reason := 'confidence_not_high';
    elsif rec.suggested_value is null then
      v_ok := false; v_reason := 'null_suggested';
    elsif rec.suggested_value <= 0 then
      v_ok := false; v_reason := 'non_positive';
    elsif v_bench.unit = 'pct' and rec.suggested_value > 1 then
      v_ok := false; v_reason := 'pct_out_of_range';
    elsif v_bench.current_value is not null and v_bench.current_value > 0
          and (rec.suggested_value > v_bench.current_value * 3
               or rec.suggested_value < v_bench.current_value / 3) then
      v_ok := false; v_reason := 'move_exceeds_3x';
    end if;

    if not v_ok then
      update public.intelligence_updates
         set status = 'held',
             notes  = left(coalesce(notes,'') || ' [auto: held - ' || v_reason || ']', 1000)
       where id = rec.id;
      v_held := v_held + 1;
      continue;
    end if;

    -- Apply to benchmark (provenance via last_updated_by; baseline source left intact)
    update public.intelligence_benchmarks
       set current_value   = rec.suggested_value,
           last_updated_at = now(),
           last_updated_by = 'auto-apply',
           notes = left('auto-apply ' || to_char(now(),'YYYY-MM-DD') || ': '
                        || coalesce(rec.evidence,''), 500)
     where field_path = rec.field_path;

    update public.intelligence_updates
       set status      = 'applied',
           approved_by = 'auto-apply',
           approved_at = now(),
           applied_at  = now(),
           notes = left(coalesce(notes,'') || ' [auto: applied]', 1000)
     where id = rec.id;

    v_applied := v_applied + 1;
  end loop;

  return jsonb_build_object(
    'ran_at',     now(),
    'applied',    v_applied,
    'held',       v_held,
    'superseded', v_superseded,
    'no_target',  v_no_target
  );
end;
$$;

comment on function public.apply_intelligence_updates() is
  'Self-sharpening intelligence apply step: applies newest HIGH-confidence signals to matching benchmarks within guardrails (pct in 0..1, max 3x move), supersedes duplicates, holds outliers, leaves targetless signals standing. Scheduled daily via pg_cron after the detector.';

-- Scheduled daily at 04:45 UTC, 15 min after the detector job (orbag-intelligence-fx-weather-daily @ 04:30).
-- select cron.schedule('orbag-intelligence-apply-daily', '45 4 * * *',
--   $$select public.apply_intelligence_updates();$$);
