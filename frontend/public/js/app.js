/*
 * PuneStay Sonar · Nearby Services WebGIS in plain JavaScript (Leaflet, no framework, no build step).
 *
 * Course brief (Nearby Services WebGIS) applied to one service: PGs and hostels. Location by map click /
 * coordinates / geolocation (+ address and PIN search), category (PG or hostel) and subcategory (anyone, boys,
 * girls) filters, radius and nearest-N search, a distance-sorted list synchronised with the markers, popup +
 * side-panel details with the nearest bus stop, mess, hospital and more, a PostGIS query on the server
 * (GET /listings/nearby, geography, metres), GeoServer WMS overlays, and explicit error handling for denied
 * geolocation, invalid input and empty results.
 */
(function () {
  'use strict';

  // ======================= configuration =======================
  // Every URL the page talks to lives here. The Vite dev server (5173) and `npm run preview` (4173) proxy /api
  // to FastAPI; any other origin (file://, python -m http.server, ...) calls the API directly, which needs its
  // origin in CORS_ORIGINS in .env.
  var API = /^(5173|4173)$/.test(location.port) ? '/api' : 'http://localhost:8000';
  var URLS = {
    health: API + '/health',
    nearby: API + '/listings/nearby',                  // PostGIS radius / nearest-N search (metres on the geography type)
    summary: API + '/listings/nearby/summary',         // counts for the chips and the intro
    listing: API + '/listings/',                       // + id: details, photos, nearest services
    geocode: API + '/geocode',                         // Nominatim through the backend: cached, throttled to 1 request/s, Find/Enter only
    reverse: API + '/geocode/reverse',                 // Nominatim reverse through the backend, same cache and throttle
    destinations: API + '/destinations',               // 1,010 colleges and offices in our own database (safe for as-you-type)
    areas: API + '/areas',                             // localities in our own database
    login: API + '/auth/login', register: API + '/auth/register', me: API + '/auth/me',
    listings: API + '/listings'                        // POST creates a listing; POST /listings/{id}/photos adds photos
  };
  var TOKEN_KEY = 'punestay.token';                    // same key as the React app, so one sign-in works in both
  var GEOSERVER = 'http://localhost:8080/geoserver';
  var WS = 'punestay';
  var WMS_URL = GEOSERVER + '/' + WS + '/wms';
  var TILES = {   // all free, no key; attribution is shown for whichever is active
    osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    hot: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    light: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    dark: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    terrain: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    esri: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    esriLabels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
  };
  // thumbnail tile over central Pune: z=12, x=2887, y=1820 (Esri URLs take z/y/x)
  function thumbOf(tpl) { return tpl.replace('{s}', 'a').replace('{z}', '12').replace('{x}', '2887').replace('{y}', '1820'); }
  var PUNE = { lat: 18.5204, lng: 73.8567 };
  var SAMPLE = { lat: 18.5308, lng: 73.8575, name: 'Sample spot: Shivajinagar' };
  var BBOX = { south: 18.40, west: 73.62, north: 18.75, east: 74.05 };   // same as PUNE_BBOX in .env
  var RADII = [500, 1000, 2000, 5000, 10000];
  var STORE = { theme: 'punestay.sonar.theme', toured: 'punestay.sonar.toured', base: 'punestay.sonar.basemap' };
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // One mapping drives chips, markers, popups, cards and the legend. The "category" is the kind of place
  // (PG or hostel) and the "subcategory" is who it is for; both come from PuneStay's own listings table.
  var TYPES = [
    { category: 'pg', label: 'PG', icon: 'bed-double', color: 'var(--c-stay)', count: 0 },
    { category: 'hostel', label: 'Hostel', icon: 'building', color: 'var(--c-hostel)', count: 0 }
  ];
  var FOR = [{ sub: '', label: 'Anyone', icon: 'users' }, { sub: 'male', label: 'Boys', icon: 'user' }, { sub: 'female', label: 'Girls', icon: 'user-round' }];
  // Icons and colours for the nearest services shown inside a place's detail panel.
  var CAT_ICON = { pg: 'bed-double', hostel: 'building', bus_stop: 'bus', metro: 'train-front', mess: 'utensils', hospital: 'hospital', pharmacy: 'pill', atm: 'banknote', grocery: 'shopping-cart', police: 'shield' };
  var NEAR_COLOR = { bus_stop: 'var(--c-transport)', metro: 'var(--c-transport)', mess: 'var(--c-food)', hospital: 'var(--c-healthcare)', pharmacy: 'var(--c-healthcare)', atm: 'var(--c-commercial)', grocery: 'var(--c-food)', police: 'var(--c-public)' };
  function isStay() { return true; }
  function typeOf(cat) { return TYPES.filter(function (t) { return t.category === cat; })[0]; }
  function colorOf(cat) { var t = typeOf(cat); return t ? t.color : (NEAR_COLOR[cat] || 'var(--c-other)'); }
  function iconOf(cat) { return CAT_ICON[cat] || 'map-pin'; }

  // ======================= small helpers =======================
  function $(id) { return document.getElementById(id); }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ic(name, cls) { return '<i data-lucide="' + name + '"' + (cls ? ' class="' + cls + '"' : '') + '></i>'; }
  function icons() { if (window.lucide) { try { window.lucide.createIcons(); } catch (e) { /* ignore */ } } }
  function metres(m) { return m == null ? '' : m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' km'; }
  function nice(s) { return String(s || '').replace(/_/g, ' '); }
  function round6(n) { return Math.round(n * 1e6) / 1e6; }
  function inPune(lat, lng) { return lat >= BBOX.south && lat <= BBOX.north && lng >= BBOX.west && lng <= BBOX.east; }
  function fmt(lat, lng) { return lat.toFixed(5) + ', ' + lng.toFixed(5); }
  function isNarrow() { return window.innerWidth < 640; }
  function isTablet() { return window.innerWidth >= 640 && window.innerWidth < 1024; }

  // ======================= toasts =======================
  var toastsEl = $('toasts');
  function toast(text, kind, opts) {
    opts = opts || {};
    var t = document.createElement('div');
    t.className = 'toast ' + (kind || 'ok');
    var iconName = kind === 'err' ? 'circle-x' : kind === 'load' ? 'loader-circle' : 'check';
    t.innerHTML = ic(iconName) + '<span>' + esc(text) + '</span>' + (opts.action ? '<button class="btn sm" type="button">' + esc(opts.action) + '</button>' : '');
    if (opts.action) t.querySelector('button').addEventListener('click', function () { opts.onAction(); dismiss(); });
    toastsEl.appendChild(t);
    icons();
    var timer = setTimeout(dismiss, opts.sticky ? 1e9 : (kind === 'err' ? 6500 : 3200));
    function dismiss() { clearTimeout(timer); t.classList.add('out'); setTimeout(function () { t.remove(); }, 230); }
    return { dismiss: dismiss };
  }

  // ======================= theme =======================
  var html = document.documentElement;
  var themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
  function storedTheme() { try { return localStorage.getItem(STORE.theme); } catch (e) { return null; } }
  function currentTheme() { return html.getAttribute('data-theme'); }
  function applyTheme(t, remember) {
    html.setAttribute('data-theme', t);
    qs('meta[name="theme-color"]').content = t === 'dark' ? '#070b16' : '#f4f7fb';
    if (remember) { try { localStorage.setItem(STORE.theme, t); } catch (e) { /* ignore */ } }
    if (!state.basemap) setBasemap(t === 'dark' ? 'dark' : 'light', false);
  }
  themeMedia.addEventListener('change', function (e) { if (!storedTheme()) applyTheme(e.matches ? 'dark' : 'light', false); });

  // ======================= state + URL =======================
  var state = {
    loc: null, group: '', cat: '', sub: '', mode: 'radius', radiusIdx: 2, n: 10, sort: 'distance',
    results: [], activeId: null, basemap: null,
    overlays: { markers: true, ring: true, heat: false, wmsAll: false }
  };
  var categories = [];            // from /nearby/categories (the database's own grouping)
  function radiusM() { return RADII[state.radiusIdx]; }

  function syncUrl() {
    var p = new URLSearchParams();
    if (state.loc) { p.set('lat', state.loc.lat); p.set('lng', state.loc.lng); if (state.loc.name) p.set('name', state.loc.name); }
    if (state.cat) p.set('type', state.cat);
    if (state.sub) p.set('gender', state.sub);
    p.set('mode', state.mode);
    p.set('radius', radiusM());
    p.set('n', state.n);
    if (state.basemap) p.set('base', state.basemap);
    history.replaceState(null, '', location.pathname + '?' + p.toString());
  }
  function readUrl() {
    var p = new URLSearchParams(location.search);
    if (p.get('mode') === 'nearest') setMode('nearest', true);
    if (p.get('radius') && RADII.indexOf(Number(p.get('radius'))) >= 0) setRadius(RADII.indexOf(Number(p.get('radius'))), true);
    if (p.get('n') && [5, 10, 20, 50, 100].indexOf(Number(p.get('n'))) >= 0) setN(Number(p.get('n')), true);
    if (p.get('base')) setBasemap(p.get('base'), true);
    var t = p.get('type') || p.get('category');
    if (t && typeOf(t)) state.cat = t;
    var g = p.get('gender') || p.get('subcategory');
    if (g === 'male' || g === 'female') state.sub = g;
    var lat = Number(p.get('lat')), lng = Number(p.get('lng'));
    if (p.get('lat') && p.get('lng') && !isNaN(lat) && !isNaN(lng) && inPune(lat, lng)) {
      return { lat: round6(lat), lng: round6(lng), name: p.get('name') || 'Shared location', source: 'link' };
    }
    return null;
  }

  // ======================= map =======================
  var map = L.map('map', { center: PUNE, zoom: 12, minZoom: 10, maxZoom: 19, maxBounds: [[18.2, 73.4], [18.9, 74.3]], zoomControl: false, zoomAnimation: !reducedMotion });
  L.control.zoom({ position: 'bottomleft' }).addTo(map);
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

  var OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  var ESRI_GRAY_ATTR = 'Tiles &copy; <a href="https://www.esri.com/">Esri</a>, HERE, Garmin, ' + OSM_ATTR;
  // OpenFreeMap vector styles (free, no key, no limits) drawn by MapLibre inside Leaflet. If the plugin failed to
  // load (offline CDN), the same keys fall back to raster tiles so the picker always works.
  var OFM = 'https://tiles.openfreemap.org/styles/';
  var OFM_ATTR = '<a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/">OpenMapTiles</a> ' + OSM_ATTR;
  var hasGL = typeof L.maplibreGL === 'function' && typeof window.maplibregl === 'object';
  function vectorOrRaster(style, rasterUrl, rasterOpts) {
    return hasGL ? L.maplibreGL({ style: OFM + style, attribution: OFM_ATTR }) : L.tileLayer(rasterUrl, rasterOpts);
  }
  var BASEMAPS = {
    streets: { label: 'Streets', swatch: 'linear-gradient(135deg, #e8f1e3, #fff3cf 60%, #cfe5f5)',
      layer: vectorOrRaster('liberty', TILES.osm, { maxZoom: 19, subdomains: 'abc', attribution: OSM_ATTR }) },
    light: { label: 'Light', swatch: 'linear-gradient(135deg, #f7f7f5, #e4e7e2)',
      layer: vectorOrRaster('positron', TILES.light, { maxZoom: 16, attribution: ESRI_GRAY_ATTR }) },
    dark: { label: 'Dark', swatch: 'linear-gradient(135deg, #1b1f27, #2b3140)',
      layer: vectorOrRaster('dark', TILES.dark, { maxZoom: 16, attribution: ESRI_GRAY_ATTR }) },
    osm: { label: 'OpenStreetMap', thumb: thumbOf(TILES.osm),
      layer: L.tileLayer(TILES.osm, { maxZoom: 19, subdomains: 'abc', attribution: OSM_ATTR }) },
    hot: { label: 'Humanitarian', thumb: thumbOf(TILES.hot),
      layer: L.tileLayer(TILES.hot, { maxZoom: 19, subdomains: 'abc', attribution: OSM_ATTR + ', tiles <a href="https://www.hotosm.org/">HOT</a> hosted by OSM France' }) },
    terrain: { label: 'Terrain', thumb: thumbOf(TILES.terrain),
      layer: L.tileLayer(TILES.terrain, { maxZoom: 17, subdomains: 'abc', attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA), ' + OSM_ATTR }) },
    satellite: { label: 'Satellite', thumb: thumbOf(TILES.esri),
      layer: L.layerGroup([
        L.tileLayer(TILES.esri, { maxZoom: 19, attribution: 'Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics' }),
        L.tileLayer(TILES.esriLabels, { maxZoom: 19 })
      ]) }
  };
  var activeBase = null;
  function setBasemap(key, explicit) {
    if (!BASEMAPS[key]) return;
    if (activeBase) map.removeLayer(BASEMAPS[activeBase].layer);
    activeBase = key;
    BASEMAPS[key].layer.addTo(map);
    if (explicit) { state.basemap = key; try { localStorage.setItem(STORE.base, key); } catch (e) { /* ignore */ } }
    qsa('#basemaps button').forEach(function (b) { b.classList.toggle('on', b.dataset.base === key); });
  }

  // overlays
  var clusters = L.markerClusterGroup({ maxClusterRadius: 44, showCoverageOnHover: false, disableClusteringAtZoom: 16, spiderfyOnMaxZoom: true });
  clusters.addTo(map);
  var ring = null, heat = null, userMarker = null, halo = null;
  var markers = {};               // id -> marker
  var wms = {};                   // key -> L.tileLayer.wms
  function wmsLayer(cql, layerName) {
    var opts = { layers: WS + ':' + (layerName || 'services'), format: 'image/png', transparent: true, version: '1.1.1', opacity: 0.8, attribution: 'GeoServer' };
    if (cql) opts.CQL_FILTER = cql;
    var l = L.tileLayer.wms(WMS_URL, opts);
    l.on('tileerror', function () { if (!l._warned) { l._warned = true; toast('GeoServer overlay could not be loaded. Is GeoServer running on port 8080?', 'err'); } });
    return l;
  }
  var OVERLAYS = [
    { key: 'markers', label: 'Result markers', icon: 'map-pin', on: true },
    { key: 'ring', label: 'Search ring', icon: 'circle-dashed', on: true },
    { key: 'heat', label: 'Heatmap of results', icon: 'flame', on: false },
    { key: 'wmsAll', label: 'All PGs and hostels (GeoServer WMS)', icon: 'server', on: false, layer: 'listings_public' },
    { key: 'wmsPg', label: 'PGs only (WMS)', icon: 'bed-double', color: 'var(--c-stay)', on: false, layer: 'listings_public', cql: "listing_type='pg'" },
    { key: 'wmsHostel', label: 'Hostels only (WMS)', icon: 'building', color: 'var(--c-hostel)', on: false, layer: 'listings_public', cql: "listing_type='hostel'" },
    { key: 'wmsStops', label: 'Bus stops and metro around (WMS)', icon: 'bus', color: 'var(--c-transport)', on: false, cql: "category IN ('bus_stop','metro')" }
  ];
  function setOverlay(key, on) {
    state.overlays[key] = on;
    if (key === 'markers') { if (on) clusters.addTo(map); else map.removeLayer(clusters); }
    else if (key === 'ring') { drawRing(); }
    else if (key === 'heat') { drawHeat(); }
    else {
      var def = OVERLAYS.filter(function (o) { return o.key === key; })[0];
      if (on && !wms[key]) { wms[key] = wmsLayer(def.cql, def.layer).addTo(map); }
      else if (!on && wms[key]) { map.removeLayer(wms[key]); delete wms[key]; }
    }
  }

  function drawRing() {
    if (ring) { map.removeLayer(ring); ring = null; }
    if (!state.loc || !state.overlays.ring) return;
    var nearest = state.mode === 'nearest';
    var r = radiusM();
    if (nearest) {
      var far = state.results.length ? Math.max.apply(null, state.results.map(function (f) { return f.properties.distance_m; })) : 0;
      if (!far) return;
      r = far;
    }
    ring = L.circle([state.loc.lat, state.loc.lng], { radius: r, color: getComputedStyle(html).getPropertyValue('--primary').trim() || '#2de2c4', weight: 1.5, fillOpacity: 0.05, dashArray: nearest ? '6 6' : null, interactive: false }).addTo(map);
  }
  function drawHeat() {
    if (heat) { map.removeLayer(heat); heat = null; }
    if (!state.overlays.heat || !state.results.length || !L.heatLayer) return;
    heat = L.heatLayer(state.results.map(function (f) { return [f.geometry.coordinates[1], f.geometry.coordinates[0], 0.8]; }), { radius: 28, blur: 22, minOpacity: 0.3 }).addTo(map);
  }

  // cursor readout
  map.on('mousemove', function (e) { $('cursor').textContent = fmt(e.latlng.lat, e.latlng.lng); });
  map.on('click', function (e) { if (document.body.classList.contains('introing')) return; setLocation({ lat: round6(e.latlng.lat), lng: round6(e.latlng.lng), name: 'Dropped pin', source: 'map click', reverse: true }); });

  // ======================= location =======================
  function setLocation(loc, opts) {
    opts = opts || {};
    if (!inPune(loc.lat, loc.lng)) {
      toast('That point is outside Pune (lat ' + BBOX.south + ' to ' + BBOX.north + ', lng ' + BBOX.west + ' to ' + BBOX.east + ').' + (state.loc ? ' Kept your previous location.' : ''), 'err',
            { action: 'Try a sample spot', onAction: function () { setLocation({ lat: SAMPLE.lat, lng: SAMPLE.lng, name: SAMPLE.name, source: 'sample' }); } });
      return false;
    }
    state.loc = loc;
    $('loc-chip').classList.remove('empty');
    $('loc-name').textContent = loc.name || 'Location';
    $('loc-coords').textContent = fmt(loc.lat, loc.lng) + (loc.source ? ' · ' + loc.source : '');
    $('btn-scan').disabled = false;
    $('btn-scan').title = '';
    if (!userMarker) {
      userMarker = L.marker([loc.lat, loc.lng], { icon: L.divIcon({ className: 'user-dot drop', html: '<i></i>', iconSize: [18, 18], iconAnchor: [9, 9] }), draggable: true, zIndexOffset: 1000, title: 'You are here (drag me)' }).addTo(map);
      userMarker.on('dragend', function () {
        var p = userMarker.getLatLng();
        if (!setLocation({ lat: round6(p.lat), lng: round6(p.lng), name: 'Dropped pin', source: 'drag', reverse: true }, { noFly: true })) userMarker.setLatLng([state.loc.lat, state.loc.lng]);
      });
    } else {
      userMarker.setLatLng([loc.lat, loc.lng]);
      userMarker.setIcon(L.divIcon({ className: 'user-dot drop', html: '<i></i>', iconSize: [18, 18], iconAnchor: [9, 9] }));
    }
    if (!opts.noFly) map.flyTo([loc.lat, loc.lng], Math.max(map.getZoom(), 14), { duration: reducedMotion ? 0 : 1.1 });
    drawRing();
    syncUrl();
    if (!opts.silent) toast('Location set: ' + (loc.name || fmt(loc.lat, loc.lng)), 'ok');
    if (opts.scan || state.results.length) scan();
    if (loc.reverse) reverseName(loc);
    if (typeof refreshAddLocation === 'function') refreshAddLocation();
    return true;
  }
  // Name a clicked, dragged or GPS point: Nominatim reverse through the backend (cached, throttled to 1 request/s).
  var reverseAbort = null;
  function reverseName(loc) {
    if (reverseAbort) reverseAbort.abort();
    reverseAbort = new AbortController();
    fetch(URLS.reverse + '?lat=' + loc.lat + '&lng=' + loc.lng, { signal: reverseAbort.signal })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (hit) {
        if (!hit || !hit.display || state.loc !== loc) return;
        loc.name = hit.display;
        $('loc-name').textContent = loc.name;
        syncUrl();
      })
      .catch(function () { /* keep "Dropped pin" */ });
  }
  function clearLocation() {
    state.loc = null;
    $('loc-chip').classList.add('empty');
    $('loc-name').textContent = 'No location yet';
    $('loc-coords').textContent = 'tap the map or search above';
    $('btn-scan').disabled = true;
    $('btn-scan').title = 'Set a location first';
    if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
    clearResults();
    drawRing();
    syncUrl();
  }
  $('loc-clear').addEventListener('click', clearLocation);
  $('loc-edit').addEventListener('click', function () { openCoords(true); });

  // geolocation
  $('btn-locate').addEventListener('click', locate);
  function locate() {
    if (!('geolocation' in navigator)) { toast('Your browser does not support geolocation. Tap the map or type coordinates.', 'err'); return; }
    if (!window.isSecureContext) { toast('Geolocation needs HTTPS or localhost. Open the page on localhost, or tap the map instead.', 'err'); return; }
    var t = toast('Finding your location…', 'load', { sticky: true });
    navigator.geolocation.getCurrentPosition(function (pos) {
      t.dismiss();
      setLocation({ lat: round6(pos.coords.latitude), lng: round6(pos.coords.longitude), name: 'Your location', source: 'GPS ±' + Math.round(pos.coords.accuracy || 0) + ' m', reverse: true });
    }, function (err) {
      t.dismiss();
      var msg = { 1: 'Location permission was denied. Allow it in the browser, or tap the map / type coordinates.',
                  2: 'Your position is unavailable right now. Tap the map or type coordinates.',
                  3: 'Finding your location timed out. Try again, or tap the map.' }[err.code] || 'Could not get your location.';
      toast(msg + (state.loc ? ' Kept your previous location.' : ''), 'err');
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }

  // coordinates popover
  var coordsPop = $('coords-pop');
  function openCoords(open) {
    coordsPop.hidden = !open;
    $('btn-coords').setAttribute('aria-expanded', String(open));
    if (open) {
      if (state.loc) { $('lat').value = state.loc.lat; $('lng').value = state.loc.lng; }
      if (isNarrow()) { /* on phones the search bar is compact: show the popover under the fabs */ coordsPop.style.right = '12px'; }
      $('lat').focus();
    }
  }
  $('btn-coords').addEventListener('click', function () { openCoords(coordsPop.hidden); });
  $('btn-coords-ok').addEventListener('click', applyCoords);
  ['lat', 'lng'].forEach(function (id) { $(id).addEventListener('keydown', function (e) { if (e.key === 'Enter') applyCoords(); }); });
  function applyCoords() {
    var latS = $('lat').value.trim(), lngS = $('lng').value.trim();
    var lat = Number(latS), lng = Number(lngS), ok = true;
    $('lat-err').textContent = ''; $('lng-err').textContent = '';
    if (latS === '' || isNaN(lat)) { $('lat-err').textContent = 'Enter a number, e.g. 18.5204'; ok = false; }
    else if (lat < -90 || lat > 90) { $('lat-err').textContent = 'Latitude must be within ±90'; ok = false; }
    else if (lat < BBOX.south || lat > BBOX.north) { $('lat-err').textContent = 'Pune is between ' + BBOX.south + ' and ' + BBOX.north; ok = false; }
    if (lngS === '' || isNaN(lng)) { $('lng-err').textContent = 'Enter a number, e.g. 73.8567'; ok = false; }
    else if (lng < -180 || lng > 180) { $('lng-err').textContent = 'Longitude must be within ±180'; ok = false; }
    else if (lng < BBOX.west || lng > BBOX.east) { $('lng-err').textContent = 'Pune is between ' + BBOX.west + ' and ' + BBOX.east; ok = false; }
    if (!ok) return;
    openCoords(false);
    setLocation({ lat: round6(lat), lng: round6(lng), name: 'Typed coordinates', source: 'coordinates' });
  }

  // ---------- search box ----------
  // As you type: suggestions come only from our own database (colleges, offices, localities), debounced 300 ms,
  // at least 2 characters, old requests cancelled, up to 6 results, keyboard ↑ ↓ Enter Esc.
  // Find / Enter: a chosen suggestion, typed "lat, lng" coordinates, a 6-digit PIN code, or a free-text address
  // through the backend geocoder (Nominatim, cached and throttled there; never used for autocomplete).
  var q = $('q'), suggest = $('suggest'), geoAbort = null, sugAbort = null, sugTimer = null;
  var suggestions = [], sugIndex = -1, localities = [];
  fetch(URLS.areas + '?min_listings=1').then(function (r) { return r.ok ? r.json() : []; })
    .then(function (rows) { localities = rows.map(function (a) { return { name: a.locality, kind: 'locality', lat: a.lat, lng: a.lng, note: a.listings + ' places' }; }); })
    .catch(function () { /* suggestions then come from colleges and offices only */ });

  q.addEventListener('input', function () {
    clearTimeout(sugTimer);
    var term = q.value.trim();
    if (term.length < 2 || /^[\d\s.,-]+$/.test(term)) { hideSuggest(); return; }
    sugTimer = setTimeout(function () { suggestLocal(term); }, 300);
  });
  q.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!suggestions.length) return;
      e.preventDefault();
      sugIndex = (sugIndex + (e.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length;
      renderSuggest();
    } else if (e.key === 'Enter') { e.preventDefault(); find(); }
    else if (e.key === 'Escape') hideSuggest();
  });
  q.addEventListener('blur', function () { setTimeout(hideSuggest, 150); });
  $('btn-find').addEventListener('click', find);

  function suggestLocal(term) {
    if (sugAbort) sugAbort.abort();
    sugAbort = new AbortController();
    var t = term.toLowerCase();
    var local = localities.filter(function (l) { return l.name.toLowerCase().indexOf(t) >= 0; }).slice(0, 3);
    fetch(URLS.destinations + '?q=' + encodeURIComponent(term) + '&limit=6', { signal: sugAbort.signal })
      .then(function (r) { return r.ok ? r.json() : { features: [] }; })
      .then(function (fc) {
        var dest = (fc.features || []).map(function (f) { return { name: f.properties.name, kind: f.properties.kind, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }; });
        suggestions = local.concat(dest).slice(0, 6);
        sugIndex = suggestions.length ? 0 : -1;
        renderSuggest();
      })
      .catch(function (e) { if (e.name !== 'AbortError') { suggestions = local; sugIndex = local.length ? 0 : -1; renderSuggest(); } });
  }
  function renderSuggest() {
    if (!suggestions.length) { hideSuggest(); return; }
    var kindIcon = { college: 'graduation-cap', office: 'briefcase', locality: 'map-pin' };
    suggest.innerHTML = suggestions.map(function (s, i) {
      return '<li class="' + (i === sugIndex ? 'on' : '') + '" role="option" aria-selected="' + (i === sugIndex) + '" data-i="' + i + '">' + ic(kindIcon[s.kind] || 'map-pin') +
        '<span>' + esc(s.name) + '</span><span class="mono">' + esc(s.note || s.kind) + '</span></li>';
    }).join('');
    suggest.hidden = false;
    qsa('li', suggest).forEach(function (li) {
      li.addEventListener('mousedown', function (e) { e.preventDefault(); pickSuggestion(suggestions[Number(li.dataset.i)]); });
      li.addEventListener('mouseenter', function () { sugIndex = Number(li.dataset.i); qsa('li', suggest).forEach(function (x) { x.classList.toggle('on', x === li); }); });
    });
    icons();
  }
  function hideSuggest() { suggest.hidden = true; suggest.innerHTML = ''; suggestions = []; sugIndex = -1; }
  function pickSuggestion(s) {
    hideSuggest();
    q.value = s.name;
    setLocation({ lat: round6(s.lat), lng: round6(s.lng), name: s.name, source: s.kind === 'locality' ? 'locality' : s.kind });
  }
  function find() {
    var term = q.value.trim();
    if (sugIndex >= 0 && suggestions[sugIndex]) { pickSuggestion(suggestions[sugIndex]); return; }
    if (!term) { toast('Type an address, a locality, a college, an office, a 6-digit PIN code or "lat, lng".', 'err'); return; }
    // "18.52, 73.85" typed straight into the box
    var m = term.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
    if (m) {
      var lat = Number(m[1]), lng = Number(m[2]);
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) { toast('Latitude must be within ±90 and longitude within ±180.', 'err'); return; }
      hideSuggest();
      setLocation({ lat: round6(lat), lng: round6(lng), name: 'Typed coordinates', source: 'coordinates', reverse: true });
      return;
    }
    var pin = /^\d+$/.test(term);
    if (pin && !/^\d{6}$/.test(term)) { toast('A PIN code has 6 digits, for example 411005.', 'err'); return; }
    geocode(term, pin);
  }
  function geocode(term, pin) {
    var query = pin ? term + ', Pune, Maharashtra' : (/pune/i.test(term) ? term : term + ', Pune');
    if (geoAbort) geoAbort.abort();
    geoAbort = new AbortController();
    var t = toast('Searching ' + term + '…', 'load', { sticky: true });
    fetch(URLS.geocode + '?q=' + encodeURIComponent(query), { signal: geoAbort.signal })
      .then(function (r) { return r.json().then(function (b) { if (!r.ok) throw new Error(b.detail || 'Geocoding failed (' + r.status + ')'); return b; }); })
      .then(function (hit) {
        t.dismiss(); hideSuggest();
        setLocation({ lat: round6(hit.lat), lng: round6(hit.lng), name: shortName(hit.display || term), source: pin ? 'PIN code' : 'address' });
      })
      .catch(function (e) {
        if (e.name === 'AbortError') return;
        t.dismiss();
        toast((/No match/i.test(e.message) ? 'Address not found inside Pune. Try adding the locality name, or tap the map.' : e.message) + (state.loc ? ' Kept your previous location.' : ''), 'err');
      });
  }
  function shortName(display) { return display.split(',').slice(0, 3).join(',').trim(); }

  // ======================= filters =======================
  function renderTypeChips() {
    var total = TYPES.reduce(function (s, t) { return s + t.count; }, 0);
    var h = '<button type="button" class="chip' + (state.cat ? '' : ' on') + '" data-cat="" style="--c: var(--primary)">' + ic('layers') + ' Any' + (total ? ' <small>' + total + '</small>' : '') + '</button>';
    TYPES.forEach(function (t) {
      h += '<button type="button" class="chip' + (state.cat === t.category ? ' on' : '') + '" data-cat="' + t.category + '" style="--c:' + t.color + '">' + ic(t.icon) + ' ' + esc(t.label) + (t.count ? ' <small>' + t.count + '</small>' : '') + '</button>';
    });
    $('type-chips').innerHTML = h;
    icons();
  }
  function renderForChips() {
    $('for-chips').innerHTML = FOR.map(function (f) {
      return '<button type="button" class="chip' + (state.sub === f.sub ? ' on' : '') + '" data-sub="' + f.sub + '" style="--c: var(--accent)">' + ic(f.icon) + ' ' + esc(f.label) + '</button>';
    }).join('');
    icons();
  }
  function renderGroupChips() { renderTypeChips(); renderForChips(); }
  $('type-chips').addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    state.cat = b.dataset.cat;
    renderTypeChips(); afterFilterChange();
  });
  $('for-chips').addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    state.sub = b.dataset.sub;
    renderForChips(); afterFilterChange();
  });

  function setMode(m, quiet) {
    state.mode = m;
    qsa('#mode button').forEach(function (b) { var on = b.dataset.mode === m; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
    $('radius-step').classList.toggle('disabled', m === 'nearest');
    $('radius').disabled = m === 'nearest';
    $('radius-note').hidden = m !== 'nearest';
    $('n-label').textContent = m === 'nearest' ? 'How many nearest?' : 'Maximum results';
    if (!quiet) afterFilterChange();
  }
  $('mode').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) setMode(b.dataset.mode); });
  function setRadius(idx, quiet) {
    state.radiusIdx = idx;
    $('radius').value = idx;
    $('radius-out').textContent = metres(RADII[idx]);
    drawRing();
    if (!quiet) { syncUrl(); }
  }
  $('radius').addEventListener('input', function (e) { setRadius(Number(e.target.value)); });
  $('radius').addEventListener('change', function () { afterFilterChange(); });
  function setN(n, quiet) {
    state.n = n;
    qsa('#n-pills button').forEach(function (b) { b.classList.toggle('on', Number(b.dataset.n) === n); });
    if (!quiet) afterFilterChange();
  }
  $('n-pills').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) setN(Number(b.dataset.n)); });
  function afterFilterChange() { syncUrl(); if (state.results.length || hasScanned) scan(); }
  $('btn-reset').addEventListener('click', function () {
    state.cat = ''; state.sub = ''; setMode('radius', true); setRadius(2, true); setN(10, true);
    renderGroupChips(); syncUrl(); toast('Filters reset', 'ok'); if (hasScanned) scan();
  });

  // ======================= the scan (PostGIS on the server) =======================
  var scanAbort = null, hasScanned = false;
  $('btn-scan').addEventListener('click', function () { scan(true); });
  function queryParams() {
    var p = new URLSearchParams({ lat: state.loc.lat, lng: state.loc.lng });
    if (state.cat) p.set('type', state.cat);
    if (state.sub) p.set('gender', state.sub);
    if (state.mode === 'radius') { p.set('radius_m', radiusM()); p.set('limit', state.n); }
    else { p.set('limit', state.n); }
    return p;
  }
  function scan(animate) {
    if (!state.loc) { toast('Set a location first: tap the map, use your location or search.', 'err'); return; }
    hasScanned = true;
    if (scanAbort) scanAbort.abort();
    scanAbort = new AbortController();
    var timeout = setTimeout(function () { scanAbort.abort('timeout'); }, 15000);
    showState('loading');
    if (animate) scanAnimation();
    var t = toast('Scanning ' + (state.mode === 'radius' ? 'within ' + metres(radiusM()) : 'for the nearest ' + state.n) + '…', 'load', { sticky: true });
    fetch(URLS.nearby + '?' + queryParams().toString(), { signal: scanAbort.signal })
      .then(function (r) { return r.json().then(function (b) { if (!r.ok) throw new Error(b.detail || 'The API answered ' + r.status); return b; }); })
      .then(function (fc) {
        clearTimeout(timeout); t.dismiss();
        state.results = fc.features || [];
        if (isStay()) state.results.forEach(function (f) { f.properties.listing = true; f.properties.link = '/app/#/listing/' + f.properties.id; });
        state.activeId = null;
        $('api-banner').hidden = true;
        render();
        if (!state.results.length) { showState('empty', fc.message); toast(fc.message || 'No services found here.', 'err'); }
        else { showState('list'); toast(state.results.length + ' place' + (state.results.length === 1 ? '' : 's') + ' found · nearest ' + metres(state.results[0].properties.distance_m), 'ok'); }
        if (isNarrow()) { sheetTab('results'); if ($('sheet').dataset.snap === 'peek') $('sheet').dataset.snap = 'half'; }
      })
      .catch(function (e) {
        clearTimeout(timeout);
        if (e.name === 'AbortError' && scanAbort.signal.reason !== 'timeout') return;   // superseded by a newer scan
        t.dismiss();
        var msg = e.name === 'AbortError' ? 'The server took too long to answer (15 s). Try a smaller radius.' :
                  /Failed to fetch|NetworkError/i.test(e.message) ? 'Could not reach the PuneStay API.' : e.message;
        if (/could not reach/i.test(msg)) checkApi();
        state.results = []; render(); showState('error', msg); toast(msg, 'err');
      });
  }
  $('btn-retry').addEventListener('click', function () { scan(true); });

  function showState(which, msg) {
    $('skeleton').hidden = which !== 'loading';
    $('empty').hidden = which !== 'empty';
    $('error').hidden = which !== 'error';
    $('list').hidden = which !== 'list';
    if (which === 'empty') $('empty-msg').textContent = msg || 'No services matched here.';
    if (which === 'error') $('error-msg').textContent = msg || '';
    if (which === 'loading') { $('results-title').innerHTML = ic('list-ordered') + ' Scanning…'; icons(); }
  }
  qsa('#empty [data-fix]').forEach(function (b) {
    b.addEventListener('click', function () {
      var fix = b.dataset.fix;
      if (fix === 'radius1k') { setMode('radius', true); setRadius(1, true); }
      if (fix === 'nearest10') { setMode('nearest', true); setN(10, true); }
      if (fix === 'allcats') { state.cat = ''; state.sub = ''; renderGroupChips(); }
      syncUrl(); scan(true);
    });
  });

  // ======================= results: list + markers in sync =======================
  function sorted() {
    var r = state.results.slice();
    if (state.sort === 'name') r.sort(function (a, b) { return String(a.properties.name || 'zzz').localeCompare(String(b.properties.name || 'zzz')); });
    else if (state.sort === 'category') r.sort(function (a, b) { return (a.properties.category + a.properties.distance_m).localeCompare(b.properties.category + b.properties.distance_m); });
    return r;
  }
  function render() {
    clusters.clearLayers(); markers = {};
    if (halo) { map.removeLayer(halo); halo = null; }
    var list = $('list'); list.innerHTML = '';
    var rs = state.results, n = rs.length;
    $('results-title').innerHTML = ic('list-ordered') + ' ' + (n ? n + ' place' + (n === 1 ? '' : 's') + ' found' : 'Results');
    $('results-sub').textContent = n ? 'Nearest ' + metres(rs[0].properties.distance_m) + ' · farthest ' + metres(rs[n - 1].properties.distance_m) + (state.mode === 'radius' ? ' · within ' + metres(radiusM()) : ' · nearest ' + state.n)
      : hasScanned && state.loc ? 'No places matched this search.' : state.loc ? 'Press Scan to search around your location.' : 'Set a location and press Scan.';
    $('rail-count').textContent = n || '';
    $('sheet-count').textContent = n || '';
    var maxD = n ? Math.max.apply(null, rs.map(function (f) { return f.properties.distance_m; })) || 1 : 1;
    var bounds = state.loc ? L.latLngBounds([[state.loc.lat, state.loc.lng]]) : null;

    // markers in distance order (rank = position in the distance-sorted result)
    rs.forEach(function (f, i) {
      var p = f.properties, lat = f.geometry.coordinates[1], lng = f.geometry.coordinates[0];
      var m = L.marker([lat, lng], { icon: pinIcon(p, i + 1, false), title: p.name || nice(p.subcategory) });
      m.bindPopup(popupHtml(p, f), { maxWidth: 300 });
      m.on('click', function () { setActive(p.id, 'marker'); });
      m.on('popupopen', function () { icons(); });
      m._stagger = reducedMotion ? 0 : Math.min(i * 60, 1500);
      markers[p.id] = m;
      if (bounds) bounds.extend([lat, lng]);
    });
    clusters.addLayers(rs.map(function (f) { return markers[f.properties.id]; }));
    clusters.eachLayer(function (m) { if (m._icon) m._icon.style.animationDelay = m._stagger + 'ms'; });

    // cards, sorted as the user asked
    sorted().forEach(function (f, i) {
      var p = f.properties, rank = rs.indexOf(f) + 1, c = colorOf(p.category);
      var li = document.createElement('li');
      li.className = 'res'; li.dataset.id = p.id; li.tabIndex = 0;
      li.style.animationDelay = (reducedMotion ? 0 : Math.min(i * 40, 800)) + 'ms';
      li.style.setProperty('--c', c);
      li.innerHTML =
        '<div class="res-top"><span class="tile">' + ic(iconOf(p.category)) + '<b class="rank">' + rank + '</b></span>' +
        '<span class="res-main"><b>' + esc(p.name || 'Unnamed ' + nice(p.subcategory)) + '</b><small>' + esc(kindLine(p)) + '</small></span>' +
        '<span class="res-dist">' + metres(p.distance_m) + '</span></div>' +
        '<div class="res-bar"><i data-w="' + Math.max(4, Math.round(100 * p.distance_m / maxD)) + '"></i></div>' +
        (p.listing ? '<div class="res-rent">' + (p.rent_min != null ? '₹' + Number(p.rent_min).toLocaleString('en-IN') + ' <small>/ month</small>' : 'Rent not published') + ' <button type="button" class="link" data-detail="' + p.id + '">Details →</button></div>' : '') +
        (p.address ? '<div class="res-addr">' + ic('map-pin') + '<span>' + esc(p.address) + '</span></div>' : '') +
        '<button class="res-more" type="button" aria-label="More details" aria-expanded="false">' + ic('chevron-down') + '</button>' +
        '<div class="res-detail"><dl>' +
          (p.listing ? '<dt>Listing</dt><dd><button type="button" class="link" data-detail="' + p.id + '">Full details, photos and nearby services</button></dd>' : '') +
          (p.phone ? '<dt>Phone</dt><dd><a href="tel:' + esc(p.phone) + '">' + esc(p.phone) + '</a></dd>' : '') +
          (p.website ? '<dt>Website</dt><dd><a href="' + esc(p.website) + '" target="_blank" rel="noopener">' + esc(p.website.replace(/^https?:\/\//, '')) + '</a></dd>' : '') +
          (p.opening_hours ? '<dt>Hours</dt><dd>' + esc(p.opening_hours) + '</dd>' : '') +
          '<dt>Bearing</dt><dd>' + (p.bearing_deg != null ? p.bearing_deg + '°' : '—') + '</dd>' +
          '<dt>Source</dt><dd>' + esc(p.source_label || 'OpenStreetMap') + '</dd>' +
          '<dt>Coords</dt><dd class="mono">' + fmt(lat_(f), lng_(f)) + '</dd></dl>' +
          '<div class="pop-actions"><a class="primary" href="' + directionsUrl(f) + '" target="_blank" rel="noopener">' + ic('navigation') + ' Directions ↗</a>' +
          '<button type="button" data-copy="' + fmt(lat_(f), lng_(f)) + '">' + ic('copy') + ' Copy coordinates</button></div></div>';
      li.addEventListener('click', function (e) {
        if (e.target.closest('.res-more')) { li.classList.toggle('open'); e.target.closest('.res-more').setAttribute('aria-expanded', String(li.classList.contains('open'))); return; }
        if (e.target.closest('[data-copy]')) { copyText(e.target.closest('[data-copy]').dataset.copy); return; }
        if (e.target.closest('[data-detail]')) { openDetail(Number(e.target.closest('[data-detail]').dataset.detail)); return; }
        if (e.target.closest('a')) return;
        setActive(p.id, 'card');
      });
      li.addEventListener('keydown', function (e) { if (e.key === 'Enter') setActive(p.id, 'card'); });
      list.appendChild(li);
    });
    icons();
    requestAnimationFrame(function () { qsa('.res-bar i').forEach(function (b) { b.style.width = b.dataset.w + '%'; }); });
    drawRing(); drawHeat();
    if (bounds && n) map.flyToBounds(bounds.pad(0.18), { maxZoom: 16, duration: reducedMotion ? 0 : 0.9 });
  }
  function kindLine(p) {
    var t = typeOf(p.category);
    return (t ? t.label : nice(p.subcategory)) + ' · ' + (p.gender === 'male' ? 'boys only' : p.gender === 'female' ? 'girls only' : 'anyone') + (p.status === 'verified' ? ' · verified' : '');
  }
  function lat_(f) { return f.geometry.coordinates[1]; }
  function lng_(f) { return f.geometry.coordinates[0]; }
  function directionsUrl(f) { return 'https://www.google.com/maps/dir/?api=1' + (state.loc ? '&origin=' + state.loc.lat + ',' + state.loc.lng : '') + '&destination=' + lat_(f) + ',' + lng_(f); }
  function pinIcon(p, rank, active) {
    return L.divIcon({
      className: 'pin-marker',
      html: '<div class="pin' + (active ? ' active' : '') + '"><span class="drop" style="background:' + colorOf(p.category) + '">' + ic(iconOf(p.category)) + '</span><b class="rank">' + rank + '</b></div>',
      iconSize: [36, 46], iconAnchor: [18, 46], popupAnchor: [0, -40]
    });
  }
  function popupHtml(p, f) {
    return '<div class="pop-head"><span class="tile" style="--c:' + colorOf(p.category) + '">' + ic(iconOf(p.category)) + '</span><span><b>' + esc(p.name || 'Unnamed ' + nice(p.subcategory)) + '</b><small>' + esc(kindLine(p)) + '</small></span></div>' +
      '<div><span class="pop-dist">' + metres(p.distance_m) + '</span> from your pin' + (p.listing ? '<br>' + (p.rent_min != null ? '₹' + Number(p.rent_min).toLocaleString('en-IN') + ' / month' : 'Rent not published') : '') + (p.address ? '<br>' + esc(p.address) : '') + '</div>' +
      '<div class="pop-actions"><a class="primary" href="' + directionsUrl(f) + '" target="_blank" rel="noopener">' + ic('navigation') + ' Directions</a>' +
      (p.listing ? '<button type="button" data-detail="' + p.id + '">' + ic('info') + ' Details</button>' : '') +
      (p.phone ? '<a href="tel:' + esc(p.phone) + '">' + ic('phone') + ' Call</a>' : '') +
      (p.website ? '<a href="' + esc(p.website) + '" target="_blank" rel="noopener">' + ic('globe') + ' Website</a>' : '') + '</div>';
  }
  function setActive(id, from) {
    var prev = state.activeId;
    state.activeId = id;
    if (prev != null && markers[prev]) { var pf = byId(prev); markers[prev].setIcon(pinIcon(pf.properties, state.results.indexOf(pf) + 1, false)); }
    var f = byId(id), m = markers[id];
    if (!f || !m) return;
    m.setIcon(pinIcon(f.properties, state.results.indexOf(f) + 1, true));
    qsa('#list .res').forEach(function (li) { var on = Number(li.dataset.id) === id; li.classList.toggle('active', on); if (on && from !== 'card') li.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' }); });
    if (halo) map.removeLayer(halo);
    halo = L.marker(m.getLatLng(), { icon: L.divIcon({ className: 'pin-halo', html: '<i></i>', iconSize: [60, 60], iconAnchor: [30, 48] }), interactive: false, zIndexOffset: -10 }).addTo(map);
    var open = function () { m.openPopup(); icons(); };
    if (from === 'card') { map.flyTo(m.getLatLng(), Math.max(map.getZoom(), 16), { duration: reducedMotion ? 0 : 0.8 }); clusters.zoomToShowLayer(m, open); }
    else { open(); }
    if (isNarrow() && from === 'marker') { sheetTab('results'); }
  }
  function byId(id) { return state.results.filter(function (f) { return f.properties.id === id; })[0]; }
  function copyText(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast('Copied ' + text, 'ok'); }, function () { toast('Could not copy', 'err'); });
    else toast('Clipboard not available here', 'err');
  }
  function clearResults() {
    state.results = []; state.activeId = null; hasScanned = false;
    render(); showState('list');
    $('results-sub').textContent = state.loc ? 'Press Scan to search around your location.' : 'Set a location and press Scan.';
  }
  $('btn-clear').addEventListener('click', function () { clearResults(); toast('Results cleared', 'ok'); });
  $('sort').addEventListener('change', function (e) { state.sort = e.target.value; render(); });
  $('btn-share').addEventListener('click', function () { syncUrl(); copyText(location.href); });
  var dlMenu = $('download-menu');
  $('btn-download').addEventListener('click', function () { dlMenu.hidden = !dlMenu.hidden; $('btn-download').setAttribute('aria-expanded', String(!dlMenu.hidden)); });
  dlMenu.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return; dlMenu.hidden = true;
    if (!state.results.length) { toast('Nothing to download yet. Scan first.', 'err'); return; }
    var name = 'punestay-nearby-' + new Date().toISOString().slice(0, 10);
    if (b.dataset.fmt === 'csv') {
      var cols = ['rank', 'name', 'type', 'for', 'rent_min', 'status', 'distance_m', 'bearing_deg', 'address', 'phone', 'website', 'source', 'lat', 'lng'];
      var rows = [cols.join(',')].concat(state.results.map(function (f, i) {
        var p = f.properties, vals = [i + 1, p.name, p.category, p.gender, p.rent_min, p.status, p.distance_m, p.bearing_deg, p.address, p.phone, p.website, p.source_label, lat_(f), lng_(f)];
        return vals.map(function (v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',');
      }));
      download(name + '.csv', '﻿' + rows.join('\n'), 'text/csv;charset=utf-8');
    } else {
      download(name + '.geojson', JSON.stringify({ type: 'FeatureCollection', origin: state.loc, features: state.results }, null, 1), 'application/geo+json');
    }
    toast('Downloaded ' + name + (b.dataset.fmt === 'csv' ? '.csv' : '.geojson'), 'ok');
  });
  function download(filename, text, mime) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  // scan animation: ripples + a sweep over the pin, sized to the ring
  function scanAnimation() {
    if (reducedMotion || !state.loc) return;
    var c = map.latLngToContainerPoint([state.loc.lat, state.loc.lng]);
    var edge = map.latLngToContainerPoint([state.loc.lat, state.loc.lng + (state.mode === 'radius' ? radiusM() : 1500) / (111320 * Math.cos(state.loc.lat * Math.PI / 180))]);
    var r = Math.max(60, Math.min(900, Math.abs(edge.x - c.x)));
    var d = document.createElement('div');
    d.className = 'scan'; d.style.left = c.x + 'px'; d.style.top = c.y + 'px'; d.style.width = d.style.height = (2 * r) + 'px';
    d.innerHTML = '<span></span><span></span><span></span><i></i>';
    $('map').appendChild(d);
    setTimeout(function () { d.remove(); }, 3000);
  }

  // ======================= PG / hostel details inside Sonar =======================
  var detailEl = $('detail'), detailBody = $('detail-body'), detailAbort = null;
  var TYPE_LABEL = { pg: 'PG', hostel: 'Hostel', flat: 'Flat' };
  var GENDER_LABEL = { any: 'Anyone', male: 'Boys only', female: 'Girls only' };
  var NEAR_LABEL = { bus_stop: 'Bus stop', metro: 'Metro station', mess: 'Mess / food', hospital: 'Hospital', pharmacy: 'Pharmacy', atm: 'ATM / bank', grocery: 'Grocery', police: 'Police station' };
  function safetyLevel(s) { return s == null ? { text: 'Not scored', cls: '' } : s >= 70 ? { text: s + ' · Good', cls: 'good' } : s >= 45 ? { text: s + ' · Moderate', cls: 'mid' } : { text: s + ' · Low', cls: 'bad' }; }
  function openDetail(id) {
    detailEl.hidden = false;
    detailBody.innerHTML = '<div class="d-loading"><div></div><div></div><div></div></div>';
    if (detailAbort) detailAbort.abort();
    detailAbort = new AbortController();
    fetch(URLS.listing + id, { signal: detailAbort.signal })
      .then(function (r) { return r.json().then(function (b) { if (!r.ok) throw new Error(b.detail || 'Could not load this place (' + r.status + ')'); return b; }); })
      .then(renderDetail)
      .catch(function (e) { if (e.name !== 'AbortError') detailBody.innerHTML = '<div class="state">' + ic('triangle-alert') + '<b>Could not load</b><p class="muted small">' + esc(e.message) + '</p></div>'; icons(); });
    if (markers[id]) setActive(id, 'detail');
  }
  function closeDetail() { detailEl.hidden = true; }
  function renderDetail(d) {
    var l = d.listing, photos = d.photos || [], phone = d.contact_phone;
    var imported = (l.source === 'osm' || l.source === 'overture') && l.owner_id == null;
    var initials = (l.name || '?').replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase() || '?';
    var safety = safetyLevel(l.safety_score);
    var near = Object.keys(d.nearby || {}).filter(function (c) { return d.nearby[c] && d.nearby[c].length; });
    var amen = Array.isArray(l.amenities) ? l.amenities : [];
    var pos = { geometry: { coordinates: [l.lng, l.lat] } };
    var h = '<div class="d-hero">' +
      (photos.length ? '<div class="strip">' + photos.map(function (p) { return '<img src="' + esc(p.url) + '" alt="" loading="lazy" />'; }).join('') + '</div>'
                     : '<span class="initials">' + esc(initials) + '</span><span class="none">' + ic('image-off') + ' No photos yet</span>') + '</div>' +
      '<div class="d-main">' +
        '<div class="badges">' + (l.status === 'verified' ? '<span class="badge good">' + ic('shield-check') + ' Verified</span>' : '<span class="badge warn">Unverified</span>') +
          (l.vacancy != null ? '<span class="badge ' + (l.vacancy ? 'good' : '') + '">' + (l.vacancy ? 'Rooms available' : 'Currently full') + '</span>' : '') +
          (imported ? '<span class="badge">From ' + (l.source === 'osm' ? 'OpenStreetMap' : 'Overture Maps') + '</span>' : '') + '</div>' +
        '<div><div class="d-title">' + esc(l.name) + '</div><div class="d-addr">' + ic('map-pin') + '<span>' + esc(l.address) + '</span></div></div>' +
        (l.rent_min != null
          ? '<div class="d-rent"><b>₹' + Number(l.rent_min).toLocaleString('en-IN') + '</b>' + (l.rent_max && l.rent_max !== l.rent_min ? '<small>to ₹' + Number(l.rent_max).toLocaleString('en-IN') + '</small>' : '') + '<small>/ month</small>' + (l.deposit != null ? '<span class="note">Deposit ₹' + Number(l.deposit).toLocaleString('en-IN') + '</span>' : '') + '</div>'
          : '<div class="d-rent"><b style="font-size:18px">Rent not published</b><span class="note">' + (phone ? 'Call to ask the current rent.' : 'Ask the owner for the current rent.') + ' Owners can claim this place in the PuneStay app and publish it.</span></div>') +
        '<div class="facts">' +
          '<div class="fact">' + ic('house') + '<span><small>Type</small><b>' + esc(TYPE_LABEL[l.listing_type] || l.listing_type) + '</b></span></div>' +
          '<div class="fact">' + ic('users') + '<span><small>For</small><b>' + esc(imported && l.gender === 'any' ? 'Not stated' : (GENDER_LABEL[l.gender] || l.gender)) + '</b></span></div>' +
          '<div class="fact">' + ic('utensils') + '<span><small>Food</small><b>' + (l.food_included ? 'Included' : imported ? 'Not stated' : 'Not included') + '</b></span></div>' +
          '<div class="fact ' + safety.cls + '">' + ic('shield-check') + '<span><small>Night safety</small><b>' + esc(safety.text) + '</b></span></div>' +
        '</div>' +
        (amen.length ? '<div class="d-section"><h4>Amenities</h4><div class="amen">' + amen.map(function (a) { return '<span>' + esc(nice(a)) + '</span>'; }).join('') + '</div></div>' : '') +
        '<div class="d-section"><h4>Nearby</h4>' + (near.length ? '<div class="nearrows">' + near.map(function (c) {
          var f = d.nearby[c][0];
          return '<div class="nearrow"><span class="tile" style="--c:' + colorOf(c) + '">' + ic(iconOf(c)) + '</span><span class="main"><small>' + esc(NEAR_LABEL[c] || nice(c)) + '</small><b>' + esc(f.name || 'Unnamed') + '</b></span><span class="dist">' + metres(f.distance_m) + '</span></div>';
        }).join('') + '</div>' : '<p class="muted small">Nothing within 3 km in the database yet.</p>') + '</div>' +
        '<div class="d-actions">' +
          (phone ? '<a class="btn primary" href="tel:' + esc(phone) + '">' + ic('phone') + ' Call</a>' : '') +
          (/^https?:\/\//i.test(l.website || '') ? '<a class="btn" href="' + esc(l.website) + '" target="_blank" rel="noopener">' + ic('globe') + ' Website</a>' : '') +
          '<a class="btn" href="' + directionsUrl(pos) + '" target="_blank" rel="noopener">' + ic('navigation') + ' Directions</a>' +
        '</div>' +
        '<p class="d-foot">To confirm, flag, claim or edit this place, open it in the <a href="/app/#/listing/' + l.id + '" target="_blank" rel="noopener">PuneStay app</a>.</p>' +
      '</div>';
    detailBody.innerHTML = h;
    icons();
  }
  qsa('[data-close="detail"]').forEach(function (b) { b.addEventListener('click', closeDetail); });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.leaflet-popup [data-detail], #detail [data-detail]');
    if (b) openDetail(Number(b.dataset.detail));
  });

  // ======================= account: sign in, create account, sign out =======================
  var authUser = null, afterAuth = null;
  function token() { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }
  function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ } }
  function apiFetch(url, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    var tk = token();
    if (tk) headers.Authorization = 'Bearer ' + tk;
    if (opts.json !== undefined) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(opts.json); }
    opts.headers = headers;
    return fetch(url, opts).then(function (r) {
      if (r.status === 204) return null;
      return r.json().catch(function () { return {}; }).then(function (b) {
        if (!r.ok) {
          if (r.status === 401 && tk) { setToken(null); setAuthUser(null); }
          var d = b.detail;
          throw new Error(typeof d === 'string' ? d : Array.isArray(d) ? d.map(function (x) { return x.msg; }).join('; ') : 'API error ' + r.status);
        }
        return b;
      });
    });
  }
  function setAuthUser(u) {
    authUser = u;
    var label = $('auth-label');
    if (u) {
      label.textContent = u.name.split(' ')[0];
      $('account-name').textContent = u.name;
      $('account-email').textContent = u.email + ' · ' + u.role + (u.trusted ? ' · trusted' : '');
    } else { label.textContent = 'Sign in'; $('account-menu').hidden = true; }
    $('btn-auth').classList.toggle('on-accent', !!u);
  }
  var authEl = $('auth'), authMode = 'login';
  function openAuth(mode, then) {
    afterAuth = then || null;
    setAuthMode(mode || 'login');
    authEl.hidden = false;
    $('auth-error').hidden = true;
    setTimeout(function () { $(authMode === 'login' ? 'a-email' : 'a-name').focus(); }, 50);
  }
  function closeAuth() { authEl.hidden = true; afterAuth = null; }
  function setAuthMode(mode) {
    authMode = mode;
    qsa('[data-atab]').forEach(function (b) { b.classList.toggle('on', b.dataset.atab === mode); });
    qsa('.reg-only', authEl).forEach(function (el) { el.hidden = mode !== 'register'; });
    $('auth-title').textContent = mode === 'login' ? 'Welcome back' : 'Join PuneStay';
    $('auth-sub').textContent = mode === 'login' ? 'Sign in to add, confirm or claim places.' : 'One account to list a place or confirm one.';
    $('auth-submit').textContent = mode === 'login' ? 'Sign in' : 'Create account';
    $('a-password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    $('a-password').minLength = mode === 'login' ? 1 : 8;
  }
  qsa('[data-atab]').forEach(function (b) { b.addEventListener('click', function () { setAuthMode(b.dataset.atab); }); });
  qsa('#a-role button').forEach(function (b) { b.addEventListener('click', function () { qsa('#a-role button').forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); }); }); });
  $('auth-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('a-email').value.trim(), password = $('a-password').value;
    var err = $('auth-error'); err.hidden = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Enter a valid email address.'; err.hidden = false; return; }
    var body, url;
    if (authMode === 'login') {
      if (!password) { err.textContent = 'Enter your password.'; err.hidden = false; return; }
      url = URLS.login; body = { email: email, password: password };
    } else {
      var name = $('a-name').value.trim(), phone = $('a-phone').value.trim();
      if (name.length < 2) { err.textContent = 'Enter your name.'; err.hidden = false; return; }
      if (password.length < 8) { err.textContent = 'Use a password of 8 or more characters.'; err.hidden = false; return; }
      if (phone && !/^[0-9+\- ]{8,15}$/.test(phone)) { err.textContent = 'Phone: 8 to 15 digits.'; err.hidden = false; return; }
      url = URLS.register; body = { name: name, email: email, phone: phone || null, password: password, role: qs('#a-role button.on').dataset.role };
    }
    $('auth-submit').disabled = true;
    apiFetch(url, { method: 'POST', json: body })
      .then(function (r) {
        setToken(r.token); setAuthUser(r.user);
        toast(authMode === 'login' ? 'Signed in as ' + r.user.name : 'Welcome, ' + r.user.name, 'ok');
        var then = afterAuth; closeAuth(); if (then) then();
      })
      .catch(function (e) { err.textContent = e.message; err.hidden = false; })
      .finally(function () { $('auth-submit').disabled = false; });
  });
  $('btn-auth').addEventListener('click', function () {
    if (!authUser) { openAuth('login'); return; }
    var m = $('account-menu'); m.hidden = !m.hidden; $('btn-auth').setAttribute('aria-expanded', String(!m.hidden));
  });
  $('btn-logout').addEventListener('click', function () { setToken(null); setAuthUser(null); toast('Signed out', 'ok'); });
  qsa('[data-close="auth"]').forEach(function (b) { b.addEventListener('click', closeAuth); });
  authEl.addEventListener('click', function (e) { if (e.target === authEl) closeAuth(); });
  if (token()) apiFetch(URLS.me).then(setAuthUser).catch(function () { setAuthUser(null); });

  // ======================= add a PG or hostel =======================
  var AMENITIES = ['wifi', 'ac', 'laundry', 'parking', 'lift', 'security', 'mess', 'geyser', 'cctv', 'power_backup', 'housekeeping', 'wheelchair'];
  var AMENITY_LABEL = { power_backup: 'Power backup', ac: 'AC', cctv: 'CCTV', wifi: 'Wi-Fi' };
  var addEl = $('add'), chosenAmenities = [];
  $('f-amenities').innerHTML = AMENITIES.map(function (a) { return '<button type="button" class="chip" data-amenity="' + a + '" style="--c: var(--accent)">' + esc(AMENITY_LABEL[a] || nice(a)) + '</button>'; }).join('');
  $('f-amenities').addEventListener('click', function (e) {
    var b = e.target.closest('[data-amenity]'); if (!b) return;
    var a = b.dataset.amenity, i = chosenAmenities.indexOf(a);
    if (i >= 0) chosenAmenities.splice(i, 1); else chosenAmenities.push(a);
    b.classList.toggle('on', i < 0);
  });
  function openAdd() {
    if (!authUser) { openAuth('login', openAdd); return; }
    closeDetail();
    addEl.hidden = false;
    $('add-note').textContent = authUser.trusted || authUser.role === 'admin'
      ? 'It appears on the map right away as Unverified. Once three students confirm it from the spot, it becomes verified.'
      : 'Because your account is new, an admin checks your first listing before it appears on the map. After that, your listings go live right away.';
    refreshAddLocation();
    if (!$('f-address').value && state.loc && state.loc.name && !/pin|location|coordinates/i.test(state.loc.name)) $('f-address').value = state.loc.name;
    setTimeout(function () { $('f-name').focus(); }, 50);
  }
  function closeAdd() { addEl.hidden = true; }
  function refreshAddLocation() {
    if (addEl.hidden) return;
    var chip = $('add-loc');
    chip.classList.toggle('empty', !state.loc);
    $('add-loc-name').textContent = state.loc ? (state.loc.name || 'Pin on the map') : 'Tap the map where the place is';
    $('add-loc-coords').textContent = state.loc ? fmt(state.loc.lat, state.loc.lng) + ' · drag the amber pin to the gate' : 'the amber pin is used as the location';
  }
  $('btn-add').addEventListener('click', function () { if (addEl.hidden) openAdd(); else closeAdd(); });
  qsa('[data-close="add"]').forEach(function (b) { b.addEventListener('click', closeAdd); });
  $('add-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('add-error'); err.hidden = true;
    var fail = function (m) { err.textContent = m; err.hidden = false; };
    if (!authUser) { openAuth('login', openAdd); return; }
    if (!state.loc) { fail('Tap the map where the place is, or use your location, so the pin marks it.'); return; }
    var name = $('f-name').value.trim(), address = $('f-address').value.trim(), rent = Number($('f-rent').value), rentMax = $('f-rent-max').value, deposit = $('f-deposit').value;
    var phone = $('f-phone').value.trim(), website = $('f-website').value.trim();
    if (name.length < 3) { fail('Give the place a name of at least 3 characters.'); return; }
    if (address.length < 5) { fail('Enter the address: lane, locality, Pune.'); return; }
    if (!rent || rent < 500 || rent > 500000) { fail('Enter the monthly rent in rupees (500 to 5,00,000).'); return; }
    if (rentMax && Number(rentMax) < rent) { fail('The upper rent must not be below the rent.'); return; }
    if (phone && !/^[0-9+\- ]{8,15}$/.test(phone)) { fail('Phone: 8 to 15 digits.'); return; }
    if (website && !/^https?:\/\/[^\s<>"']+$/.test(website)) { fail('Website must start with http:// or https://.'); return; }
    var files = Array.prototype.slice.call($('f-photos').files || []).filter(function (f) { return /^image\//.test(f.type); }).slice(0, 5);
    var body = {
      name: name, address: address, lat: state.loc.lat, lng: state.loc.lng,
      listing_type: $('f-type').value, gender: $('f-gender').value,
      rent_min: rent, rent_max: rentMax ? Number(rentMax) : null, deposit: deposit ? Number(deposit) : null,
      food_included: $('f-food').checked, amenities: chosenAmenities.slice(), contact_phone: phone || null, website: website || null,
      vacancy: $('f-vacancy').checked
    };
    $('add-submit').disabled = true;
    var t = toast('Publishing…', 'load', { sticky: true });
    apiFetch(URLS.listings, { method: 'POST', json: body })
      .then(function (saved) {
        if (!files.length) return saved;
        var form = new FormData();
        files.forEach(function (f) { form.append('files', f); });
        return apiFetch(URLS.listings + '/' + saved.id + '/photos', { method: 'POST', body: form }).then(function () { return saved; }, function () { toast('Listing saved, but the photos could not be uploaded.', 'err'); return saved; });
      })
      .then(function (saved) {
        t.dismiss(); closeAdd(); $('add-form').reset(); chosenAmenities = []; qsa('#f-amenities .chip').forEach(function (c) { c.classList.remove('on'); });
        if (saved.status === 'pending') toast('Saved. An admin will check it before it appears on the map.', 'ok', { sticky: false });
        else { toast(saved.name + ' is live on the map as Unverified.', 'ok'); state.cat = ''; state.sub = ''; renderGroupChips(); scan(true); setTimeout(function () { openDetail(saved.id); }, 1500); }
      })
      .catch(function (e) { t.dismiss(); fail(e.message); })
      .finally(function () { $('add-submit').disabled = false; });
  });

  // ======================= layers panel, legend, collapse =======================
  var layersEl = $('layers');
  function toggleLayers(open) {
    if (open === undefined) open = layersEl.hidden;
    layersEl.hidden = !open;
    $('btn-layers').setAttribute('aria-expanded', String(open));
  }
  $('btn-layers').addEventListener('click', function () { toggleLayers(); });
  function renderLayers() {
    $('basemaps').innerHTML = Object.keys(BASEMAPS).map(function (k) {
      var look = BASEMAPS[k].thumb ? 'background-image:url(' + BASEMAPS[k].thumb + ')' : 'background:' + BASEMAPS[k].swatch;
      return '<button type="button" data-base="' + k + '" class="' + (activeBase === k ? 'on' : '') + '"><span class="thumb" style="' + look + '"></span>' + esc(BASEMAPS[k].label) + '</button>';
    }).join('');
    $('overlays').innerHTML = OVERLAYS.map(function (o) {
      return '<label class="switch" style="--c:' + (o.color || 'var(--primary)') + '">' + ic(o.icon) + '<span>' + esc(o.label) + '</span><input type="checkbox" data-overlay="' + o.key + '"' + (state.overlays[o.key] ? ' checked' : '') + ' /><span class="tog"></span></label>';
    }).join('');
    icons();
  }
  $('basemaps').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { setBasemap(b.dataset.base, true); syncUrl(); } });
  $('overlays').addEventListener('change', function (e) { if (e.target.dataset.overlay) setOverlay(e.target.dataset.overlay, e.target.checked); });
  function renderLegend() {
    $('legend-body').innerHTML = TYPES.map(function (t) {
      return '<span style="--c:' + t.color + '"><i></i>' + ic(t.icon) + esc(t.label) + '</span>';
    }).join('') + '<span class="you"><i></i>' + ic('locate-fixed') + 'You are here</span><span style="--c: var(--primary)"><i></i>' + ic('circle-dashed') + 'Search ring</span>';
    icons();
  }
  qs('.legend-head').addEventListener('click', function () { var l = $('legend'); l.classList.toggle('closed'); qs('.legend-head').setAttribute('aria-expanded', String(!l.classList.contains('closed'))); });
  qsa('[data-collapse]').forEach(function (b) {
    b.addEventListener('click', function () {
      var card = $(b.dataset.collapse);
      if (isTablet() && b.dataset.collapse === 'filters') card.classList.toggle('expanded');
      else card.classList.toggle('collapsed');
    });
  });
  qsa('.card.filters .rail-icons, .card.results .rail-icons').forEach(function (r) {
    r.style.cursor = 'pointer';
    r.addEventListener('click', function () { var card = r.closest('.card'); if (isTablet() && card.id === 'filters') card.classList.add('expanded'); else card.classList.remove('collapsed'); });
  });

  // ======================= help, theme, shortcuts =======================
  var help = $('help');
  function openHelp(open) { help.hidden = !open; if (open) qs('.modal-close', help).focus(); }
  $('btn-help').addEventListener('click', function () { openHelp(true); });
  qsa('[data-close="help"]').forEach(function (b) { b.addEventListener('click', function () { openHelp(false); }); });
  help.addEventListener('click', function (e) { if (e.target === help) openHelp(false); });
  qsa('[data-htab]').forEach(function (b) {
    b.addEventListener('click', function () {
      qsa('[data-htab]').forEach(function (x) { x.classList.toggle('on', x === b); });
      qsa('[data-hpane]').forEach(function (p) { p.hidden = p.dataset.hpane !== b.dataset.htab; });
    });
  });
  $('btn-replay-tour').addEventListener('click', function () { openHelp(false); startTour(); });
  $('btn-theme').addEventListener('click', function () { applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', true); toast((currentTheme() === 'dark' ? 'Dark' : 'Light') + ' theme', 'ok'); });
  qsa('[data-proxy]').forEach(function (b) { b.addEventListener('click', function () { $(b.dataset.proxy).click(); }); });
  $('btn-retry-api').addEventListener('click', function () { checkApi(true); });

  document.addEventListener('keydown', function (e) {
    var typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
    if (e.key === 'Escape') { openHelp(false); toggleLayers(false); openCoords(false); dlMenu.hidden = true; hideSuggest(); closeDetail(); closeAuth(); closeAdd(); $('account-menu').hidden = true; if (!$('tour').hidden) endTour(); map.closePopup(); return; }
    if (typing) return;
    if (e.key === '/') { e.preventDefault(); q.focus(); }
    else if (e.key === 'Enter') { if (state.loc) scan(true); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!state.results.length) return;
      e.preventDefault();
      var order = sorted().map(function (f) { return f.properties.id; }), i = order.indexOf(state.activeId);
      setActive(order[(i + (e.key === 'ArrowDown' ? 1 : -1) + order.length) % order.length], 'key');
    }
    else if (e.key === 'l' || e.key === 'L') toggleLayers();
    else if (e.key === 't' || e.key === 'T') $('btn-theme').click();
    else if (e.key === '?') openHelp(true);
  });
  // ripple on buttons, chips and cards
  document.addEventListener('click', function (e) {
    var el = e.target.closest('.btn, .icon-btn, .chip, .pills button, .res');
    if (!el || reducedMotion) return;
    var r = el.getBoundingClientRect(), s = document.createElement('span');
    var size = Math.max(r.width, r.height);
    s.className = 'ripple'; s.style.width = s.style.height = size + 'px';
    s.style.left = (e.clientX - r.left - size / 2) + 'px'; s.style.top = (e.clientY - r.top - size / 2) + 'px';
    el.appendChild(s); setTimeout(function () { s.remove(); }, 600);
  });

  // ======================= responsive: bottom sheet on phones =======================
  var sheet = $('sheet'), narrowMedia = window.matchMedia('(max-width: 639px)');
  function placePanels() {
    if (narrowMedia.matches) {
      $('sheet-filters').appendChild($('filters-body'));
      $('sheet-results').appendChild($('results-sub'));
      $('sheet-results').appendChild($('results-body'));
    } else {
      $('filters').appendChild($('filters-body'));
      var resCard = $('results'); resCard.insertBefore($('results-sub'), resCard.querySelector('#download-menu').nextSibling); resCard.appendChild($('results-body'));
    }
  }
  narrowMedia.addEventListener('change', placePanels);
  placePanels();
  function sheetTab(name) {
    qsa('.sheet-tabs button').forEach(function (b) { var on = b.dataset.tab === name; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    qsa('.sheet-pane').forEach(function (p) { p.hidden = p.dataset.pane !== name; });
    if (sheet.dataset.snap === 'peek') sheet.dataset.snap = 'half';
  }
  qsa('.sheet-tabs button').forEach(function (b) { b.addEventListener('click', function () { sheetTab(b.dataset.tab); }); });
  (function sheetDrag() {
    var handle = $('sheet-handle'), startY = 0, startH = 0, dragging = false;
    var snaps = ['peek', 'half', 'full'];
    handle.addEventListener('pointerdown', function (e) { dragging = true; startY = e.clientY; startH = sheet.getBoundingClientRect().height; sheet.style.transition = 'none'; handle.setPointerCapture(e.pointerId); });
    handle.addEventListener('pointermove', function (e) { if (!dragging) return; sheet.style.height = Math.max(92, Math.min(window.innerHeight - 76, startH + (startY - e.clientY))) + 'px'; });
    handle.addEventListener('pointerup', function (e) {
      if (!dragging) return; dragging = false; sheet.style.transition = '';
      var h = sheet.getBoundingClientRect().height, H = window.innerHeight, moved = Math.abs(startY - e.clientY) > 6;
      sheet.style.height = '';
      if (!moved) { sheet.dataset.snap = snaps[(snaps.indexOf(sheet.dataset.snap) + 1) % snaps.length]; return; }
      sheet.dataset.snap = h < H * 0.3 ? 'peek' : h < H * 0.72 ? 'half' : 'full';
    });
  })();

  // ======================= tour =======================
  var TOUR = [
    { el: function () { return isNarrow() ? $('searchbar') : $('searchbar'); }, title: 'Where are you?', text: 'Search an address or PIN code, press the locate button, type coordinates, or simply tap the map.' },
    { el: function () { return $('type-chips'); }, title: 'PG or hostel?', text: 'Choose the kind of place, then who it is for: anyone, boys or girls.' },
    { el: function () { return $('mode'); }, title: 'Radius or nearest N', text: 'Within a radius finds everything inside the ring. Nearest N returns the N closest places wherever they are.' },
    { el: function () { return $('btn-scan'); }, title: 'Scan nearby', text: 'The ring sweeps, PostGIS answers, and the results appear by distance.' },
    { el: function () { return isNarrow() ? $('sheet') : $('results'); }, title: 'Results', text: 'Click a card to fly to its marker, open the arrow for phone and directions, and use ↑ ↓ to move through the list.' },
    { el: function () { return isNarrow() ? qs('[data-proxy="btn-layers"]') : $('btn-layers'); }, title: 'Layers', text: 'Change the basemap, turn on the heatmap, or draw the GeoServer services layer.' }
  ];
  var tourStep = 0, tourEl = $('tour');
  function startTour() { tourStep = 0; tourEl.hidden = false; showTourStep(); }
  function endTour() { tourEl.hidden = true; try { localStorage.setItem(STORE.toured, '1'); } catch (e) { /* ignore */ } }
  function showTourStep() {
    while (tourStep < TOUR.length && !(TOUR[tourStep].el() && TOUR[tourStep].el().offsetParent !== null)) tourStep++;
    if (tourStep >= TOUR.length) { endTour(); return; }
    var s = TOUR[tourStep], el = s.el();
    if (isNarrow() && tourStep >= 1 && tourStep <= 3) { sheetTab('filters'); sheet.dataset.snap = 'half'; }
    setTimeout(function () {
      var r = el.getBoundingClientRect(), hole = $('tour-hole'), card = $('tour-card');
      hole.style.left = (r.left - 8) + 'px'; hole.style.top = (r.top - 8) + 'px'; hole.style.width = (r.width + 16) + 'px'; hole.style.height = (r.height + 16) + 'px';
      $('tour-step').textContent = 'Step ' + (tourStep + 1) + ' of ' + TOUR.length;
      $('tour-title').textContent = s.title; $('tour-text').textContent = s.text;
      $('tour-next').textContent = tourStep === TOUR.length - 1 ? 'Done' : 'Next';
      var below = r.bottom + 180 < window.innerHeight;
      card.style.top = (below ? r.bottom + 16 : Math.max(12, r.top - 170)) + 'px';
      card.style.left = Math.max(12, Math.min(window.innerWidth - 340, r.left)) + 'px';
    }, 320);
  }
  $('tour-next').addEventListener('click', function () { tourStep++; showTourStep(); });
  $('tour-skip').addEventListener('click', endTour);

  // ======================= intro =======================
  function countUp(el, to) {
    var start = performance.now(), dur = reducedMotion ? 0 : 1400;
    (function tick(now) {
      var k = dur ? Math.min(1, (now - start) / dur) : 1, v = Math.round(to * (1 - Math.pow(1 - k, 3)));
      el.textContent = v.toLocaleString('en-IN');
      if (k < 1) requestAnimationFrame(tick);
    })(start);
  }
  function startApp(withTour) {
    var intro = $('intro');
    if (intro.classList.contains('out')) return;
    intro.classList.add('out');
    document.body.classList.remove('introing');
    document.body.classList.add('panel-in');
    setTimeout(function () { intro.remove(); map.invalidateSize(); }, 650);
    var toured = false; try { toured = !!localStorage.getItem(STORE.toured); } catch (e) { /* ignore */ }
    if (withTour || !toured) setTimeout(startTour, 800);
    if (pendingLoc) { var l = pendingLoc; pendingLoc = null; setTimeout(function () { setLocation(l, { scan: true, silent: true }); }, 700); }
  }
  $('intro-start').addEventListener('click', function () { startApp(false); });
  $('intro-tour').addEventListener('click', function () { startApp(true); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && document.body.classList.contains('introing')) startApp(false); });

  // ======================= start-up =======================
  var pendingLoc = null;
  function checkApi(fromRetry) {
    return fetch(URLS.health).then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function (h) { $('api-banner').hidden = true; if (fromRetry) { toast('API is back', 'ok'); loadCategories(); } return h; })
      .catch(function () { $('api-banner').hidden = false; icons(); });
  }
  function loadCategories() {
    renderGroupChips(); renderLegend();
    return fetch(URLS.summary)
      .then(function (r) { if (!r.ok) throw new Error('API error ' + r.status); return r.json(); })
      .then(function (s) {
        TYPES[0].count = s.pg || 0; TYPES[1].count = s.hostel || 0;
        countUp($('stat-services'), s.total || 0); countUp($('stat-types'), s.pg || 0); countUp($('stat-groups'), s.hostel || 0);
        renderGroupChips();
        $('api-banner').hidden = true;
      })
      .catch(function () { $('api-banner').hidden = false; icons(); });
  }

  document.body.classList.add('introing');
  if (window.innerHeight < 720) { $('legend').classList.add('closed'); qs('.legend-head').setAttribute('aria-expanded', 'false'); }
  applyTheme(storedTheme() || (themeMedia.matches ? 'dark' : 'light'), false);
  try { var sb = localStorage.getItem(STORE.base); if (sb && BASEMAPS[sb]) setBasemap(sb, true); } catch (e) { /* ignore */ }
  pendingLoc = readUrl();
  setRadius(state.radiusIdx, true); setN(state.n, true); setMode(state.mode, true);
  renderLayers();
  icons();
  loadCategories();
  // a slow, quiet pan behind the intro
  if (!reducedMotion) map.flyTo([18.53, 73.87], 12.6, { duration: 24, easeLinearity: 0.9 });
})();
