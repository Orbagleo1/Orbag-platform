const config = { maxDuration: 60 };
module.exports.config = config;

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
Inputkostenreductie regen vs gangbaar: kunstmest -40-60% (€180-270/ha besparing), gewasbescherming -30-50% (€60-150/ha)
Regen premium boven gangbaar: granen +15-25%, peulvruchten +40-80%, groenten +15-25%
Carbon credits akkerbouw NL: €30-80/ha/jaar potentieel (markt in ontwikkeling)
Transitiekosten jaar 1-2: €150-300/ha eenmalig (certificering, omschakeling, kennis)
Opbrengstverlies jaar 1-2: 5-15% lager tijdens transitie
Volledig regen inkomen bereikt: jaar 3-4 gemiddeld
On the Way to PlanetProof: bekendste NL regen certificering, €20-50/ha kosten`;

async function getLiveBuyerContext(crops, region, supabaseUrl, supabaseKey) {
  if (!supabaseUrl || !supabaseKey) return '';
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/reports?select=company,crop,region,current_price,report_data,created_at&sector=neq.farmer&order=created_at.desc&limit=8`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    if (!res.ok) return '';
    const rows = await res.json();
    const cropList = (crops||[]).join(' ').toLowerCase();
    const relevant = rows.filter(r => {
      const rc = (r.crop||'').toLowerCase();
      return cropList.includes(rc) || rc.includes('tarwe') || rc.includes('aardappel') ||
        (r.report_data?.input?.crop && cropList.includes(r.report_data.input.crop));
    }).slice(0, 3);
    if (!relevant.length) return '';
    const lines = relevant.map(r => {
      const k = r.report_data?.kpis || {};
      const v = r.report_data?.verdict || 'unknown';
      return `- ${r.company||'Buyer'} (${r.region||'NL'}): wants ${r.report_data?.input?.volume||'?'}t, price range ${k.price_range||r.current_price+'€/t'}, verdict: ${v}`;
    }).join('\n');
    return `
LIVE BUYER DEMAND DATA (from Orbag database, most recent):
${lines}
Use this to calibrate premium revenue potential and buyer availability for this farmer.`;
  } catch(e) { return ''; }
}

function buildPrompt(d, liveContext="") {
  const regions = {
    groningen:'Groningen kleigrond',friesland:'Friesland kleigrond',
    drenthe:'Drenthe zand/dalgrond',flevoland:'Flevoland IJsselmeerpolders',
    zeeland:'Zeeland zware klei',brabant:'Noord-Brabant zandgrond',
    other_nl:'Nederland'
  };
  const ambitions = {
    partial:'gedeeltelijk (20-40% van land)',majority:'meerderheid (50-70%)',
    full:'volledig bedrijf',exploring:'nog aan het verkennen'
  };
  const concerns = {
    income_drop:'inkomensdaling tijdens transitie',
    finding_buyers:'afnemers vinden die regen premie betalen',
    knowledge:'gebrek aan kennis / begeleiding',
    certification:'certificeringskosten en -complexiteit',
    soil_risk:'risico lagere opbrengsten eerste jaren'
  };

  const totalCurrentIncome = d.totalHa * d.currentIncome;

  return `You are an agricultural economist for Orbag, a Dutch regenerative farming platform. Use ONLY the data below. Return pure JSON, no markdown.

${KWIN}

FARMER INPUT:
farm: ${d.farmName}, region: ${regions[d.farmRegion]||d.farmRegion}
soil: ${d.soilType}, size: ${d.totalHa} ha
crops: ${(d.crops||[]).join(', ')||'not specified'}
current net income: €${d.currentIncome}/ha/yr (total €${totalCurrentIncome.toLocaleString()}/yr)
fertiliser cost: €${d.fertCost}/ha/yr
current certification: ${d.currentCert}
years on land: ${d.yearsOnLand}
transition ambition: ${ambitions[d.ambition]||d.ambition}
biggest concern: ${concerns[d.concern]||d.concern}
max income drop tolerance: €${d.incomeDrop}/ha/yr
target payback: ${d.payback} years
context: ${d.context||'none'}
${liveContext}

Calculate transition economics using KWIN data. If GO: regen income exceeds current within payback target and income drop stays within tolerance. CONDITIONAL_GO: viable but concern needs addressing. NO_GO: economics don't work within stated constraints.

Return ONLY this JSON:
{
"verdict":"GO"|"CONDITIONAL_GO"|"NO_GO",
"verdict_reason":"one sentence with specific euro figures",
"kpis":{
"current_income_ha":"€XXX",
"regen_income_ha":"€XXX",
"input_saving_ha":"€XXX/ha",
"transition_years":"X-Y years",
"payback_period":"X-Y years",
"carbon_potential_ha":"€XX-XX/ha"
},
"income_analysis":"3 sentences. Use KWIN figures for specific crops. State total farm income current vs regen at full transition. Reference regional crop suitability.",
"input_analysis":"2-3 sentences. Calculate actual fertiliser saving based on €${d.fertCost}/ha input. Add crop protection saving. State total input cost reduction per hectare and for whole farm.",
"scenarios":{
"optimistic":{"net_income_ha":"€XXX/ha","timeline":"year X","note":"condition for optimistic outcome"},
"base":{"net_income_ha":"€XXX/ha","timeline":"year X-Y","note":"most likely condition"},
"pessimistic":{"net_income_ha":"€XXX/ha","timeline":"year X+","note":"worst case condition"}
},
"crop_recommendations":[
"Crop 1 — specific reason why good regen choice for this farm with price premium",
"Crop 2",
"Crop 3"
],
"next_steps":[
"Step 1 — specific and actionable for this farm",
"Step 2",
"Step 3",
"Step 4"
],
"orbag_note":"One sentence: what Orbag does next — buyer matching, cultivation plan, certification guidance."
}`;
}

module.exports.default = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const d = req.body;
    const liveContext = await getLiveBuyerContext(d.crops, d.farmRegion, process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    console.log('farmer live context length:', liveContext.length);
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content: buildPrompt(d, liveContext) }],
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.json().catch(() => ({}));
      return res.status(500).json({ error: err.error?.message || `Anthropic error ${anthropicRes.status}` });
    }

    const data = await anthropicRes.json();
    let text = data.content.map(b => b.type === 'text' ? b.text : '').join('');
    console.log('farmer stop_reason:', data.stop_reason, 'length:', text.length);

    text = text.replace(/```json\n?|```\n?/g, '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'AI did not return valid JSON. Please try again.' });

    let report;
    try { report = JSON.parse(jsonMatch[0]); }
    catch(e) { return res.status(500).json({ error: 'Could not parse response. Please try again.' }); }

    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          company: d.farmName, sector: 'farmer', crop: (d.crops||[]).join(','),
          region: d.farmRegion, volume: d.totalHa,
          current_price: d.currentIncome, premium: 0,
          verdict: report.verdict, feasibility: null,
          price_range: report.kpis?.regen_income_ha,
          input_data: d, report_data: report,
          created_at: new Date().toISOString(),
        }),
      });
    }

    return res.status(200).json(report);
  } catch (err) {
    console.error('Farmer error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
