// Orbag Intelligence — market data refresh (diesel, carbon, CBAM, freight).
// Updates MARKET.* benchmarks. FX/weather have clean free APIs (handled elsewhere);
// diesel is attempted via CBS Open Data but GATED to a plausible NL pump-price band
// (the raw CBS field is ex-tax ~€1.00, not the pump price). EUA/CBAM/WCI have no free
// programmatic feed — they stay as dated reference benchmarks until a source is wired.
// Scheduled daily at 04:35 UTC by pg_cron job 'orbag-intelligence-market-daily'.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const H = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

// Realistic NL pump diesel band (€/L incl. taxes). Values outside are rejected as wrong-field.
const DIESEL_MIN = 1.40, DIESEL_MAX = 3.50;

async function setBenchmark(field_path: string, value: number, source: string, note: string): Promise<boolean> {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/intelligence_benchmarks?field_path=eq.${encodeURIComponent(field_path)}`,
    { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ current_value: value, last_updated_at: new Date().toISOString(), last_updated_by: 'market-feed', source: source, notes: note }) }
  );
  return r.ok;
}

// NL pump diesel via CBS Open Data (StatLine 80416ENG). Defensive + plausibility-gated.
async function fetchDieselNL(): Promise<number | null> {
  try {
    const url = 'https://opendata.cbs.nl/ODataApi/odata/80416ENG/TypedDataSet?$orderby=Periods%20desc&$top=15';
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    const j = await r.json();
    const rows: any[] = j.value || [];
    for (const row of rows) {
      for (const key in row) {
        if (/diesel/i.test(key)) {
          let v = Number(row[key]);
          if (!isFinite(v) || v <= 0) continue;
          if (v > 5) v = v / 100;                       // cents -> euro
          if (v >= DIESEL_MIN && v <= DIESEL_MAX) return Math.round(v * 1000) / 1000;
        }
      }
    }
    return null;                                          // nothing in the plausible pump-price band
  } catch { return null; }
}

Deno.serve(async () => {
  const today = new Date().toISOString().slice(0, 10);
  const out: Record<string, unknown> = { ran_at: new Date().toISOString() };

  const diesel = await fetchDieselNL();
  if (diesel != null) {
    out.diesel = (await setBenchmark('MARKET.diesel_eur_l', diesel, 'CBS 80416ENG', `as_of ${today} — auto via CBS`)) ? diesel : 'write-failed';
  } else {
    out.diesel = 'no plausible pump price from CBS — kept verified dated value';
  }

  // EUA carbon, CBAM, WCI freight: no free programmatic feed. Kept as dated reference
  // benchmarks (seeded with verified values). Wire a paid API / manual refresh to automate.
  out.eua_carbon  = 'manual/dated — no free feed';
  out.cbam        = 'manual/dated — quarterly EC publication';
  out.wci_freight = 'manual/dated — Drewry proprietary';

  return new Response(JSON.stringify(out, null, 2), { headers: { 'Content-Type': 'application/json' } });
});
