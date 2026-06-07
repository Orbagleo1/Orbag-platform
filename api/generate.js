// ORBAG BUYER BUSINESSCASE GENERATOR v3
// Architecture: JS calculation engine + AI narrative
// Two-call design — no token ceiling on calculation complexity

// ── BENCHMARK DATA ───────────────────────────────────────
// KWIN is the NL-ONLY quality/agronomy table: tare, defect, dry-matter gain, nitrate risk,
// and the conventional/bio price split. The REGION-VARYING production economics (yield t/ha,
// conventional price/t, variable cost/ha) now live in REGIONAL_CROP_DATA below and OVERRIDE the
// matching KWIN fields per source region. KWIN values are NL (KWIN-AGV 2024; wheat & onions
// sourced, the rest UNVERIFIED internal estimates) — do not cite UNVERIFIED rows as authoritative.
var KWIN = {
  green_beans: {yield_ha:10000, price_conv:330, price_bio:420, cost_ha:2100, tare_conv:18, tare_regen:13, dm_gain:10, defect_conv:8,  defect_regen:4,  nitrate_risk:'medium', nitrate_reject_conv:0.040, nitrate_reject_regen:0.004, nitrate_cost:25000}, // src: internal estimate — UNVERIFIED (flag for KWIN-AGV review)
  wheat:       {yield_ha:9400,  price_conv:230, price_bio:340, cost_ha:1400, tare_conv:0,  tare_regen:0,  dm_gain:7,  defect_conv:5,  defect_regen:2,  nitrate_risk:'low',    nitrate_reject_conv:0.010, nitrate_reject_regen:0.001, nitrate_cost:10000}, // src: BIJ12 KWIN-AGV 2024 — yield 9,400 kg/ha, price €0.23/kg (=€230/t)
  potatoes:    {yield_ha:49500, price_conv:170, price_bio:220, cost_ha:3300, tare_conv:12, tare_regen:11, dm_gain:2,  defect_conv:7,  defect_regen:5,  nitrate_risk:'low',    nitrate_reject_conv:0.010, nitrate_reject_regen:0.001, nitrate_cost:15000}, // src: internal estimate — UNVERIFIED
  onions:      {yield_ha:47000, price_conv:130, price_bio:180, cost_ha:8507, tare_conv:10, tare_regen:8,  dm_gain:3,  defect_conv:8,  defect_regen:5,  nitrate_risk:'low',    nitrate_reject_conv:0.010, nitrate_reject_regen:0.001, nitrate_cost:10000}, // src: KWIN/market avg 2023-2024 — yield 47 t/ha, kostprijs €181/t (=€8,507/ha), price_conv €130/t
  lentils:     {yield_ha:4500,  price_conv:420, price_bio:700, cost_ha:1000, tare_conv:12, tare_regen:9,  dm_gain:9,  defect_conv:7,  defect_regen:3,  nitrate_risk:'low',    nitrate_reject_conv:0.008, nitrate_reject_regen:0.001, nitrate_cost:10000}, // src: internal estimate — UNVERIFIED
  oats:        {yield_ha:5200,  price_conv:210, price_bio:320, cost_ha:950,  tare_conv:0,  tare_regen:0,  dm_gain:6,  defect_conv:4,  defect_regen:2,  nitrate_risk:'low',    nitrate_reject_conv:0.008, nitrate_reject_regen:0.001, nitrate_cost:8000}, // src: internal estimate — UNVERIFIED
  peas:        {yield_ha:5000,  price_conv:420, price_bio:700, cost_ha:1000, tare_conv:12, tare_regen:9,  dm_gain:9,  defect_conv:7,  defect_regen:3,  nitrate_risk:'low',    nitrate_reject_conv:0.008, nitrate_reject_regen:0.001, nitrate_cost:10000}, // src: internal estimate — UNVERIFIED
  carrots:     {yield_ha:80000, price_conv:100, price_bio:140, cost_ha:2200, tare_conv:15, tare_regen:13, dm_gain:3,  defect_conv:10, defect_regen:6,  nitrate_risk:'low',    nitrate_reject_conv:0.010, nitrate_reject_regen:0.001, nitrate_cost:8000}, // src: internal estimate — UNVERIFIED
};

// ── REGIONAL CROP PRODUCTION DATA ────────────────────────
// Production economics are a function of WHERE the crop is GROWN (the source region), NOT of
// the buyer. Keyed by region; each crop carries yield (t/ha), conventional price (EUR/t),
// variable_cost (EUR/ha) and a source_label for provenance. These OVERRIDE KWIN's
// yield_ha/price_conv/cost_ha; everything else (quality, bio price) still comes from KWIN (NL).
// NOTE: logistics + customs are kept OUT of this object on purpose — they belong to the
// buyer⇄farm route (see LOGISTICS + BUYER_LOCATION), so the same UK production data can serve a
// UK buyer (no border) or an NL buyer (border) without change.
var REGIONAL_CROP_DATA = {
  nl: {
    // src: KWIN-AGV 2024 (NL) — migrated 1:1 from the KWIN table above (yield kg/ha ÷1000 = t/ha)
    green_beans:{yield_t_ha:10.0, price_conv:330, variable_cost_ha:2100, source_label:'KWIN-AGV 2024'},
    wheat:      {yield_t_ha:9.4,  price_conv:230, variable_cost_ha:1400, source_label:'KWIN-AGV 2024'},
    potatoes:   {yield_t_ha:49.5, price_conv:170, variable_cost_ha:3300, source_label:'KWIN-AGV 2024'},
    onions:     {yield_t_ha:47.0, price_conv:130, variable_cost_ha:8507, source_label:'KWIN-AGV 2024'},
    lentils:    {yield_t_ha:4.5,  price_conv:420, variable_cost_ha:1000, source_label:'KWIN-AGV 2024'},
    oats:       {yield_t_ha:5.2,  price_conv:210, variable_cost_ha:950,  source_label:'KWIN-AGV 2024'},
    peas:       {yield_t_ha:5.0,  price_conv:420, variable_cost_ha:1000, source_label:'KWIN-AGV 2024'},
    carrots:    {yield_t_ha:80.0, price_conv:100, variable_cost_ha:2200, source_label:'KWIN-AGV 2024'},
  },
  uk_norfolk: {
    // src: AHDB Farmbench / Grain Market Daily 2024/25 — UNVERIFIED-but-traceable, values in EUR
    wheat:    {yield_t_ha:8.0,  price_conv:235, variable_cost_ha:670,  source_label:'AHDB Farmbench / Grain Market Daily 2024/25'}, // SOURCE: AHDB feed wheat Nov-25 £199.66/t, full econ cost ~£1610/ha
    potatoes: {yield_t_ha:45.0, price_conv:230, variable_cost_ha:2350, source_label:'AHDB Farmbench / Grain Market Daily 2024/25'}, // SOURCE: AHDB highest-overhead crop, var cost ~9x combinables
    peas:     {yield_t_ha:4.2,  price_conv:280, variable_cost_ha:290,  source_label:'AHDB Farmbench / Grain Market Daily 2024/25'}, // SOURCE: AHDB feed peas, low input, N-fixing
  },
};

// Map a sourcing origin (currentSource) to its crop-production region. The crop region can also
// be set directly via the `region` field (e.g. the Bolwick preset sets region='uk_norfolk').
var SOURCE_TO_CROP_REGION = {uk:'uk_norfolk', netherlands:'nl', mixed_eu:'nl'};
// A crop region is available if either the live DB layer (mkt.cropData) or the hardcoded fallback has it.
function cropRegionAvailable(region, mkt) {
  return !!((mkt && mkt.cropData && mkt.cropData[region]) || REGIONAL_CROP_DATA[region]);
}
function resolveCropRegion(d, mkt) {
  if (d && d.region && cropRegionAvailable(d.region, mkt)) return d.region;    // explicit crop region
  var src = d && d.currentSource;
  if (src && mkt && mkt.regions && mkt.regions[src] && mkt.regions[src].crop_region) return mkt.regions[src].crop_region; // DB-driven
  if (src && SOURCE_TO_CROP_REGION[src]) return SOURCE_TO_CROP_REGION[src];    // hardcoded fallback
  return 'nl';                                                                 // default: NL benchmarks
}
// Build the effective crop coefficients: KWIN quality fields + regional production overrides.
// Production overrides come from the live DB layer (mkt.cropData) first, then the hardcoded
// REGIONAL_CROP_DATA, then NL as a last resort — so the engine never breaks if the DB is empty.
function cropCoefficients(crop, cropRegion, mkt) {
  var base = KWIN[crop] || KWIN.green_beans;
  var k = {}; for (var f in base) k[f] = base[f];                              // clone — never mutate KWIN
  var rcd = (mkt && mkt.cropData && mkt.cropData[cropRegion] && mkt.cropData[cropRegion][crop])
         || (REGIONAL_CROP_DATA[cropRegion] && REGIONAL_CROP_DATA[cropRegion][crop])
         || (mkt && mkt.cropData && mkt.cropData.nl && mkt.cropData.nl[crop])
         || REGIONAL_CROP_DATA.nl[crop];
  if (rcd) {
    // Per-field override: a provisional region may have e.g. yield but no price/cost yet — keep the
    // KWIN/NL fallback for any field the regional row leaves null, instead of zeroing it out.
    if (rcd.yield_t_ha != null)       k.yield_ha   = Math.round(rcd.yield_t_ha * 1000); // t/ha -> kg/ha
    if (rcd.price_conv != null)       k.price_conv = rcd.price_conv;
    if (rcd.variable_cost_ha != null) k.cost_ha    = rcd.variable_cost_ha;
    if (rcd.source_label)             k.source_label = rcd.source_label;
  }
  if (!k.source_label) k.source_label = 'KWIN-AGV 2024';
  return k;
}

// ── DELIVERY SPEC MODIFIERS ──────────────────────────────
var DELIVERY_MOD = {
  fresh:   {tare_mult:1.0,  dm_mult:1.3,  shelf_risk:1.5, logistics_mult:1.4, label:'fresh market'},
  frozen:  {tare_mult:0.85, dm_mult:1.15, shelf_risk:0.4, logistics_mult:1.0, label:'frozen processing'},
  canned:  {tare_mult:0.80, dm_mult:1.20, shelf_risk:0.2, logistics_mult:0.9, label:'canning / preserving'},
  dried:   {tare_mult:0.70, dm_mult:1.40, shelf_risk:0.1, logistics_mult:0.8, label:'drying / dehydration'},
  any:     {tare_mult:1.0,  dm_mult:1.0,  shelf_risk:1.0, logistics_mult:1.0, label:'any / not specified'},
};

// ── SECTOR MODIFIERS ─────────────────────────────────────
var SECTOR_MOD = {
  food_processor: {processing_value_mult:1.3, csrd_urgency:1.2, quality_premium:1.2, label:'food processor'},
  retailer:       {processing_value_mult:0.8, csrd_urgency:1.1, quality_premium:1.4, label:'retailer/supermarket'},
  catering:       {processing_value_mult:0.9, csrd_urgency:0.9, quality_premium:1.1, label:'catering/foodservice'},
  wholesaler:     {processing_value_mult:0.7, csrd_urgency:0.8, quality_premium:0.9, label:'wholesaler'},
  exporter:       {processing_value_mult:0.6, csrd_urgency:0.7, quality_premium:0.8, label:'exporter'},
};

// ── SEASONALITY MODIFIERS ────────────────────────────────
var SEASON_MOD = {
  year_round:  {supply_risk_mult:1.3, farm_count_mult:1.5, label:'year-round supply needed'},
  seasonal:    {supply_risk_mult:0.8, farm_count_mult:0.7, label:'seasonal window (3-6 months)'},
  flexible:    {supply_risk_mult:1.0, farm_count_mult:1.0, label:'flexible timing'},
};

// ── RISK PERCENTAGES ─────────────────────────────────────
var RISK_PCT = {
  geopolitical: {morocco_egypt:0.15, turkey_spain:0.08, netherlands:0.02, mixed_eu:0.045, mixed_global:0.115, uk:0.04}, // uk: stable OECD
  weather_conv: {morocco_egypt:0.30, turkey_spain:0.22, netherlands:0.20, mixed_eu:0.18, mixed_global:0.25, uk:0.22}, // morocco_egypt: JRC MARS drought 2024 (was 0.32); uk: higher rainfall variability than NL
  weather_regen: 0.12,
  recall_conv:  {none:0.003, minor:0.012, moderate:0.035, major:0.09},
  recall_regen: 0.0008,
  price_vol:    {mostly_spot:0.38, mixed:0.20, mostly_contract:0.10, full_contract:0.04},
  price_vol_regen: 0.07,
  csrd_gap:     {mandatory_2025:120000, mandatory_2026:75000, voluntary:20000, not_yet:0},
  concentration_base: 0.30,
};

var LOGISTICS = {
  // Transport costs per tonne by source region (€/t including freight, handling, port)
  transport: {
    morocco_egypt:  {cost_per_t:68, distance_km:3400, transit_days:14, buffer_weeks:4},
    turkey_spain:   {cost_per_t:42, distance_km:2200, transit_days:8,  buffer_weeks:3},
    netherlands:    {cost_per_t:8,  distance_km:120,  transit_days:1,  buffer_weeks:1},
    mixed_eu:       {cost_per_t:22, distance_km:900,  transit_days:3,  buffer_weeks:2},
    mixed_global:   {cost_per_t:75, distance_km:4000, transit_days:18, buffer_weeks:5},
    uk:             {cost_per_t:30, distance_km:480,  transit_days:2,  buffer_weeks:2}, // Stena Harwich-Hook short-sea + road (key is cost_per_t to match logiComponents)
  },
  // Cold chain cost premium per tonne per week of transit
  cold_chain_per_week: 12,
  // Storage cost per tonne per week (ambient)
  storage_ambient_per_week: 4,
  // Storage cost per tonne per week (cold)
  storage_cold_per_week: 9,
  // Inventory carrying cost (% of product value per week in transit/buffer)
  carrying_cost_pct_per_week: 0.004,
  // Spoilage risk by delivery spec and transit duration
  spoilage: {
    fresh:  {morocco_egypt:0.06, turkey_spain:0.04, netherlands:0.005, mixed_eu:0.02, mixed_global:0.08},
    frozen: {morocco_egypt:0.01, turkey_spain:0.008,netherlands:0.001,mixed_eu:0.005,mixed_global:0.015},
    canned: {morocco_egypt:0.003,turkey_spain:0.002,netherlands:0.001,mixed_eu:0.002,mixed_global:0.004},
    dried:  {morocco_egypt:0.002,turkey_spain:0.002,netherlands:0.001,mixed_eu:0.002,mixed_global:0.003},
    any:    {morocco_egypt:0.03, turkey_spain:0.02, netherlands:0.003,mixed_eu:0.012,mixed_global:0.04},
  },
  // Import/customs cost per tonne charged to an EU buyer (non-EU sourcing). Gated by customsCost()
  // against BUYER_LOCATION so a same-customs-area buyer (e.g. UK->UK) incurs nothing.
  import_cost: {morocco_egypt:18, turkey_spain:0, netherlands:0, mixed_eu:0, mixed_global:22, uk:45}, // uk: post-Brexit BTOM/Common User Charge + SPS, EUR/t GB->EU
  // Internal logistics saving from shorter supply chain (% of transport cost)
  internal_saving_pct: 0.15,

  // ── EXTENDED LOGISTICS VARIABLES ──
  // CALIBRATED 2026-06-06 via multi-source deep research (EEA/CE Delft, GLEC July 2022,
  // Eurostat 2024, Drewry WCI, IRU Q4 2025; 20/25 claims adversarially verified).
  // CO2 + fuel are now MODE-SPLIT (road vs sea) — a single uniform factor was wrong by
  // ~20x across modes; logiComponents selects road/sea per route's isSea flag.
  fuel: {
    diesel_price_eur_l:   1.65,   // EU avg diesel ~2024; live-fed via intelligence pipeline (mkt.diesel)
    // Diesel LITRES per tonne-km, mode-split. HIGH confidence (CE Delft STREAM 2020, ICCT, UK DfT):
    // heavy artic ~1.2-1.4 MJ/tkm ÷ 36 MJ/L diesel = 0.033-0.039; set 0.030 for medium fleet load +
    // efficiency trend. Sea = mid-size bulker 0.09 MJ/tkm ÷ 40 MJ/L = 0.0022 (near-exact match);
    // sea burns HFO/VLSFO not diesel, so the diesel price is an energy proxy. src: CE Delft STREAM 2020.
    intensity_road_l_per_t_km: 0.030,  // CE Delft STREAM 2020 (range 0.025-0.036)
    intensity_sea_l_per_t_km:  0.002,  // CE Delft mid-size bulker (range 0.002-0.008 incl. general-cargo)
  },
  emissions: {
    // Well-to-wheel kgCO2e per tonne-km, mode-split. HIGH confidence (EEA/CE Delft EU-27 2018,
    // IPCC AR4): HGV 0.137 fleet-avg (ICCT long-haul ~0.05-0.06) -> 0.110 for NL+EU road legs;
    // total maritime 0.0066 (container 0.0082, bulk 0.0045) -> 0.008. Old uniform 0.062 understated
    // road ~2.2x and overstated sea ~9x. src: cedelft.eu GHG-efficiency 2021, GLEC July 2022.
    co2_road_kg_per_t_km: 0.110,
    co2_sea_kg_per_t_km:  0.008,
    carbon_price_eur_t: 80,       // EU ETS ~2024 / CSRD scope-3 shadow price; live-fed via mkt.carbon
  },
  // Vehicle/container utilisation 0-1 (lower = more empty running -> higher per-tonne cost).
  // Eurostat 2024: national/short-haul road 25.8% empty (~0.74) vs international 12.6% (~0.87);
  // short-road < long-haul ordering CONFIRMED (HIGH). Maritime lowered from 0.88-0.92 (MEDIUM):
  // GLEC 70% container default was refuted as a clean benchmark and laden trips run ~50-60% loaded,
  // so 0.70-0.80 is realistic for sea. src: Eurostat road-freight journey characteristics 2024.
  load_factor: {morocco_egypt:0.78, turkey_spain:0.80, netherlands:0.75, mixed_eu:0.82, mixed_global:0.78, uk:0.82},
  // Annualised average seasonal/peak freight surcharge on haulage. HIGH: maritime PSS spikes
  // 17-28% of base FEU but only part-year; road contract rates +~2% Q4'25 -> 0.08 mid-point.
  // src: Drewry WCI (Jun 2026), IRU Q4 2025 benchmark, Seatrade peak-season.
  peak_surcharge_pct: 0.08,
  // Transit-time spoilage curve (%/day) by delivery spec. Relative ordering (fresh >> frozen >>
  // canned/dried) confirmed — green beans/legumes are highly perishable, few-days shelf life
  // (NC State Extension, FAO). Per-day MAGNITUDES remain unsourced: a targeted FAO/WUR search
  // (2026-06) found no in-transit %/day primary; four shelf-life-to-decay conversions were refuted.
  // Retained as LOW-confidence placeholder. src: NC State green-bean/field-pea postharvest.
  spoilage_per_day: {fresh:0.006, frozen:0.0008, canned:0.0002, dried:0.0002, any:0.003},
  spoilage_cap: 0.10,
  // Packaging (per tonne) by delivery spec. LOW: targeted search (2026-06) found no usable current
  // benchmark — the only FAO packaging-cost table is 1988-dollar (X5016E06, unusable without ~2.6x
  // inflation + USD->EUR) and a FIBC bulk-bag quote was refuted as single-vendor. Ordering plausible,
  // €4-9/t magnitude not implausible for bulk transport packaging; retained as placeholder.
  packaging_eur_t: {fresh:9, frozen:6, canned:5, dried:4, any:6},
  // Reverse logistics as % of forward transport. Bulk agri returns << retail/e-commerce (10-30%);
  // targeted search (2026-06) found no RTP-pooling/CHEP-IFCO cost-share primary. 0.02 retained as a
  // sound low placeholder (range 0.01-0.03), LOW confidence (domain reasoning only).
  returns_pct: 0.02,
};

// Carbon €/ha/yr — capped at max €15 (Rabobank sequestration data + VCM price €5/ton CO2, 2024).
// Scaled to the €15 ceiling, legumes (N-fixing) highest. Was 30–65/ha (unsourced).
var CARBON_POTENTIAL = {green_beans:9, wheat:13, potatoes:8, onions:7, lentils:15, oats:12, peas:15, carrots:8};
var PROCESSING_CONF  = {green_beans:'HIGH', peas:'HIGH', lentils:'HIGH', wheat:'HIGH', oats:'MEDIUM', carrots:'LOW', potatoes:'LOW', onions:'LOW'};

// Sea-route source regions — exposed to maritime shocks (freight, transit, geopolitics).
// Netherlands / mixed_eu are land/short-haul and structurally immune to these.
var SEA_ROUTES = {morocco_egypt:true, turkey_spain:true, mixed_global:true, uk:true}; // uk: Channel short-sea leg

// ── BUYER LOCATION vs FARM LOCATION ──────────────────────
// Logistics + customs are a function of the route from the source to the BUYER, not of the farm
// alone. The UI currently exposes only an NL (EU) buyer, but the structure below keeps customs
// buyer-aware: customsCost() charges import_cost only when the source sits in a DIFFERENT customs
// area than the buyer — so a UK farm -> UK buyer pays 0, while a UK farm -> NL buyer pays the GB->EU
// charge. Production data (REGIONAL_CROP_DATA) stays separate so it is unaffected by buyer location.
var BUYER_LOCATION = 'nl';   // default buyer location when the request omits one (NL = EU)
var BUYER_IS_EU = true;      // NL buyer sits inside the EU customs area
// EU / customs-union membership by source key (hardcoded fallback; the DB carries is_eu per region).
var IS_EU = {netherlands:true, mixed_eu:true, turkey_spain:false, morocco_egypt:false, mixed_global:false, uk:false};
// Buyer location -> inside the EU customs area? The UI defaults to NL; the field lets a non-EU
// buyer (e.g. UK) be modelled so a UK->UK route pays no customs while UK->NL does. Unknown or
// missing -> default EU buyer, so existing submissions compute exactly as before.
var BUYER_IS_EU_BY_LOCATION = {nl:true, eu:true, uk:false};
function buyerIsEU(loc) {
  if (loc == null || loc === '') return BUYER_IS_EU;
  return BUYER_IS_EU_BY_LOCATION[loc] != null ? BUYER_IS_EU_BY_LOCATION[loc] : BUYER_IS_EU;
}
function customsCost(region, buyerEu) {
  // region is a resolved region object. Same customs area as the buyer => no border cost.
  if (!region) return 0;
  if (buyerEu == null) buyerEu = BUYER_IS_EU;   // default: NL/EU buyer (back-compat)
  if (!!region.is_eu === buyerEu) return 0;
  return region.import_cost || 0;
}

// ── CONSOLIDATED REGION TABLE (hardcoded fallback) ───────
// One object per source region, assembled from RISK_PCT + LOGISTICS + SEA_ROUTES + IS_EU above.
// The live DB layer (region_coefficients via getRegionalData) is merged OVER this per request by
// buildRegions(), so a new region is a DB row — but if the DB is empty/unreachable the engine
// still runs on these values unchanged.
var HARDCODED_REGIONS = (function () {
  var out = {};
  for (var key in LOGISTICS.transport) {
    out[key] = {
      geopolitical: RISK_PCT.geopolitical[key],
      weather_conv: RISK_PCT.weather_conv[key],
      transport:    LOGISTICS.transport[key],
      load_factor:  LOGISTICS.load_factor[key],
      import_cost:  LOGISTICS.import_cost[key],
      is_sea:       !!SEA_ROUTES[key],
      is_eu:        !!IS_EU[key],
      crop_region:  SOURCE_TO_CROP_REGION[key] || 'nl',
    };
  }
  return out;
})();
// Merge the live DB regions over the hardcoded fallback (field-by-field, DB wins when present).
function buildRegions(dbRegions) {
  var out = {};
  for (var k in HARDCODED_REGIONS) out[k] = HARDCODED_REGIONS[k];
  if (dbRegions) for (var d in dbRegions) {
    var s = dbRegions[d], b = out[d] || {};
    out[d] = {
      geopolitical: s.geopolitical != null ? s.geopolitical : b.geopolitical,
      weather_conv: s.weather_conv != null ? s.weather_conv : b.weather_conv,
      transport:    s.transport || b.transport,
      load_factor:  s.load_factor != null ? s.load_factor : b.load_factor,
      import_cost:  s.import_cost != null ? s.import_cost : b.import_cost,
      is_sea:       s.is_sea != null ? s.is_sea : b.is_sea,
      is_eu:        s.is_eu != null ? s.is_eu : b.is_eu,
      crop_region:  s.crop_region || b.crop_region || 'nl',
    };
  }
  return out;
}

// ── SHOCK SCENARIO LIBRARY ───────────────────────────────
// Named forward-looking stress tests. Each shock applies multipliers/additions to the
// existing risk + logistics layers. Sea-route sources are hit; near-shored NL barely moves.
// CALIBRATED 2026-06-06 via multi-source deep research (24/25 claims adversarially verified).
// fuel_mult referent = EU PUMP DIESEL (logiComponents applies it to the diesel price).
// Sources: EIA, IRU, Eurostat, ITF-OECD, Drewry, FAO, IMF, World Bank, Springer ME&L 2024.
// geo_risk_add stays EXPERT-PRIOR (LOW confidence): relative ordering is evidence-backed
// (mixed_global >= morocco_egypt > turkey_spain) but absolute values are not source-grounded
// (TODO: anchor to war-risk insurance surcharges on Red Sea/Hormuz transits).
var SCENARIOS = {
  none:   {label:'Base case (no shock)',           desc:'', fuel_mult:1,    freight_mult:1,   transit_add_days:0,  price_vol_mult:1,    geo_risk_add:{}},
  // Hormuz: EU diesel +26-29% live 2026 (IRU) -> 1.30; Gulf->ARA Cape reroute +16d (EIA);
  // freight 1.60 conservative vs 2.3-4.4x peaks; price_vol from FAO/IMF transmission.
  hormuz: {label:'Strait of Hormuz closure',       desc:'Oil/energy spike + maritime disruption + rerouting around Africa',
           fuel_mult:1.30, freight_mult:1.60, transit_add_days:16, price_vol_mult:1.30,
           geo_risk_add:{morocco_egypt:0.10, turkey_spain:0.06, mixed_global:0.12, mixed_eu:0.01, netherlands:0.00}},
  // Red Sea: best-validated scenario. transit +12d exact (Springer ME&L 2024); freight 1.40
  // (+130% containers Nov'23->Mar'24, Drewry); fuel 1.20 (tankers +20%, EIA).
  redsea: {label:'Red Sea / Suez disruption',      desc:'Cape rerouting — freight and transit up across maritime routes',
           fuel_mult:1.20, freight_mult:1.40, transit_add_days:12, price_vol_mult:1.20,
           geo_risk_add:{morocco_egypt:0.05, turkey_spain:0.04, mixed_global:0.08, mixed_eu:0.01, netherlands:0.00}},
  // Energy: road diesel +45.2% peak 2022 (Eurostat) -> 1.45; road freight pass-through only
  // ~+2.3% (IRU) so sea freight 1.08; price_vol 1.15 (IMF).
  energy: {label:'EU energy price spike',          desc:'Diesel/gas surge — all transport up, sea and land',
           fuel_mult:1.45, freight_mult:1.08, transit_add_days:0,  price_vol_mult:1.15,
           geo_risk_add:{}},
};

// ── CROP-CONCENTRATION RISK LAYER (todo2) ────────────────
// Measures how strongly ONE crop dominates the landscape around a farm: a higher same-crop share
// within the pest-spread radius => higher pest/disease pressure => a risk add-on. This is an
// ENRICHMENT layer — it only activates when the request supplies farm_lat/farm_lon AND a parcel
// source is available; otherwise it is OMITTED (never silently zeroed) and the reason is surfaced.
// Requests that don't use it compute exactly as before (the todo.md fixtures stay green).
//
// ⚠ AGRONOMY KNOBS — NOT ENGINEERING. The pest-spread RADIUS per crop and the concentration→risk
// THRESHOLDS/ADD-ONS below are voorlopige aannames, agronomische validatie vereist (verified:false).
// They are surfaced as explicit parameters, never buried in the math, and must NOT be presented as
// established biology — a plant pathologist fills these later (ideally a per-(crop,pest) table).
var CROP_CONCENTRATION = {
  // ── KNOB 1: pest-spread radius per crop (km) — literature-grounded for potatoes ──
  // The pipeline reads .km; mode/confidence/source document provenance. A crop ABSENT here reports
  // "unavailable" (fail-soft) — fill it from a pathogen source, never guess.
  radius: {
    potatoes: { km: 15, mode: 'wind-borne fungal (Phytophthora infestans / late blight)', confidence: 'MEDIUM',
      // ≥16 km field separation is needed to fully prevent regional late-blight epidemic spread; wind-borne
      // sporangia travel 10–20 km in <3 h. 15 km = slightly conservative mid-range effective radius.
      source: 'Firester et al. 2018, Plant Pathology (regional P. infestans modelling, ≥16 km separation); APS review PHYTO-04-18-0130-IA (10–20 km wind dispersal); Hannukkala et al. 2007 (lack of rotation → earlier/larger epidemics)' },
    // Other crops are not individually sourced yet → unavailable until filled. Use the mode guide
    // below + a pathogen-specific source; set the per-crop `confidence` honestly.
  },
  // Dispersal-mode guide (km) for FILLING new crops later — REFERENCE ONLY, not auto-applied:
  // wind-borne fungal (blights/rusts) ~15; insect-vectored virus ~5; soil-borne (nematodes/Rhizoctonia) ~2.
  radius_mode_guide_km: { wind_fungal: 15, vector_virus: 5, soil_borne: 2 },

  // ── KNOB 2: concentration → risk. THREE-LEVEL THRESHOLD model (NOT linear) ──
  // The STEP form is evidence-based: pathogen invasion across a landscape is a PERCOLATION phenomenon —
  // risk climbs sharply once the same-crop host fraction crosses a critical connectivity threshold, so a
  // threshold model fits better than a linear curve. Threshold POSITIONS are grounded; ADD-ON MAGNITUDES
  // are not. Critical host fraction in the literature: ~0.33 empirical (Davis et al. 2008, PNAS-percolation
  // threshold) up to ~0.41 static percolation, and spatial clustering of the same crop LOWERS it further:
  //   share < 0.30          -> subcritical: spread stays local                       -> low add-on
  //   0.30 ≤ share < 0.50   -> transition zone around the percolation threshold      -> medium add-on
  //   share ≥ 0.50          -> supercritical: connected host matrix, landscape epidemic possible -> high
  thresholds: { medium: 0.30, high: 0.50 }, // CONFIDENCE MEDIUM (percolation theory). verified:false — agronomische validatie vereist
  // Add-on as % of contract value per regime. CONFIDENCE LOW (expert-prior): ordering follows the
  // percolation regimes; magnitudes are anchored loosely to the engine's other risk add-ons
  // (geopolitical ~4–15%) — high=0.06 sits mid-range, low=0.01 ≈ noise. Validate with a plant pathologist.
  addon_pct: { low: 0.01, medium: 0.03, high: 0.06 }, // verified:false — voorlopige aanname, agronomische validatie vereist
  regen_addon_pct: 0.01,                              // diversified near-shored baseline // verified:false
  verified: false,
};
// Effective pest-spread radius (km) for a crop, or null when not sourced (=> layer unavailable, fail-soft).
function cropRadiusKm(crop) { var r = CROP_CONCENTRATION.radius[crop]; return r && r.km != null ? r.km : null; }

// Parcel-source registry, keyed by country (like REGIONAL_CROP_DATA). nl => BRP (PDOK/RVO).
// uk/dk/pt are EXPLICIT empty stubs: LPIS availability/coverage per country is UNVERIFIED and must be
// checked before use — do NOT assume EU-wide coverage. An unfilled country fails loud (explicit
// unavailable reason), never a silent zero.
// ── CONCENTRATION PROVIDER REGISTRY (worldwide foundation) ──
// Crop concentration is measurable at three DATA TIERS; each provider declares its capability so the
// resolution chain (resolveConcentrationGlobal) can pick the best available source for ANY farm
// worldwide and label the result honestly (provider + method + confidence + coverage), degrading to an
// explicit "no source yet" — never a silent or faked number.
//   tier 1  crop_type_parcel   HIGH    per-country parcel registries — true same-crop share, any crop
//   tier 2  crop_group_raster  MEDIUM  global coarse crop groups (cereals/maize) — ESA WorldCereal
//   tier 3  cropland_only      LOW     global cropland-presence proxy — ESA WorldCover / Dynamic World
// The precompute cache (crop_concentration_grid) is keyed by lat/lon, so it is the UNIVERSAL GLOBAL
// store: any provider that precomputes cells anywhere makes those farms resolvable instantly.
// To add a country/source: add a provider here (+ a precompute path); no change to the calculation.
var CONCENTRATION_PROVIDERS = [
  { id: 'nl-brp', tier: 1, granularity: 'crop_type_parcel', confidence: 'HIGH',
    coverage: { type: 'country', countries: ['nl'] }, crops: '*',
    label: 'BRP Gewaspercelen (PDOK/RVO)',
    resolve: function (lat, lon, crop) { return getBRPConcentration(lat, lon, crop); } },  // live WFS, density-guarded
  // Tier-2 EU real crop-TYPE — CLMS Crop Types Europe 10m via CDSE openEO. Served through the
  // precompute cache (scripts/precompute-concentration-openeo.js PROVIDER=clms); the credential-free
  // production engine does not call openEO live, so resolve() is a cache-miss explainer.
  { id: 'clms-eu', tier: 2, granularity: 'crop_type_raster', confidence: 'MEDIUM',
    coverage: { type: 'eu' }, crops: ['potatoes', 'wheat', 'oats'],
    label: 'CLMS Crop Types Europe 10m (openEO/CDSE)',
    resolve: function () { return Promise.resolve({ available: false, deferred: true,
      reason: 'CLMS EU crop-type (Tier-2) is served via the precompute cache; not yet precomputed here — run the openEO precompute (PROVIDER=clms) for this area' }); } },
  // Tier-3 global cropland-density PROXY — ESA WorldCover via CDSE openEO, served via the precompute cache.
  { id: 'cropland-proxy', tier: 3, granularity: 'cropland_only', confidence: 'LOW',
    coverage: { type: 'global' }, crops: '*',
    label: 'ESA WorldCover cropland density (openEO/CDSE, proxy)',
    resolve: function () { return Promise.resolve({ available: false, deferred: true,
      reason: 'cropland-density proxy (Tier-3 global, cropland presence only — not crop-type) served via the precompute cache; not yet precomputed here — run the openEO precompute (PROVIDER=worldcover)' }); } },
];
// EU-27 (+ where CLMS Crop Types Europe has coverage) for the 'eu' coverage tier.
var EU_COUNTRIES = ['nl','be','de','fr','dk','pt','es','it','pl','at','se','fi','ie','cz','sk','hu','ro','bg','gr','hr','si','lt','lv','ee','lu','mt','cy'];
function providerApplies(p, country, crop) {
  if (p.coverage.type === 'country' && (!country || p.coverage.countries.indexOf(country) < 0)) return false;
  if (p.coverage.type === 'eu' && (!country || EU_COUNTRIES.indexOf(country) < 0)) return false;
  if (p.crops !== '*' && p.crops.indexOf(crop) < 0) return false;
  return true;
}

// BRP `gewas` (Dutch, granular: several potato categories) -> engine crop key, matched by substring.
// verified:false — extend as crops are added.
var BRP_CROP_MATCH = {
  potatoes: ['aardappel'], wheat: ['tarwe'], onions: ['ui, ', 'uien', 'zaaiui', 'plantui'],
  carrots: ['peen', 'wortel'], green_beans: ['boon', 'bonen'], peas: ['erwt'],
  oats: ['haver'], lentils: ['linze'],
};

// Hand-placed example parcels around Dronten, Flevoland (~52.53N, 5.72E) — enough to exercise the
// radius, clustering, share and threshold model offline. crop key + centroid + area_ha. One potato
// parcel sits OUTSIDE the 15km radius to prove radius exclusion. NOT real BRP data (none committed).
var DRONTEN_EXAMPLE = {
  source_label: 'voorbeelddata Dronten (handmatig)', verified: false,
  farm: { lat: 52.53, lon: 5.72 },
  parcels: [
    { crop: 'potatoes', lat: 52.535, lon: 5.725, area_ha: 20 },
    { crop: 'potatoes', lat: 52.525, lon: 5.715, area_ha: 25 },
    { crop: 'potatoes', lat: 52.540, lon: 5.730, area_ha: 15 },
    { crop: 'wheat',    lat: 52.520, lon: 5.710, area_ha: 18 },
    { crop: 'onions',   lat: 52.545, lon: 5.735, area_ha: 12 },
    { crop: 'wheat',    lat: 52.515, lon: 5.705, area_ha: 10 },
    { crop: 'potatoes', lat: 52.700, lon: 5.900, area_ha: 30 }, // ~22 km away -> excluded by radius
  ],
};

function haversineKm(lat1, lon1, lat2, lon2) {
  var R = 6371, toRad = function (x) { return x * Math.PI / 180; };
  var dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) +
          Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
// Map a same-crop share to {level, addon_pct} via the three-level threshold model.
function concentrationLevel(share) {
  var t = CROP_CONCENTRATION.thresholds, a = CROP_CONCENTRATION.addon_pct;
  if (share >= t.high)   return { level: 'high',   addon_pct: a.high };
  if (share >= t.medium) return { level: 'medium', addon_pct: a.medium };
  return { level: 'low', addon_pct: a.low };
}
// Pure pipeline: same-crop area share within the pest radius around the farm -> risk model.
// parcels each carry {crop, lat, lon, area_ha}. Returns an explicit available/unavailable result.
function concentrationFromParcels(farmLat, farmLon, crop, parcels, sourceLabel, basis) {
  var radius = cropRadiusKm(crop);
  if (radius == null) return { available: false, reason: 'no pest-radius defined for crop "' + crop + '" (agronomy knob unfilled)' };
  if (farmLat == null || farmLon == null) return { available: false, reason: 'no farm coordinates supplied' };
  var inR = parcels.filter(function (p) { return haversineKm(farmLat, farmLon, p.lat, p.lon) <= radius; });
  var total = inR.reduce(function (s, p) { return s + (p.area_ha || 0); }, 0);
  if (total <= 0) return { available: false, reason: 'no agricultural parcels within ' + radius + ' km of the farm' };
  var same = inR.filter(function (p) { return p.crop === crop; }).reduce(function (s, p) { return s + (p.area_ha || 0); }, 0);
  var share = same / total;
  var lvl = concentrationLevel(share);
  return {
    available: true, share: share, level: lvl.level, addon_pct: lvl.addon_pct, radius_km: radius,
    same_crop_ha: Math.round(same), total_ha: Math.round(total), n_parcels: inR.length,
    source_label: sourceLabel, verified: false, basis: basis || 'area',
  };
}
// Country for a crop region (concentration uses the FARM's country to pick the parcel source).
function countryOfCropRegion(cropRegion) {
  if (!cropRegion) return 'nl';
  if (cropRegion === 'nl') return 'nl';
  return cropRegion.split('_')[0];   // e.g. uk_norfolk -> uk
}
// SYNC resolver for calculate()'s offline path (tests + when the handler hasn't pre-resolved). Uses the
// hand-placed NL example for nl; otherwise an explicit tiered "unavailable" (no network here). The live
// + global resolution (cache + providers) is async — see resolveConcentrationGlobal (handler).
function resolveConcentrationSync(d, mkt) {
  var crop = d.crop || 'green_beans';
  if (d.farm_lat == null || d.farm_lon == null) return { available: false, reason: 'no farm coordinates supplied' };
  var country = d.farm_country || countryOfCropRegion(resolveCropRegion(d, mkt)) || null;
  if (country === 'nl') {
    var r = concentrationFromParcels(d.farm_lat, d.farm_lon, crop, DRONTEN_EXAMPLE.parcels, DRONTEN_EXAMPLE.source_label, 'area (example)');
    if (r.available) { r.provider = 'nl-example'; r.method = 'crop_type_parcel'; r.confidence = 'HIGH'; r.coverage = 'country'; r.country = 'nl'; }
    return r;
  }
  var applicable = CONCENTRATION_PROVIDERS.filter(function (p) { return providerApplies(p, country, crop); });
  return { available: false, country: country,
    reason: 'no offline parcel source for country "' + (country || 'unknown') + '" (LPIS coverage UNVERIFIED / stub not filled). Applicable provider tiers: ' +
      (applicable.length ? applicable.map(function (p) { return p.id + ' (' + p.tier + '/' + p.confidence + ', not wired offline)'; }).join('; ') : 'none') + '.' };
}

// ASYNC resolution chain for ANY farm worldwide: cache first (global, instant — resolves the dense 15 km
// case), then the best applicable LIVE provider by tier, else an explicit tiered "unavailable" reason.
async function resolveConcentrationGlobal(d, mkt, supabaseUrl, supabaseKey) {
  var crop = d.crop || 'green_beans';
  if (d.farm_lat == null || d.farm_lon == null) return { available: false, reason: 'no farm coordinates supplied' };
  var lat = Number(d.farm_lat), lon = Number(d.farm_lon);
  var country = d.farm_country || countryOfCropRegion(resolveCropRegion(d, mkt)) || null;

  var cached = await getConcentrationFromCache(lat, lon, crop, supabaseUrl, supabaseKey);   // global by coords
  if (cached && cached.available) return cached;

  var applicable = CONCENTRATION_PROVIDERS.filter(function (p) { return providerApplies(p, country, crop); });
  var tried = [];
  for (var i = 0; i < applicable.length; i++) {
    var p = applicable[i];
    var r = await p.resolve(lat, lon, crop);
    if (r && r.available) {
      r.provider = p.id; r.method = p.granularity; r.confidence = p.confidence; r.coverage = p.coverage.type; r.country = country;
      return r;
    }
    tried.push(p.id + ' (' + p.tier + '/' + p.confidence + '): ' + ((r && r.reason) || 'unavailable'));
  }
  return { available: false, country: country, tiers_tried: tried,
    reason: 'no usable crop-concentration source for ' + crop + (country ? ' in ' + country : ' (country unknown)') +
      '. Tiers tried: ' + (tried.length ? tried.join('; ') : 'none applicable') +
      '. Add a parcel source for this country, or wire a global provider (WorldCereal / cropland proxy).' };
}

// ── LIVE BRP SOURCE (PDOK/RVO) ───────────────────────────
// PDOK's BRP WFS honours the spatial `bbox` param but NOT cql_filter or propertyName, so there is no
// server-side crop filter and geometry always comes back. A density PREFLIGHT (resultType=hits, which
// IS honoured) guards the serverless budget: above the cap we defer with the exact parcel count
// instead of downloading tens of thousands of polygons.
var BRP_BASE = 'https://service.pdok.nl/rvo/brpgewaspercelen/wfs/v1_0?service=WFS&version=2.0.0&typeName=brpgewaspercelen:BrpGewas';
function brpBbox(farmLat, farmLon, radiusKm) {
  var dLat = radiusKm / 111, dLon = radiusKm / (111 * Math.cos(farmLat * Math.PI / 180));
  return [farmLat - dLat, farmLon - dLon, farmLat + dLat, farmLon + dLon].join(',') + ',urn:ogc:def:crs:EPSG::4326';
}
function ringCentroid(ring) { var n = ring.length - 1, lo = 0, la = 0; for (var i = 0; i < n; i++) { lo += ring[i][0]; la += ring[i][1]; } return { lon: lo / n, lat: la / n }; }
function ringAreaHa(ring) {
  if (!ring || ring.length < 4) return 0;
  var lat0 = ring[0][1] * Math.PI / 180, mLat = 110540, mLon = 111320 * Math.cos(lat0), s = 0;
  for (var i = 0; i < ring.length - 1; i++) { s += (ring[i][0]*mLon)*(ring[i+1][1]*mLat) - (ring[i+1][0]*mLon)*(ring[i][1]*mLat); }
  return Math.abs(s) / 2 / 10000;   // m² -> ha
}
async function getBRPConcentration(farmLat, farmLon, crop, cap) {
  cap = cap || 6000;
  var radius = cropRadiusKm(crop);
  if (radius == null) return { available: false, reason: 'no pest-radius for crop "' + crop + '"' };
  var match = BRP_CROP_MATCH[crop];
  if (!match) return { available: false, reason: 'no BRP crop mapping for "' + crop + '"' };
  if (farmLat == null || farmLon == null) return { available: false, reason: 'no farm coordinates supplied' };
  var bbox = brpBbox(farmLat, farmLon, radius);
  try {
    var hitsXml = await (await fetch(BRP_BASE + '&request=GetFeature&resultType=hits&bbox=' + encodeURIComponent(bbox))).text();
    var m = hitsXml.match(/numberMatched="(\d+)"/i);
    var n = m ? Number(m[1]) : null;
    if (n == null) return { available: false, reason: 'BRP preflight failed (no numberMatched)' };
    if (n > cap) return { available: false, deferred: true, count: n, source_label: 'BRP Gewaspercelen (PDOK/RVO)',
      reason: 'BRP parcel density too high for in-request computation: ' + n + ' parcels within ' + radius + ' km (cap ' + cap + '). PDOK BRP WFS has no server-side crop filter, so this needs an offline precompute/cache step.' };
    var gj = await (await fetch(BRP_BASE + '&request=GetFeature&outputFormat=application/json&srsName=EPSG:4326&count=' + cap + '&bbox=' + encodeURIComponent(bbox))).json();
    var year = gj.features && gj.features[0] && gj.features[0].properties && gj.features[0].properties.jaar;
    var parcels = (gj.features || []).map(function (f) {
      var g = f.geometry; if (!g) return null;
      var ring = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0][0] : null;
      if (!ring) return null;
      var c = ringCentroid(ring);
      return { gewas: (f.properties && f.properties.gewas) || '', lat: c.lat, lon: c.lon, area_ha: ringAreaHa(ring) };
    }).filter(Boolean);
    var inR = parcels.filter(function (p) { return haversineKm(farmLat, farmLon, p.lat, p.lon) <= radius; });
    var total = inR.reduce(function (s, p) { return s + p.area_ha; }, 0);
    if (total <= 0) return { available: false, reason: 'no BRP parcels within ' + radius + ' km' };
    var hit = function (g) { g = (g || '').toLowerCase(); return match.some(function (sub) { return g.indexOf(sub) >= 0; }); };
    var same = inR.filter(function (p) { return hit(p.gewas); }).reduce(function (s, p) { return s + p.area_ha; }, 0);
    var share = same / total, lvl = concentrationLevel(share);
    return { available: true, share: share, level: lvl.level, addon_pct: lvl.addon_pct, radius_km: radius,
      same_crop_ha: Math.round(same), total_ha: Math.round(total), n_parcels: inR.length,
      source_label: 'BRP Gewaspercelen (PDOK/RVO)' + (year ? ' ' + year : ''), verified: false, basis: 'area (live BRP)' };
  } catch (e) { return { available: false, reason: 'BRP fetch error: ' + e.message }; }
}

// Read the OFFLINE precompute cache (crop_concentration_grid) for the nearest grid cell to the farm.
// This is what lets the 15 km case resolve instantly (the live WFS path defers at that density).
// Returns a computed-style result, or null on miss/error so the caller falls back to live WFS.
async function getConcentrationFromCache(farmLat, farmLon, crop, supabaseUrl, supabaseKey) {
  if (!supabaseUrl || !supabaseKey || farmLat == null || farmLon == null) return null;
  if (cropRadiusKm(crop) == null) return null;
  try {
    var dLat = 0.06, dLon = 0.09;   // ~±6 km candidate window
    var q = supabaseUrl + '/rest/v1/crop_concentration_grid?select=*'
      + '&crop=eq.' + encodeURIComponent(crop)
      + '&grid_lat=gte.' + (farmLat - dLat) + '&grid_lat=lte.' + (farmLat + dLat)
      + '&grid_lon=gte.' + (farmLon - dLon) + '&grid_lon=lte.' + (farmLon + dLon);
    var res = await fetch(q, { headers: { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey } });
    if (!res.ok) return null;
    var rows = await res.json();
    if (!rows || !rows.length) return null;
    var best = null, bestD = Infinity;
    rows.forEach(function (r) {
      var dkm = haversineKm(farmLat, farmLon, Number(r.grid_lat), Number(r.grid_lon));
      var tol = (Number(r.cell_km) || 5) / 2 + 1.5;   // within half a cell + tolerance
      if (dkm <= tol && dkm < bestD) { bestD = dkm; best = r; }
    });
    if (!best) return null;
    return {
      available: true, share: Number(best.share), level: best.level, addon_pct: Number(best.addon_pct),
      radius_km: Number(best.radius_km),
      same_crop_ha: best.same_crop_ha != null ? Math.round(best.same_crop_ha) : null,
      total_ha: best.total_ha != null ? Math.round(best.total_ha) : null,
      n_parcels: best.n_parcels != null ? best.n_parcels : null,
      source_label: (best.source_label || 'BRP precompute grid') + ' [cache ' + (Math.round(bestD * 10) / 10) + 'km]',
      provider: best.source_id || 'nl-brp',
      method: best.granularity || 'crop_type_parcel',
      confidence: best.confidence || 'HIGH',
      coverage: best.source_id === 'cropland-proxy' ? 'global' : best.source_id === 'clms-eu' ? 'eu' : 'country',
      country: best.country || null,
      verified: false, basis: 'area (precompute cache)',
    };
  } catch (e) { return null; }
}

// ── MAIN CALCULATION ENGINE ──────────────────────────────
// sc  = shock scenario overlay (defaults to no shock)
// mkt = live market overrides {diesel, carbon} from intelligence_benchmarks (defaults to table)
function calculate(d, sc, mkt) {
  sc  = sc  || SCENARIOS.none;
  mkt = mkt || {};
  var diesel = mkt.diesel != null ? mkt.diesel : LOGISTICS.fuel.diesel_price_eur_l;
  var carbon = mkt.carbon != null ? mkt.carbon : LOGISTICS.emissions.carbon_price_eur_t;
  var REGIONS = buildRegions(mkt.regions);               // hardcoded fallback ∪ live DB regions
  var R       = REGIONS[d.currentSource] || REGIONS.netherlands; // resolved source region
  var buyerEu = buyerIsEU(d.buyerLocation);              // buyer customs area (default NL/EU)
  var crop       = d.crop || 'green_beans';
  var cropRegion = resolveCropRegion(d, mkt);            // where the crop is grown (production data)
  var k          = cropCoefficients(crop, cropRegion, mkt); // KWIN quality + regional yield/price/cost
  var dm       = DELIVERY_MOD[d.deliverySpec] || DELIVERY_MOD.any;
  var sm       = SECTOR_MOD[d.sector] || SECTOR_MOD.food_processor;
  var szm      = SEASON_MOD[d.seasonality] || SEASON_MOD.flexible;
  var vol      = parseFloat(d.volume) || 100;
  var price    = parseFloat(d.currentPrice) || 300;
  var premium  = parseFloat(d.premium) / 100 || 0.15;
  var suppCnt  = parseInt(d.supplierCount) || 1;
  var cv       = vol * price;

  // 1. Geopolitical (+ shock overlay on the current source)
  var geo_pct     = R.geopolitical != null ? R.geopolitical : 0.05;
  var geo_shock   = (sc.geo_risk_add && sc.geo_risk_add[d.currentSource]) || 0;
  var geo_current = Math.round(cv * (geo_pct + geo_shock));
  var geo_regen   = Math.round(cv * 0.02);
  var geo_basis   = Math.round(geo_pct * 100) + '% of €' + Math.round(cv/1000) + 'K contract value — ' + (d.currentSource||'unknown') + ' sourcing profile (WUR 2024)';

  // 2. Weather
  var wthr_pct     = R.weather_conv != null ? R.weather_conv : 0.20;
  var wthr_current = Math.round(cv * wthr_pct * 0.3);
  var wthr_regen   = Math.round(cv * RISK_PCT.weather_regen * 0.3);
  var wthr_basis   = Math.round(wthr_pct * 100) + '% yield variance × 0.3 impact factor × contract value';

  // 3. Quality / recall
  var rec_pct     = RISK_PCT.recall_conv[d.incidents] || 0.005;
  var qual_current= Math.round(cv * rec_pct);
  var qual_regen  = Math.round(cv * RISK_PCT.recall_regen);
  var qual_basis  = 'Incident history: ' + (d.incidents||'none') + ' → ' + Math.round(rec_pct*100*10)/10 + '% annual recall risk';

  // 4. Price volatility
  var pvol_pct     = RISK_PCT.price_vol[d.currentContract] || 0.20;
  var pvol_current = Math.round(cv * pvol_pct * 0.2 * sc.price_vol_mult);
  var pvol_regen   = Math.round(cv * RISK_PCT.price_vol_regen * 0.2);
  var pvol_basis   = 'Contract structure: ' + (d.currentContract||'unknown') + ' → ' + Math.round(pvol_pct*100) + '% price swing exposure';

  // 5. CSRD
  var csrd_raw     = RISK_PCT.csrd_gap[d.csrd] || 0;
  var csrd_current = Math.round(csrd_raw * sm.csrd_urgency * 0.4);
  var csrd_regen   = 0;
  var csrd_basis   = 'CSRD obligation: ' + (d.csrd||'unknown') + ' — compliance gap cost × sector urgency factor ' + sm.csrd_urgency;

  // 6. Supplier concentration — scales with supplier count
  var conc_mult    = suppCnt === 1 ? 1.6 : suppCnt <= 2 ? 1.3 : suppCnt <= 4 ? 1.1 : 1.0;
  var conc_current = Math.round(geo_current * RISK_PCT.concentration_base * conc_mult);
  var conc_regen   = Math.round(conc_current * 0.15);
  var conc_basis   = suppCnt + ' current supplier' + (suppCnt>1?'s':'') + ' — concentration multiplier ' + conc_mult + 'x on geopolitical risk';

  // 7. Nitrate rejection
  var nit_current  = Math.round(k.nitrate_reject_conv * k.nitrate_cost);
  var nit_regen    = Math.round(k.nitrate_reject_regen * k.nitrate_cost);
  var nit_basis    = Math.round(k.nitrate_reject_conv*100) + '% rejection risk × €' + k.nitrate_cost.toLocaleString() + '/incident for ' + crop.replace('_',' ');

  // 8. Crop concentration (todo2) — enrichment; activates ONLY when farm coords + a parcel source
  //    are present. mkt.concentration (live BRP, resolved in the handler) wins; else the sync
  //    example/stub resolver. Unavailable => omitted from totals (never silently zeroed).
  var cropConc = (mkt && mkt.concentration) || ((d.farm_lat != null && d.farm_lon != null) ? resolveConcentrationSync(d, mkt) : null);
  var cropconc_current = 0, cropconc_regen = 0;
  if (cropConc && cropConc.available) {
    cropconc_current = Math.round(cv * cropConc.addon_pct);
    cropconc_regen   = Math.round(cv * CROP_CONCENTRATION.regen_addon_pct);
  }

  // 9. Logistics saving (near-shoring benefit) — computed below

  var current_total = geo_current + wthr_current + qual_current + pvol_current + csrd_current + conc_current + nit_current + cropconc_current;
  var regen_total   = geo_regen   + wthr_regen   + qual_regen   + pvol_regen   + csrd_regen   + conc_regen   + nit_regen   + cropconc_regen;
  var risk_reduction = current_total - regen_total;

  // Processing economics with delivery spec + sector modifiers
  var tare_saving  = k.tare_conv > 0 ? Math.round((k.tare_conv - k.tare_regen) / 100 * price * dm.tare_mult) : 0;
  var dm_value     = Math.round(k.dm_gain / 100 * price * 0.5 * dm.dm_mult * sm.processing_value_mult);
  var defect_save  = Math.round((k.defect_conv - k.defect_regen) / 100 * price * sm.quality_premium);
  var total_proc   = tare_saving + dm_value + defect_save;
  var prem_per_t   = Math.round(price * premium);
  var net_cost_t   = prem_per_t - total_proc;
  var prem_annual  = Math.round(vol * prem_per_t);
  var proc_annual  = Math.round(vol * total_proc);

  // Carbon
  var ha_needed    = Math.round(vol / (k.yield_ha / 1000));
  var carbon_total = Math.round(ha_needed * (CARBON_POTENTIAL[crop] || 40));
  var carbon_share = Math.round(carbon_total * 0.30);

  // ── Logistics calculation (extended: transport, fuel, CO2, load factor, peak,
  //    cold chain, storage, carrying, import, spoilage curve, packaging, returns) ──
  var lg = R.transport || LOGISTICS.transport.netherlands;
  var lg_regen = (REGIONS.netherlands && REGIONS.netherlands.transport) || LOGISTICS.transport.netherlands;
  var cold_chain = d.deliverySpec === 'fresh' || d.deliverySpec === 'frozen';
  var storage_rate = cold_chain ? LOGISTICS.storage_cold_per_week : LOGISTICS.storage_ambient_per_week;
  var chain_rate = cold_chain ? LOGISTICS.cold_chain_per_week : 0;
  var spec = d.deliverySpec || 'any';
  var spoilDay = LOGISTICS.spoilage_per_day[spec] != null ? LOGISTICS.spoilage_per_day[spec] : LOGISTICS.spoilage_per_day.any;
  var packaging = LOGISTICS.packaging_eur_t[spec] != null ? LOGISTICS.packaging_eur_t[spec] : LOGISTICS.packaging_eur_t.any;

  // Build every logistics line for a transport profile (used for current + regen)
  function logiComponents(t, sourceKey) {
    var rgn        = REGIONS[sourceKey] || REGIONS.netherlands;  // resolved region (DB ∪ fallback)
    var isSea      = !!rgn.is_sea;
    var freightM   = isSea ? sc.freight_mult : 1;          // maritime shocks hit sea routes only
    var transitDay = t.transit_days + (isSea ? sc.transit_add_days : 0);
    var transport = Math.round(t.cost_per_t * freightM);
    var fuelInt   = isSea ? LOGISTICS.fuel.intensity_sea_l_per_t_km : LOGISTICS.fuel.intensity_road_l_per_t_km;
    var fuel      = Math.round(t.distance_km * fuelInt * diesel * sc.fuel_mult);
    var co2Fac    = isSea ? LOGISTICS.emissions.co2_sea_kg_per_t_km : LOGISTICS.emissions.co2_road_kg_per_t_km;
    var co2_kg    = Math.round(t.distance_km * co2Fac);
    var emissions = Math.round(co2_kg / 1000 * carbon);
    var lf        = rgn.load_factor != null ? rgn.load_factor : 0.85;
    var load_pen  = Math.round((transport + fuel) * (1 / lf - 1));
    var peak      = Math.round((transport + fuel) * LOGISTICS.peak_surcharge_pct);
    var cold      = Math.round(transitDay / 7 * chain_rate);
    var storage   = Math.round(t.buffer_weeks * storage_rate);
    var carrying  = Math.round(price * t.buffer_weeks * LOGISTICS.carrying_cost_pct_per_week);
    var importd   = customsCost(rgn, buyerEu);   // buyer-aware: 0 when source shares the buyer's customs area
    var spoil_rate= Math.min(LOGISTICS.spoilage_cap, spoilDay * transitDay);
    var spoilage  = Math.round(price * spoil_rate);
    var returns   = Math.round(transport * LOGISTICS.returns_pct);
    var comp = {
      transport: transport, fuel: fuel, emissions_co2: emissions,
      load_penalty: load_pen, peak_surcharge: peak, cold_chain: cold,
      storage: storage, carrying: carrying, import_duties: importd,
      spoilage: spoilage, packaging: packaging, returns: returns,
    };
    var total = 0; for (var key in comp) total += comp[key];
    return { components: comp, total: total, co2_kg: co2_kg, spoil_rate: spoil_rate };
  }

  var cur = logiComponents(lg, d.currentSource);
  var reg = logiComponents(lg_regen, 'netherlands');
  var total_logistics_current = cur.total;
  var total_logistics_regen   = reg.total;
  var logistics_saving_per_tonne = total_logistics_current - total_logistics_regen;
  var logistics_save_annual = Math.round(logistics_saving_per_tonne * vol);

  var logistics_breakdown = {
    current_per_tonne: total_logistics_current,
    regen_per_tonne: total_logistics_regen,
    saving_per_tonne: logistics_saving_per_tonne,
    annual_saving: logistics_save_annual,
    components_current: cur.components,
    components_regen: reg.components,
    co2_kg_current: cur.co2_kg,
    co2_kg_regen: reg.co2_kg,
    co2_saving_kg_per_tonne: cur.co2_kg - reg.co2_kg,
    transit_days_current: lg.transit_days,
    buffer_weeks_current: lg.buffer_weeks,
    basis: 'Transport ' + lg.distance_km + 'km @ €' + cur.components.transport + '/t + fuel €' + cur.components.fuel + '/t + CO2 €' + cur.components.emissions_co2 + '/t + ' + lg.buffer_weeks + 'wk buffer + spoilage ' + Math.round(cur.spoil_rate*1000)/10 + '%',
  };

  // Seasonality effect on farm count
  var base_farms   = vol < 200 ? 10 : vol < 500 ? 18 : 30;
  var adj_farms    = Math.round(base_farms * szm.farm_count_mult);

  // Net value
  var net_value = risk_reduction + proc_annual + logistics_save_annual - prem_annual;

  // Feasibility
  var feasibility = Math.min(100, Math.max(10,
    (net_value > 0 ? 70 : 40) +
    (vol < 300 ? 15 : vol < 600 ? 10 : 5) +
    (d.region === 'noord_nederland' ? 10 : d.region === 'no_preference' ? 5 : 0) +
    (d.currentSource !== 'netherlands' ? 5 : 0) +
    (suppCnt > 2 ? -5 : 0)
  ));

  var verdict = net_value > 0 ? 'GO' : (net_value > -prem_annual * 0.2 ? 'CONDITIONAL_GO' : 'NO_GO');

  return {
    verdict, feasibility, net_value,
    risk_reduction, prem_annual, proc_annual, logistics_save: logistics_save_annual,
    current_total, regen_total,
    layers: [
      {layer:'Geopolitical',     current:geo_current,  regen:geo_regen,  reduction:geo_current-geo_regen,  basis:geo_basis},
      {layer:'Weather / yield',  current:wthr_current, regen:wthr_regen, reduction:wthr_current-wthr_regen, basis:wthr_basis},
      {layer:'Quality / recall', current:qual_current, regen:qual_regen, reduction:qual_current-qual_regen,  basis:qual_basis},
      {layer:'Price volatility', current:pvol_current, regen:pvol_regen, reduction:pvol_current-pvol_regen,  basis:pvol_basis},
      {layer:'CSRD / regulatory',current:csrd_current, regen:csrd_regen, reduction:csrd_current-csrd_regen,  basis:csrd_basis},
      {layer:'Supplier conc.',   current:conc_current, regen:conc_regen, reduction:conc_current-conc_regen,  basis:conc_basis},
      {layer:'Nitrate rejection',current:nit_current,  regen:nit_regen,  reduction:nit_current-nit_regen,    basis:nit_basis},
    ].concat(cropConc && cropConc.available ? [{
      layer:'Crop concentration', current:cropconc_current, regen:cropconc_regen, reduction:cropconc_current-cropconc_regen,
      basis: Math.round(cropConc.share*100) + '% same-crop share within ' + cropConc.radius_km + 'km (' + cropConc.level + ') — ' + cropConc.source_label + ' [verified:false, provisional agronomy]',
    }] : []),
    concentration: cropConc ? {
      available: cropConc.available,
      status: cropConc.available ? 'computed'
            : (cropConc.deferred ? 'unavailable (deferred) — ' + cropConc.reason : 'unavailable — ' + (cropConc.reason || 'unknown')),
      share_pct: cropConc.available ? Math.round(cropConc.share*1000)/10 : null,
      level: cropConc.level || null,
      addon_pct: cropConc.available ? Math.round(cropConc.addon_pct*1000)/10 : null,
      current: cropconc_current, regen: cropconc_regen,
      radius_km: cropConc.radius_km || null,
      same_crop_ha: cropConc.same_crop_ha != null ? cropConc.same_crop_ha : null,
      total_ha: cropConc.total_ha != null ? cropConc.total_ha : null,
      n_parcels: cropConc.n_parcels != null ? cropConc.n_parcels : null,
      parcel_count_in_radius: cropConc.count != null ? cropConc.count : null,
      source_label: cropConc.source_label || null,
      basis: cropConc.basis || null,
      provider: cropConc.provider || null,
      method: cropConc.method || null,
      confidence: cropConc.confidence || null,
      coverage: cropConc.coverage || null,
      radius_confidence: (CROP_CONCENTRATION.radius[crop] && CROP_CONCENTRATION.radius[crop].confidence) || null,
      model: 'three-level percolation threshold — threshold positions MEDIUM confidence, add-on magnitudes LOW (expert-prior); agronomy knobs verified:false, validate with a plant pathologist',
      verified: false,
    } : { available: false, status: 'not requested (no farm coordinates supplied)' },
    logistics: logistics_breakdown,
    processing: {
      tare_saving_per_tonne:  tare_saving,
      dm_value_per_tonne:     dm_value,
      defect_saving_per_tonne:defect_save,
      total_saving_per_tonne: total_proc,
      premium_cost_per_tonne: prem_per_t,
      net_cost_per_tonne:     net_cost_t,
      processing_saving_annual:proc_annual,
      confidence: PROCESSING_CONF[crop] || 'LOW',
      delivery_spec: dm.label,
      sector_label:  sm.label,
    },
    carbon: {ha_needed, total_potential:carbon_total, buyer_share_30pct:carbon_share},
    market: {
      crop_source:      k.source_label,
      crop_region:      cropRegion,
      kwin_conv_price:  k.price_conv,
      kwin_bio_price:   k.price_bio,
      regen_price_est:  Math.round(price * (1+premium)),
      premium_pct:      Math.round(premium*100),
      contract_value:   cv,
      volume:           vol,
      available_farms:  adj_farms + '–' + (adj_farms + 12) + ' farms',
      crop, seasonality: szm.label,
      supplier_count:   suppCnt,
    },
  };
}

// ── SENSITIVITY ANALYSIS ─────────────────────────────────
function buildSensitivity(d, mkt) {
  var base = calculate(d, SCENARIOS.none, mkt);
  var scenarios = [
    {label:'Volume +50%',  change:'volume',   val: parseFloat(d.volume)*1.5},
    {label:'Volume -30%',  change:'volume',   val: parseFloat(d.volume)*0.7},
    {label:'Premium 10%',  change:'premium',  val: 10},
    {label:'Premium 25%',  change:'premium',  val: 25},
    {label:'Spot → contract', change:'currentContract', val:'full_contract'},
  ];
  return scenarios.map(function(s) {
    var mod = JSON.parse(JSON.stringify(d));
    mod[s.change] = s.val;
    var c = calculate(mod, SCENARIOS.none, mkt);
    return {label:s.label, net_value:c.net_value, verdict:c.verdict, delta:c.net_value - base.net_value};
  });
}

// ── SHOCK STRESS TEST ────────────────────────────────────
// Runs the full business case under each named shock and compares the buyer's current
// (sea-route) supply against near-shored regen NL. The resilience gap is the multi-year argument.
function buildShockScenarios(d, mkt) {
  var base = calculate(d, SCENARIOS.none, mkt);
  var vol  = parseFloat(d.volume) || 100;
  return ['hormuz','redsea','energy'].map(function(key) {
    var sc = SCENARIOS[key];
    var c  = calculate(d, sc, mkt);
    var inc_logi_delta   = (c.logistics.current_per_tonne - base.logistics.current_per_tonne) * vol;
    var inc_risk_delta   = c.current_total - base.current_total;
    var regen_logi_delta = (c.logistics.regen_per_tonne - base.logistics.regen_per_tonne) * vol;
    var incumbent_extra  = Math.round(inc_risk_delta + inc_logi_delta);
    var regen_extra      = Math.round(regen_logi_delta);
    return {
      key: key, label: sc.label, desc: sc.desc,
      incumbent_extra_cost: incumbent_extra,            // €/yr extra to stay with current source under shock
      incumbent_logi_per_t: c.logistics.current_per_tonne,
      incumbent_logi_base:  base.logistics.current_per_tonne,
      regen_extra_cost: regen_extra,                    // €/yr — should be near zero
      regen_logi_per_t: c.logistics.regen_per_tonne,
      regen_net_value: c.net_value,                     // Orbag regen case under shock (often improves)
      regen_net_value_base: base.net_value,
      resilient: Math.abs(regen_extra) <= Math.max(1, Math.abs(incumbent_extra)) * 0.15,
    };
  });
}

// ── LIVE MARKET BENCHMARKS (diesel, carbon) ──────────────
async function getMarketBenchmarks(supabaseUrl, supabaseKey) {
  var out = {};
  if (!supabaseUrl || !supabaseKey) return out;
  try {
    var res = await fetch(
      supabaseUrl + '/rest/v1/intelligence_benchmarks?field_path=in.(MARKET.diesel_eur_l,MARKET.eua_carbon_eur_t)&select=field_path,current_value',
      {headers: {apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey}}
    );
    if (!res.ok) return out;
    var rows = await res.json();
    rows.forEach(function(r) {
      if (r.field_path === 'MARKET.diesel_eur_l')     out.diesel = Number(r.current_value);
      if (r.field_path === 'MARKET.eua_carbon_eur_t') out.carbon = Number(r.current_value);
    });
  } catch(e) { /* fall back to table defaults */ }
  return out;
}

// Live regional layer: region_coefficients (risk + logistics per source) and regional_crop_data
// (yield/price/cost per production region). Returned shape matches what buildRegions/cropCoefficients
// expect. On any failure returns empty maps, so the engine falls back to the hardcoded constants.
async function getRegionalData(supabaseUrl, supabaseKey) {
  var out = {regions: {}, cropData: {}};
  if (!supabaseUrl || !supabaseKey) return out;
  var headers = {apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey};
  try {
    var rcRes = await fetch(supabaseUrl + '/rest/v1/region_coefficients?select=*', {headers: headers});
    if (rcRes.ok) {
      (await rcRes.json()).forEach(function (r) {
        out.regions[r.region_key] = {
          geopolitical: r.geopolitical_pct != null ? Number(r.geopolitical_pct) : null,
          weather_conv: r.weather_conv_pct != null ? Number(r.weather_conv_pct) : null,
          transport: (r.transport_cost_per_t != null) ? {
            cost_per_t:   Number(r.transport_cost_per_t),
            distance_km:  Number(r.transport_distance_km),
            transit_days: Number(r.transport_transit_days),
            buffer_weeks: Number(r.transport_buffer_weeks),
          } : null,
          load_factor: r.load_factor != null ? Number(r.load_factor) : null,
          import_cost: r.import_cost != null ? Number(r.import_cost) : null,
          is_sea: r.is_sea_route,
          is_eu: r.is_eu,
          crop_region: r.crop_region,
        };
      });
    }
    var cdRes = await fetch(supabaseUrl + '/rest/v1/regional_crop_data?select=*', {headers: headers});
    if (cdRes.ok) {
      (await cdRes.json()).forEach(function (r) {
        if (!out.cropData[r.crop_region]) out.cropData[r.crop_region] = {};
        out.cropData[r.crop_region][r.crop] = {
          yield_t_ha:       r.yield_t_ha       != null ? Number(r.yield_t_ha)       : null,
          price_conv:       r.price_conv       != null ? Number(r.price_conv)       : null,
          variable_cost_ha: r.variable_cost_ha != null ? Number(r.variable_cost_ha) : null,
          source_label:     r.source_label,
        };
      });
    }
  } catch(e) { /* fall back to hardcoded REGIONAL_CROP_DATA / RISK_PCT / LOGISTICS */ }
  return out;
}

// ── NARRATIVE PROMPT ─────────────────────────────────────
function buildNarrativePrompt(d, calc, liveContext) {
  var f = function(n) { return '€' + Math.round(n).toLocaleString(); };
  var c = calc;
  var crops = {green_beans:'green beans (sperziebonen)',wheat:'wintertarwe',potatoes:'potatoes',onions:'onions',lentils:'lentils',oats:'oats',peas:'peas',carrots:'carrots'};

  return 'You are a supply chain analyst for Orbag. Write a buyer businesscase narrative using ONLY these pre-calculated numbers. Return pure JSON, no markdown.\n\n'
    + 'BUYER: ' + d.company + ' (' + d.sector + '), crop: ' + (crops[d.crop]||d.crop) + ', ' + d.volume + 't/yr\n'
    + 'DELIVERY: ' + c.processing.delivery_spec + ' | SEASONALITY: ' + c.market.seasonality + ' | SUPPLIERS: ' + c.market.supplier_count + '\n'
    + 'VERDICT: ' + c.verdict + ' | Net value: ' + f(c.net_value) + '/yr | Feasibility: ' + c.feasibility + '/100\n'
    + 'RISK: current ' + f(c.current_total) + '/yr → regen ' + f(c.regen_total) + '/yr | reduction: ' + f(c.risk_reduction) + '/yr\n'
    + 'LOGISTICS (per tonne): current €' + c.logistics.current_per_tonne + '/t → regen €' + c.logistics.regen_per_tonne + '/t | saving €' + c.logistics.saving_per_tonne + '/t = ' + f(c.logistics.annual_saving) + '/yr\n'
    + 'Logistics breakdown current: transport €' + c.logistics.components_current.transport + ' + fuel €' + c.logistics.components_current.fuel + ' + CO2 €' + c.logistics.components_current.emissions_co2 + ' + cold chain €' + c.logistics.components_current.cold_chain + ' + storage €' + c.logistics.components_current.storage + ' + spoilage €' + c.logistics.components_current.spoilage + ' + import €' + c.logistics.components_current.import_duties + '\n'
    + 'CO2 transport: current ' + c.logistics.co2_kg_current + 'kg/t → regen ' + c.logistics.co2_kg_regen + 'kg/t (scope-3 relevant)\n'
    + 'PREMIUM COST: ' + f(c.prem_annual) + '/yr | PROCESSING SAVING: ' + f(c.proc_annual) + '/yr\n'
    + 'PROCESSING: tare ' + f(c.processing.tare_saving_per_tonne) + '/t, DM ' + f(c.processing.dm_value_per_tonne) + '/t, defect ' + f(c.processing.defect_saving_per_tonne) + '/t (' + c.processing.confidence + ' conf.)\n'
    + 'CARBON: ' + f(c.carbon.buyer_share_30pct) + '/yr buyer share on ' + c.carbon.ha_needed + ' ha\n'
    + 'Production benchmark (' + (c.market.crop_source||'KWIN-AGV 2024') + ', ' + (c.market.crop_region||'nl') + '): conventional ' + f(c.market.kwin_conv_price) + '/t, regen est. ' + f(c.market.regen_price_est) + '/t\n'
    + (liveContext || '') + '\n'
    + 'Buyer context: ' + (d.concerns || 'none') + '\n\n'
    + 'Write concise, CFO-level analysis. Return JSON:\n'
    + '{"verdict_reason":"one sentence citing net value",'
    + '"supply_analysis":"2-3 sentences on regional supply capacity, farm availability, seasonality fit",'
    + '"pricing_analysis":"2-3 sentences: name the production benchmark source shown above, give the conventional vs regen estimate, and state whether premium tolerance is sufficient",'
    + '"processing_insight":"2-3 sentences on tare/DM/defect advantage for ' + c.processing.sector_label + ' using ' + c.processing.delivery_spec + '. State net cost per unit finished product.",'
    + '"logistics_note":"1-2 sentences on near-shoring logistics saving and transport risk reduction",'
    + '"carbon_note":"1-2 sentences on carbon credit structure and buyer share",'
    + '"nitrate_note":"1 sentence on nitrate rejection risk reduction for this crop",'
    + '"scenarios":{"optimistic":{"volume_pct":"X%","price":"€X/t","note":"condition"},"base":{"volume_pct":"X%","price":"€X/t","note":"condition"},"pessimistic":{"volume_pct":"X%","price":"€X/t","note":"condition"}},'
    + '"next_steps":["step 1","step 2","step 3","step 4"],'
    + '"orbag_note":"one sentence on what Orbag does next"}';
}

// ── LIVE CONTEXT ─────────────────────────────────────────
async function getLiveContext(crop, supabaseUrl, supabaseKey) {
  if (!supabaseUrl || !supabaseKey) return '';
  try {
    var res = await fetch(
      supabaseUrl + '/rest/v1/reports?select=company,sector,crop,region,current_price,report_data,created_at&sector=eq.farmer&order=created_at.desc&limit=5',
      {headers: {apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey}}
    );
    if (!res.ok) return '';
    var rows = await res.json();
    var cropLC = (crop||'').toLowerCase();
    var relevant = rows.filter(function(r) {
      return (r.crop||'').toLowerCase().includes(cropLC) || cropLC.includes((r.crop||'').split(',')[0]);
    }).slice(0, 3);
    if (!relevant.length) return '';
    var lines = relevant.map(function(r) {
      var k = (r.report_data && r.report_data.kpis) || {};
      return '- Farm ' + (r.region||'NL') + ': regen ' + (k.regen_income_ha||'?') + '/ha, verdict: ' + ((r.report_data&&r.report_data.verdict)||'?');
    }).join('\n');
    return 'LIVE FARMER DATA:\n' + lines;
  } catch(e) { return ''; }
}

// ── HANDLER ──────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});

  try {
    var d = req.body;

    // Step 0: live benchmarks — market (diesel/carbon) + regional layer (regions + crop data), in parallel
    var SB_URL = process.env.SUPABASE_URL, SB_KEY = process.env.SUPABASE_KEY;
    var mktAndRegional = await Promise.all([
      getMarketBenchmarks(SB_URL, SB_KEY),
      getRegionalData(SB_URL, SB_KEY),
    ]);
    var mkt = mktAndRegional[0];
    mkt.regions  = mktAndRegional[1].regions;
    mkt.cropData = mktAndRegional[1].cropData;

    // Crop-concentration (todo2): only when farm coords are supplied. NL => live BRP (density-guarded);
    // other countries => fail-loud stub. Enrichment only — never blocks the report on failure.
    if (d.farm_lat != null && d.farm_lon != null) {
      // Worldwide resolution: cache (global) -> best provider by tier -> explicit tiered unavailable.
      mkt.concentration = await resolveConcentrationGlobal(d, mkt, SB_URL, SB_KEY);
    }

    // Step 1: JS calculation — instant (uses live market + regional overrides where available)
    var calc = calculate(d, SCENARIOS.none, mkt);
    var sensitivity = buildSensitivity(d, mkt);
    var shockScenarios = buildShockScenarios(d, mkt);
    console.log('calc verdict:', calc.verdict, 'net_value:', calc.net_value, 'diesel:', mkt.diesel, 'carbon:', mkt.carbon, 'db_regions:', Object.keys(mkt.regions||{}).length);

    // Step 2: live farmer context
    var liveContext = await getLiveContext(d.crop, process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    // Step 3: AI writes narrative only — lean prompt, fast
    var anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1200,
        messages: [{role:'user', content: buildNarrativePrompt(d, calc, liveContext)}],
      }),
    });

    if (!anthropicRes.ok) {
      var err = await anthropicRes.json().catch(function(){return{};});
      return res.status(500).json({error: (err.error&&err.error.message)||'Anthropic error '+anthropicRes.status});
    }

    var anthropicData = await anthropicRes.json();
    var text = anthropicData.content.map(function(b){return b.type==='text'?b.text:'';}).join('');
    console.log('narrative stop_reason:', anthropicData.stop_reason, 'len:', text.length);

    text = text.replace(/```json\n?|```\n?/g,'').trim();
    var jm = text.match(/\{[\s\S]*\}/);
    if (!jm) return res.status(500).json({error:'AI did not return JSON. Please try again.'});

    var nar;
    try { nar = JSON.parse(jm[0]); }
    catch(e) { return res.status(500).json({error:'Could not parse response. Please try again.'}); }

    // Assemble final report
    var report = {
      verdict: calc.verdict,
      verdict_reason: nar.verdict_reason,
      kpis: {
        feasibility_score: calc.feasibility,
        price_range: '€' + calc.market.kwin_conv_price + '–' + calc.market.regen_price_est + '/t',
        benchmark_source: calc.market.crop_source || 'KWIN-AGV 2024',
        available_farms: calc.market.available_farms,
        supply_reliability: calc.feasibility > 70 ? 'High' : calc.feasibility > 50 ? 'Medium' : 'Low',
        regen_premium: '€' + calc.processing.premium_cost_per_tonne + '/t (+' + calc.market.premium_pct + '%)',
        payback_context: calc.processing.net_cost_per_tonne <= 0 ? 'net cheaper per unit finished product' : 'offset by risk + logistics saving',
      },
      risk_analysis: {
        current_total_exposure: '€' + Math.round(calc.current_total).toLocaleString() + '/yr',
        residual_exposure_regen: '€' + Math.round(calc.regen_total).toLocaleString() + '/yr',
        risk_reduction_value: '€' + Math.round(calc.risk_reduction).toLocaleString() + '/yr',
        premium_cost: '€' + Math.round(calc.prem_annual).toLocaleString() + '/yr',
        net_value: '€' + Math.round(calc.net_value).toLocaleString() + '/yr',
        layers: calc.layers.map(function(l){
          return {layer:l.layer, current:'€'+l.current.toLocaleString(), regen:'€'+l.regen.toLocaleString(), reduction:'€'+l.reduction.toLocaleString(), basis:l.basis};
        }),
        logistics_saving: '€' + calc.logistics.annual_saving.toLocaleString() + '/yr',
        logistics_basis: calc.logistics.basis,
      },
      logistics_detail: {
        current_per_tonne: '€' + calc.logistics.current_per_tonne + '/t',
        regen_per_tonne: '€' + calc.logistics.regen_per_tonne + '/t',
        saving_per_tonne: '€' + calc.logistics.saving_per_tonne + '/t',
        annual_saving: '€' + calc.logistics.annual_saving.toLocaleString() + '/yr',
        transit_days_current: calc.logistics.transit_days_current,
        buffer_weeks_current: calc.logistics.buffer_weeks_current,
        components: calc.logistics.components_current,
        components_regen: calc.logistics.components_regen,
        co2_kg_current: calc.logistics.co2_kg_current,
        co2_kg_regen: calc.logistics.co2_kg_regen,
        co2_saving_kg_per_tonne: calc.logistics.co2_saving_kg_per_tonne,
      },
      processing_economics: {
        tare_saving_per_tonne: '€' + calc.processing.tare_saving_per_tonne + '/t',
        dm_value_per_tonne: '€' + calc.processing.dm_value_per_tonne + '/t',
        defect_saving_per_tonne: '€' + calc.processing.defect_saving_per_tonne + '/t',
        total_saving_per_tonne: '€' + calc.processing.total_saving_per_tonne + '/t',
        net_cost_vs_conventional: calc.processing.net_cost_per_tonne <= 0
          ? '€' + Math.abs(calc.processing.net_cost_per_tonne) + '/t cheaper net'
          : '€' + calc.processing.net_cost_per_tonne + '/t more expensive net',
        annual_impact: (calc.proc_annual - calc.prem_annual) >= 0
          ? '+€' + Math.round(calc.proc_annual - calc.prem_annual).toLocaleString() + '/yr net saving'
          : '-€' + Math.abs(Math.round(calc.proc_annual - calc.prem_annual)).toLocaleString() + '/yr net cost',
        confidence: calc.processing.confidence,
        delivery_spec: calc.processing.delivery_spec,
        caveat: nar.processing_insight || '',
      },
      carbon_upside: {
        ha_needed: calc.carbon.ha_needed,
        total_farm_potential: '€' + calc.carbon.total_potential.toLocaleString() + '/yr',
        buyer_share: '€' + calc.carbon.buyer_share_30pct.toLocaleString() + '/yr',
        note: nar.carbon_note || '',
      },
      sensitivity: sensitivity,
      scenario_stress: shockScenarios,
      concentration: calc.concentration,
      supply_analysis: nar.supply_analysis,
      pricing_analysis: nar.pricing_analysis,
      logistics_note: nar.logistics_note,
      nitrate_note: nar.nitrate_note,
      scenarios: nar.scenarios,
      next_steps: nar.next_steps,
      orbag_note: nar.orbag_note,
    };

    // Save to Supabase
    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      // Persist via the bounded save_report RPC — the anon key cannot insert into reports directly.
      await fetch(process.env.SUPABASE_URL + '/rest/v1/rpc/save_report', {
        method:'POST',
        headers:{'Content-Type':'application/json','apikey':process.env.SUPABASE_KEY,'Authorization':'Bearer '+process.env.SUPABASE_KEY},
        body: JSON.stringify({ p: {
          company:d.company, sector:d.sector, crop:d.crop, region:d.region,
          volume:Number(d.volume), current_price:Number(d.currentPrice),
          premium:Number(d.premium), verdict:report.verdict,
          feasibility:report.kpis.feasibility_score,
          price_range:report.kpis.price_range,
          input_data:d, report_data:report,
          created_at:new Date().toISOString(),
        }}),
      });
      // Save to buyer_bcs for match engine
      if (d.user_id) {
        var justifiable = Math.round(
          Number(d.currentPrice) * (1 + Number(d.premium)/100) +
          calc.processing.tare_saving_per_tonne +
          calc.processing.dm_value_per_tonne +
          calc.processing.defect_saving_per_tonne
        );
        await fetch(process.env.SUPABASE_URL + '/rest/v1/rpc/save_buyer_bc', {
          method:'POST',
          headers:{'Content-Type':'application/json','apikey':process.env.SUPABASE_KEY,'Authorization':'Bearer '+process.env.SUPABASE_KEY},
          body: JSON.stringify({ p: {
            user_id:d.user_id, company:d.company, sector:d.sector,
            crop:d.crop, region:d.region, volume:Number(d.volume),
            current_price:Number(d.currentPrice), net_value:calc.net_value,
            risk_reduction:calc.risk_reduction, feasibility:calc.feasibility,
            verdict:report.verdict, justifiable_farm_price:justifiable,
          }}),
        });
      }
    }

    return res.status(200).json(report);
  } catch(err) {
    console.error('Error:', err.message);
    return res.status(500).json({error:err.message});
  }
};

// ── TEST HOOKS ───────────────────────────────────────────
// Expose pure engine internals for offline fixture tests (tests/engine.test.js). These are
// attached to the exported handler function object and do NOT affect the Vercel default export
// or runtime behaviour — the engine still computes everything from the request as before.
module.exports.calculate = calculate;
module.exports.SCENARIOS = SCENARIOS;
module.exports.cropCoefficients = cropCoefficients;
module.exports.buildRegions = buildRegions;
module.exports.buyerIsEU = buyerIsEU;
module.exports.concentrationFromParcels = concentrationFromParcels;
module.exports.resolveConcentrationSync = resolveConcentrationSync;
module.exports.resolveConcentrationGlobal = resolveConcentrationGlobal;
module.exports.CONCENTRATION_PROVIDERS = CONCENTRATION_PROVIDERS;
module.exports.providerApplies = providerApplies;
module.exports.getBRPConcentration = getBRPConcentration;
module.exports.CROP_CONCENTRATION = CROP_CONCENTRATION;
module.exports.DRONTEN_EXAMPLE = DRONTEN_EXAMPLE;
module.exports.haversineKm = haversineKm;
module.exports.ringAreaHa = ringAreaHa;
module.exports.ringCentroid = ringCentroid;
module.exports.concentrationLevel = concentrationLevel;
module.exports.cropRadiusKm = cropRadiusKm;
module.exports.BRP_CROP_MATCH = BRP_CROP_MATCH;
module.exports.getConcentrationFromCache = getConcentrationFromCache;
