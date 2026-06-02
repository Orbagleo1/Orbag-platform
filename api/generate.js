export const config = { maxDuration: 60 };

const BENCHMARK_DATA = `
=== OFFICIËLE KWIN-AGV 2024 BENCHMARKS (bron: WUR/BIJ12, 5-jarig gemiddelde 2019-2023) ===

WINTERTARWE: opbrengst kleigrond Noord-NL 9.100-9.400 kg/ha | gangbaar €230/tonne | biologisch €340/tonne | teeltkosten €1.200-1.600/ha | saldo €500-700/ha | regen premium €40-80/tonne
POOTAARDAPPELEN Noord-NL kleigrond: opbrengst 34.500 kg/ha | prijs €310/tonne | teeltkosten €3.500-4.500/ha | regen premium €30-60/tonne
CONSUMPTIEAARDAPPELEN kleigrond Noord-NL: opbrengst 49.500 kg/ha | prijs €170/tonne (volatiel) | teeltkosten €2.800-3.800/ha | regen premium €20-40/tonne
ZETMEELAARDAPPELEN Noord-NL: opbrengst 40.000 kg/ha | prijs €100/tonne (vast via AVEBE) | saldo €1.200-1.800/ha stabiel
SUIKERBIETEN Noord-NL kleigrond: opbrengst 80.000 kg/ha | prijs €45,23/tonne | teeltkosten €2.200-2.800/ha
HAVER: opbrengst 5.200 kg/ha gangbaar | prijs €210/tonne gangbaar | biologisch €320/tonne | teeltkosten €800-1.100/ha
SPERZIEBONEN industrieel NL: opbrengst 8.000-12.000 kg/ha | contractprijs €280-380/tonne | regen premium 15-25% | teeltkosten €1.800-2.400/ha
ERWTEN/PEULVRUCHTEN Noord-NL: opbrengst 4.000-5.500 kg/ha | prijs €350-500/tonne gangbaar | €600-800/tonne biologisch/regen
UIEN kleigrond Noord-NL: opbrengst 55.000-70.000 kg/ha | prijs €100-180/tonne (sterk volatiel)
WORTELEN industrieel Noord-NL: opbrengst 70.000-90.000 kg/ha | contractprijs €80-120/tonne

=== REGEN PREMIUMS NEDERLAND 2024-2025 ===
Certificering kosten: €20-80/ha extra | Carbon credits akkerbouw: €30-80/ha potentieel
Regen premium boven gangbaar retail/foodservice: 10-25% afhankelijk van gewas
Betrouwbaarheidsbonus contractteelt: 3-8% waarde voor afnemer
`;

const RISK_DATA = `
=== SUPPLY CHAIN RISK KWANTIFICERING PER BRONREGIO ===

GEOPOLITIEK RISICO (jaarlijkse blootstelling als % van contractwaarde):
- Marokko/Egypte: 12-18% (politieke instabiliteit, exportrestricties, valutarisico, transportkosten +€60-120/tonne vs NL)
- Turkije/Spanje: 6-10% (EU-relatie risico, klimaat extremen, logistieke complexiteit)
- Nederland only: 1-3% (EU-stabiliteit, geen transportrisico)
- Mixed EU: 3-6%
- Mixed global 3+ landen: 8-15%

WEERSRISICO (yield variance en impact op leveringszekerheid):
- Marokko/Egypte: 25-40% yield variance, droogterisico hoog, klimaattrend negatief
- Conventioneel NL monocultuur: 15-25% yield variance, bodemgezondheid dalend
- Regeneratief NL: 8-15% yield variance, bodem als buffer, rotatie spreidt risico
- Financiële impact bij 20% yield shortfall op 500t = 100t tekort = €30.000-80.000 noodinkoop premie

KWALITEIT/TRACEERBAARHEID RISICO:
- Spot inkoop meerder origins: recall risico €50.000-500.000 per incident (afhankelijk van sector)
- Vaste contractteler NL: recall risico 60-80% lager door farm-level traceability
- Incidenten in afgelopen 3 jaar vermenigvuldigen risicoscore met 1.5-2.5x

PRIJSVOLATILITEIT RISICO (jaar-op-jaar swings):
- Spot inkoop: 30-50% prijsswing mogelijk (zie ui-markt NL: €50-180/tonne range in 5 jaar)
- Mixed spot/contract: 15-25% effectieve blootstelling
- Full contract regen: 5-10% (premium is vast, inputkosten stabiel door minder kunstmest)

CSRD/REGELGEVINGS RISICO (boeterisico en rapporteringskosten):
- Mandatory 2025 zonder data: €50.000-200.000 compliance gap kosten
- Mandatory 2026 zonder data: €30.000-120.000
- Regen contract met Orbag: scope 3 data automatisch beschikbaar, audit-ready

=== RISICOWAARDE BEREKENING ===
Totale jaarlijkse risicowaarde gangbare keten = som van:
1. Geopolitiek: contractwaarde × geopolitiek% 
2. Weer: volume × kans shortfall × noodinkoop premium
3. Kwaliteit: recall kans × gemiddelde recall kosten × incidentfactor
4. Prijsvolatiliteit: contractwaarde × volatiliteit%
5. CSRD: compliance gap kosten / jaren tot deadline

Regen alternatief reduceert posten 1-4 met 40-70% en elimineert post 5 vrijwel volledig.
`;

function buildPrompt(d) {
  const cropNames = {
    green_beans:'green beans (sperziebonen)',wheat:'wheat (wintertarwe)',
    potatoes:'potatoes (consumptieaardappelen)',onions:'onions (uien)',
    lentils:'lentils/pulses (linzen/peulvruchten)',oats:'oats (haver)',
    peas:'peas (erwten)',carrots:'carrots (wortelen)',
  };
  const regionNames = {
    noord_nederland:'Noord-Nederland (Groningen, Friesland, Drenthe) kleigrond/dalgrond',
    west_nederland:'West-Nederland (Zuid-Holland, Zeeland) kleigrond',
    oost_nederland:'Oost-Nederland (Gelderland, Overijssel) zand/rivierklei',
    portugal:'Portugal (Alentejo) mediterraan klimaat',
    morocco:'Marokko semi-aride klimaat',
    denmark:'Denemarken vergelijkbaar klimaat NL',
    no_preference:'geen regiovoorkeur Nederland',
  };
  const sourceNames = {
    morocco_egypt:'Marokko/Egypte (Noord-Afrika)',
    turkey_spain:'Turkije/Spanje (Zuid-Europa)',
    netherlands:'Nederland',
    mixed_eu:'gemengd EU',
    mixed_global:'gemengd globaal (3+ landen)',
  };
  const contractStructureNames = {
    mostly_spot:'voornamelijk spot inkoop (>60%)',
    mixed:'gemengd spot en contract (~50/50)',
    mostly_contract:'voornamelijk gecontracteerd (>60%)',
    full_contract:'volledig gecontracteerd',
  };
  const csrdNames = {
    mandatory_2025:'verplicht vanaf 2025',
    mandatory_2026:'verplicht vanaf 2026',
    voluntary:'vrijwillig / voorbereiding',
    not_yet:'nog niet van toepassing',
  };
  const incidentNames = {
    none:'geen incidenten',
    minor:'kleine incidenten (1-2 leveringsproblemen)',
    moderate:'matige incidenten (kwaliteitsfouten of tekort)',
    major:'grote incidenten (recall, contractbreuk of significant verlies)',
  };

  const contractValue = d.volume * d.currentPrice;

  return `You are an expert supply chain risk analyst and agricultural economist for Orbag, a Dutch regenerative agriculture platform. Generate a buyer businesscase that QUANTIFIES supply chain risk in euros. Output pure JSON only — no markdown, no backticks.

USE THESE OFFICIAL DATA SOURCES — DO NOT DEVIATE:

${BENCHMARK_DATA}

${RISK_DATA}

BUYER PROFILE:
- Company: ${d.company} (${d.sector}, ${d.country})
- Target crop: ${cropNames[d.crop] || d.crop}
- Required volume: ${d.volume} tonnes/year
- Desired source region: ${regionNames[d.region] || d.region}
- Current price: €${d.currentPrice}/tonne
- Annual contract value at current price: €${contractValue.toLocaleString()}
- Max regen premium: ${d.premium}%
- Certifications required: ${(d.certs||[]).join(', ')||'none'}
- Contract type desired: ${d.contractLabel || d.contract}

RISK PROFILE:
- Current source region: ${sourceNames[d.currentSource] || d.currentSource || 'unknown'}
- Current contract structure: ${contractStructureNames[d.currentContract] || d.currentContract || 'unknown'}
- CSRD scope 3 obligation: ${csrdNames[d.csrd] || d.csrd || 'unknown'}
- Quality/supply incidents last 3 years: ${incidentNames[d.incidents] || d.incidents || 'none'}
- Additional context: ${d.concerns || 'none'}

CALCULATION INSTRUCTIONS:
1. Calculate the CURRENT annual risk exposure in euros using the risk data above. Show each of the 5 risk layers separately.
2. Calculate the RESIDUAL risk exposure with regenerative Noord-Nederland sourcing.
3. Calculate the RISK REDUCTION VALUE = current exposure minus residual exposure.
4. Calculate the PREMIUM COST = volume × current price × (premium% / 100).
5. Calculate the NET VALUE = risk reduction value minus premium cost.
6. If net value is positive, verdict = GO. If marginal (within 20%), verdict = CONDITIONAL_GO. If negative, verdict = NO_GO.

Return ONLY this JSON:
{
  "verdict": "GO"|"CONDITIONAL_GO"|"NO_GO",
  "verdict_reason": "one sentence with specific euro figures e.g. risk reduction of €X outweighs premium cost of €Y by €Z",
  "kpis": {
    "feasibility_score": number 0-100,
    "price_range": "€X-Y/tonne (KWIN gangbaar + regen premium)",
    "available_farms": "realistic estimate e.g. 12-20 farms in Noord-NL",
    "supply_reliability": "Low"|"Medium"|"High",
    "regen_premium": "€X/tonne (+Y% above KWIN gangbaar €Z)",
    "payback_context": "premium pays back in X months via risk reduction"
  },
  "risk_analysis": {
    "current_total_exposure": "€X.XXX/year",
    "residual_exposure_regen": "€X.XXX/year",
    "risk_reduction_value": "€X.XXX/year",
    "premium_cost": "€X.XXX/year",
    "net_value": "€X.XXX/year",
    "layers": [
      {"layer": "Geopolitical", "current": "€X.XXX", "regen": "€X.XXX", "reduction": "€X.XXX", "basis": "brief calculation note"},
      {"layer": "Weather / yield", "current": "€X.XXX", "regen": "€X.XXX", "reduction": "€X.XXX", "basis": "brief calculation note"},
      {"layer": "Quality / traceability", "current": "€X.XXX", "regen": "€X.XXX", "reduction": "€X.XXX", "basis": "brief calculation note"},
      {"layer": "Price volatility", "current": "€X.XXX", "regen": "€X.XXX", "reduction": "€X.XXX", "basis": "brief calculation note"},
      {"layer": "CSRD / regulatory", "current": "€X.XXX", "regen": "€X.XXX", "reduction": "€X.XXX", "basis": "brief calculation note"}
    ]
  },
  "supply_analysis": "3-4 sentences. Use specific KWIN yield figures. State how many hectares needed. Comment on Noord-NL regional suitability for this crop.",
  "pricing_analysis": "3-4 sentences. State exact KWIN gangbare prijs. Calculate regen premium explicitly. State whether ${d.premium}% tolerance is sufficient.",
  "scenarios": {
    "optimistic": {"volume_pct": "e.g. 108%", "price": "€/tonne", "risk_exposure": "€/year", "note": "condition"},
    "base":       {"volume_pct": "e.g. 95%",  "price": "€/tonne", "risk_exposure": "€/year", "note": "condition"},
    "pessimistic":{"volume_pct": "e.g. 74%",  "price": "€/tonne", "risk_exposure": "€/year", "note": "condition"}
  },
  "next_steps": [
    "Orbag identifies [X] certified regen farms in Noord-NL with capacity for [crop] — step 1 action",
    "Step 2 — specific",
    "Step 3 — specific",
    "Step 4 — specific"
  ],
  "orbag_note": "One sentence on what Orbag does next for this specific buyer."
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
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2500,
        messages: [{ role: 'user', content: buildPrompt(d) }],
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
    // Extract JSON object if surrounded by extra text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in response:', text.substring(0, 200));
      return res.status(500).json({ error: 'AI did not return valid JSON. Please try again.' });
    }
    let report;
    try {
      report = JSON.parse(jsonMatch[0]);
    } catch(parseErr) {
      console.error('JSON parse error:', parseErr.message, 'text:', text.substring(0, 300));
      return res.status(500).json({ error: 'Could not parse AI response: ' + parseErr.message });
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
          company:      d.company,
          sector:       d.sector,
          crop:         d.crop,
          region:       d.region,
          volume:       Number(d.volume),
          current_price:Number(d.currentPrice),
          premium:      Number(d.premium),
          verdict:      report.verdict,
          feasibility:  report.kpis?.feasibility_score,
          price_range:  report.kpis?.price_range,
          input_data:   d,
          report_data:  report,
          created_at:   new Date().toISOString(),
        }),
      });
    }

    return res.status(200).json(report);
  } catch (err) {
    console.error('Handler error:', err.message, err.stack);
    return res.status(500).json({ error: err.message, stack: err.stack?.split('\n')[0] });
  }
}
