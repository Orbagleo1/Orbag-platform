// ORBAG — AUTO-BOOTSTRAP A NEW REGION
// When a user from a country with no benchmark data signs up (or runs an analysis), this
// produces a PROVISIONAL region entry so the engine has something to work with immediately,
// instead of silently falling back to NL numbers. It pulls what is machine-available
// (World Bank country metadata + cereal yield) and derives the rest (great-circle distance ->
// logistics, EU lookup -> customs, income level -> geopolitical-risk proxy). Everything is
// written status='provisional' with a traceable source_label; the deep-research harness and
// human review (Hanze library) sharpen it afterwards. Never blocks the user.
//
// POST { country: "Poland" | "POL", region_key?: "poland" }  ->  { region_key, provisional fields }
// Pure CommonJS for Vercel.

var EU27 = {AUT:1,BEL:1,BGR:1,HRV:1,CYP:1,CZE:1,DNK:1,EST:1,FIN:1,FRA:1,DEU:1,GRC:1,HUN:1,
  IRL:1,ITA:1,LVA:1,LTU:1,LUX:1,MLT:1,NLD:1,POL:1,PRT:1,ROU:1,SVK:1,SVN:1,ESP:1,SWE:1};

// NL buyer reference point (only buyer location in the current UI).
var BUYER_LAT = 52.1, BUYER_LNG = 5.29;

function slug(s){ return String(s||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,''); }

function haversineKm(lat1, lon1, lat2, lon2){
  var toRad = function(d){ return d*Math.PI/180; };
  var R = 6371;
  var dLat = toRad(lat2-lat1), dLon = toRad(lon2-lon1);
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) +
          Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2);
  return R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function wbJson(url){
  try {
    var r = await fetch(url, {headers:{'Accept':'application/json'}});
    if (!r.ok) return null;
    var j = await r.json();
    return j;
  } catch(e){ return null; }
}

// Resolve a country name OR ISO3 code to World Bank metadata.
async function resolveCountry(input){
  // 1. Try as a direct code (iso2/iso3) — WB accepts these on /country/{id}.
  var byCode = await wbJson('https://api.worldbank.org/v2/country/' + encodeURIComponent(input) + '?format=json');
  if (byCode && byCode[1] && byCode[1][0] && byCode[1][0].id) return byCode[1][0];
  // 2. Fall back to a name search over the full list.
  var list = await wbJson('https://api.worldbank.org/v2/country?format=json&per_page=400');
  if (list && list[1]) {
    var lc = String(input||'').toLowerCase();
    var exact = list[1].filter(function(c){ return c.name && c.name.toLowerCase() === lc; })[0];
    if (exact) return exact;
    var partial = list[1].filter(function(c){ return c.name && c.name.toLowerCase().indexOf(lc) >= 0 && c.region && c.region.value !== 'Aggregates'; })[0];
    if (partial) return partial;
  }
  return null;
}

function geoFromIncome(income){
  income = String(income||'').toLowerCase();
  if (income.indexOf('high') >= 0)         return 0.04;
  if (income.indexOf('upper middle') >= 0) return 0.08;
  if (income.indexOf('lower middle') >= 0) return 0.12;
  if (income.indexOf('low') >= 0)          return 0.15;
  return 0.08;
}

async function latestCerealYield(iso3){
  var j = await wbJson('https://api.worldbank.org/v2/country/' + iso3 + '/indicator/AG.YLD.CREL.KG?format=json&date=2017:2024&per_page=20');
  if (!j || !j[1]) return null;
  var v = j[1].filter(function(x){ return x.value != null; })[0];
  return v ? Number(v.value) : null;  // kg/ha
}

// Persist via the SECURITY DEFINER RPC bootstrap_region — SUPABASE_KEY is the ANON key, which RLS
// blocks from writing benchmark tables directly. The function only ever touches provisional rows.
async function sbBootstrap(url, key, regionRow, cropRows){
  var r = await fetch(url + '/rest/v1/rpc/bootstrap_region', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': 'Bearer ' + key,
    },
    body: JSON.stringify({ p_region: regionRow, p_crops: cropRows || [] }),
  });
  if (!r.ok) return { ok: false, error: 'rpc ' + r.status, detail: await r.text().catch(function(){return '';}) };
  return { ok: true, result: await r.json().catch(function(){return null;}) };
}

module.exports = async function handler(req, res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});

  try {
    var body = req.body || {};
    var countryInput = (body.country || '').toString().trim();
    if (!countryInput) return res.status(400).json({error:'country is required'});
    var regionKey = body.region_key ? slug(body.region_key) : slug(countryInput);
    if (!regionKey) return res.status(400).json({error:'could not derive a region key'});

    var SB_URL = process.env.SUPABASE_URL, SB_KEY = process.env.SUPABASE_KEY;
    if (!SB_URL || !SB_KEY) return res.status(500).json({error:'Supabase not configured'});
    // Idempotency / curated-protection is enforced inside the bootstrap_region() RPC: it only ever
    // writes provisional rows and never overwrites a curated region.

    // 1. Resolve country via World Bank.
    var c = await resolveCountry(countryInput);
    if (!c || !c.id) return res.status(422).json({error:'could not resolve country', input: countryInput});
    var iso3 = c.id;
    var lat = Number(c.latitude), lng = Number(c.longitude);
    var isEu = !!EU27[iso3];

    // 2. Derive coefficients.
    var distance = (lat && lng) ? Math.round(haversineKm(lat, lng, BUYER_LAT, BUYER_LNG)) : 1500;
    var isSea = !isEu;                                   // non-EU defaults to a sea/short-sea + customs leg
    var geo = geoFromIncome(c.incomeLevel && c.incomeLevel.value);
    var transitDays = Math.max(1, Math.round(distance / (isSea ? 280 : 350)));
    var bufferWeeks = Math.min(6, Math.max(1, Math.round(transitDays / 3) + 1));
    var costPerT = Math.round(6 + distance * 0.017 + (isSea ? 12 : 0));
    var importCost = isEu ? 0 : 30;                     // provisional customs default for a non-EU -> EU buyer
    var weatherConv = 0.20;                             // provisional default; sharpened by the weather detector
    var src = 'Auto-bootstrap: World Bank metadata + geo-derived (UNVERIFIED, provisional)';

    var regionRow = {
      region_key: regionKey,
      label: (c.name || countryInput) + ' (auto)',
      crop_region: regionKey,
      geopolitical_pct: geo,
      weather_conv_pct: weatherConv,
      transport_cost_per_t: costPerT,
      transport_distance_km: distance,
      transport_transit_days: transitDays,
      transport_buffer_weeks: bufferWeeks,
      load_factor: 0.82,
      import_cost: importCost,
      is_sea_route: isSea,
      is_eu: isEu,
      status: 'provisional',
      source_label: src,
    };

    // 3. Crop production data: World Bank cereal yield is a usable proxy for wheat/oats (cereals).
    //    Price + variable cost are not machine-available -> left null so the engine falls back to NL,
    //    and flagged for the deep-research / Hanze sharpening pass.
    var cropRows = [];
    var cerealKg = await latestCerealYield(iso3);       // kg/ha
    if (cerealKg) {
      var yieldT = Math.round((cerealKg/1000) * 10) / 10;
      ['wheat','oats'].forEach(function(crop){
        cropRows.push({
          crop_region: regionKey, crop: crop,
          yield_t_ha: yieldT, price_conv: null, variable_cost_ha: null,
          source_label: 'Auto: World Bank cereal yield ' + Math.round(cerealKg) + ' kg/ha (proxy, provisional)',
          status: 'provisional',
        });
      });
    }

    // 4. Persist via the SECURITY DEFINER RPC (anon key cannot write the tables directly).
    var saved = await sbBootstrap(SB_URL, SB_KEY, regionRow, cropRows);

    return res.status(saved.ok ? 200 : 500).json({
      region_key: regionKey,
      resolved: {country: c.name, iso3: iso3, is_eu: isEu, distance_km: distance, income: c.incomeLevel && c.incomeLevel.value},
      written: saved.ok,
      crops: cropRows.map(function(r){return r.crop;}),
      db: saved.ok ? saved.result : (saved.error + ' ' + (saved.detail||'')),
      status: 'provisional',
      next: 'queued for deep-research sharpening; price/variable-cost and per-crop yields pending (FAOSTAT/Statista/Hanze)',
    });
  } catch (err) {
    return res.status(500).json({error: err.message || 'bootstrap failed'});
  }
};
