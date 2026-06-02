export const config = { maxDuration: 60 };

const BENCHMARK_DATA = `
=== OFFICIËLE KWIN-AGV 2024 BENCHMARKS (bron: WUR/BIJ12, gebaseerd op 5-jarig gemiddelde 2019-2023) ===

WINTERTARWE:
- Opbrengst kleigrond Noord-Nederland: 9.100–9.400 kg/ha
- Opbrengst zandgrond: 9.300 kg/ha
- Gangbare prijs: €0,23/kg (= €230/tonne)
- Biologische tarwe kleigebieden: 7.000 kg/ha @ €0,34/kg (= €340/tonne)
- Teeltkosten gangbaar (zaad, bemesting, gwasbescherming, loonwerk): €1.200–1.600/ha
- Saldo gangbaar Noord-Nederland: €500–700/ha
- Regen premium verwacht: €40–80/tonne boven gangbaar

POOTAARDAPPELEN Noord-Nederland (kleigrond):
- Opbrengst: 34.500 kg/ha
- Gangbare prijs: €0,31/kg (= €310/tonne)
- Teeltkosten: €3.500–4.500/ha (hoog door pootgoed en bewaring)
- Saldo: €200–800/ha afhankelijk van prijsvorming
- Regen premium: €30–60/tonne

CONSUMPTIEAARDAPPELEN (kleigrond IJsselmeerpolders/Noord):
- Opbrengst: 49.500 kg/ha
- Gangbare prijs: €0,17/kg (= €170/tonne) — sterk volatiel
- Teeltkosten: €2.800–3.800/ha
- Saldo gangbaar: fluctueert sterk, -€500 tot +€2.000/ha
- Regen premium: €20–40/tonne

ZETMEELAARDAPPELEN (Noord-Nederland dalgrond/zandgrond):
- Opbrengst: 40.000 kg/ha
- Prijs: €0,10/kg (= €100/tonne) — vaste afzet via AVEBE
- Teeltkosten: €1.800–2.400/ha
- Saldo: €1.200–1.800/ha stabiel

SUIKERBIETEN Noord-Nederland (kleigrond):
- Opbrengst: 80.000 kg/ha
- Prijs: €45,23/tonne
- Teeltkosten: €2.200–2.800/ha
- Saldo: €800–1.400/ha

HAVER:
- Opbrengst: 5.200 kg/ha gangbaar
- Prijs gangbaar: €0,21/kg (= €210/tonne)
- Biologische haver zandgebieden: 6.000 kg/ha @ €0,32/kg (= €320/tonne)
- Teeltkosten: €800–1.100/ha
- Saldo gangbaar: €300–600/ha

WINTERTARWE biologisch:
- Opbrengst: 7.000 kg/ha kleigebieden
- Prijs: €0,34/kg (= €340/tonne)
- Premium boven gangbaar: €110/tonne

ERWTEN/PEULVRUCHTEN (Noord-Nederland):
- Opbrengst: 4.000–5.500 kg/ha
- Prijs: €0,35–0,50/kg gangbaar, €0,60–0,80/kg biologisch/regen
- Teeltkosten: €900–1.200/ha
- Stikstofbindend — belangrijke regen rotatiebijdrage

UIEN (kleigrond Noord-Nederland):
- Opbrengst: 55.000–70.000 kg/ha
- Gangbare prijs: €0,10–0,18/kg (sterk volatiel)
- Teeltkosten: €2.500–3.200/ha

SPERZIEBONEN (industrieel/contractteelt Nederland):
- Opbrengst: 8.000–12.000 kg/ha (vers gewicht)
- Contractprijs industrie: €0,28–0,38/kg vers (= €280–380/tonne)
- Regen/biologisch premium: 15–25% boven gangbaar
- Teeltkosten: €1.800–2.400/ha (arbeidsintensief)
- Saldo gangbaar: €400–900/ha
- Bonduelle, Hak, Farm Frites zijn grote afnemers NL
- Noord-Nederland: geschikt op kleigrond, rijstijd 60–70 dagen

WORTELEN (industrieel Noord-Nederland):
- Opbrengst: 70.000–90.000 kg/ha
- Contractprijs industrie: €0,08–0,12/kg
- Regen premium: beperkt, markt minder volwassen

=== REGENERATIEVE LANDBOUW PREMIUMS NEDERLAND 2024-2025 ===
- Certificering (bijv. Soil & More, On the Way to PlanetProof): €20–80/ha extra kosten
- Carbon credits akkerbouw: €30–80/ha potentieel (markt nog in ontwikkeling)
- Regen premium retail/foodservice boven gangbaar: 10–25% afhankelijk van gewas en afnemer
- Betrouwbaarheidsbonus bij contractteelt (minder uitval): 3–8% waarde voor afnemer

=== TEELTKOSTEN STRUCTUUR NOORD-NEDERLAND (kleigrond, per ha) ===
- Grondkosten (pacht/eigendom): €600–1.200/ha/jr
- Vaste mechanisatiekosten: €400–700/ha
- Loonwerkkosten: €300–600/ha afhankelijk gewas
- Arbeid (eigen): €150–350/ha
- Zaad/pootgoed: gewasafhankelijk (tarwe €90, aardappelen €800–1.400)
- Bemesting gangbaar: €300–600/ha (sterk gestegen 2022-2023, nu stabielere markt)
- Bemesting regen: €150–300/ha (compost, groenbemesters, minder kunstmest)
- Gewasbescherming gangbaar: €200–500/ha
- Gewasbescherming regen/bio: €50–200/ha
`;

function buildPrompt(d) {
  const cropNames = {
    green_beans: 'green beans (sperziebonen)', wheat: 'wheat (wintertarwe)',
    potatoes: 'potatoes (consumptieaardappelen)', onions: 'onions (uien)',
    lentils: 'lentils/pulses (linzen/peulvruchten)', oats: 'oats (haver)',
    peas: 'peas (erwten)', carrots: 'carrots (wortelen)',
  };
  const regionNames = {
    noord_nederland: 'Noord-Nederland (Groningen, Friesland, Drenthe) — kleigrond en dalgrond',
    west_nederland: 'West-Nederland (Zuid-Holland, Zeeland) — kleigrond',
    oost_nederland: 'Oost-Nederland (Gelderland, Overijssel) — zand en rivierklei',
    portugal: 'Portugal (Alentejo) — mediterraan klimaat, droogterisico',
    morocco: 'Marokko — mediterraan/semi-aride, seizoensgebonden',
    denmark: 'Denemarken — vergelijkbaar klimaat NL, sterk regen netwerk',
    no_preference: 'geen regiovoorkeur — Nederland breed',
  };
  const contractNames = {
    season: 'volledig seizoenscontract (12 maanden)',
    spot: 'spot inkoop',
    multi_year: 'meerjarig raamcontract (2–3 jaar)',
  };
  const sectorNames = {
    food_processor: 'food processor / conservenindustrie',
    retailer: 'retailer / supermarkt',
    catering: 'catering / foodservice',
    wholesaler: 'groothandel',
    exporter: 'exporteur',
  };

  return `You are an expert agricultural supply chain analyst for Orbag, a Dutch regenerative agriculture AI platform. Generate a detailed buyer businesscase as pure JSON only — no markdown, no backticks, no explanation.

USE THE FOLLOWING OFFICIAL DUTCH BENCHMARK DATA AS YOUR PRIMARY SOURCE. Do not deviate from these price ranges without explicit reasoning:

${BENCHMARK_DATA}

BUYER INPUT:
- Company: ${d.company} (${sectorNames[d.sector] || d.sector}, ${d.country})
- Annual procurement budget: €${Number(d.budget).toLocaleString()}
- Target crop: ${cropNames[d.crop] || d.crop}
- Required volume: ${d.volume} tonnes/year
- Region: ${regionNames[d.region] || d.region}
- Contract type: ${contractNames[d.contract] || d.contract}
- Certifications required: ${(d.certs || []).join(', ') || 'none'}
- Current price paid: €${d.currentPrice}/tonne
- Max regen premium tolerance: ${d.premium}%
- Context: ${d.concerns || 'none provided'}

CRITICAL INSTRUCTIONS:
1. Use ONLY the benchmark prices above for the crop and region specified. Cite the exact KWIN figures.
2. Calculate the regen premium as a percentage of the gangbare (conventional) KWIN price.
3. For Noord-Nederland specifically: reference kleigrond vs dalgrond/zandgrond differences where relevant.
4. The feasibility score must reflect whether the buyer's volume is achievable given regional supply capacity.
5. All euro amounts must be realistic and consistent with the KWIN benchmarks above.

Return ONLY this JSON structure:
{
  "verdict": "GO" | "CONDITIONAL_GO" | "NO_GO",
  "verdict_reason": "one sentence citing specific KWIN benchmark data",
  "kpis": {
    "feasibility_score": number 0-100,
    "price_range": "e.g. €320-360/tonne (based on KWIN gangbaar €230 + regen premium)",
    "available_farms": "realistic estimate e.g. 15-25 farms in region",
    "supply_reliability": "Low" | "Medium" | "High",
    "regen_premium": "e.g. €48/tonne (+21% above KWIN gangbaar)",
    "payback_context": "what the premium delivers e.g. traceability + carbon credits"
  },
  "supply_analysis": "3-4 sentences. Reference specific KWIN yield figures for this crop and region. State whether ${d.volume}t is achievable. Mention number of hectares needed based on KWIN yields.",
  "pricing_analysis": "3-4 sentences. State the exact KWIN gangbare prijs. Calculate the regen premium explicitly. State whether buyer's ${d.premium}% tolerance covers the premium. Reference biologisch/regen price benchmarks from KWIN.",
  "risk_assessment": [
    {"risk": "Supply volume risk", "level": "Low|Medium|High", "note": "based on regional ha availability"},
    {"risk": "Quality consistency", "level": "Low|Medium|High", "note": "certification status Noord-NL"},
    {"risk": "Weather / climate", "level": "Low|Medium|High", "note": "specific to crop and region"},
    {"risk": "Certification compliance", "level": "Low|Medium|High", "note": "regen cert landscape NL"},
    {"risk": "Price volatility", "level": "Low|Medium|High", "note": "based on KWIN 5yr trend"}
  ],
  "scenarios": {
    "optimistic": {"volume_pct": "% of required volume", "price": "€/tonne", "note": "condition e.g. good harvest, multiple farms secured"},
    "base": {"volume_pct": "%", "price": "€/tonne", "note": "condition"},
    "pessimistic": {"volume_pct": "%", "price": "€/tonne", "note": "condition e.g. poor harvest, certification delays"}
  },
  "next_steps": [
    "Contact Orbag to identify [X] certified farms in [region] with capacity for [crop]",
    "Step 2 — specific and actionable",
    "Step 3",
    "Step 4"
  ],
  "orbag_note": "One sentence: what Orbag does next — farm matching, individual farm businesscases, contract structuring."
}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
