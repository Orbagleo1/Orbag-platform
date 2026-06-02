// ── ORBAG BUYER BUSINESSCASE GENERATOR ──────────────────
// Architecture: two sequential AI calls
// Call 1 (calculate): pure numbers from benchmark data — fast, no narrative
// Call 2 (narrate): writes the report from the numbers — focused, no benchmark data
// This split removes the token ceiling: add calculation variables to Call 1,
// add narrative fields to Call 2, neither affects the other.

// ── BENCHMARK DATA ──────────────────────────────────────
const KWIN = {
  green_beans: {yield_ha:10000, price_conv:330, price_bio:420, cost_ha:2100, tare_conv:18, tare_regen:13, dm_gain:10, defect_conv:8, defect_regen:4},
  wheat:       {yield_ha:9200,  price_conv:230, price_bio:340, cost_ha:1400, tare_conv:0,  tare_regen:0,  dm_gain:7,  defect_conv:5, defect_regen:2},
  potatoes:    {yield_ha:49500, price_conv:170, price_bio:220, cost_ha:3300, tare_conv:12, tare_regen:11, dm_gain:2,  defect_conv:7, defect_regen:5},
  onions:      {yield_ha:62000, price_conv:140, price_bio:180, cost_ha:2800, tare_conv:10, tare_regen:8,  dm_gain:3,  defect_conv:8, defect_regen:5},
  lentils:     {yield_ha:4500,  price_conv:420, price_bio:700, cost_ha:1000, tare_conv:12, tare_regen:9,  dm_gain:9,  defect_conv:7, defect_regen:3},
  oats:        {yield_ha:5200,  price_conv:210, price_bio:320, cost_ha:950,  tare_conv:0,  tare_regen:0,  dm_gain:6,  defect_conv:4, defect_regen:2},
  peas:        {yield_ha:5000,  price_conv:420, price_bio:700, cost_ha:1000, tare_conv:12, tare_regen:9,  dm_gain:9,  defect_conv:7, defect_regen:3},
  carrots:     {yield_ha:80000, price_conv:100, price_bio:140, cost_ha:2200, tare_conv:15, tare_regen:13, dm_gain:3,  defect_conv:10,defect_regen:6},
};

const RISK_PCT = {
  geopolitical: {morocco_egypt:0.15, turkey_spain:0.08, netherlands:0.02, mixed_eu:0.045, mixed_global:0.115},
  weather_conv: {morocco_egypt:0.32, turkey_spain:0.22, netherlands:0.20, mixed_eu:0.18,  mixed_global:0.25},
  weather_regen:0.12,
  recall_conv:  {none:0.003, minor:0.012, moderate:0.035, major:0.09},
  recall_regen: 0.0008,
  price_vol:    {mostly_spot:0.38, mixed:0.20, mostly_contract:0.10, full_contract:0.04},
  price_vol_regen:0.07,
  csrd_gap:     {mandatory_2025:120000, mandatory_2026:75000, voluntary:20000, not_yet:0},
};

const CARBON_POTENTIAL = {
  green_beans:40, wheat:55, potatoes:35, onions:30,
  lentils:65, oats:50, peas:65, carrots:35,
};

const NITRATE_RISK = {
  green_beans: {risk:'medium', rejection_chance_conv:0.04, rejection_chance_regen:0.004, cost_per_incident:25000},
  wheat:       {risk:'low',    rejection_chance_conv:0.01, rejection_chance_regen:0.001, cost_per_incident:10000},
  potatoes:    {risk:'low',    rejection_chance_conv:0.01, rejection_chance_regen:0.001, cost_per_incident:15000},
  onions:      {risk:'low',    rejection_chance_conv:0.01, rejection_chance_regen:0.001, cost_per_incident:10000},
  lentils:     {risk:'low',    rejection_chance_conv:0.01, rejection_chance_regen:0.001, cost_per_incident:10000},
  oats:        {risk:'low',    rejection_chance_conv:0.01, rejection_chance_regen:0.001, cost_per_incident:8000},
  peas:        {risk:'low',    rejection_chance_conv:0.01, rejection_chance_regen:0.001, cost_per_incident:10000},
  carrots:     {risk:'low',    rejection_chance_conv:0.01, rejection_chance_regen:0.001, cost_per_incident:8000},
};

const PROCESSING_CONF = {
  green_beans:'HIGH', peas:'HIGH', lentils:'HIGH',
  wheat:'HIGH', oats:'MEDIUM',
  carrots:'LOW', potatoes:'LOW', onions:'LOW',
};

// ── CALL 1: CALCULATE ────────────────────────────────────
function calculate(d) {
  var crop = d.crop || 'green_beans';
  var k = KWIN[crop] || KWIN.green_beans;
  var vol = parseFloat(d.volume) || 100;
  var price = parseFloat(d.currentPrice) || 300;
  var premium = parseFloat(d.premium) / 100 || 0.15;
  var cv = vol * price;

  // 1. Geopolitical risk
  var geo_pct = (RISK_PCT.geopolitical[d.currentSource] || 0.05);
  var geo_current = Math.round(cv * geo_pct);
  var geo_regen = Math.round(cv * 0.02);

  // 2. Weather / yield risk
  var weather_pct = (RISK_PCT.weather_conv[d.currentSource] || 0.20);
  var weather_current = Math.round(cv * weather_pct * 0.3);
  var weather_regen = Math.round(cv * RISK_PCT.weather_regen * 0.3);

  // 3. Quality / traceability
  var recall_pct = (RISK_PCT.recall_conv[d.incidents] || 0.005);
  var quality_current = Math.round(cv * recall_pct);
  var quality_regen = Math.round(cv * RISK_PCT.recall_regen);

  // 4. Price volatility
  var vol_pct = (RISK_PCT.price_vol[d.currentContract] || 0.20);
  var price_vol_current = Math.round(cv * vol_pct * 0.2);
  var price_vol_regen = Math.round(cv * RISK_PCT.price_vol_regen * 0.2);

  // 5. CSRD compliance gap
  var csrd_current = Math.round((RISK_PCT.csrd_gap[d.csrd] || 0) * 0.4);
  var csrd_regen = 0;

  // 6. Supplier concentration risk
  var concentration_mult = d.currentSource === 'morocco_egypt' || d.currentSource === 'turkey_spain' ? 1.4 : 1.0;
  var concentration_current = Math.round(geo_current * 0.3 * concentration_mult);
  var concentration_regen = Math.round(concentration_current * 0.15);

  // 7. Nitrate rejection risk
  var nr = NITRATE_RISK[crop] || NITRATE_RISK.green_beans;
  var nitrate_current = Math.round(nr.rejection_chance_conv * nr.cost_per_incident);
  var nitrate_regen = Math.round(nr.rejection_chance_regen * nr.cost_per_incident);

  var current_total = geo_current + weather_current + quality_current + price_vol_current + csrd_current + concentration_current + nitrate_current;
  var regen_total = geo_regen + weather_regen + quality_regen + price_vol_regen + csrd_regen + concentration_regen + nitrate_regen;
  var risk_reduction = current_total - regen_total;

  // Processing economics
  var tare_saving = k.tare_conv > 0 ? Math.round((k.tare_conv - k.tare_regen) / 100 * price) : 0;
  var dm_value = Math.round(k.dm_gain / 100 * price * 0.5);
  var defect_saving = Math.round((k.defect_conv - k.defect_regen) / 100 * price);
  var total_processing_saving = tare_saving + dm_value + defect_saving;
  var premium_cost_per_tonne = Math.round(price * premium);
  var net_cost_per_tonne = premium_cost_per_tonne - total_processing_saving;
  var premium_cost_annual = Math.round(vol * premium_cost_per_tonne);
  var processing_saving_annual = Math.round(vol * total_processing_saving);
  var net_value = risk_reduction + processing_saving_annual - premium_cost_annual;

  // Carbon credit upside
  var carbon_ha_needed = Math.round(vol / (k.yield_ha / 1000));
  var carbon_potential = Math.round(carbon_ha_needed * (CARBON_POTENTIAL[crop] || 40));
  var carbon_buyer_share = Math.round(carbon_potential * 0.3);

  // KWIN prices
  var regen_price_est = Math.round(price * (1 + premium));
  var kwin_conv = k.price_conv;
  var kwin_bio = k.price_bio;

  // Feasibility
  var feasibility = Math.min(100, Math.max(10,
    (net_value > 0 ? 70 : 40) +
    (vol < 200 ? 15 : vol < 500 ? 10 : 5) +
    (d.region === 'noord_nederland' ? 10 : d.region === 'no_preference' ? 5 : 0) +
    (d.currentSource !== 'netherlands' ? 5 : 0)
  ));

  var verdict = net_value > 0 ? 'GO' : (net_value > -premium_cost_annual * 0.2 ? 'CONDITIONAL_GO' : 'NO_GO');

  return {
    verdict, feasibility, net_value, risk_reduction,
    premium_cost_annual, processing_saving_annual,
    current_total, regen_total,
    layers: [
      {layer:'Geopolitical',    current:geo_current,       regen:geo_regen,       reduction:geo_current-geo_regen},
      {layer:'Weather/yield',   current:weather_current,   regen:weather_regen,   reduction:weather_current-weather_regen},
      {layer:'Quality/recall',  current:quality_current,   regen:quality_regen,   reduction:quality_current-quality_regen},
      {layer:'Price volatility',current:price_vol_current, regen:price_vol_regen, reduction:price_vol_current-price_vol_regen},
      {layer:'CSRD/regulatory', current:csrd_current,      regen:csrd_regen,      reduction:csrd_current-csrd_regen},
      {layer:'Supplier conc.',  current:concentration_current, regen:concentration_regen, reduction:concentration_current-concentration_regen},
      {layer:'Nitrate rejection',current:nitrate_current,  regen:nitrate_regen,   reduction:nitrate_current-nitrate_regen},
    ],
    processing: {
      tare_saving_per_tonne: tare_saving,
      dm_value_per_tonne: dm_value,
      defect_saving_per_tonne: defect_saving,
      total_saving_per_tonne: total_processing_saving,
      premium_cost_per_tonne,
      net_cost_per_tonne,
      processing_saving_annual,
      confidence: PROCESSING_CONF[crop] || 'LOW',
    },
    carbon: {
      ha_needed: carbon_ha_needed,
      total_potential: carbon_potential,
      buyer_share_30pct: carbon_buyer_share,
    },
    market: {
      kwin_conv_price: kwin_conv,
      kwin_bio_price: kwin_bio,
      regen_price_estimate: regen_price_est,
      premium_pct: Math.round(premium * 100),
      contract_value: cv,
      volume: vol,
      crop,
    },
  };
}

// ── CALL 2: NARRATE ──────────────────────────────────────
function buildNarrativePrompt(d, calc, liveContext) {
  var fmt = function(n) { return '€' + Math.round(n).toLocaleString(); };
  var crops = {green_beans:'green beans (sperziebonen)',wheat:'wheat (tarwe)',potatoes:'potatoes',onions:'onions',lentils:'lentils',oats:'oats',peas:'peas',carrots:'carrots'};
  var c = calc;

  return 'You are a supply chain analyst for Orbag. Write a buyer businesscase report narrative. Use ONLY the pre-calculated numbers below. Return pure JSON, no markdown.\n\n'
    + 'BUYER: ' + d.company + ' (' + d.sector + '), crop: ' + (crops[d.crop]||d.crop) + ', ' + d.volume + 't/yr from ' + d.region + '\n'
    + 'VERDICT: ' + c.verdict + ' | Net value: ' + fmt(c.net_value) + '/yr | Feasibility: ' + c.feasibility + '/100\n'
    + 'RISK: current ' + fmt(c.current_total) + '/yr → regen ' + fmt(c.regen_total) + '/yr | reduction: ' + fmt(c.risk_reduction) + '/yr\n'
    + 'PREMIUM COST: ' + fmt(c.premium_cost_annual) + '/yr | PROCESSING SAVING: ' + fmt(c.processing_saving_annual) + '/yr\n'
    + 'CARBON UPSIDE: ' + fmt(c.carbon.buyer_share_30pct) + '/yr (30% share of farm carbon credits on ' + c.carbon.ha_needed + ' ha)\n'
    + 'KWIN prices: conventional ' + fmt(c.market.kwin_conv_price) + '/t, regen est. ' + fmt(c.market.regen_price_estimate) + '/t\n'
    + 'PROCESSING: tare saving ' + fmt(c.processing.tare_saving_per_tonne) + '/t, DM gain ' + fmt(c.processing.dm_value_per_tonne) + '/t, defect saving ' + fmt(c.processing.defect_saving_per_tonne) + '/t (' + c.processing.confidence + ' confidence)\n'
    + (liveContext || '') + '\n'
    + 'Context from buyer: ' + (d.concerns || 'none') + '\n\n'
    + 'Return this JSON:\n'
    + '{"verdict_reason":"one sentence citing the net value figure",'
    + '"supply_analysis":"2-3 sentences on regional supply capacity for this crop. Be specific about Noord-NL suitability.",'
    + '"pricing_analysis":"2-3 sentences on KWIN price vs regen estimate. Explain whether premium tolerance is sufficient.",'
    + '"processing_insight":"2-3 sentences explaining the tare/DM/defect advantage in plain language a CFO understands. State net cost per unit of finished product.",'
    + '"carbon_note":"1-2 sentences on carbon credit upside and buyer share structure.",'
    + '"nitrate_note":"1 sentence on nitrate rejection risk reduction for this crop.",'
    + '"scenarios":{"optimistic":{"volume_pct":"X%","price":"€X/t","note":"condition"},"base":{"volume_pct":"X%","price":"€X/t","note":"condition"},"pessimistic":{"volume_pct":"X%","price":"€X/t","note":"condition"}},'
    + '"next_steps":["step 1","step 2","step 3","step 4"],'
    + '"orbag_note":"one sentence on what Orbag does next"}';
}

// ── LIVE CONTEXT ─────────────────────────────────────────
async function getLiveContext(crop, supabaseUrl, supabaseKey) {
  if (!supabaseUrl || !supabaseKey) return '';
  try {
    var res = await fetch(
      supabaseUrl + '/rest/v1/reports?select=company,sector,crop,region,current_price,report_data,created_at&sector=eq.farmer&order=created_at.desc&limit=5',
      { headers: { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey } }
    );
    if (!res.ok) return '';
    var rows = await res.json();
    var cropLC = (crop || '').toLowerCase();
    var relevant = rows.filter(function(r) {
      var rc = (r.crop || '').toLowerCase();
      return rc.includes(cropLC) || cropLC.includes(rc.split(',')[0]);
    }).slice(0, 3);
    if (!relevant.length) return '';
    var lines = relevant.map(function(r) {
      var k = (r.report_data && r.report_data.kpis) || {};
      return '- Farm in ' + (r.region || 'NL') + ': regen income ' + (k.regen_income_ha || 'unknown') + '/ha, verdict: ' + ((r.report_data && r.report_data.verdict) || 'unknown');
    }).join('\n');
    return 'LIVE FARMER DATA (Orbag database):\n' + lines;
  } catch(e) { return ''; }
}

// ── HANDLER ──────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    var d = req.body;

    // CALL 1: calculate all numbers locally (no AI needed)
    var calc = calculate(d);
    console.log('calc done — verdict:', calc.verdict, 'net_value:', calc.net_value);

    // CALL 2: get live farmer context
    var liveContext = await getLiveContext(d.crop, process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    // CALL 3: AI writes the narrative only
    var anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1200,
        messages: [{ role: 'user', content: buildNarrativePrompt(d, calc, liveContext) }],
      }),
    });

    if (!anthropicRes.ok) {
      var err = await anthropicRes.json().catch(function() { return {}; });
      return res.status(500).json({ error: (err.error && err.error.message) || 'Anthropic error ' + anthropicRes.status });
    }

    var anthropicData = await anthropicRes.json();
    var text = anthropicData.content.map(function(b) { return b.type === 'text' ? b.text : ''; }).join('');
    console.log('narrative stop_reason:', anthropicData.stop_reason, 'length:', text.length);

    text = text.replace(/```json\n?|```\n?/g, '').trim();
    var jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'AI did not return valid JSON. Please try again.' });

    var narrative;
    try { narrative = JSON.parse(jsonMatch[0]); }
    catch(e) { return res.status(500).json({ error: 'Could not parse response. Please try again.' }); }

    // Merge calculated numbers with narrative
    var report = {
      verdict: calc.verdict,
      verdict_reason: narrative.verdict_reason,
      kpis: {
        feasibility_score: calc.feasibility,
        price_range: '€' + calc.market.kwin_conv_price + '–' + calc.market.regen_price_estimate + '/t',
        available_farms: calc.market.volume < 200 ? '8–15 farms' : calc.market.volume < 500 ? '12–25 farms' : '20–40 farms',
        supply_reliability: calc.feasibility > 70 ? 'High' : calc.feasibility > 50 ? 'Medium' : 'Low',
        regen_premium: '€' + calc.processing.premium_cost_per_tonne + '/t (+' + calc.market.premium_pct + '%)',
        payback_context: calc.processing.net_cost_per_tonne <= 0 ? 'net cheaper per unit finished product' : 'offset by risk reduction',
      },
      risk_analysis: {
        current_total_exposure: '€' + Math.round(calc.current_total).toLocaleString() + '/yr',
        residual_exposure_regen: '€' + Math.round(calc.regen_total).toLocaleString() + '/yr',
        risk_reduction_value: '€' + Math.round(calc.risk_reduction).toLocaleString() + '/yr',
        premium_cost: '€' + Math.round(calc.premium_cost_annual).toLocaleString() + '/yr',
        net_value: '€' + Math.round(calc.net_value).toLocaleString() + '/yr',
        layers: calc.layers.map(function(l) {
          return {
            layer: l.layer,
            current: '€' + l.current.toLocaleString(),
            regen: '€' + l.regen.toLocaleString(),
            reduction: '€' + l.reduction.toLocaleString(),
            basis: '',
          };
        }),
      },
      processing_economics: {
        tare_saving_per_tonne: '€' + calc.processing.tare_saving_per_tonne + '/t',
        dm_value_per_tonne: '€' + calc.processing.dm_value_per_tonne + '/t',
        defect_saving_per_tonne: '€' + calc.processing.defect_saving_per_tonne + '/t',
        total_saving_per_tonne: '€' + calc.processing.total_saving_per_tonne + '/t',
        net_cost_vs_conventional: calc.processing.net_cost_per_tonne <= 0
          ? '€' + Math.abs(calc.processing.net_cost_per_tonne) + '/t cheaper net'
          : '€' + calc.processing.net_cost_per_tonne + '/t more expensive net',
        annual_impact: (calc.processing_saving_annual - calc.premium_cost_annual) >= 0
          ? '+€' + Math.round(calc.processing_saving_annual - calc.premium_cost_annual).toLocaleString() + '/yr net saving'
          : '-€' + Math.abs(Math.round(calc.processing_saving_annual - calc.premium_cost_annual)).toLocaleString() + '/yr net cost',
        confidence: calc.processing.confidence,
        caveat: narrative.processing_insight || '',
      },
      carbon_upside: {
        ha_needed: calc.carbon.ha_needed,
        total_farm_potential: '€' + calc.carbon.total_potential.toLocaleString() + '/yr',
        buyer_share: '€' + calc.carbon.buyer_share_30pct.toLocaleString() + '/yr',
        note: narrative.carbon_note || '',
      },
      supply_analysis: narrative.supply_analysis,
      pricing_analysis: narrative.pricing_analysis,
      nitrate_note: narrative.nitrate_note,
      scenarios: narrative.scenarios,
      next_steps: narrative.next_steps,
      orbag_note: narrative.orbag_note,
    };

    // Save to Supabase
    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      await fetch(process.env.SUPABASE_URL + '/rest/v1/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_KEY,
          'Authorization': 'Bearer ' + process.env.SUPABASE_KEY,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          company: d.company, sector: d.sector, crop: d.crop, region: d.region,
          volume: Number(d.volume), current_price: Number(d.currentPrice),
          premium: Number(d.premium), verdict: report.verdict,
          feasibility: report.kpis.feasibility_score,
          price_range: report.kpis.price_range,
          input_data: d, report_data: report,
          created_at: new Date().toISOString(),
        }),
      });
    }

    return res.status(200).json(report);
  } catch(err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
