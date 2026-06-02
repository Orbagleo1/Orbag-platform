// ORBAG BUYER BUSINESSCASE GENERATOR v3
// Architecture: JS calculation engine + AI narrative
// Two-call design — no token ceiling on calculation complexity

// ── BENCHMARK DATA ───────────────────────────────────────
var KWIN = {
  green_beans: {yield_ha:10000, price_conv:330, price_bio:420, cost_ha:2100, tare_conv:18, tare_regen:13, dm_gain:10, defect_conv:8,  defect_regen:4,  nitrate_risk:'medium', nitrate_reject_conv:0.040, nitrate_reject_regen:0.004, nitrate_cost:25000},
  wheat:       {yield_ha:9200,  price_conv:230, price_bio:340, cost_ha:1400, tare_conv:0,  tare_regen:0,  dm_gain:7,  defect_conv:5,  defect_regen:2,  nitrate_risk:'low',    nitrate_reject_conv:0.010, nitrate_reject_regen:0.001, nitrate_cost:10000},
  potatoes:    {yield_ha:49500, price_conv:170, price_bio:220, cost_ha:3300, tare_conv:12, tare_regen:11, dm_gain:2,  defect_conv:7,  defect_regen:5,  nitrate_risk:'low',    nitrate_reject_conv:0.010, nitrate_reject_regen:0.001, nitrate_cost:15000},
  onions:      {yield_ha:62000, price_conv:140, price_bio:180, cost_ha:2800, tare_conv:10, tare_regen:8,  dm_gain:3,  defect_conv:8,  defect_regen:5,  nitrate_risk:'low',    nitrate_reject_conv:0.010, nitrate_reject_regen:0.001, nitrate_cost:10000},
  lentils:     {yield_ha:4500,  price_conv:420, price_bio:700, cost_ha:1000, tare_conv:12, tare_regen:9,  dm_gain:9,  defect_conv:7,  defect_regen:3,  nitrate_risk:'low',    nitrate_reject_conv:0.008, nitrate_reject_regen:0.001, nitrate_cost:10000},
  oats:        {yield_ha:5200,  price_conv:210, price_bio:320, cost_ha:950,  tare_conv:0,  tare_regen:0,  dm_gain:6,  defect_conv:4,  defect_regen:2,  nitrate_risk:'low',    nitrate_reject_conv:0.008, nitrate_reject_regen:0.001, nitrate_cost:8000},
  peas:        {yield_ha:5000,  price_conv:420, price_bio:700, cost_ha:1000, tare_conv:12, tare_regen:9,  dm_gain:9,  defect_conv:7,  defect_regen:3,  nitrate_risk:'low',    nitrate_reject_conv:0.008, nitrate_reject_regen:0.001, nitrate_cost:10000},
  carrots:     {yield_ha:80000, price_conv:100, price_bio:140, cost_ha:2200, tare_conv:15, tare_regen:13, dm_gain:3,  defect_conv:10, defect_regen:6,  nitrate_risk:'low',    nitrate_reject_conv:0.010, nitrate_reject_regen:0.001, nitrate_cost:8000},
};

// ── DELIVERY SPEC MODIFIERS ──────────────────────────────
var DELIVERY_MOD = {
  fresh:   {tare_mult:1.0,  dm_mult:1.3,  shelf_risk:1.5, logistics_mult:1.4, label:'fresh market'},
  frozen:  {tare_mult:0.85, dm_mult:1.15, shelf_risk:0.4, logistics_mult:1.0, label:'frozen processing'},
  canned:  {tare_mult:0.80, dm_mult:1.20, shelf_risk:0.2, logistics_mult:0.9, label:'canning / preserving'},
  dried:   {tare_mult:0.70, dm_mult:1.40, shelf_risk:0.1, logistics_mult:0.8, label:'drying / dehydration'},
  any:     {tare_mult:1.0,  dm_mult:1.0,  shelf_risk:1.0, logistics_mult:1.0, label:'any / not specified'},
};

// ── SECTOR MODIFIERS ─────────────────────────────────────
var SECTOR_MOD = {
  food_processor: {processing_value_mult:1.3, csrd_urgency:1.2, quality_premium:1.2, label:'food processor'},
  retailer:       {processing_value_mult:0.8, csrd_urgency:1.1, quality_premium:1.4, label:'retailer/supermarket'},
  catering:       {processing_value_mult:0.9, csrd_urgency:0.9, quality_premium:1.1, label:'catering/foodservice'},
  wholesaler:     {processing_value_mult:0.7, csrd_urgency:0.8, quality_premium:0.9, label:'wholesaler'},
  exporter:       {processing_value_mult:0.6, csrd_urgency:0.7, quality_premium:0.8, label:'exporter'},
};

// ── SEASONALITY MODIFIERS ────────────────────────────────
var SEASON_MOD = {
  year_round:  {supply_risk_mult:1.3, farm_count_mult:1.5, label:'year-round supply needed'},
  seasonal:    {supply_risk_mult:0.8, farm_count_mult:0.7, label:'seasonal window (3-6 months)'},
  flexible:    {supply_risk_mult:1.0, farm_count_mult:1.0, label:'flexible timing'},
};

// ── RISK PERCENTAGES ─────────────────────────────────────
var RISK_PCT = {
  geopolitical: {morocco_egypt:0.15, turkey_spain:0.08, netherlands:0.02, mixed_eu:0.045, mixed_global:0.115},
  weather_conv: {morocco_egypt:0.32, turkey_spain:0.22, netherlands:0.20, mixed_eu:0.18, mixed_global:0.25},
  weather_regen: 0.12,
  recall_conv:  {none:0.003, minor:0.012, moderate:0.035, major:0.09},
  recall_regen: 0.0008,
  price_vol:    {mostly_spot:0.38, mixed:0.20, mostly_contract:0.10, full_contract:0.04},
  price_vol_regen: 0.07,
  csrd_gap:     {mandatory_2025:120000, mandatory_2026:75000, voluntary:20000, not_yet:0},
  concentration_base: 0.30,
  logistics_savings_per_tonne: {morocco_egypt:65, turkey_spain:40, netherlands:0, mixed_eu:15, mixed_global:50},
};

var CARBON_POTENTIAL = {green_beans:40, wheat:55, potatoes:35, onions:30, lentils:65, oats:50, peas:65, carrots:35};
var PROCESSING_CONF  = {green_beans:'HIGH', peas:'HIGH', lentils:'HIGH', wheat:'HIGH', oats:'MEDIUM', carrots:'LOW', potatoes:'LOW', onions:'LOW'};

// ── MAIN CALCULATION ENGINE ──────────────────────────────
function calculate(d) {
  var crop     = d.crop || 'green_beans';
  var k        = KWIN[crop] || KWIN.green_beans;
  var dm       = DELIVERY_MOD[d.deliverySpec] || DELIVERY_MOD.any;
  var sm       = SECTOR_MOD[d.sector] || SECTOR_MOD.food_processor;
  var szm      = SEASON_MOD[d.seasonality] || SEASON_MOD.flexible;
  var vol      = parseFloat(d.volume) || 100;
  var price    = parseFloat(d.currentPrice) || 300;
  var premium  = parseFloat(d.premium) / 100 || 0.15;
  var suppCnt  = parseInt(d.supplierCount) || 1;
  var cv       = vol * price;

  // 1. Geopolitical
  var geo_pct     = RISK_PCT.geopolitical[d.currentSource] || 0.05;
  var geo_current = Math.round(cv * geo_pct);
  var geo_regen   = Math.round(cv * 0.02);
  var geo_basis   = Math.round(geo_pct * 100) + '% of €' + Math.round(cv/1000) + 'K contract value — ' + (d.currentSource||'unknown') + ' sourcing profile (WUR 2024)';

  // 2. Weather
  var wthr_pct     = RISK_PCT.weather_conv[d.currentSource] || 0.20;
  var wthr_current = Math.round(cv * wthr_pct * 0.3);
  var wthr_regen   = Math.round(cv * RISK_PCT.weather_regen * 0.3);
  var wthr_basis   = Math.round(wthr_pct * 100) + '% yield variance × 0.3 impact factor × contract value';

  // 3. Quality / recall
  var rec_pct     = RISK_PCT.recall_conv[d.incidents] || 0.005;
  var qual_current= Math.round(cv * rec_pct);
  var qual_regen  = Math.round(cv * RISK_PCT.recall_regen);
  var qual_basis  = 'Incident history: ' + (d.incidents||'none') + ' → ' + Math.round(rec_pct*100*10)/10 + '% annual recall risk';

  // 4. Price volatility
  var pvol_pct     = RISK_PCT.price_vol[d.currentContract] || 0.20;
  var pvol_current = Math.round(cv * pvol_pct * 0.2);
  var pvol_regen   = Math.round(cv * RISK_PCT.price_vol_regen * 0.2);
  var pvol_basis   = 'Contract structure: ' + (d.currentContract||'unknown') + ' → ' + Math.round(pvol_pct*100) + '% price swing exposure';

  // 5. CSRD
  var csrd_raw     = RISK_PCT.csrd_gap[d.csrd] || 0;
  var csrd_current = Math.round(csrd_raw * sm.csrd_urgency * 0.4);
  var csrd_regen   = 0;
  var csrd_basis   = 'CSRD obligation: ' + (d.csrd||'unknown') + ' — compliance gap cost × sector urgency factor ' + sm.csrd_urgency;

  // 6. Supplier concentration — scales with supplier count
  var conc_mult    = suppCnt === 1 ? 1.6 : suppCnt <= 2 ? 1.3 : suppCnt <= 4 ? 1.1 : 1.0;
  var conc_current = Math.round(geo_current * RISK_PCT.concentration_base * conc_mult);
  var conc_regen   = Math.round(conc_current * 0.15);
  var conc_basis   = suppCnt + ' current supplier' + (suppCnt>1?'s':'') + ' — concentration multiplier ' + conc_mult + 'x on geopolitical risk';

  // 7. Nitrate rejection
  var nit_current  = Math.round(k.nitrate_reject_conv * k.nitrate_cost);
  var nit_regen    = Math.round(k.nitrate_reject_regen * k.nitrate_cost);
  var nit_basis    = Math.round(k.nitrate_reject_conv*100) + '% rejection risk × €' + k.nitrate_cost.toLocaleString() + '/incident for ' + crop.replace('_',' ');

  // 8. Logistics saving (near-shoring benefit)
  var logistics_save = Math.round((RISK_PCT.logistics_savings_per_tonne[d.currentSource]||0) * vol);
  var logistics_basis = '€' + (RISK_PCT.logistics_savings_per_tonne[d.currentSource]||0) + '/t transport saving × ' + vol + 't vs current source';

  var current_total = geo_current + wthr_current + qual_current + pvol_current + csrd_current + conc_current + nit_current;
  var regen_total   = geo_regen   + wthr_regen   + qual_regen   + pvol_regen   + csrd_regen   + conc_regen   + nit_regen;
  var risk_reduction = current_total - regen_total;

  // Processing economics with delivery spec + sector modifiers
  var tare_saving  = k.tare_conv > 0 ? Math.round((k.tare_conv - k.tare_regen) / 100 * price * dm.tare_mult) : 0;
  var dm_value     = Math.round(k.dm_gain / 100 * price * 0.5 * dm.dm_mult * sm.processing_value_mult);
  var defect_save  = Math.round((k.defect_conv - k.defect_regen) / 100 * price * sm.quality_premium);
  var total_proc   = tare_saving + dm_value + defect_save;
  var prem_per_t   = Math.round(price * premium);
  var net_cost_t   = prem_per_t - total_proc;
  var prem_annual  = Math.round(vol * prem_per_t);
  var proc_annual  = Math.round(vol * total_proc);

  // Carbon
  var ha_needed    = Math.round(vol / (k.yield_ha / 1000));
  var carbon_total = Math.round(ha_needed * (CARBON_POTENTIAL[crop] || 40));
  var carbon_share = Math.round(carbon_total * 0.30);

  // Seasonality effect on farm count
  var base_farms   = vol < 200 ? 10 : vol < 500 ? 18 : 30;
  var adj_farms    = Math.round(base_farms * szm.farm_count_mult);

  // Net value
  var net_value = risk_reduction + proc_annual + logistics_save - prem_annual;

  // Feasibility
  var feasibility = Math.min(100, Math.max(10,
    (net_value > 0 ? 70 : 40) +
    (vol < 300 ? 15 : vol < 600 ? 10 : 5) +
    (d.region === 'noord_nederland' ? 10 : d.region === 'no_preference' ? 5 : 0) +
    (d.currentSource !== 'netherlands' ? 5 : 0) +
    (suppCnt > 2 ? -5 : 0)
  ));

  var verdict = net_value > 0 ? 'GO' : (net_value > -prem_annual * 0.2 ? 'CONDITIONAL_GO' : 'NO_GO');

  return {
    verdict, feasibility, net_value,
    risk_reduction, prem_annual, proc_annual, logistics_save,
    current_total, regen_total,
    layers: [
      {layer:'Geopolitical',     current:geo_current,  regen:geo_regen,  reduction:geo_current-geo_regen,  basis:geo_basis},
      {layer:'Weather / yield',  current:wthr_current, regen:wthr_regen, reduction:wthr_current-wthr_regen, basis:wthr_basis},
      {layer:'Quality / recall', current:qual_current, regen:qual_regen, reduction:qual_current-qual_regen,  basis:qual_basis},
      {layer:'Price volatility', current:pvol_current, regen:pvol_regen, reduction:pvol_current-pvol_regen,  basis:pvol_basis},
      {layer:'CSRD / regulatory',current:csrd_current, regen:csrd_regen, reduction:csrd_current-csrd_regen,  basis:csrd_basis},
      {layer:'Supplier conc.',   current:conc_current, regen:conc_regen, reduction:conc_current-conc_regen,  basis:conc_basis},
      {layer:'Nitrate rejection',current:nit_current,  regen:nit_regen,  reduction:nit_current-nit_regen,    basis:nit_basis},
    ],
    logistics: {save:logistics_save, basis:logistics_basis},
    processing: {
      tare_saving_per_tonne:  tare_saving,
      dm_value_per_tonne:     dm_value,
      defect_saving_per_tonne:defect_save,
      total_saving_per_tonne: total_proc,
      premium_cost_per_tonne: prem_per_t,
      net_cost_per_tonne:     net_cost_t,
      processing_saving_annual:proc_annual,
      confidence: PROCESSING_CONF[crop] || 'LOW',
      delivery_spec: dm.label,
      sector_label:  sm.label,
    },
    carbon: {ha_needed, total_potential:carbon_total, buyer_share_30pct:carbon_share},
    market: {
      kwin_conv_price:  k.price_conv,
      kwin_bio_price:   k.price_bio,
      regen_price_est:  Math.round(price * (1+premium)),
      premium_pct:      Math.round(premium*100),
      contract_value:   cv,
      volume:           vol,
      available_farms:  adj_farms + '–' + (adj_farms + 12) + ' farms',
      crop, seasonality: szm.label,
      supplier_count:   suppCnt,
    },
  };
}

// ── SENSITIVITY ANALYSIS ─────────────────────────────────
function buildSensitivity(d) {
  var base = calculate(d);
  var scenarios = [
    {label:'Volume +50%',  change:'volume',   val: parseFloat(d.volume)*1.5},
    {label:'Volume -30%',  change:'volume',   val: parseFloat(d.volume)*0.7},
    {label:'Premium 10%',  change:'premium',  val: 10},
    {label:'Premium 25%',  change:'premium',  val: 25},
    {label:'Spot → contract', change:'currentContract', val:'full_contract'},
  ];
  return scenarios.map(function(s) {
    var mod = JSON.parse(JSON.stringify(d));
    mod[s.change] = s.val;
    var c = calculate(mod);
    return {label:s.label, net_value:c.net_value, verdict:c.verdict, delta:c.net_value - base.net_value};
  });
}

// ── NARRATIVE PROMPT ─────────────────────────────────────
function buildNarrativePrompt(d, calc, liveContext) {
  var f = function(n) { return '€' + Math.round(n).toLocaleString(); };
  var c = calc;
  var crops = {green_beans:'green beans (sperziebonen)',wheat:'wintertarwe',potatoes:'potatoes',onions:'onions',lentils:'lentils',oats:'oats',peas:'peas',carrots:'carrots'};

  return 'You are a supply chain analyst for Orbag. Write a buyer businesscase narrative using ONLY these pre-calculated numbers. Return pure JSON, no markdown.\n\n'
    + 'BUYER: ' + d.company + ' (' + d.sector + '), crop: ' + (crops[d.crop]||d.crop) + ', ' + d.volume + 't/yr\n'
    + 'DELIVERY: ' + c.processing.delivery_spec + ' | SEASONALITY: ' + c.market.seasonality + ' | SUPPLIERS: ' + c.market.supplier_count + '\n'
    + 'VERDICT: ' + c.verdict + ' | Net value: ' + f(c.net_value) + '/yr | Feasibility: ' + c.feasibility + '/100\n'
    + 'RISK: current ' + f(c.current_total) + '/yr → regen ' + f(c.regen_total) + '/yr | reduction: ' + f(c.risk_reduction) + '/yr\n'
    + 'LOGISTICS SAVING (near-shoring): ' + f(c.logistics.save) + '/yr\n'
    + 'PREMIUM COST: ' + f(c.prem_annual) + '/yr | PROCESSING SAVING: ' + f(c.proc_annual) + '/yr\n'
    + 'PROCESSING: tare ' + f(c.processing.tare_saving_per_tonne) + '/t, DM ' + f(c.processing.dm_value_per_tonne) + '/t, defect ' + f(c.processing.defect_saving_per_tonne) + '/t (' + c.processing.confidence + ' conf.)\n'
    + 'CARBON: ' + f(c.carbon.buyer_share_30pct) + '/yr buyer share on ' + c.carbon.ha_needed + ' ha\n'
    + 'KWIN: conventional ' + f(c.market.kwin_conv_price) + '/t, regen est. ' + f(c.market.regen_price_est) + '/t\n'
    + (liveContext || '') + '\n'
    + 'Buyer context: ' + (d.concerns || 'none') + '\n\n'
    + 'Write concise, CFO-level analysis. Return JSON:\n'
    + '{"verdict_reason":"one sentence citing net value",'
    + '"supply_analysis":"2-3 sentences on regional supply capacity, farm availability, seasonality fit",'
    + '"pricing_analysis":"2-3 sentences on KWIN price, regen estimate, whether premium tolerance is sufficient",'
    + '"processing_insight":"2-3 sentences on tare/DM/defect advantage for ' + c.processing.sector_label + ' using ' + c.processing.delivery_spec + '. State net cost per unit finished product.",'
    + '"logistics_note":"1-2 sentences on near-shoring logistics saving and transport risk reduction",'
    + '"carbon_note":"1-2 sentences on carbon credit structure and buyer share",'
    + '"nitrate_note":"1 sentence on nitrate rejection risk reduction for this crop",'
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
      {headers: {apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey}}
    );
    if (!res.ok) return '';
    var rows = await res.json();
    var cropLC = (crop||'').toLowerCase();
    var relevant = rows.filter(function(r) {
      return (r.crop||'').toLowerCase().includes(cropLC) || cropLC.includes((r.crop||'').split(',')[0]);
    }).slice(0, 3);
    if (!relevant.length) return '';
    var lines = relevant.map(function(r) {
      var k = (r.report_data && r.report_data.kpis) || {};
      return '- Farm ' + (r.region||'NL') + ': regen ' + (k.regen_income_ha||'?') + '/ha, verdict: ' + ((r.report_data&&r.report_data.verdict)||'?');
    }).join('\n');
    return 'LIVE FARMER DATA:\n' + lines;
  } catch(e) { return ''; }
}

// ── HANDLER ──────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});

  try {
    var d = req.body;

    // Step 1: JS calculation — instant
    var calc = calculate(d);
    var sensitivity = buildSensitivity(d);
    console.log('calc verdict:', calc.verdict, 'net_value:', calc.net_value);

    // Step 2: live farmer context
    var liveContext = await getLiveContext(d.crop, process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    // Step 3: AI writes narrative only — lean prompt, fast
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
        messages: [{role:'user', content: buildNarrativePrompt(d, calc, liveContext)}],
      }),
    });

    if (!anthropicRes.ok) {
      var err = await anthropicRes.json().catch(function(){return{};});
      return res.status(500).json({error: (err.error&&err.error.message)||'Anthropic error '+anthropicRes.status});
    }

    var anthropicData = await anthropicRes.json();
    var text = anthropicData.content.map(function(b){return b.type==='text'?b.text:'';}).join('');
    console.log('narrative stop_reason:', anthropicData.stop_reason, 'len:', text.length);

    text = text.replace(/```json\n?|```\n?/g,'').trim();
    var jm = text.match(/\{[\s\S]*\}/);
    if (!jm) return res.status(500).json({error:'AI did not return JSON. Please try again.'});

    var nar;
    try { nar = JSON.parse(jm[0]); }
    catch(e) { return res.status(500).json({error:'Could not parse response. Please try again.'}); }

    // Assemble final report
    var report = {
      verdict: calc.verdict,
      verdict_reason: nar.verdict_reason,
      kpis: {
        feasibility_score: calc.feasibility,
        price_range: '€' + calc.market.kwin_conv_price + '–' + calc.market.regen_price_est + '/t',
        available_farms: calc.market.available_farms,
        supply_reliability: calc.feasibility > 70 ? 'High' : calc.feasibility > 50 ? 'Medium' : 'Low',
        regen_premium: '€' + calc.processing.premium_cost_per_tonne + '/t (+' + calc.market.premium_pct + '%)',
        payback_context: calc.processing.net_cost_per_tonne <= 0 ? 'net cheaper per unit finished product' : 'offset by risk + logistics saving',
      },
      risk_analysis: {
        current_total_exposure: '€' + Math.round(calc.current_total).toLocaleString() + '/yr',
        residual_exposure_regen: '€' + Math.round(calc.regen_total).toLocaleString() + '/yr',
        risk_reduction_value: '€' + Math.round(calc.risk_reduction).toLocaleString() + '/yr',
        premium_cost: '€' + Math.round(calc.prem_annual).toLocaleString() + '/yr',
        net_value: '€' + Math.round(calc.net_value).toLocaleString() + '/yr',
        layers: calc.layers.map(function(l){
          return {layer:l.layer, current:'€'+l.current.toLocaleString(), regen:'€'+l.regen.toLocaleString(), reduction:'€'+l.reduction.toLocaleString(), basis:l.basis};
        }),
        logistics_saving: '€' + calc.logistics.save.toLocaleString() + '/yr',
        logistics_basis: calc.logistics.basis,
      },
      processing_economics: {
        tare_saving_per_tonne: '€' + calc.processing.tare_saving_per_tonne + '/t',
        dm_value_per_tonne: '€' + calc.processing.dm_value_per_tonne + '/t',
        defect_saving_per_tonne: '€' + calc.processing.defect_saving_per_tonne + '/t',
        total_saving_per_tonne: '€' + calc.processing.total_saving_per_tonne + '/t',
        net_cost_vs_conventional: calc.processing.net_cost_per_tonne <= 0
          ? '€' + Math.abs(calc.processing.net_cost_per_tonne) + '/t cheaper net'
          : '€' + calc.processing.net_cost_per_tonne + '/t more expensive net',
        annual_impact: (calc.proc_annual - calc.prem_annual) >= 0
          ? '+€' + Math.round(calc.proc_annual - calc.prem_annual).toLocaleString() + '/yr net saving'
          : '-€' + Math.abs(Math.round(calc.proc_annual - calc.prem_annual)).toLocaleString() + '/yr net cost',
        confidence: calc.processing.confidence,
        delivery_spec: calc.processing.delivery_spec,
        caveat: nar.processing_insight || '',
      },
      carbon_upside: {
        ha_needed: calc.carbon.ha_needed,
        total_farm_potential: '€' + calc.carbon.total_potential.toLocaleString() + '/yr',
        buyer_share: '€' + calc.carbon.buyer_share_30pct.toLocaleString() + '/yr',
        note: nar.carbon_note || '',
      },
      sensitivity: sensitivity,
      supply_analysis: nar.supply_analysis,
      pricing_analysis: nar.pricing_analysis,
      logistics_note: nar.logistics_note,
      nitrate_note: nar.nitrate_note,
      scenarios: nar.scenarios,
      next_steps: nar.next_steps,
      orbag_note: nar.orbag_note,
    };

    // Save to Supabase
    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      await fetch(process.env.SUPABASE_URL + '/rest/v1/reports', {
        method:'POST',
        headers:{'Content-Type':'application/json','apikey':process.env.SUPABASE_KEY,'Authorization':'Bearer '+process.env.SUPABASE_KEY,'Prefer':'return=minimal'},
        body: JSON.stringify({
          company:d.company, sector:d.sector, crop:d.crop, region:d.region,
          volume:Number(d.volume), current_price:Number(d.currentPrice),
          premium:Number(d.premium), verdict:report.verdict,
          feasibility:report.kpis.feasibility_score,
          price_range:report.kpis.price_range,
          input_data:d, report_data:report,
          created_at:new Date().toISOString(),
        }),
      });
    }

    return res.status(200).json(report);
  } catch(err) {
    console.error('Error:', err.message);
    return res.status(500).json({error:err.message});
  }
};
