const KWIN = `KWIN-AGV 2024 (WUR/BIJ12):
tarwe Noord-NL: 9.100kg/ha, €230/t gangbaar, €340/t bio, kosten €1.400/ha
sperziebonen NL industrie: 8-12t/ha, €280-380/t, kosten €2.100/ha
pootaardappelen Noord-NL: 34.500kg/ha, €310/t, kosten €4.000/ha
consumptieaardappelen Noord-NL: 49.500kg/ha, €170/t volatiel, kosten €3.300/ha
haver: 5.200kg/ha, €210/t gangbaar, €320/t bio
erwten Noord-NL: 4-5.5t/ha, €350-500/t gangbaar, €600-800/t regen
suikerbieten Noord-NL: 80t/ha, €45/t vast
regen premium retail: 10-25% boven gangbaar
carbon credits akkerbouw NL: €30-80/ha`;

const RISK = `RISICO KWANTIFICERING:
Geopolitiek (% contractwaarde/jaar): Marokko/Egypte 12-18%, Turkije/Spanje 6-10%, NL 1-3%, mixed EU 3-6%
Weer yield variance: Marokko 25-40%, conv NL 15-25%, regen NL 8-15%
Prijsvolatiliteit: spot 30-50% swing, mixed 15-25%, full contract regen 5-10%
Recall kosten voedsel: €50k-500k per incident, regen traceability vermindert kans met 60-80%
CSRD compliance gap: €50k-200k als geen data bij verplichting 2025, €30k-120k bij 2026`;


const PROCESSING_DATA = {
  green_beans: {conf:'HIGH', tare_conv:18, tare_regen:13, dm_gain:10, defect_conv:8, defect_regen:4, yield_gain:8, source:'NCBI 2023 organic bean DMC +12%', caveat:'Strong evidence — lower nitrate = less water uptake = lower tare'},
  peas:        {conf:'HIGH', tare_conv:12, tare_regen:9,  dm_gain:9,  defect_conv:7, defect_regen:3, yield_gain:8, source:'NCBI — legumes consistent DMC and protein gains', caveat:'Legumes benefit most from regen rotation due to nitrogen fixation'},
  lentils:     {conf:'HIGH', tare_conv:12, tare_regen:9,  dm_gain:9,  defect_conv:7, defect_regen:3, yield_gain:8, source:'NCBI — legumes consistent DMC gains', caveat:'Same mechanism as peas — strong evidence'},
  wheat:       {conf:'HIGH', tare_conv:0,  tare_regen:0,  dm_gain:7,  defect_conv:5, defect_regen:2, yield_gain:5, source:'Regen wheat 58% more selenium 27% more zinc', caveat:'Tare N/A for grain. Higher protein = better milling yield'},
  oats:        {conf:'MED',  tare_conv:0,  tare_regen:0,  dm_gain:6,  defect_conv:4, defect_regen:2, yield_gain:5, source:'General grain regen research', caveat:'Moderate evidence — same mechanism as wheat'},
  carrots:     {conf:'LOW',  tare_conv:15, tare_regen:13, dm_gain:3,  defect_conv:10,defect_regen:6, yield_gain:4, source:'Felix Instruments 2019 — carrots exception for DMC', caveat:'Low confidence for DMC. Lead with risk reduction not processing yield'},
  potatoes:    {conf:'LOW',  tare_conv:12, tare_regen:11, dm_gain:2,  defect_conv:7, defect_regen:5, yield_gain:3, source:'ResearchGate 2019 — conventional potatoes often higher DMC', caveat:'Do NOT use processing yield for potatoes. Use risk reduction argument'},
  onions:      {conf:'LOW',  tare_conv:10, tare_regen:8,  dm_gain:3,  defect_conv:8, defect_regen:5, yield_gain:4, source:'Nature 2022 — no general DMC trend for Allium', caveat:'Uncertain for onions. Lead with supply security and CSRD'},
};

function getProcessingContext(crop, sector, currentPrice, volume) {
  if (sector !== 'food_processor' && sector !== 'retailer') return '';
  var p = PROCESSING_DATA[crop];
  if (!p) return '';
  var price = parseFloat(currentPrice) || 300;
  var vol = parseFloat(volume) || 100;
  var tareSaving = p.tare_conv > 0 ? ((p.tare_conv - p.tare_regen) / 100 * price).toFixed(0) : '0';
  var dmValue = (p.dm_gain / 100 * price * 0.5).toFixed(0);
  var defectSaving = ((p.defect_conv - p.defect_regen) / 100 * price).toFixed(0);
  var totalSaving = (parseFloat(tareSaving) + parseFloat(dmValue) + parseFloat(defectSaving)).toFixed(0);
  return 'PROCESSING ECONOMICS FOR THIS CROP (' + p.conf + ' confidence, source: ' + p.source + '):\n'
    + '- Tare: conventional ' + p.tare_conv + '% → regen ' + p.tare_regen + '% = saving €' + tareSaving + '/t\n'
    + '- Dry matter gain: +' + p.dm_gain + '% = value €' + dmValue + '/t\n'
    + '- Defect/rejection: ' + p.defect_conv + '% → ' + p.defect_regen + '% = saving €' + defectSaving + '/t\n'
    + '- Total processing saving: €' + totalSaving + '/t (offsets regen premium)\n'
    + '- Caveat: ' + p.caveat + '\n'
    + 'Calculate net_cost_vs_conventional = (current_price * premium%) - ' + totalSaving + '. If negative = regen is cheaper per unit of finished product.\n';
}

async function getLiveContext(crop, supabaseUrl, supabaseKey) {
  if (!supabaseUrl || !supabaseKey) return '';
  try {
    const res = await fetch(
      supabaseUrl + '/rest/v1/reports?select=company,sector,crop,region,current_price,report_data,created_at&sector=eq.farmer&order=created_at.desc&limit=5',
      { headers: { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey } }
    );
    if (!res.ok) return '';
    const rows = await res.json();
    const cropLC = (crop || '').toLowerCase();
    const relevant = rows.filter(function(r) {
      const rc = (r.crop || '').toLowerCase();
      return rc.includes(cropLC) || cropLC.includes(rc.split(',')[0]);
    }).slice(0, 3);
    if (!relevant.length) return '';
    const lines = relevant.map(function(r) {
      const k = (r.report_data && r.report_data.kpis) || {};
      return '- Farm in ' + (r.region || 'NL') + ': regen income ' + (k.regen_income_ha || 'unknown') + '/ha, verdict: ' + ((r.report_data && r.report_data.verdict) || 'unknown');
    }).join('\n');
    return '\nLIVE FARMER SUPPLY DATA (Orbag database):\n' + lines + '\nUse to calibrate supply feasibility.';
  } catch(e) { return ''; }
}

function buildPrompt(d, liveContext) {
  var crops = {green_beans:'sperziebonen',wheat:'wintertarwe',potatoes:'consumptieaardappelen',onions:'uien',lentils:'erwten',oats:'haver',peas:'erwten',carrots:'wortelen'};
  var sources = {morocco_egypt:'Marokko/Egypte',turkey_spain:'Turkije/Spanje',netherlands:'Nederland',mixed_eu:'gemengd EU',mixed_global:'gemengd globaal'};
  var contracts = {mostly_spot:'voornamelijk spot (>60%)',mixed:'gemengd spot/contract',mostly_contract:'voornamelijk contract',full_contract:'volledig contract'};
  var csrds = {mandatory_2025:'verplicht 2025',mandatory_2026:'verplicht 2026',voluntary:'vrijwillig',not_yet:'nog niet'};
  var incidents = {none:'geen',minor:'klein',moderate:'matig',major:'groot'};
  var cv = (d.volume || 100) * (d.currentPrice || 300);

  return 'You are an agricultural supply chain risk analyst for Orbag. Use ONLY the data below. Return pure JSON, no markdown.\n\n'
    + KWIN + '\n\n' + RISK + '\n'
    + (liveContext || '') + '\n'
    + 'INPUT:\n'
    + 'company: ' + d.company + ', sector: ' + d.sector + ', crop: ' + (crops[d.crop] || d.crop) + '\n'
    + 'volume: ' + d.volume + 't/yr, target region: ' + d.region + ', current price: €' + d.currentPrice + '/t\n'
    + 'contract value: €' + cv.toLocaleString() + ', regen premium max: ' + d.premium + '%\n'
    + 'current source: ' + (sources[d.currentSource] || 'unknown') + ', contract structure: ' + (contracts[d.currentContract] || 'unknown') + '\n'
    + 'CSRD obligation: ' + (csrds[d.csrd] || 'unknown') + ', incidents: ' + (incidents[d.incidents] || 'none') + '\n'
    + 'context: ' + (d.concerns || 'none') + '\n'+ getProcessingContext(d.crop, d.sector, d.currentPrice, d.volume) + '\n'
    + 'Calculate annual risk exposure for each layer. Net value = risk reduction - premium cost.\n'
    + 'If net value positive: GO. Within 20%: CONDITIONAL_GO. Negative: NO_GO.\n\n'
    + 'Return this JSON exactly:\n'
    + '{"verdict":"GO","verdict_reason":"one sentence with euro figures",'
    + '"kpis":{"feasibility_score":75,"price_range":"€X-Y/t","available_farms":"X-Y farms","supply_reliability":"Medium","regen_premium":"€X/t (+Y%)","payback_context":"short phrase"},'
    + '"risk_analysis":{"current_total_exposure":"€X.XXX/yr","residual_exposure_regen":"€X.XXX/yr","risk_reduction_value":"€X.XXX/yr","premium_cost":"€X.XXX/yr","net_value":"€X.XXX/yr",'
    + '"layers":[{"layer":"Geopolitical","current":"€X.XXX","regen":"€X.XXX","reduction":"€X.XXX","basis":"note"},{"layer":"Weather","current":"€X.XXX","regen":"€X.XXX","reduction":"€X.XXX","basis":"note"},{"layer":"Quality","current":"€X.XXX","regen":"€X.XXX","reduction":"€X.XXX","basis":"note"},{"layer":"Price volatility","current":"€X.XXX","regen":"€X.XXX","reduction":"€X.XXX","basis":"note"},{"layer":"CSRD","current":"€X.XXX","regen":"€X.XXX","reduction":"€X.XXX","basis":"note"}]},'
    + '"supply_analysis":"2-3 sentences with KWIN figures",'
    + '"pricing_analysis":"2-3 sentences with exact KWIN price",'
    + '"scenarios":{"optimistic":{"volume_pct":"X%","price":"€X/t","note":"condition"},"base":{"volume_pct":"X%","price":"€X/t","note":"condition"},"pessimistic":{"volume_pct":"X%","price":"€X/t","note":"condition"}},'
    + '"next_steps":["step 1","step 2","step 3","step 4"],'
    + '"orbag_note":"one sentence"}';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    var d = req.body;
    var liveContext = await getLiveContext(d.crop, process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    var anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1800,
        messages: [{ role: 'user', content: buildPrompt(d, liveContext) }],
      }),
    });

    if (!anthropicRes.ok) {
      var err = await anthropicRes.json().catch(function() { return {}; });
      return res.status(500).json({ error: (err.error && err.error.message) || ('Anthropic error ' + anthropicRes.status) });
    }

    var anthropicData = await anthropicRes.json();
    var text = anthropicData.content.map(function(b) { return b.type === 'text' ? b.text : ''; }).join('');
    console.log('stop_reason:', anthropicData.stop_reason, 'length:', text.length);
    if (anthropicData.stop_reason === 'max_tokens') return res.status(500).json({ error: 'Response too long. Please try again.' });

    text = text.replace(/```json\n?|```\n?/g, '').trim();
    var jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'AI did not return valid JSON. Please try again.' });

    var report;
    try { report = JSON.parse(jsonMatch[0]); }
    catch(e) { return res.status(500).json({ error: 'Could not parse response. Please try again.' }); }

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
          feasibility: report.kpis && report.kpis.feasibility_score,
          price_range: report.kpis && report.kpis.price_range,
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
