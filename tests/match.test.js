// Orbag MATCH ECONOMICS — one worked net-value-per-tonne example (WORKORDER BLOK 2 gate deliverable).
// Pure, offline. Demonstrates the logistics submodule turning a buyer's justified farm-gate price into
// the real per-tonne payment capacity for a SPECIFIC farmer, and that a cross-border route is charged
// customs while a same-area route is not. Run with:  node tests/match.test.js
//
// NOTE: this is the deterministic ECONOMICS only. The full scoring WEIGHTS (niveau 1-3) are a business
// decision and are NOT tested/implemented here — they await Leo's sign-off (the BLOK 2 gate).

var me = require('../api/match-economics.js');

var fails = 0;
function check(name, actual, expected) {
  var ok = actual === expected;
  if (!ok) fails++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name +
    (ok ? '' : '  expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual)));
}
function checkTrue(name, cond) { check(name, !!cond, true); }

// Real-ish actors drawn from the live data shape:
//   Farmer: Akkerhoeve-style NL arable farm near Dronten (also the crop-concentration example centre).
//   Buyer : an NL food processor near Rotterdam wanting green beans (perishable/fresh).
var farmerNL = { lat: 52.53, lon: 5.72, country: 'nl' };
var buyerNL  = { lat: 51.92, lon: 4.48, location: 'nl', perishable: true };
// Buyer's justified farm-gate price (€/t) — the max they can pay; in production this comes from
// buyer_bcs.justifiable_farm_price (computed by api/generate.js). Use a representative €413/t (the
// value on the live green_beans buyer report id 48).
var JFP_GREEN_BEANS = 413;

// ── Example A: NL farmer ⇄ NL buyer (same customs area) ──────────────────────
(function () {
  var r = me.netValuePerTonne(JFP_GREEN_BEANS, farmerNL, buyerNL);
  console.log('\n[Example A] NL Dronten farm → NL Rotterdam buyer, green beans (fresh):');
  console.log('  ' + JSON.stringify(r, null, 0));
  checkTrue('A available', r.available);
  check('A distance_km', r.logistics.distance_km, 108);
  check('A customs (same area) = 0', r.logistics.customs_eur_t, 0);
  checkTrue('A cold-chain applied (perishable)', r.logistics.cold_chain_eur_t > 0);
  check('A net = jfp - total', r.net_value_per_tonne, me.netValuePerTonne(JFP_GREEN_BEANS, farmerNL, buyerNL).logistics.total_eur_t * -1 + JFP_GREEN_BEANS);
  checkTrue('A net value below justified price', r.net_value_per_tonne < JFP_GREEN_BEANS);
  checkTrue('A net value still strongly positive', r.net_value_per_tonne > 380);
})();

// ── Example B: UK farmer ⇄ NL buyer (cross-border) — proves customs is charged ──
(function () {
  var farmerUK = { lat: 52.6, lon: 1.3, country: 'gb' };          // Norfolk
  var r = me.netValuePerTonne(JFP_GREEN_BEANS, farmerUK, buyerNL);
  console.log('\n[Example B] UK Norfolk farm → NL Rotterdam buyer (cross-border):');
  console.log('  ' + JSON.stringify(r, null, 0));
  check('B customs (GB→EU) = 45', r.logistics.customs_eur_t, 45);
  checkTrue('B net value below the NL-NL match', r.net_value_per_tonne < me.netValuePerTonne(JFP_GREEN_BEANS, farmerNL, buyerNL).net_value_per_tonne);
})();

// ── Example C: Morocco farmer ⇄ NL buyer — duty must be the source-country rate (18, not 45) ──
(function () {
  var farmerMA = { lat: 31.8, lon: -7.1, country: 'ma' };
  var r = me.netValuePerTonne(JFP_GREEN_BEANS, farmerMA, buyerNL);
  check('C customs (MA->EU) = 18', r.logistics.customs_eur_t, 18);
  // EU source into an EU buyer pays nothing; an EU source into a non-EU buyer also pays 0 (source duty).
  check('NL->UK buyer customs = 0', me.customsPerTonne('nl', 'uk'), 0);
  check('UK->NL buyer customs = 45', me.customsPerTonne('gb', 'nl'), 45);
})();

// ── Guard: missing coordinates fail soft (never a fake number) ───────────────
(function () {
  var r = me.netValuePerTonne(JFP_GREEN_BEANS, { country: 'nl' }, buyerNL);
  checkTrue('missing coords -> not available', !r.available);
})();

console.log('\n' + (fails ? (fails + ' FAIL') : 'ALL PASS'));
process.exit(fails ? 1 : 0);
