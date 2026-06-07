-- Bug-audit fix — country_benchmark_status used an UNESCAPED engine_region_key inside LIKE. Current
-- keys (nl, de, gb, …) have no '_'/'%', so it is latent today, but any future key containing '_'
-- (e.g. a 'uk_norfolk'-style engine key) would turn '_' into a single-char wildcard and produce a
-- FALSE "own benchmark available" — silently defeating the fail-loud guarantee this very view exists
-- to enforce. Escape the key in every LIKE so the match is literal.

create or replace view public.country_benchmark_status as
with own as (
  select c.key,
         exists (
           select 1 from public.regional_crop_data rcd
           where rcd.crop_region = c.engine_region_key
              or rcd.crop_region like replace(c.engine_region_key, '_', '\_') || '\_%' escape '\'
         )
         or exists (
           select 1 from public.intelligence_benchmarks b
           where b.field_path like '%.' || replace(c.engine_region_key, '_', '\_') escape '\'
              or b.field_path like '%.' || replace(c.engine_region_key, '_', '\_') || '.%' escape '\'
         ) as has_own
  from public.intelligence_countries c
  where c.iso_code is not null
)
select c.key, c.iso_code, c.label, c.currency, c.region_cluster,
       c.engine_region_key, c.benchmark_source_planned, c.rotation_active,
       o.has_own as has_own_benchmark,
       case when o.has_own
            then 'own benchmark available (source: ' || coalesce(c.benchmark_source_planned, 'see regional_crop_data') || ')'
            else 'no benchmark available — planned source: ' || coalesce(nullif(c.benchmark_source_planned,'UNASSIGNED'), 'UNASSIGNED')
                 || ' — FAIL LOUD: do NOT fall back to another country'
       end as benchmark_status
from public.intelligence_countries c
join own o on o.key = c.key
order by c.region_cluster, c.label;

grant select on public.country_benchmark_status to anon, authenticated;
