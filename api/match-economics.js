// ORBAG MATCH ECONOMICS — logistics cost per tonne + net value per tonne for a SPECIFIC
// farmer⇄buyer pair. WORKORDER BLOK 2, gated deliverable.
//
// What this is: the "logistieke kostencalculator als submodule" + the ONE worked example the gate
// asks for. It turns the buyer's justified farm-gate price (the max they can pay, already computed by
// api/generate.js and stored in buyer_bcs.justifiable_farm_price) into the REAL payment capacity for
// one specific farmer, by subtracting the route's logistics cost. Output: matches comparable on NET
// VALUE to the buyer, not just on crop/region availability.
//
// What this is NOT (gate): the full multi-variable scoring with WEIGHTS across niveau 1-3
// (volume-fit, season-fit, quality, certification, contract, concentration, growth, geopolitical
// complementarity). Those weights are a BUSINESS decision — they wait for Leo's sign-off. This module
// deliberately exposes only the deterministic, defensible economics (distance → transport + customs +
// cold chain). No weighting, no ranking opinion baked in.
//
// Constants mirror api/generate.js LOGISTICS (road leg). generate.js stays the single source of truth
// for the buyer engine; these are the farm→buyer road-distance coefficients, sourced identically.

var ROAD = {
  diesel_eur_l:              1.65,   // EU avg diesel; live-fed via intelligence MARKET.diesel_eur_l
  intensity_road_l_per_t_km: 0.030,  // CE Delft STREAM 2020 (range 0.025–0.036) — same as generate.js
  load_factor:               0.78,   // medium fleet load (generate.js load_factor mid-range)
  handling_eur_t:            6,      // fixed load/unload/handling per tonne
  cold_chain_eur_per_100km_t:1.2,    // perishable cold-chain surcharge per tonne per 100 km
};

// Per-SOURCE-country import duty (EUR/t), mirroring generate.js LOGISTICS.import_cost (GB→EU 45 via
// BTOM/Common User Charge + SPS; the morocco_egypt bucket = 18; mixed_global = 22). Charged only when
// the farm and buyer sit in different customs areas, keyed by the source (farm) country — an EU source
// pays 0 even into a non-EU buyer, exactly like the buyer engine charges the source's import_cost.
var IMPORT_DUTY_EUR_T = { gb: 45, ma: 18, eg: 18, tn: 18 };
var DEFAULT_NON_EU_DUTY_EUR_T = 22;   // unknown non-EU source (mixed_global proxy)

// EU customs union membership by country code (mirrors generate.js IS_EU, expanded to the BLOK 3
// country set). Used ONLY to decide same-area vs cross-border — never to borrow a benchmark.
var EU_CUSTOMS = {
  nl:true, be:true, de:true, fr:true, at:true, bg:true, hr:true, cy:true, cz:true, dk:true, ee:true,
  fi:true, gr:true, hu:true, ie:true, it:true, lv:true, lt:true, lu:true, mt:true, pl:true, pt:true,
  ro:true, sk:true, si:true, es:true, se:true,
  gb:false, ma:false, eg:false, tn:false,
};

function round(n) { return Math.round(n); }
function round2(n) { return Math.round(n * 100) / 100; }

function haversineKm(lat1, lon1, lat2, lon2) {
  var R = 6371, toRad = function (x) { return x * Math.PI / 180; };
  var dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Cross-border duty per tonne: 0 when both sit in the same customs area, else the SOURCE country's
// import duty. Unknown country defaults to EU (back-compat with generate.js customsCost). Never borrows.
function customsPerTonne(farmerCountry, buyerArea) {
  var fc = String(farmerCountry == null ? 'nl' : farmerCountry).toLowerCase();
  var fEu = EU_CUSTOMS[fc] !== false;                  // unknown -> treat as EU (back-compat)
  // buyerArea is a customs area label (nl/eu => EU; uk => non-EU) OR a country code.
  var b = String(buyerArea == null ? 'nl' : buyerArea).toLowerCase();
  var bEu = (b === 'eu' || b === 'nl') ? true : (EU_CUSTOMS[b] !== false);
  if (fEu === bEu) return 0;                           // same customs area -> no border cost
  // Cross-border: charge the SOURCE country's import duty (EU source -> 0, mirrors generate.js).
  return fEu ? 0 : (IMPORT_DUTY_EUR_T[fc] != null ? IMPORT_DUTY_EUR_T[fc] : DEFAULT_NON_EU_DUTY_EUR_T);
}

// Logistics cost (EUR/tonne) for the road route from a farm to a buyer.
//   farmer = {lat, lon, country}
//   buyer  = {lat, lon, location|country, perishable}
function logisticsCostPerTonne(farmer, buyer) {
  if (farmer == null || buyer == null || farmer.lat == null || farmer.lon == null ||
      buyer.lat == null || buyer.lon == null) {
    return { available: false, reason: 'missing farm or buyer coordinates' };
  }
  var dist     = haversineKm(Number(farmer.lat), Number(farmer.lon), Number(buyer.lat), Number(buyer.lon));
  var transport = dist * ROAD.intensity_road_l_per_t_km * ROAD.diesel_eur_l / ROAD.load_factor;
  var handling  = ROAD.handling_eur_t;
  var cold      = buyer.perishable ? (dist / 100) * ROAD.cold_chain_eur_per_100km_t : 0;
  var customs   = customsPerTonne(farmer.country, buyer.location || buyer.country);
  var total     = transport + handling + cold + customs;
  return {
    available: true,
    distance_km:        round(dist),
    transport_eur_t:    round2(transport),
    handling_eur_t:     round2(handling),
    cold_chain_eur_t:   round2(cold),
    customs_eur_t:      round2(customs),
    total_eur_t:        round2(total),
    basis: 'road: ' + round(dist) + ' km × ' + ROAD.intensity_road_l_per_t_km + ' L/t·km × €' +
           ROAD.diesel_eur_l + '/L ÷ ' + ROAD.load_factor + ' load + €' + ROAD.handling_eur_t +
           '/t handling' + (cold ? ' + cold chain' : '') + (customs ? ' + €' + customs + '/t customs' : ''),
  };
}

// Net value per tonne for ONE farmer⇄buyer match: the buyer's justified farm-gate price minus the
// route logistics. This is the real per-tonne payment capacity for THIS specific pairing.
function netValuePerTonne(justifiedFarmGatePrice, farmer, buyer) {
  var jfp = Number(justifiedFarmGatePrice);
  var lg  = logisticsCostPerTonne(farmer, buyer);
  if (!lg.available) return { available: false, reason: lg.reason, justified_farm_gate_price: jfp };
  var net = jfp - lg.total_eur_t;
  return {
    available: true,
    justified_farm_gate_price: round2(jfp),
    logistics: lg,
    net_value_per_tonne: round2(net),
    note: 'Max the buyer can pay this specific farm after logistics. Compare across candidate farmers ' +
          'to rank by net value to the buyer (full scoring weights await sign-off — BLOK 2 gate).',
  };
}

module.exports = {
  ROAD: ROAD, EU_CUSTOMS: EU_CUSTOMS, IMPORT_DUTY_EUR_T: IMPORT_DUTY_EUR_T,
  haversineKm: haversineKm, customsPerTonne: customsPerTonne,
  logisticsCostPerTonne: logisticsCostPerTonne, netValuePerTonne: netValuePerTonne,
};
