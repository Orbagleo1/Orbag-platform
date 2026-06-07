// Orbag crop-concentration risk layer (todo2) — offline regression fixtures.
// Pure, deterministic tests of the concentration pipeline in api/generate.js. No network: the live
// BRP (PDOK/RVO) source is exercised separately and was verified live; here we lock the pipeline
// behaviour against the hand-placed Dronten example data. Run:  node tests/concentration.test.js
//
// Mirrors tests/engine.test.js conventions; exits non-zero on any mismatch.

var eng = require('../api/generate.js');

var fails = 0;
function check(name, actual, expected) {
  var ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) fails++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name +
    (ok ? '' : '  expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual)));
}
function checkTrue(name, cond) { check(name, !!cond, true); }

var ex = eng.DRONTEN_EXAMPLE;

// ── Pure pipeline on the Dronten example (potatoes, 15km) ─────────────────────
// In radius: potatoes 20+25+15=60 ha; wheat 18+10=28; onions 12 -> total 100. The 30 ha potato
// parcel ~22 km away is excluded (proves the radius), so share = 60/100 = 0.60 -> high -> 6% add-on.
(function () {
  var c = eng.concentrationFromParcels(ex.farm.lat, ex.farm.lon, 'potatoes', ex.parcels, ex.source_label, 'area (example)');
  check('Dronten available',    c.available, true);
  check('Dronten share',        c.share, 0.6);
  check('Dronten level',        c.level, 'high');
  check('Dronten addon_pct',    c.addon_pct, 0.06);
  check('Dronten same_crop_ha', c.same_crop_ha, 60);
  check('Dronten total_ha',     c.total_ha, 100);     // 130 would mean the far parcel leaked in
  check('Dronten n_parcels',    c.n_parcels, 6);      // 7th (far) parcel excluded by radius
  check('Dronten verified',     c.verified, false);
})();

// ── Threshold model boundaries (three-level) ──────────────────────────────────
(function () {
  check('level 0.10 -> low',    eng.concentrationFromParcels(52.53,5.72,'potatoes',[{crop:'potatoes',lat:52.53,lon:5.72,area_ha:10},{crop:'wheat',lat:52.531,lon:5.721,area_ha:90}],'t').level, 'low');
  check('level 0.30 -> medium', eng.concentrationFromParcels(52.53,5.72,'potatoes',[{crop:'potatoes',lat:52.53,lon:5.72,area_ha:30},{crop:'wheat',lat:52.531,lon:5.721,area_ha:70}],'t').level, 'medium');
  check('level 0.45 -> high',   eng.concentrationFromParcels(52.53,5.72,'potatoes',[{crop:'potatoes',lat:52.53,lon:5.72,area_ha:45},{crop:'wheat',lat:52.531,lon:5.721,area_ha:55}],'t').level, 'high');
})();

// ── Fail-soft: crop without an agronomy radius knob is unavailable, not zeroed ─
(function () {
  var c = eng.concentrationFromParcels(ex.farm.lat, ex.farm.lon, 'wheat', ex.parcels, ex.source_label);
  check('wheat unavailable', c.available, false);
  checkTrue('wheat reason mentions pest-radius', /pest-radius/.test(c.reason));
})();

// ── Fail-loud: a country without a filled parcel source ───────────────────────
(function () {
  var c = eng.resolveConcentration({ crop: 'potatoes', currentSource: 'uk', farm_lat: 52.6, farm_lon: 1.3, farm_country: 'uk' }, {});
  check('uk parcel source unavailable', c.available, false);
  checkTrue('uk reason mentions LPIS/unverified', /LPIS|UNVERIFIED|stub/.test(c.reason));
})();

// ── Engine integration: layer + totals only when farm coords are supplied ─────
var base = {
  company: 'Conc', sector: 'food_processor', currentContract: 'mixed', csrd: 'voluntary',
  incidents: 'none', deliverySpec: 'frozen', seasonality: 'flexible', supplierCount: '1',
  region: 'no_preference', premium: 15, volume: 500, currentPrice: 300, currentSource: 'netherlands',
};
(function () {
  var withCoords = eng.calculate(Object.assign({}, base, { crop: 'potatoes', farm_lat: 52.53, farm_lon: 5.72 }), eng.SCENARIOS.none, {});
  var noCoords   = eng.calculate(Object.assign({}, base, { crop: 'potatoes' }), eng.SCENARIOS.none, {});
  var layer = withCoords.layers.filter(function (l) { return l.layer === 'Crop concentration'; })[0];
  checkTrue('layer present with coords', !!layer);
  check('layer current = cv*0.06', layer.current, Math.round(500 * 300 * 0.06)); // 9000
  check('layer regen = cv*0.01',   layer.regen,   Math.round(500 * 300 * 0.01)); // 1500
  check('concentration computed',  withCoords.concentration.status, 'computed');
  // Without coords: no layer, status explicit, totals untouched (todo.md fixtures stay valid).
  check('no layer without coords', noCoords.layers.filter(function (l) { return l.layer === 'Crop concentration'; }).length, 0);
  checkTrue('not-requested status', /not requested/.test(noCoords.concentration.status));
  check('totals differ by cv*0.06', withCoords.current_total - noCoords.current_total, Math.round(500 * 300 * 0.06));
})();

console.log('\n' + (fails === 0 ? 'ALL PASS' : fails + ' FAILED'));
process.exit(fails === 0 ? 0 : 1);
