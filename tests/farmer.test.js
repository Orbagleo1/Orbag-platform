// Orbag farmer-engine regression fixtures.
// Pure, offline tests of api/farmer.js `calculateFarmer()` — no network, no Supabase, no Anthropic.
// Each fixture is a fixed input -> expected COMPUTED output (numbers, not the AI narrative), so a
// future change can't silently shift the transition economics. Run with:  node tests/farmer.test.js
// (no dependencies, no build step). Exits non-zero on any mismatch.
//
// Baseline captured 2026-06-07 from the deterministic engine (KWIN_FARMER + TRANSITION_MODEL).

var f = require('../api/farmer.js');

var fails = 0;
function check(name, actual, expected) {
  var ok = actual === expected;
  if (!ok) fails++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name +
    (ok ? '' : '  expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual)));
}
function checkTrue(name, cond) { check(name, !!cond, true); }

// ── Fixture 1: baseline farm — Groningen, winter wheat + sugar beet, 85 ha ─────
(function () {
  var c = f.calculateFarmer({
    farmName: 'Hoeve De Akker', farmRegion: 'groningen', totalHa: 85, soilType: 'klei',
    crops: ['wintertarwe', 'suikerbieten'], currentIncome: 800, fertCost: 450,
    currentCert: 'none', ambition: 'majority', concern: 'income_drop', incomeDrop: 100, payback: '5',
  });
  check('baseline verdict',          c.verdict, 'CONDITIONAL_GO');   // payback 3 ≤ 5 but dip 185 > tol 100
  check('baseline current_income',   c.kpis.current_income_ha, 800);
  check('baseline regen_income_ha',  c.kpis.regen_income_ha, 1263);
  check('baseline steady_uplift_ha', c.model.steady_uplift_ha, 463);
  check('baseline input_saving_ha',  c.kpis.input_saving_ha, 279);
  check('baseline carbon_ha',        c.kpis.carbon_potential_ha, 11);
  check('baseline payback_year',     c.model.payback_year, 3);
  check('baseline max_income_drop',  c.model.max_income_drop_ha, 185);
  check('baseline net_value_annual', c.net_value, 39313);
  check('baseline net_value_cum',    c.model.net_value_cumulative, 249091);
  check('baseline horizon rows',     c.model.cashflow.length, 7);
  check('baseline yr1 regen_ha',     c.model.cashflow[0].regen_ha, 615);
  check('baseline verified false',   c.model.verified, false);       // suikerbieten + model knobs verified:false
})();

// ── Fixture 2: legume-led, low income tolerance, fast payback target -> GO ─────
(function () {
  var c = f.calculateFarmer({
    farmName: 'Pulse Farm', farmRegion: 'flevoland', totalHa: 50, soilType: 'klei',
    crops: ['erwten'], currentIncome: 700, incomeDrop: 400, payback: '5',
  });
  checkTrue('legume positive uplift', c.model.steady_uplift_ha > 0);
  check('legume verdict GO',          c.verdict, 'GO');              // high premium, dip within €400 tolerance
  checkTrue('legume payback set',     c.model.payback_year != null);
})();

// ── Fixture 3: fail-loud guards ───────────────────────────────────────────────
(function () {
  var unknown = f.calculateFarmer({ crops: ['quinoa'], totalHa: 50 });
  checkTrue('unknown crop errors',    unknown.error && unknown.error.indexOf('quinoa') >= 0);
  var none = f.calculateFarmer({ crops: [], totalHa: 50 });
  checkTrue('no crops errors',        none.error && none.error.indexOf('No crops') >= 0);
})();

// ── Fixture 4: determinism — two identical runs produce identical numbers ──────
(function () {
  var d = { crops: ['wintertarwe'], totalHa: 100, currentIncome: 850, incomeDrop: 150, payback: '4' };
  var a = f.calculateFarmer(d), b = f.calculateFarmer(d);
  check('deterministic net_value',    a.net_value, b.net_value);
  check('deterministic regen_income', a.kpis.regen_income_ha, b.kpis.regen_income_ha);
})();

console.log('');
console.log(fails === 0 ? 'ALL PASS' : (fails + ' FAILED'));
process.exit(fails === 0 ? 0 : 1);
