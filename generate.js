export const config = { runtime: 'edge' };

const SYSTEM_PROMPT = `You are an expert agricultural supply chain analyst for Orbag, a Dutch regenerative agriculture AI platform. Generate a detailed buyer businesscase as pure JSON (no markdown, no backticks, no explanation — just the raw JSON object).`;

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

  return `${SYSTEM_PROMPT}

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
  "verdict": "GO" | "CONDITIONAL_GO" | "NO_GO",
  "verdict_reason": "one sentence",
  "kpis": {
    "feasibility_score": number 0-100,
    "price_range": "e.g. €340-380/tonne",
    "available_farms": "e.g. 12-18 farms",
    "supply_reliability": "Low" | "Medium" | "High",
    "regen_premium": "e.g. €48/tonne (+15%)",
    "payback_context": "short phrase"
  },
  "supply_analysis": "3-4 sentences about regional supply capacity for ${cropNames[d.crop] || d.crop} in ${regionNames[d.region] || d.region}. Be specific about Dutch agricultural context.",
  "pricing_analysis": "3-4 sentences on Dutch market price benchmarks for this crop, the regen premium range, and whether ${d.premium}% tolerance is sufficient.",
  "risk_assessment": [
    {"risk": "Supply volume risk",       "level": "Low|Medium|High", "note": "specific note max 10 words"},
    {"risk": "Quality consistency",      "level": "Low|Medium|High", "note": "specific note max 10 words"},
    {"risk": "Weather / climate",        "level": "Low|Medium|High", "note": "specific note max 10 words"},
    {"risk": "Certification compliance", "level": "Low|Medium|High", "note": "specific note max 10 words"},
    {"risk": "Price volatility",         "level": "Low|Medium|High", "note": "specific note max 10 words"}
  ],
  "scenarios": {
    "optimistic": {"volume_pct": "e.g. 108%", "price": "e.g. €338/tonne", "note": "condition in 10 words"},
    "base":       {"volume_pct": "e.g. 95%",  "price": "e.g. €362/tonne", "note": "condition in 10 words"},
    "pessimistic":{"volume_pct": "e.g. 74%",  "price": "e.g. €388/tonne", "note": "condition in 10 words"}
  },
  "next_steps": [
    "Actionable step 1 — starts with a verb",
    "Actionable step 2",
    "Actionable step 3",
    "Actionable step 4"
  ],
  "orbag_note": "One sentence: what Orbag does next for this buyer."
}`;
}

export default async function handler(req) {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // CORS headers so the frontend can call this
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const formData = await req.json();

    // 1. Call Anthropic API (key stays secret on the server)
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: buildPrompt(formData) }],
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `Anthropic API error ${anthropicRes.status}`);
    }

    const anthropicData = await anthropicRes.json();
    let text = anthropicData.content.map(b => b.type === 'text' ? b.text : '').join('');
    text = text.replace(/```json\n?|```\n?/g, '').trim();
    const report = JSON.parse(text);

    // 2. Save to Supabase database
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

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
