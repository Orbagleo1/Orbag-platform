export const config = { maxDuration: 60 };

function buildPrompt(d) {
  const cropNames = {
    green_beans: 'green beans (sperziebonen)', wheat: 'wheat (tarwe)',
    potatoes: 'potatoes (aardappelen)', onions: 'onions (uien)',
    lentils: 'lentils (linzen)', oats: 'oats (haver)',
    peas: 'peas (erwten)', carrots: 'carrots (wortelen)',
  };
  const regionNames = {
    noord_nederland: 'Noord-Nederland (Groningen, Friesland, Drenthe)',
    west_nederland: 'West-Nederland (Zuid-Holland, Zeeland)',
    oost_nederland: 'Oost-Nederland (Gelderland, Overijssel)',
    portugal: 'Portugal (Alentejo)', morocco: 'Morocco',
    denmark: 'Denmark', no_preference: 'any Dutch region',
  };
  const contractNames = {
    season: 'full season contract (12 months)',
    spot: 'spot purchasing',
    multi_year: 'multi-year framework (2-3 years)',
  };
  const sectorNames = {
    food_processor: 'food processor', retailer: 'retailer/supermarket',
    catering: 'catering/foodservice', wholesaler: 'wholesaler', exporter: 'exporter',
  };

  return `You are an expert agricultural supply chain analyst for Orbag, a Dutch regenerative agriculture AI platform. Generate a detailed buyer businesscase as pure JSON (no markdown, no backticks, no explanation — just the raw JSON object).

BUYER INPUT:
- Company: ${d.company} (${sectorNames[d.sector] || d.sector}, ${d.country})
- Annual procurement budget: €${Number(d.budget).toLocaleString()}
- Target crop: ${cropNames[d.crop] || d.crop}
- Required volume: ${d.volume} tonnes/year
- Region: ${regionNames[d.region] || d.region}
- Contract type: ${contractNames[d.contract] || d.contract}
- Certifications required: ${(d.certs || []).join(', ') || 'none'}
- Current price: €${d.currentPrice}/tonne
- Max regen premium tolerance: ${d.premium}%
- Context: ${d.concerns || 'none provided'}

Return ONLY a JSON object with this exact structure:
{
  "verdict": "GO",
  "verdict_reason": "one sentence",
  "kpis": {
    "feasibility_score": 78,
    "price_range": "€340-380/tonne",
    "available_farms": "12-18 farms",
    "supply_reliability": "Medium",
    "regen_premium": "€48/tonne (+15%)",
    "payback_context": "traceability and carbon offset"
  },
  "supply_analysis": "3-4 sentences about regional supply capacity. Be specific about Dutch agricultural context and this crop and region.",
  "pricing_analysis": "3-4 sentences on Dutch market price benchmarks for this crop, the regen premium range, and whether the premium tolerance is sufficient.",
  "risk_assessment": [
    {"risk": "Supply volume risk", "level": "Medium", "note": "specific note max 10 words"},
    {"risk": "Quality consistency", "level": "Low", "note": "specific note max 10 words"},
    {"risk": "Weather / climate", "level": "Medium", "note": "specific note max 10 words"},
    {"risk": "Certification compliance", "level": "Low", "note": "specific note max 10 words"},
    {"risk": "Price volatility", "level": "Medium", "note": "specific note max 10 words"}
  ],
  "scenarios": {
    "optimistic": {"volume_pct": "108%", "price": "€338/tonne", "note": "condition in 10 words"},
    "base": {"volume_pct": "95%", "price": "€362/tonne", "note": "condition in 10 words"},
    "pessimistic": {"volume_pct": "74%", "price": "€388/tonne", "note": "condition in 10 words"}
  },
  "next_steps": [
    "Actionable step 1 starting with a verb",
    "Actionable step 2",
    "Actionable step 3",
    "Actionable step 4"
  ],
  "orbag_note": "One sentence about what Orbag does next for this buyer."
}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const formData = req.body;

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
        messages: [{ role: 'user', content: buildPrompt(formData) }],
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.json().catch(() => ({}));
      return res.status(500).json({ error: err.error?.message || `Anthropic error ${anthropicRes.status}` });
    }

    const anthropicData = await anthropicRes.json();
    let text = anthropicData.content.map(b => b.type === 'text' ? b.text : '').join('');
    text = text.replace(/```json\n?|```\n?/g, '').trim();
    const report = JSON.parse(text);

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
          company:      formData.company,
          sector:       formData.sector,
          crop:         formData.crop,
          region:       formData.region,
          volume:       Number(formData.volume),
          current_price:Number(formData.currentPrice),
          premium:      Number(formData.premium),
          verdict:      report.verdict,
          feasibility:  report.kpis?.feasibility_score,
          price_range:  report.kpis?.price_range,
          input_data:   formData,
          report_data:  report,
          created_at:   new Date().toISOString(),
        }),
      });
    }

    return res.status(200).json(report);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
