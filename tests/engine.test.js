// Orbag buyer-engine regression fixtures.
// Pure, offline tests of api/generate.js `calculate()` — no network, no Supabase, no Anthropic.
// Each fixture is a fixed input -> expected COMPUTED output (numbers, not the AI narrative), so a
// future change can't silently shift an existing farm's figures. Run with:  node tests/engine.test.js
// (no dependencies, no build step). Exits non-zero on any mismatch.
//
// Baseline captured 2026-06-06 from the hardcoded fallback layer (mkt = {} -> no live DB/market
// overrides), so the numbers are deterministic and independent of the live intelligence pipeline.

var eng = require('../api/generate.js');

var fails = 0;
function check(name, actual, expected) {
  var ok = actual === expected;
  if (!ok) fails++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name +
    (ok ? '' : '  expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual)));
}
function checkTrue(name, cond) { check(name, !!cond, true); }

// Shared base input — only crop/volume/price/source/buyer vary per fixture.
var base = {
  company: 'Fixture', sector: 'food_processor', currentContract: 'mixed', csrd: 'voluntary',
  incidents: 'none', deliverySpec: 'frozen', seasonality: 'flexible', supplierCount: '1',
  region: 'no_preference', premium: 15,
};
function run(overrides) {
  var d = Object.assign({}, base, overrides);
  return eng.calculate(d, eng.SCENARIOS.none, {}); // mkt={} -> hardcoded fallback, deterministic
}

// ── Fixture 1: NL source, NL buyer — reproduces today's KWIN numbers ──────────
(function () {
  var c = run({ crop: 'green_beans', volume: 500, currentPrice: 300, currentSource: 'netherlands' });
  check('NL verdict',         c.verdict, 'GO');
  check('NL feasibility',     c.feasibility, 85);
  check('NL net_value',       c.net_value, 21554);
  check('NL risk_reduction',  c.risk_reduction, 19554);
  check('NL current_total',   c.current_total, 30490);
  check('NL regen_total',     c.regen_total, 10936);
  check('NL logistics/t',     c.logistics.current_per_tonne, 39);
  check('NL crop_source',     c.market.crop_source, 'KWIN-AGV 2024');
  check('NL crop_region',     c.market.crop_region, 'nl');
  check('NL no customs',      c.logistics.components_current.import_duties, 0);
})();

// ── Fixture 2: UK (Norfolk) source, NL buyer — customs + sea-leg apply ────────
(function () {
  var c = run({ crop: 'wheat', volume: 500, currentPrice: 230, currentSource: 'uk', buyerLocation: 'nl' });
  check('UK->NL verdict',        c.verdict, 'GO');
  check('UK->NL net_value',      c.net_value, 52060);
  check('UK->NL risk_reduction', c.risk_reduction, 20560);
  check('UK->NL current_total',  c.current_total, 29043);
  check('UK->NL regen_total',    c.regen_total, 8483);
  check('UK->NL logistics/t',    c.logistics.current_per_tonne, 117);
  check('UK->NL crop_region',    c.market.crop_region, 'uk_norfolk');
  check('UK->NL AHDB source',    c.market.crop_source, 'AHDB Farmbench / Grain Market Daily 2024/25');
  // Customs charged: UK is non-EU, NL buyer is EU -> GB->EU import duty applies.
  check('UK->NL customs applied', c.logistics.components_current.import_duties, 45);
})();

// ── Fixture 3: UK (Norfolk) source, UK buyer — same customs area, NO customs ───
(function () {
  var c = run({ crop: 'wheat', volume: 500, currentPrice: 230, currentSource: 'uk', buyerLocation: 'uk' });
  check('UK->UK net_value',      c.net_value, 29560);
  check('UK->UK logistics/t',    c.logistics.current_per_tonne, 72);
  check('UK->UK AHDB source',    c.market.crop_source, 'AHDB Farmbench / Grain Market Daily 2024/25');
  // Same customs area (UK->UK) -> no border cost.
  check('UK->UK no customs',     c.logistics.components_current.import_duties, 0);
  // Cross-check: the only logistics delta vs the NL buyer is exactly the GB->EU import duty.
  var ukNL = run({ crop: 'wheat', volume: 500, currentPrice: 230, currentSource: 'uk', buyerLocation: 'nl' });
  check('customs == logistics delta',
    ukNL.logistics.current_per_tonne - c.logistics.current_per_tonne,
    ukNL.logistics.components_current.import_duties);
})();

// ── buyerIsEU helper: missing/unknown -> default EU (back-compat) ──────────────
(function () {
  checkTrue('buyerIsEU() default EU', eng.buyerIsEU(undefined) === true);
  checkTrue('buyerIsEU(nl) EU',       eng.buyerIsEU('nl') === true);
  checkTrue('buyerIsEU(uk) non-EU',   eng.buyerIsEU('uk') === false);
  checkTrue('buyerIsEU(unknown) EU',  eng.buyerIsEU('atlantis') === true);
})();

console.log('\n' + (fails === 0 ? 'ALL PASS' : fails + ' FAILED'));
process.exit(fails === 0 ? 0 : 1);
