#!/usr/bin/env node
// Offline crop-concentration precompute (todo2 follow-up).
//
// WHY: the buyer engine can't compute a 15 km same-crop share in a 60 s serverless call (a 15 km
// radius in dense NL ≈ 43k BRP polygons). This batch job has no such limit: it downloads the parcels
// ONCE for a covering bbox, computes the true AREA-based share per grid point, and upserts the result
// into Supabase (crop_concentration_grid) via the bounded save_concentration_grid RPC. The engine then
// reads the nearest grid cell instantly, so the 15 km case computes "live" from cache.
//
// RUN (PowerShell):
//   $env:SUPABASE_URL="https://wbysgkfsaoyaaatdgics.supabase.co"; $env:SUPABASE_KEY="<anon key>"; `
//   node scripts/precompute-concentration.js
// Optional env: CROP (default potatoes), CENTER_LAT, CENTER_LON (default Dronten), GRID_N (default 3,
//   => N×N grid), CELL_KM (default 5). BRP is annual, so this only needs re-running when BRP updates.
//
// Reuses the engine's own helpers so the cached numbers match the live pipeline exactly.

var eng = require('../api/generate.js');

var SB_URL = process.env.SUPABASE_URL, SB_KEY = process.env.SUPABASE_KEY;
if (!SB_URL || !SB_KEY) { console.error('Set SUPABASE_URL and SUPABASE_KEY env vars.'); process.exit(1); }

var CROP      = process.env.CROP || 'potatoes';
var CENTER    = { lat: Number(process.env.CENTER_LAT || 52.53), lon: Number(process.env.CENTER_LON || 5.72) };
var GRID_N    = parseInt(process.env.GRID_N || '3', 10);   // N×N grid of points
var CELL_KM   = Number(process.env.CELL_KM || 5);          // spacing between grid points (km)
var RADIUS    = eng.cropRadiusKm(CROP);
if (RADIUS == null) { console.error('No pest-radius for crop "' + CROP + '" — fill CROP_CONCENTRATION.radius first.'); process.exit(1); }
var MATCH     = eng.BRP_CROP_MATCH[CROP];
if (!MATCH)   { console.error('No BRP crop mapping for "' + CROP + '".'); process.exit(1); }

var BRP = 'https://service.pdok.nl/rvo/brpgewaspercelen/wfs/v1_0?service=WFS&version=2.0.0&typeName=brpgewaspercelen:BrpGewas';
var kmLat = 1 / 111, kmLon = function (lat) { return 1 / (111 * Math.cos(lat * Math.PI / 180)); };

function gridPoints() {
  var pts = [], half = (GRID_N - 1) / 2;
  for (var i = 0; i < GRID_N; i++) for (var j = 0; j < GRID_N; j++) {
    var dy = (i - half) * CELL_KM, dx = (j - half) * CELL_KM;
    pts.push({ lat: CENTER.lat + dy * kmLat, lon: CENTER.lon + dx * kmLon(CENTER.lat) });
  }
  return pts;
}

async function downloadParcels(bbox) {
  var out = [], start = 0, page = 1000;   // PDOK GeoServer caps GetFeature at ~1000/request -> must page
  for (;;) {
    var url = BRP + '&request=GetFeature&outputFormat=application/json&srsName=EPSG:4326&count=' + page +
              '&startIndex=' + start + '&bbox=' + encodeURIComponent(bbox);
    // Fail loud on a non-OK page: PDOK can return a 5xx or a 200 WFS XML exception report, and a
    // blind .json() would throw an opaque "Unexpected token" mid-paging AFTER earlier pages were
    // already collected — masking the real upstream error. Stop the run with the actual status.
    var res = await fetch(url);
    if (!res.ok) throw new Error('PDOK BRP ' + res.status + ' at startIndex ' + start + ': ' + (await res.text()).slice(0, 200));
    var gj = await res.json();
    var feats = gj.features || [];
    var raw = feats.length;
    for (var k = 0; k < feats.length; k++) {
      var g = feats[k].geometry; if (!g) continue;
      var ring = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0][0] : null;
      if (!ring) continue;
      var c = eng.ringCentroid(ring);
      out.push({ gewas: ((feats[k].properties && feats[k].properties.gewas) || '').toLowerCase(),
                 lat: c.lat, lon: c.lon, area_ha: eng.ringAreaHa(ring),
                 year: feats[k].properties && feats[k].properties.jaar });
    }
    process.stdout.write('  downloaded ' + out.length + ' parcels\r');
    if (raw === 0) break;       // PDOK returns ~990/page (just under the 1000 cap), so advance by the
    start += raw;               // actual count and stop only on an empty page — never on raw<page.
  }
  process.stdout.write('\n');
  return out;
}

async function rpc(p) {
  var res = await fetch(SB_URL + '/rest/v1/rpc/save_concentration_grid', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
    body: JSON.stringify({ p: p }),
  });
  if (!res.ok) throw new Error('RPC ' + res.status + ': ' + (await res.text()).slice(0, 200));
}

(async function main() {
  var pts = gridPoints();
  // Covering bbox = grid extent + radius around the centre.
  var reach = (GRID_N - 1) / 2 * CELL_KM + RADIUS + 0.5;
  var bbox = [CENTER.lat - reach * kmLat, CENTER.lon - reach * kmLon(CENTER.lat),
              CENTER.lat + reach * kmLat, CENTER.lon + reach * kmLon(CENTER.lat)].join(',') + ',urn:ogc:def:crs:EPSG::4326';
  console.log('Crop=' + CROP + ' radius=' + RADIUS + 'km  grid=' + GRID_N + 'x' + GRID_N + '@' + CELL_KM + 'km  centre=' + CENTER.lat + ',' + CENTER.lon);
  console.log('Downloading BRP parcels for covering bbox (±' + Math.round(reach) + 'km)…');
  var parcels = await downloadParcels(bbox);
  var year = (parcels[0] && parcels[0].year) || null;
  console.log('Total parcels downloaded: ' + parcels.length + (year ? '  (BRP ' + year + ')' : ''));

  var isMatch = function (g) { return MATCH.some(function (s) { return g.indexOf(s) >= 0; }); };
  var written = 0;
  for (var p = 0; p < pts.length; p++) {
    var pt = pts[p];
    var inR = parcels.filter(function (x) { return eng.haversineKm(pt.lat, pt.lon, x.lat, x.lon) <= RADIUS; });
    var total = inR.reduce(function (s, x) { return s + x.area_ha; }, 0);
    if (total <= 0) { console.log('  cell ' + (p + 1) + '/' + pts.length + ' — no parcels, skipped'); continue; }
    var same = inR.filter(function (x) { return isMatch(x.gewas); }).reduce(function (s, x) { return s + x.area_ha; }, 0);
    var share = same / total, lvl = eng.concentrationLevel(share);
    await rpc({
      crop: CROP, grid_lat: Number(pt.lat.toFixed(5)), grid_lon: Number(pt.lon.toFixed(5)),
      cell_km: CELL_KM, radius_km: RADIUS, share: share, level: lvl.level, addon_pct: lvl.addon_pct,
      same_crop_ha: Math.round(same), total_ha: Math.round(total), n_parcels: inR.length,
      source_label: 'BRP Gewaspercelen (PDOK/RVO)' + (year ? ' ' + year : ''), brp_year: year, verified: false,
      // Provenance (worldwide provider foundation) — this script is the Tier-1 NL BRP precompute.
      // A global Tier-2 (WorldCereal) / Tier-3 (cropland) precompute upserts the same row shape with
      // source_id 'worldcereal'/'cropland-proxy', granularity 'crop_group_raster'/'cropland_only',
      // confidence 'MEDIUM'/'LOW', and the relevant country.
      source_id: 'nl-brp', granularity: 'crop_type_parcel', confidence: 'HIGH', country: 'nl',
    });
    written++;
    console.log('  cell ' + (p + 1) + '/' + pts.length + '  ' + pt.lat.toFixed(4) + ',' + pt.lon.toFixed(4) +
                '  share=' + Math.round(share * 1000) / 10 + '%  ' + lvl.level + '  (' + inR.length + ' parcels)');
  }
  console.log('Done — ' + written + ' grid cells upserted into crop_concentration_grid.');
})().catch(function (e) { console.error('FAILED:', e.message); process.exit(1); });
