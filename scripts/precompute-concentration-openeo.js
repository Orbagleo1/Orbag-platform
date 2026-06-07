#!/usr/bin/env node
// Generic openEO crop-concentration precompute (todo2 worldwide foundation).
//
// Collection-agnostic engine: for a grid of farm points it asks CDSE openEO to compute, SERVER-SIDE,
// the fraction of a target class within the pest radius (no raster download), then upserts the result
// into crop_concentration_grid via the bounded save_concentration_grid RPC. The buyer engine only
// READS that cache, so production stays credential-free. Adding a global layer = one PROVIDERS config.
//
// AUTH: uses the CDSE device-flow token saved by the login step at <tmp>/cdse_token.json, refreshing
// it via the refresh_token when expired. (openEO requires a user login, not a service client.)
//
// RUN (PowerShell):
//   $env:SUPABASE_URL="https://wbysgkfsaoyaaatdgics.supabase.co"; $env:SUPABASE_KEY="<anon key>"; `
//   $env:PROVIDER="worldcover"; $env:CROP="potatoes"; $env:CENTER_LAT="48.5"; $env:CENTER_LON="2.0"; `
//   node scripts/precompute-concentration-openeo.js
// Opts: PROVIDER (worldcover), CROP, CENTER_LAT/LON, GRID_N (default 1), CELL_KM (default 5).

var fs = require('fs'), os = require('os'), path = require('path');
var eng = require('../api/generate.js');

var SB_URL = process.env.SUPABASE_URL, SB_KEY = process.env.SUPABASE_KEY;
if (!SB_URL || !SB_KEY) { console.error('Set SUPABASE_URL and SUPABASE_KEY.'); process.exit(1); }
var TOKEN_FILE = path.join(os.tmpdir(), 'cdse_token.json');
var OIDC_CLIENT = 'sh-b1c3a958-52d4-40fe-a333-153595d1c71e';   // CDSE openEO default public client
var OPENEO = 'https://openeo.dataspace.copernicus.eu/openeo/1.2';
var TOKEN_URL = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';

// Provider configs — each maps to a reachable openEO collection + how a target class is selected.
// classFor(crop) returns the single class value that counts as "the crop" within the radius.
var PROVIDERS = {
  worldcover: {                                  // Tier-3 global cropland-density PROXY (not same-crop)
    source_id: 'cropland-proxy', collection: 'ESA_WORLDCOVER_10M_2021_V2',
    temporal: ['2021-01-01', '2022-01-01'], band: 'MAP', granularity: 'cropland_only', confidence: 'LOW',
    coverage: 'global', source_label: 'ESA WorldCover 10m 2021 cropland (openEO/CDSE)',
    classFor: function () { return 40; },        // 40 = Cropland (same for every crop -> a proxy)
  },
  clms: {                                        // Tier-2 EU real crop-TYPE (same-crop), MEDIUM
    source_id: 'clms-eu', collection: 'CLMS_VLCC_CROP_TYPES_EUROPE_10M_YEARLY_V1',
    temporal: ['2022-01-01', '2023-01-01'], band: 'data', granularity: 'crop_type_raster', confidence: 'MEDIUM',
    coverage: 'eu', source_label: 'CLMS Crop Types Europe 10m 2022 (openEO/CDSE)',
    // Class codes EMPIRICALLY VALIDATED against BRP ground truth + a wheat-belt control (Beauce):
    //   1210 = potatoes (Dronten 18% ≈ BRP 15.9%; Beauce 3.7%), 1110 = cereals (Beauce 41.6%).
    // verified:false — confirm/extend the rest against the official CLMS legend before relying on them.
    cropCodes: { potatoes: 1210, wheat: 1110, oats: 1110 },
    classFor: function (crop) { return this.cropCodes[crop] || null; },
  },
};

var CFG = PROVIDERS[process.env.PROVIDER || 'worldcover'];
if (!CFG) { console.error('Unknown PROVIDER.'); process.exit(1); }
var CROP = process.env.CROP || 'potatoes';
var CENTER = { lat: Number(process.env.CENTER_LAT || 52.53), lon: Number(process.env.CENTER_LON || 5.72) };
var GRID_N = parseInt(process.env.GRID_N || '1', 10);
var CELL_KM = Number(process.env.CELL_KM || 5);
var RADIUS = eng.cropRadiusKm(CROP);
if (RADIUS == null) { console.error('No pest-radius for crop "' + CROP + '".'); process.exit(1); }

var kmLat = 1 / 111, kmLon = function (lat) { return 1 / (111 * Math.cos(lat * Math.PI / 180)); };

async function token() {
  var t = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  var fresh = t.obtained && (Date.now() - t.obtained) / 1000 < (t.expires_in - 120);
  if (fresh) return t.access_token;
  var body = new URLSearchParams({ grant_type: 'refresh_token', client_id: OIDC_CLIENT, refresh_token: t.refresh_token });
  var j = await (await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body })).json();
  if (!j.access_token) throw new Error('token refresh failed: ' + (j.error_description || j.error || '?') + ' — re-run the device login');
  fs.writeFileSync(TOKEN_FILE, JSON.stringify({ access_token: j.access_token, refresh_token: j.refresh_token || t.refresh_token, obtained: Date.now(), expires_in: j.expires_in }));
  return j.access_token;
}

function circle(lat, lon, R, n) {
  var ring = [];
  for (var i = 0; i <= n; i++) { var a = 2 * Math.PI * i / n; ring.push([lon + R * kmLon(lat) * Math.sin(a), lat + R * kmLat * Math.cos(a)]); }
  return ring;
}

// Server-side fraction of `cls` pixels within the circle around EACH point — ALL points in ONE
// openEO call (aggregate_spatial accepts many geometries), so we don't hammer the rate limit.
async function classFractions(tok, points, cls) {
  var feats = points.map(function (p, i) {
    return { type: 'Feature', properties: { idx: i }, geometry: { type: 'Polygon', coordinates: [circle(p.lat, p.lon, RADIUS, 32)] } };
  });
  var W = Infinity, E = -Infinity, S = Infinity, N = -Infinity;
  feats.forEach(function (f) { f.geometry.coordinates[0].forEach(function (c) { W = Math.min(W, c[0]); E = Math.max(E, c[0]); S = Math.min(S, c[1]); N = Math.max(N, c[1]); }); });
  var ext = { west: W, east: E, south: S, north: N };
  var geom = { type: 'FeatureCollection', features: feats };
  var pg = { process: { process_graph: {
    load: { process_id: 'load_collection', arguments: { id: CFG.collection, spatial_extent: ext, temporal_extent: CFG.temporal, bands: [CFG.band] } },
    mask: { process_id: 'apply', arguments: { data: { from_node: 'load' }, process: { process_graph: {
      e: { process_id: 'eq', arguments: { x: { from_parameter: 'x' }, y: cls }, result: true } } } } },
    agg: { process_id: 'aggregate_spatial', arguments: { data: { from_node: 'mask' }, geometries: geom, reducer: { process_graph: {
      m: { process_id: 'mean', arguments: { data: { from_parameter: 'data' } }, result: true } } } } },
    save: { process_id: 'save_result', arguments: { data: { from_node: 'agg' }, format: 'JSON' }, result: true },
  } } };
  var res = await fetch(OPENEO + '/result', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer oidc/CDSE/' + tok }, body: JSON.stringify(pg) });
  if (!res.ok) throw new Error('openEO ' + res.status + ': ' + (await res.text()).slice(0, 300));
  var out = await res.json();
  var first = out[Object.keys(out)[0]];                 // { "<date>": [[v0],[v1],...] } — one per geometry, in order
  return points.map(function (_, i) { var c = first[i]; return Number(Array.isArray(c) ? c[0] : c); });
}
function gridPoints() {
  var pts = [], half = (GRID_N - 1) / 2;
  for (var i = 0; i < GRID_N; i++) for (var j = 0; j < GRID_N; j++) {
    pts.push({ lat: CENTER.lat + (i - half) * CELL_KM * kmLat, lon: CENTER.lon + (j - half) * CELL_KM * kmLon(CENTER.lat) });
  }
  return pts;
}

async function rpc(p) {
  var res = await fetch(SB_URL + '/rest/v1/rpc/save_concentration_grid', {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
    body: JSON.stringify({ p: p }) });
  if (!res.ok) throw new Error('RPC ' + res.status + ': ' + (await res.text()).slice(0, 200));
}

(async function main() {
  var tok = await token();
  var CLS = CFG.classFor(CROP);
  if (CLS == null) { console.error('Provider "' + (process.env.PROVIDER || 'worldcover') + '" has no class code for crop "' + CROP + '" — add it to cropCodes first.'); process.exit(1); }
  var pts = gridPoints();
  console.log('provider=' + (process.env.PROVIDER || 'worldcover') + ' collection=' + CFG.collection + ' crop=' + CROP + ' class=' + CLS + ' radius=' + RADIUS + 'km grid=' + GRID_N + 'x' + GRID_N + '@' + CELL_KM + 'km centre=' + CENTER.lat + ',' + CENTER.lon + ' (' + pts.length + ' cells, 1 openEO call)');
  var fr = await classFractions(tok, pts, CLS);
  var written = 0;
  for (var i = 0; i < pts.length; i++) {
    var share = fr[i];
    if (!(share >= 0)) { console.log('  cell ' + pts[i].lat.toFixed(4) + ',' + pts[i].lon.toFixed(4) + ' -> no data, skipped'); continue; }
    var lvl = eng.concentrationLevel(share);
    await rpc({ crop: CROP, grid_lat: Number(pts[i].lat.toFixed(5)), grid_lon: Number(pts[i].lon.toFixed(5)), cell_km: CELL_KM,
      radius_km: RADIUS, share: share, level: lvl.level, addon_pct: lvl.addon_pct, n_parcels: null,
      source_label: CFG.source_label, verified: false,
      source_id: CFG.source_id, granularity: CFG.granularity, confidence: CFG.confidence, country: process.env.COUNTRY || null });
    written++;
    console.log('  cell ' + pts[i].lat.toFixed(4) + ',' + pts[i].lon.toFixed(4) + '  share=' + Math.round(share * 1000) / 10 + '%  ' + lvl.level);
  }
  console.log('Done — ' + written + '/' + pts.length + ' cells upserted (' + CFG.granularity + '/' + CFG.confidence + ').');
})().catch(function (e) { console.error('FAILED:', e.message); process.exit(1); });
