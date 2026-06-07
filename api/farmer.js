// ORBAG FARMER TRANSITION BUSINESSCASE GENERATOR v2
// Architecture mirrors the buyer engine (api/generate.js): a deterministic JS engine computes
// EVERY number (multi-year regen-transition cashflow), the AI (claude-sonnet-4-6) writes the
// narrative ONLY. No number is produced by the model — so the output is deterministic, testable
// and regression-lockable (tests/farmer.test.js). KWIN is structured data, not a text blob.

// ── STRUCTURED FARMER BENCHMARK DATA ─────────────────────
// Keyed by the boer.html crop-checkbox `value`s (Dutch) — these flow to storage/match, do NOT
// rename them. Values in EUR. `verified:true` only where genuinely sourced (KWIN-AGV 2024,
// WUR/BIJ12); the rest are traceable estimates marked verified:false (validate later).
//   yield_t_ha          conventional yield (t/ha)
//   price_conv          conventional price (EUR/t)
//   variable_cost_ha    variable cost (EUR/ha)
//   fert_cost_share     share of variable cost that is fertiliser + crop protection (the part regen cuts)
//   regen_premium_pct   regen price premium over conventional (fraction)
//   regen_yield_factor  steady-state regen yield vs conventional (≤1 typical)
//   carbon_eur_ha       carbon-credit potential (EUR/ha/yr) — calibrated to the BUYER engine's
//                       CARBON_POTENTIAL (Rabobank sequestration + VCM €5/t, capped €15/ha), which
//                       SUPERSEDES the old unsourced €30-80/ha figure in the previous text blob.
var KWIN_FARMER = {
  wintertarwe:          {yield_t_ha:9.4,  price_conv:230, variable_cost_ha:1400, fert_cost_share:0.35, regen_premium_pct:0.20, regen_yield_factor:0.95, carbon_eur_ha:13, source_label:'KWIN-AGV 2024', verified:true},
  pootaardappelen:      {yield_t_ha:34.5, price_conv:310, variable_cost_ha:4000, fert_cost_share:0.30, regen_premium_pct:0.15, regen_yield_factor:0.93, carbon_eur_ha:8,  source_label:'KWIN-AGV 2024', verified:true},
  consumptieaardappelen:{yield_t_ha:49.5, price_conv:170, variable_cost_ha:3300, fert_cost_share:0.30, regen_premium_pct:0.20, regen_yield_factor:0.93, carbon_eur_ha:8,  source_label:'KWIN-AGV 2024', verified:true},
  suikerbieten:         {yield_t_ha:80.0, price_conv:45,  variable_cost_ha:2500, fert_cost_share:0.30, regen_premium_pct:0.10, regen_yield_factor:0.92, carbon_eur_ha:8,  source_label:'KWIN-AGV 2024 (regen premium est.)', verified:false}, // regen sugar-beet market thin → premium UNVERIFIED
  uien:                 {yield_t_ha:60.0, price_conv:130, variable_cost_ha:2800, fert_cost_share:0.30, regen_premium_pct:0.20, regen_yield_factor:0.93, carbon_eur_ha:7,  source_label:'KWIN/market avg 2023-24 (cost est.)', verified:false}, // onion variable cost not in KWIN blob → est.
  gerst:                {yield_t_ha:7.5,  price_conv:190, variable_cost_ha:1100, fert_cost_share:0.35, regen_premium_pct:0.20, regen_yield_factor:0.95, carbon_eur_ha:12, source_label:'WUR akkerbouw est. (not in KWIN blob)', verified:false}, // barley absent from blob → estimate
  haver:                {yield_t_ha:5.2,  price_conv:210, variable_cost_ha:950,  fert_cost_share:0.30, regen_premium_pct:0.20, regen_yield_factor:0.97, carbon_eur_ha:12, source_label:'KWIN-AGV 2024', verified:true},
  erwten:               {yield_t_ha:5.0,  price_conv:450, variable_cost_ha:1000, fert_cost_share:0.15, regen_premium_pct:0.50, regen_yield_factor:1.00, carbon_eur_ha:15, source_label:'KWIN-AGV 2024 (legume, N-fixing)', verified:true}, // peas/legumes: low fert (N-fixing), high regen premium
  sperziebonen:         {yield_t_ha:10.0, price_conv:340, variable_cost_ha:2100, fert_cost_share:0.25, regen_premium_pct:0.20, regen_yield_factor:0.95, carbon_eur_ha:9,  source_label:'KWIN-AGV 2024 (contract)', verified:false},
};

// ── TRANSITION MODEL KNOBS ───────────────────────────────
// ⚠ ECONOMICS/AGRONOMY ASSUMPTIONS — NOT established fact. Surfaced explicitly (never buried in
// the math), each verified:false "voorlopige aanname, agronomische/economische validatie vereist".
// An agro-economist / plant pathologist calibrates these later (ideally per crop). The PIPELINE
// (multi-year cashflow → payback) is engineering and is tested; THESE are the knobs.
var TRANSITION_MODEL = {
  horizon_years:        7,     // cashflow horizon
  transition_years:     3,     // years for premium/input-saving/carbon to ramp to full + yield to recover (blob: full regen income jaar 3-4)
  yield_dip_years:      2,     // years 1-2 carry the yield dip + transition capex (blob: 5-15% lower jaar 1-2)
  yield_dip_pct:        0.10,  // yield reduction during the dip years (blob midpoint of 5-15%)        // verified:false
  input_reduction_pct:  0.45,  // reduction of the fertiliser+chem portion at full regen (blob: kunstmest -40-60%, gewasbescherming -30-50%) // verified:false
  transition_capex_ha:  225,   // one-off transition cost (blob: €150-300/ha), spread over the dip years // verified:false
  // ── Cost-of-waiting overlay (symmetric to the buyer CFO 'cost of inaction'). What standing still
  //    costs: conventional margins erode + input costs inflate for a non-transitioning farm. OFF by
  //    default in the core payback math; surfaced separately so it is never presented as fact.
  cost_of_waiting: {
    enabled:               true,
    conv_margin_erosion_pct: 0.02,  // annual real erosion of conventional net margin            // verified:false
    input_cost_inflation_pct:0.03,  // annual fertiliser/chem cost inflation hitting conventional // verified:false
  },
  verified: false,
};

// Years on land / certification labels (display only; engine does not branch on them yet).
var FARMER_REGIONS = {noord_groningen:'Noord-Groningen klei', groningen:'Groningen kleigrond', friesland:'Friesland kleigrond', drenthe:'Drenthe zand/dalgrond', flevoland:'Flevoland IJsselmeerpolders', zeeland:'Zeeland zware klei', brabant:'Noord-Brabant zandgrond', other_nl:'Nederland'};
var CERT_LABELS = {none:'None / conventional', globalgap:'GlobalGAP', on_the_way:'On the Way to PlanetProof', organic:'Organic certified (EKO)', demeter:'Demeter'};

function round(n) { return Math.round(n); }
function parseLeadingInt(v, dflt) { var m = String(v == null ? '' : v).match(/\d+/); return m ? Number(m[0]) : dflt; }

// ── MAIN FARMER TRANSITION ENGINE ────────────────────────
// Pure, deterministic, no network. Computes a per-year regen-transition cashflow for the farm's
// crop mix, then derives payback, worst-year income drop, steady-state regen income and net value.
// Baseline = the farmer's OWN stated current income (€/ha); the engine computes the regen DELTA
// from KWIN, so we never override their real baseline — we add the transition economics to it.
function calculateFarmer(d) {
  var M = TRANSITION_MODEL;
  var cropKeys = (d.crops || []).filter(function (c) { return c; });
  if (!cropKeys.length) return { error: 'No crops selected — cannot compute a transition business case.' };
  var unknown = cropKeys.filter(function (c) { return !KWIN_FARMER[c]; });
  if (unknown.length) return { error: 'No farmer data source for crop(s): ' + unknown.join(', ') + ' (region ' + (d.farmRegion || 'unknown') + ')' };

  var totalHa  = Number(d.totalHa) || 85;
  var current  = Number(d.currentIncome) || 800;          // €/ha baseline (the farmer's own figure)
  var paybackTarget = parseLeadingInt(d.payback, 5);
  var idt = Number(d.incomeDrop);                                          // €/ha tolerance
  var incomeDropTol = (d.incomeDrop != null && d.incomeDrop !== '' && Number.isFinite(idt)) ? idt : 100;
  var cow = M.cost_of_waiting;

  // Per-crop steady-state regen uplift (€/ha, full ramp, steady yield, no capex) — transparency block.
  var per_crop = cropKeys.map(function (crop) {
    var k = KWIN_FARMER[crop];
    var steadyYield   = k.yield_t_ha * k.regen_yield_factor;
    var premium_rev   = steadyYield * k.price_conv * k.regen_premium_pct;
    var input_save    = k.fert_cost_share * k.variable_cost_ha * M.input_reduction_pct;
    var carbon        = k.carbon_eur_ha;
    var yield_loss    = (1 - k.regen_yield_factor) * k.yield_t_ha * k.price_conv;
    var uplift        = premium_rev + input_save + carbon - yield_loss;
    return { crop: crop, steady_uplift_ha: round(uplift), premium_rev_ha: round(premium_rev),
             input_saving_ha: round(input_save), carbon_ha: round(carbon), yield_loss_ha: round(yield_loss),
             source_label: k.source_label, verified: k.verified };
  });
  var nC = per_crop.length;
  var avg = function (sel) { return per_crop.reduce(function (s, c) { return s + sel(c); }, 0) / nC; };

  // Per-year cashflow (per-ha figures are the equal-weighted mean across the selected crops).
  var cashflow = [];
  var cum = 0, payback_year = null, max_income_drop_ha = 0;
  for (var y = 1; y <= M.horizon_years; y++) {
    var ramp = Math.min(1, y / M.transition_years);
    var inDip = y <= M.yield_dip_years;
    // per-ha regen delta vs the farmer's CURRENT income, averaged over crops
    var regen_delta_ha = avg(function (c) {
      var k = KWIN_FARMER[c.crop];
      var yfac = inDip ? (1 - M.yield_dip_pct) : k.regen_yield_factor;
      var premium_rev = k.yield_t_ha * yfac * k.price_conv * k.regen_premium_pct * ramp;
      var input_save  = k.fert_cost_share * k.variable_cost_ha * M.input_reduction_pct * ramp;
      var carbon      = k.carbon_eur_ha * ramp;
      var yield_loss  = (1 - yfac) * k.yield_t_ha * k.price_conv;
      var capex       = inDip ? (M.transition_capex_ha / M.yield_dip_years) : 0;
      return premium_rev + input_save + carbon - yield_loss - capex;
    });
    // Cost of waiting: a NON-transitioning farm's conventional income erodes/inflates each year.
    var conv_ha = cow.enabled
      ? current * Math.pow(1 - (cow.conv_margin_erosion_pct + cow.input_cost_inflation_pct), y - 1)
      : current;
    var regen_ha = current + regen_delta_ha;        // transitioning escapes the erosion
    var delta_ha = regen_ha - conv_ha;              // benefit vs staying conventional
    var capex_ha = inDip ? (M.transition_capex_ha / M.yield_dip_years) : 0;
    cum += delta_ha;
    if (payback_year == null && cum >= 0) payback_year = y;
    var drop = current - regen_ha;                  // shortfall vs TODAY's income (what the farmer feels)
    if (drop > max_income_drop_ha) max_income_drop_ha = drop;
    cashflow.push({ year: y, conventional_ha: round(conv_ha), regen_ha: round(regen_ha),
                    capex_ha: round(capex_ha), delta_ha: round(delta_ha), cumulative_delta_ha: round(cum) });
  }

  // Steady-state (full ramp, post-dip, no capex)
  var steady_uplift_ha = avg(function (c) { return c.steady_uplift_ha; });
  var regen_income_ha  = round(current + steady_uplift_ha);
  var input_saving_ha  = round(avg(function (c) { return c.input_saving_ha; }));
  var carbon_ha        = round(avg(function (c) { return c.carbon_ha; }));
  var net_value_annual = round(steady_uplift_ha * totalHa);
  var net_value_cumulative = round(cum * totalHa);

  // Verdict — computed in JS (NOT the AI). GO needs positive steady uplift, payback within the
  // farmer's target, and the worst-year dip within their tolerance.
  var verdict;
  if (steady_uplift_ha <= 0 || payback_year == null) verdict = 'NO_GO';
  else if (payback_year <= paybackTarget && max_income_drop_ha <= incomeDropTol) verdict = 'GO';
  else verdict = 'CONDITIONAL_GO';

  // Deterministic scenarios (numbers in JS; the AI only writes the note text)
  var mk = function (factor) { return round(current + steady_uplift_ha * factor); };
  var scenarios = {
    optimistic:  { net_income_ha: mk(1.25), timeline: 'year ' + Math.max(2, M.transition_years - 1) },
    base:        { net_income_ha: mk(1.00), timeline: 'year ' + M.transition_years },
    pessimistic: { net_income_ha: mk(0.60), timeline: 'year ' + (M.transition_years + 2) },
  };

  var anyUnverified = per_crop.some(function (c) { return !c.verified; }) || !M.verified;

  return {
    verdict: verdict,
    inputs: { totalHa: totalHa, current_income_ha: current, payback_target: paybackTarget, income_drop_tolerance: incomeDropTol, crops: cropKeys },
    kpis: {
      current_income_ha: current,
      regen_income_ha: regen_income_ha,
      input_saving_ha: input_saving_ha,
      carbon_potential_ha: carbon_ha,
      transition_years: M.transition_years,
      payback_period: payback_year,                 // null = not within horizon
    },
    model: {
      horizon_years: M.horizon_years,
      cashflow: cashflow,
      payback_year: payback_year,
      max_income_drop_ha: round(max_income_drop_ha),
      steady_uplift_ha: round(steady_uplift_ha),
      regen_income_ha: regen_income_ha,
      current_income_ha: current,
      net_value_annual: net_value_annual,
      net_value_cumulative: net_value_cumulative,
      per_crop: per_crop,
      cost_of_waiting: { enabled: cow.enabled, conv_margin_erosion_pct: cow.conv_margin_erosion_pct, input_cost_inflation_pct: cow.input_cost_inflation_pct, verified: false },
      transition_capex_ha: M.transition_capex_ha,
      source_label: 'KWIN-AGV 2024 (WUR/BIJ12) + Orbag transition model',
      verified: !anyUnverified,
      model_caveat: 'Multi-year transition model — yield-dip, premium/input-saving ramp, carbon and capex are provisional economic assumptions (verified:false); validate with an agro-economist.',
    },
    scenarios: scenarios,
    net_value: net_value_annual,
  };
}

// ── LIVE BUYER DEMAND CONTEXT (for the narrative only) ───
async function getLiveBuyerContext(crops, supabaseUrl, supabaseKey) {
  if (!supabaseUrl || !supabaseKey) return '';
  try {
    var res = await fetch(
      supabaseUrl + '/rest/v1/reports?select=company,crop,region,current_price,report_data,created_at&sector=neq.farmer&order=created_at.desc&limit=8',
      { headers: { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey } }
    );
    if (!res.ok) return '';
    var rows = await res.json();
    var cropList = (crops || []).join(' ').toLowerCase();
    var relevant = rows.filter(function (r) {
      var rc = (r.crop || '').toLowerCase();
      // require a real crop that the farmer actually grows — '' must NOT match, and we must not
      // unconditionally pull in every wheat/potato buyer regardless of the farmer's crop mix.
      return rc && cropList.includes(rc);
    }).slice(0, 3);
    if (!relevant.length) return '';
    var lines = relevant.map(function (r) {
      var k = (r.report_data && r.report_data.kpis) || {};
      var v = (r.report_data && r.report_data.verdict) || 'unknown';
      var vol = r.report_data && r.report_data.input && r.report_data.input.volume;
      return '- ' + (r.company || 'Buyer') + ' (' + (r.region || 'NL') + '): wants ' + (vol || '?') + 't, price range ' + (k.price_range || r.current_price + '€/t') + ', verdict: ' + v;
    }).join('\n');
    return '\nLIVE BUYER DEMAND DATA (Orbag database):\n' + lines + '\nUse to calibrate premium revenue potential and buyer availability.';
  } catch (e) { return ''; }
}

// ── NARRATIVE PROMPT (AI writes prose ONLY, from the computed numbers) ──
function buildNarrativePrompt(d, calc, liveContext) {
  var f = function (n) { return '€' + Math.round(n).toLocaleString(); };
  var m = calc.model, k = calc.kpis;
  var regions = FARMER_REGIONS;
  var ambitions = { partial: 'partial (20-40%)', majority: 'majority (50-70%)', full: 'whole farm', exploring: 'still exploring' };
  var concerns = { income_drop: 'income drop during transition', finding_buyers: 'finding buyers', knowledge: 'lack of knowledge', certification: 'certification cost', soil_risk: 'yield risk in the first years' };
  var perCrop = m.per_crop.map(function (c) { return c.crop + ' (+' + f(c.steady_uplift_ha) + '/ha: premium ' + f(c.premium_rev_ha) + ', input ' + f(c.input_saving_ha) + ', carbon ' + f(c.carbon_ha) + ', yield loss ' + f(c.yield_loss_ha) + ')'; }).join('; ');

  return 'You are an agricultural economist for Orbag. Write a regen-transition narrative using ONLY these pre-calculated numbers. Do NOT invent or recompute figures. Return pure JSON, no markdown.\n\n'
    + 'FARM: ' + d.farmName + ', ' + (regions[d.farmRegion] || d.farmRegion) + ', ' + calc.inputs.totalHa + ' ha, soil ' + d.soilType + '\n'
    + 'CROPS: ' + calc.inputs.crops.join(', ') + ' | certification: ' + (CERT_LABELS[d.currentCert] || d.currentCert || 'none') + '\n'
    + 'AMBITION: ' + (ambitions[d.ambition] || d.ambition) + ' | biggest concern: ' + (concerns[d.concern] || d.concern) + '\n'
    + 'VERDICT (already decided): ' + calc.verdict + '\n'
    + 'CURRENT income: ' + f(k.current_income_ha) + '/ha → REGEN income at full transition: ' + f(k.regen_income_ha) + '/ha (uplift ' + f(m.steady_uplift_ha) + '/ha)\n'
    + 'INPUT saving: ' + f(k.input_saving_ha) + '/ha | CARBON: ' + f(k.carbon_potential_ha) + '/ha | transition ' + k.transition_years + ' yr | PAYBACK: ' + (k.payback_period ? 'year ' + k.payback_period : 'beyond ' + m.horizon_years + ' yr') + '\n'
    + 'Worst-year income dip: ' + f(m.max_income_drop_ha) + '/ha (farmer tolerance ' + f(calc.inputs.income_drop_tolerance) + '/ha, target payback ' + calc.inputs.payback_target + ' yr)\n'
    + 'Net value: ' + f(m.net_value_annual) + '/yr steady-state (' + f(m.net_value_cumulative) + ' cumulative over ' + m.horizon_years + ' yr)\n'
    + 'Per-crop regen economics: ' + perCrop + '\n'
    + 'Scenarios (€/ha net income): optimistic ' + f(calc.scenarios.optimistic.net_income_ha) + ' (' + calc.scenarios.optimistic.timeline + '), base ' + f(calc.scenarios.base.net_income_ha) + ' (' + calc.scenarios.base.timeline + '), conservative ' + f(calc.scenarios.pessimistic.net_income_ha) + ' (' + calc.scenarios.pessimistic.timeline + ')\n'
    + (liveContext || '') + '\n'
    + 'Farmer context: ' + (d.context || 'none') + '\n\n'
    + 'Return this JSON (prose only; numbers are already decided above):\n'
    + '{"verdict_reason":"ONE sentence with the euro figures: lead with regen income/ha and payback, and name the worst-year dip vs tolerance",'
    + '"income_analysis":"3 sentences using the per-crop regen economics above (premium, yield) for the specific crops",'
    + '"input_analysis":"2-3 sentences on the fertiliser/chemical input saving and where it comes from",'
    + '"scenarios":{"optimistic":{"note":"condition"},"base":{"note":"condition"},"pessimistic":{"note":"condition"}},'
    + '"crop_recommendations":["Crop 1 — reason citing its regen premium","Crop 2","Crop 3"],'
    + '"next_steps":["step 1","step 2","step 3","step 4"],'
    + '"orbag_note":"one sentence on what Orbag does next"}';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    var d = req.body;

    // Step 1: deterministic JS engine — every number comes from here
    var calc = calculateFarmer(d);
    if (calc.error) return res.status(400).json({ error: calc.error });
    console.log('farmer calc verdict:', calc.verdict, 'regen/ha:', calc.kpis.regen_income_ha, 'payback:', calc.kpis.payback_period, 'net_value:', calc.net_value);

    // Step 2: live buyer demand context for the narrative
    var liveContext = await getLiveBuyerContext(d.crops, process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    // Step 3: AI writes the narrative ONLY (no numbers)
    var anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1400,
        messages: [{ role: 'user', content: buildNarrativePrompt(d, calc, liveContext) }],
      }),
    });

    if (!anthropicRes.ok) {
      var err = await anthropicRes.json().catch(function () { return {}; });
      return res.status(500).json({ error: (err.error && err.error.message) || ('Anthropic error ' + anthropicRes.status) });
    }

    var anthropicData = await anthropicRes.json();
    var text = ((anthropicData && anthropicData.content) || []).map(function (b) { return b.type === 'text' ? b.text : ''; }).join('');
    console.log('farmer narrative stop_reason:', anthropicData.stop_reason, 'length:', text.length);

    text = text.replace(/```json\n?|```\n?/g, '').trim();
    var jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'AI did not return valid JSON. Please try again.' });

    var nar;
    try { nar = JSON.parse(jsonMatch[0]); }
    catch (e) { return res.status(500).json({ error: 'Could not parse response. Please try again.' }); }

    // Step 4: assemble report — JS numbers + AI prose. Scenarios merge computed numbers + AI notes.
    var sc = calc.scenarios, sn = nar.scenarios || {};
    var report = {
      verdict: calc.verdict,
      verdict_reason: nar.verdict_reason,
      kpis: {
        current_income_ha: calc.kpis.current_income_ha,
        regen_income_ha: calc.kpis.regen_income_ha,
        input_saving_ha: calc.kpis.input_saving_ha,
        carbon_potential_ha: calc.kpis.carbon_potential_ha,
        transition_years: calc.kpis.transition_years,
        payback_period: calc.kpis.payback_period,
      },
      model: calc.model,
      net_value: calc.net_value,
      scenarios: {
        optimistic:  { net_income_ha: sc.optimistic.net_income_ha,  timeline: sc.optimistic.timeline,  note: (sn.optimistic && sn.optimistic.note) || '' },
        base:        { net_income_ha: sc.base.net_income_ha,        timeline: sc.base.timeline,        note: (sn.base && sn.base.note) || '' },
        pessimistic: { net_income_ha: sc.pessimistic.net_income_ha, timeline: sc.pessimistic.timeline, note: (sn.pessimistic && sn.pessimistic.note) || '' },
      },
      income_analysis: nar.income_analysis,
      input_analysis: nar.input_analysis,
      crop_recommendations: nar.crop_recommendations || [],
      next_steps: nar.next_steps || [],
      orbag_note: nar.orbag_note,
    };

    // Step 5: persist
    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      await fetch(process.env.SUPABASE_URL + '/rest/v1/rpc/save_report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': process.env.SUPABASE_KEY, 'Authorization': 'Bearer ' + process.env.SUPABASE_KEY },
        body: JSON.stringify({ p: {
          company: d.farmName, sector: 'farmer',
          crop: (d.crops || []).join(','),
          region: d.farmRegion, volume: d.totalHa,
          // BLOK 1: promoted columns. Dutch farms -> nl (or explicit farm_country). The DB
          // generates match_key from crop+country; the report_match_keys view explodes the
          // comma-joined crop list so each crop links to its buyers.
          country: d.farm_country || 'nl',
          report_type: 'farmer',
          current_price: d.currentIncome, premium: 0,
          verdict: report.verdict, feasibility: null,
          price_range: report.kpis.regen_income_ha,
          input_data: d, report_data: report,
          created_at: new Date().toISOString(),
        }}),
      });
      // Save to farmer_bcs for the match engine — net_value is now a real number (was null).
      if (d.user_id) {
        await fetch(process.env.SUPABASE_URL + '/rest/v1/rpc/save_farmer_bc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': process.env.SUPABASE_KEY, 'Authorization': 'Bearer ' + process.env.SUPABASE_KEY },
          body: JSON.stringify({ p: {
            user_id: d.user_id,
            farm_name: d.farmName,
            region: d.farmRegion,
            hectares: Number(d.totalHa),
            soil_type: d.soilType,
            crops: d.crops || [],
            net_value: calc.net_value,
            verdict: report.verdict,
          }}),
        });
      }
    }

    return res.status(200).json(report);
  } catch (err) {
    console.error('Farmer error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// ── TEST HOOKS (offline fixtures: tests/farmer.test.js) ──
module.exports.calculateFarmer = calculateFarmer;
module.exports.KWIN_FARMER = KWIN_FARMER;
module.exports.TRANSITION_MODEL = TRANSITION_MODEL;
