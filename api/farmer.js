const KWIN = `KWIN-AGV 2024 (WUR/BIJ12) farmer benchmarks:
wintertarwe Noord-NL klei: opbrengst 9.100-9.400kg/ha, prijs €230/t gangbaar €340/t bio, kosten €1.400/ha, saldo €500-700/ha
pootaardappelen Noord-NL: opbrengst 34.500kg/ha, prijs €310/t, kosten €4.000/ha
consumptieaardappelen: opbrengst 49.500kg/ha, prijs €170/t volatiel, kosten €3.300/ha
suikerbieten Noord-NL: opbrengst 80.000kg/ha, prijs €45/t, kosten €2.500/ha, saldo stabiel €1.100/ha
haver: opbrengst 5.200kg/ha, prijs €210/t gangbaar €320/t bio, kosten €950/ha
erwten/peulvruchten: opbrengst 4.000-5.500kg/ha, prijs €400-500/t gangbaar €700/t regen, kosten €1.000/ha
sperziebonen: opbrengst 8-12t/ha, contractprijs €300-380/t, kosten €2.100/ha
uien: opbrengst 55.000-70.000kg/ha, prijs €100-180/t volatiel

REGEN TRANSITIE ECONOMIE:
Inputkostenreductie: kunstmest -40-60% (€180-270/ha besparing), gewasbescherming -30-50% (€60-150/ha)
Regen premium boven gangbaar: granen +15-25%, peulvruchten +40-80%, groenten +15-25%
Carbon credits akkerbouw NL: €30-80/ha/jaar potentieel
Transitiekosten jaar 1-2: €150-300/ha eenmalig
Opbrengstverlies jaar 1-2: 5-15% lager tijdens transitie
Volledig regen inkomen bereikt: jaar 3-4 gemiddeld`;

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
    var relevant = rows.filter(function(r) {
      var rc = (r.crop || '').toLowerCase();
      return cropList.includes(rc) || rc.includes('tarwe') || rc.includes('aardappel');
    }).slice(0, 3);
    if (!relevant.length) return '';
    var lines = relevant.map(function(r) {
      var k = (r.report_data && r.report_data.kpis) || {};
      var v = (r.report_data && r.report_data.verdict) || 'unknown';
      var vol = r.report_data && r.report_data.input && r.report_data.input.volume;
      return '- ' + (r.company || 'Buyer') + ' (' + (r.region || 'NL') + '): wants ' + (vol || '?') + 't, price range ' + (k.price_range || r.current_price + '€/t') + ', verdict: ' + v;
    }).join('\n');
    return '\nLIVE BUYER DEMAND DATA (Orbag database):\n' + lines + '\nUse to calibrate premium revenue potential and buyer availability.';
  } catch(e) { return ''; }
}

function buildPrompt(d, liveContext) {
  var regions = {groningen:'Groningen kleigrond',friesland:'Friesland kleigrond',drenthe:'Drenthe zand/dalgrond',flevoland:'Flevoland IJsselmeerpolders',zeeland:'Zeeland zware klei',brabant:'Noord-Brabant zandgrond',other_nl:'Nederland'};
  var ambitions = {partial:'gedeeltelijk (20-40%)',majority:'meerderheid (50-70%)',full:'volledig bedrijf',exploring:'nog verkennen'};
  var concerns = {income_drop:'inkomensdaling transitie',finding_buyers:'afnemers vinden',knowledge:'gebrek kennis',certification:'certificeringskosten',soil_risk:'opbrengstrisico eerste jaren'};
  var totalIncome = (d.totalHa || 85) * (d.currentIncome || 800);

  return 'You are an agricultural economist for Orbag. Use ONLY the data below. Return pure JSON, no markdown.\n\n'
    + KWIN + '\n'
    + (liveContext || '') + '\n'
    + 'FARMER INPUT:\n'
    + 'farm: ' + d.farmName + ', region: ' + (regions[d.farmRegion] || d.farmRegion) + '\n'
    + 'soil: ' + d.soilType + ', size: ' + d.totalHa + ' ha\n'
    + 'crops: ' + (d.crops || []).join(', ') + '\n'
    + 'current net income: €' + d.currentIncome + '/ha/yr (total €' + totalIncome.toLocaleString() + '/yr)\n'
    + 'fertiliser cost: €' + d.fertCost + '/ha/yr\n'
    + 'current certification: ' + d.currentCert + '\n'
    + 'transition ambition: ' + (ambitions[d.ambition] || d.ambition) + '\n'
    + 'biggest concern: ' + (concerns[d.concern] || d.concern) + '\n'
    + 'max income drop tolerance: €' + d.incomeDrop + '/ha/yr\n'
    + 'target payback: ' + d.payback + ' years\n'
    + 'context: ' + (d.context || 'none') + '\n\n'
    + 'Calculate transition economics. GO: regen income exceeds current within payback and income drop within tolerance. CONDITIONAL_GO: viable with conditions. NO_GO: economics do not work.\n\n'
    + 'Return this JSON:\n'
    + '{"verdict":"GO","verdict_reason":"one sentence with euro figures",'
    + '"kpis":{"current_income_ha":"€XXX","regen_income_ha":"€XXX","input_saving_ha":"€XXX/ha","transition_years":"X-Y years","payback_period":"X-Y years","carbon_potential_ha":"€XX-XX/ha"},'
    + '"income_analysis":"3 sentences using KWIN figures for specific crops",'
    + '"input_analysis":"2-3 sentences calculating actual savings based on fertiliser input",'
    + '"scenarios":{"optimistic":{"net_income_ha":"€XXX/ha","timeline":"year X","note":"condition"},"base":{"net_income_ha":"€XXX/ha","timeline":"year X-Y","note":"condition"},"pessimistic":{"net_income_ha":"€XXX/ha","timeline":"year X+","note":"condition"}},'
    + '"crop_recommendations":["Crop 1 — reason with price premium","Crop 2","Crop 3"],'
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
    var liveContext = await getLiveBuyerContext(d.crops, process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    var anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: buildPrompt(d, liveContext) }],
      }),
    });

    if (!anthropicRes.ok) {
      var err = await anthropicRes.json().catch(function() { return {}; });
      return res.status(500).json({ error: (err.error && err.error.message) || ('Anthropic error ' + anthropicRes.status) });
    }

    var anthropicData = await anthropicRes.json();
    var text = anthropicData.content.map(function(b) { return b.type === 'text' ? b.text : ''; }).join('');
    console.log('farmer stop_reason:', anthropicData.stop_reason, 'length:', text.length);

    text = text.replace(/```json\n?|```\n?/g, '').trim();
    var jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'AI did not return valid JSON. Please try again.' });

    var report;
    try { report = JSON.parse(jsonMatch[0]); }
    catch(e) { return res.status(500).json({ error: 'Could not parse response. Please try again.' }); }

    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      // Persist via the bounded save_report RPC — the anon key cannot insert into reports directly.
      await fetch(process.env.SUPABASE_URL + '/rest/v1/rpc/save_report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_KEY,
          'Authorization': 'Bearer ' + process.env.SUPABASE_KEY,
        },
        body: JSON.stringify({ p: {
          company: d.farmName, sector: 'farmer',
          crop: (d.crops || []).join(','),
          region: d.farmRegion, volume: d.totalHa,
          current_price: d.currentIncome, premium: 0,
          verdict: report.verdict, feasibility: null,
          price_range: report.kpis && report.kpis.regen_income_ha,
          input_data: d, report_data: report,
          created_at: new Date().toISOString(),
        }}),
      });
      // Save to farmer_bcs for match engine
      if (d.user_id) {
        await fetch(process.env.SUPABASE_URL + '/rest/v1/rpc/save_farmer_bc', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_KEY,
            'Authorization': 'Bearer ' + process.env.SUPABASE_KEY,
          },
          body: JSON.stringify({ p: {
            user_id: d.user_id,
            farm_name: d.farmName,
            region: d.farmRegion,
            hectares: Number(d.totalHa),
            soil_type: d.soilType,
            crops: d.crops || [],
            net_value: null,
            verdict: report.verdict,
          }}),
        });
      }
    }

    return res.status(200).json(report);
  } catch(err) {
    console.error('Farmer error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
