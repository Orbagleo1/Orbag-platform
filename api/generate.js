export const config = { maxDuration: 60 };

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

async function getLiveMarketContext(crop, region, supabaseUrl, supabaseKey) {
  if (!supabaseUrl || !supabaseKey) return '';
  try {
    const cropMap = {green_beans:'sperziebonen',wheat:'wintertarwe',potatoes:'aardappelen',onions:'uien',lentils:'erwten',oats:'haver',peas:'erwten',carrots:'wortelen'};
    const cropNL = cropMap[crop] || crop;
    const res = await fetch(
      `${supabaseUrl}/rest/v1/reports?select=company,sector,crop,region,current_price,report_data,created_at&sector=eq.farmer&order=created_at.desc&limit=5`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    if (!res.ok) return '';
    const rows = await res.json();
    const relevant = rows.filter(r => {
      const crops = Array.isArray(r.report_data?.input?.crops)
        ? r.report_data.input?.crops.join(',').toLowerCase()
        : (r.crop||'').toLowerCase();
      return crops.includes(cropNL.toLowerCase()) || crops.includes(crop.toLowerCase());
    }).slice(0, 3);
    if (!relevant.length) return '';
    const lines = relevant.map(r => {
      const k = r.report_data?.kpis || {};
      return `- Farm in ${r.region||'NL'}: regen income ${k.regen_income_ha||'unknown'}/ha, transition ${k.transition_years||'unknown'}, verdict: ${r.report_data?.verdict||'unknown'}`;
    }).join('
');
    return `
LIVE FARMER DATA FOR ${cropNL.toUpperCase()} (from Orbag database, most recent first):
${lines}
Use this to calibrate supply feasibility and pricing for this crop.`;
  } catch(e) { return ''; }
}

function buildPrompt(d, liveContext="") {
  const crops = {green_beans:'sperziebonen',wheat:'wintertarwe',potatoes:'consumptieaardappelen',onions:'uien',lentils:'erwten',oats:'haver',peas:'erwten',carrots:'wortelen'};
  const sources = {morocco_egypt:'Marokko/Egypte',turkey_spain:'Turkije/Spanje',netherlands:'Nederland',mixed_eu:'gemengd EU',mixed_global:'gemengd globaal'};
  const contracts = {mostly_spot:'voornamelijk spot (>60%)',mixed:'gemengd spot/contract',mostly_contract:'voornamelijk contract',full_contract:'volledig contract'};
  const csrds = {mandatory_2025:'verplicht 2025',mandatory_2026:'verplicht 2026',voluntary:'vrijwillig',not_yet:'nog niet'};
  const incidents = {none:'geen',minor:'klein',moderate:'matig',major:'groot'};

  const cv = (d.volume||100) * (d.currentPrice||300);

  return `You are an agricultural supply chain risk analyst for Orbag. Use ONLY the data below. Return pure JSON, no markdown.

${KWIN}

${RISK}

INPUT:
company: ${d.company}, sector: ${d.sector}, crop: ${crops[d.crop]||d.crop}
volume: ${d.volume}t/yr, target region: ${d.region}, current price: €${d.currentPrice}/t
contract value: €${cv.toLocaleString()}, regen premium max: ${d.premium}%
current source: ${sources[d.currentSource]||'unknown'}, contract structure: ${contracts[d.currentContract]||'unknown'}
CSRD obligation: ${csrds[d.csrd]||'unknown'}, incidents: ${incidents[d.incidents]||'none'}
context: ${d.concerns||'none'}
${liveContext}

Calculate annual risk exposure for each layer. Net value = risk reduction - premium cost.
If net value positive: GO. Within 20%: CONDITIONAL_GO. Negative: NO_GO.

Return this JSON exactly:
{
"verdict":"GO",
"verdict_reason":"one sentence with euro figures",
"kpis":{"feasibility_score":75,"price_range":"€X-Y/t","available_farms":"X-Y farms","supply_reliability":"Medium","regen_premium":"€X/t (+Y%)","payback_context":"short phrase"},
"risk_analysis":{
"current_total_exposure":"€X.XXX/yr",
"residual_exposure_regen":"€X.XXX/yr",
"risk_reduction_value":"€X.XXX/yr",
"premium_cost":"€X.XXX/yr",
"net_value":"€X.XXX/yr",
"layers":[
{"layer":"Geopolitical","current":"€X.XXX","regen":"€X.XXX","reduction":"€X.XXX","basis":"note"},
{"layer":"Weather","current":"€X.XXX","regen":"€X.XXX","reduction":"€X.XXX","basis":"note"},
{"layer":"Quality","current":"€X.XXX","regen":"€X.XXX","reduction":"€X.XXX","basis":"note"},
{"layer":"Price volatility","current":"€X.XXX","regen":"€X.XXX","reduction":"€X.XXX","basis":"note"},
{"layer":"CSRD","current":"€X.XXX","regen":"€X.XXX","reduction":"€X.XXX","basis":"note"}
]},
"supply_analysis":"2-3 sentences with KWIN figures",
"pricing_analysis":"2-3 sentences with exact KWIN price",
"scenarios":{
"optimistic":{"volume_pct":"X%","price":"€X/t","note":"condition"},
"base":{"volume_pct":"X%","price":"€X/t","note":"condition"},
"pessimistic":{"volume_pct":"X%","price":"€X/t","note":"condition"}
},
"next_steps":["step 1","step 2","step 3","step 4"],
"orbag_note":"one sentence"
}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const d = req.body;
    const liveContext = await getLiveMarketContext(d.crop, d.region, process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    console.log('live context length:', liveContext.length);
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
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
      const err = await anthropicRes.json().catch(() => ({}));
      return res.status(500).json({ error: err.error?.message || `Anthropic error ${anthropicRes.status}` });
    }

    const anthropicData = await anthropicRes.json();
    let text = anthropicData.content.map(b => b.type === 'text' ? b.text : '').join('');
    console.log('stop_reason:', anthropicData.stop_reason, 'length:', text.length);

    if (anthropicData.stop_reason === 'max_tokens') {
      return res.status(500).json({ error: 'Response too long — please try again.' });
    }

    text = text.replace(/```json\n?|```\n?/g, '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found:', text.substring(0, 200));
      return res.status(500).json({ error: 'AI did not return valid JSON. Please try again.' });
    }

    let report;
    try {
      report = JSON.parse(jsonMatch[0]);
    } catch(e) {
      console.error('Parse error:', e.message, text.substring(0, 300));
      return res.status(500).json({ error: 'Could not parse response. Please try again.' });
    }

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
          company: d.company, sector: d.sector, crop: d.crop, region: d.region,
          volume: Number(d.volume), current_price: Number(d.currentPrice),
          premium: Number(d.premium), verdict: report.verdict,
          feasibility: report.kpis?.feasibility_score,
          price_range: report.kpis?.price_range,
          input_data: d, report_data: report,
          created_at: new Date().toISOString(),
        }),
      });
    }

    return res.status(200).json(report);
  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
