/*
 * PuneStay Sonar · Nearby Services WebGIS in plain JavaScript (Leaflet, no framework, no build step).
 *
 * Course brief: location by map click / coordinates / geolocation (+ address and PIN search), category and
 * subcategory filters, radius and nearest-N search, a distance-sorted list synchronised with the markers,
 * popup + side-panel details, a PostGIS query on the server (GET /nearby, geography, metres), GeoServer WMS
 * overlays, and explicit error handling for denied geolocation, invalid input and empty results.
 */
(function () {
  'use strict';

  // ======================= configuration =======================
  var API = location.protocol === 'file:' ? 'http://localhost:8000' : '/api';
  var GEOSERVER = 'http://localhost:8080/geoserver';
  var WS = 'punestay';
  var PUNE = { lat: 18.5204, lng: 73.8567 };
  var SAMPLE = { lat: 18.5308, lng: 73.8575, name: 'Sample spot: Shivajinagar' };
  var BBOX = { south: 18.40, west: 73.62, north: 18.75, east: 74.05 };   // same as PUNE_BBOX in .env
  var RADII = [500, 1000, 2000, 5000, 10000];
  var STORE = { theme: 'punestay.sonar.theme', toured: 'punestay.sonar.toured', base: 'punestay.sonar.basemap' };
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // One mapping drives chips, markers, popups, cards and the legend. Groups collect the database categories.
  var GROUPS = {
    healthcare: { label: 'Healthcare', icon: 'stethoscope', color: 'var(--c-healthcare)', cats: ['hospital', 'pharmacy'] },
    food:       { label: 'Food', icon: 'soup', color: 'var(--c-food)', cats: ['mess', 'grocery'] },
    transport:  { label: 'Transport', icon: 'bus', color: 'var(--c-transport)', cats: ['bus_stop', 'metro', 'fuel'] },
    education:  { label: 'Education', icon: 'graduation-cap', color: 'var(--c-education)', cats: ['school', 'college', 'library'] },
    public:     { label: 'Public services', icon: 'shield', color: 'var(--c-public)', cats: ['police', 'fire_station', 'post_office', 'toilets'] },
    commercial: { label: 'Commercial', icon: 'shopping-bag', color: 'var(--c-commercial)', cats: ['atm', 'bank', 'office', 'lodging'] },
    recreation: { label: 'Recreation', icon: 'trees', color: 'var(--c-recreation)', cats: ['park', 'place_of_worship'] },
    other:      { label: 'Other', icon: 'map-pin', color: 'var(--c-other)', cats: [] }
  };
  var CAT_ICON = {
    hospital: 'hospital', pharmacy: 'pill', mess: 'utensils', grocery: 'shopping-cart', bus_stop: 'bus', metro: 'train-front',
    fuel: 'fuel', school: 'school', college: 'graduation-cap', library: 'book-open', police: 'shield', fire_station: 'flame',
    post_office: 'mail', toilets: 'bath', atm: 'banknote', bank: 'landmark', office: 'building-2', lodging: 'bed-double',
    park: 'trees', place_of_worship: 'church'
  };
  var CAT_GROUP = {};
  Object.keys(GROUPS).forEach(function (g) { GROUPS[g].cats.forEach(function (c) { CAT_GROUP[c] = g; }); });
  function groupOf(cat) { return CAT_GROUP[cat] || 'other'; }
  function colorOf(cat) { return GROUPS[groupOf(cat)].color; }
  function iconOf(cat) { return CAT_ICON[cat] || GROUPS[groupOf(cat)].icon; }

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
    if (state.group) p.set('group', state.group);
    if (state.cat) p.set('category', state.cat);
    if (state.sub) p.set('subcategory', state.sub);
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
    if (p.get('group') && GROUPS[p.get('group')]) state.group = p.get('group');
    if (p.get('category')) { state.cat = p.get('category'); if (!state.group) state.group = groupOf(state.cat); }
    if (p.get('subcategory')) state.sub = p.get('subcategory');
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
  var BASEMAPS = {
    osm: { label: 'OpenStreetMap', thumb: 'https://a.tile.openstreetmap.org/12/2887/1820.png',
      layer: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: OSM_ATTR }) },
    light: { label: 'Light', thumb: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/12/1820/2887',
      layer: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16, attribution: 'Tiles &copy; Esri, HERE, Garmin, OpenStreetMap contributors' }) },
    dark: { label: 'Dark', thumb: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/12/1820/2887',
      layer: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16, attribution: 'Tiles &copy; Esri, HERE, Garmin, OpenStreetMap contributors' }) },
    terrain: { label: 'Terrain', thumb: 'https://a.tile.opentopomap.org/12/2887/1820.png',
      layer: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)' }) },
    satellite: { label: 'Satellite', thumb: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/1820/2887',
      layer: L.layerGroup([
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics' }),
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 })
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
  function wmsLayer(cql) {
    var opts = { layers: WS + ':services', format: 'image/png', transparent: true, opacity: 0.8, attribution: 'GeoServer' };
    if (cql) opts.CQL_FILTER = cql;
    var l = L.tileLayer.wms(GEOSERVER + '/' + WS + '/wms', opts);
    l.on('tileerror', function () { if (!l._warned) { l._warned = true; toast('GeoServer overlay could not be loaded. Is GeoServer running on port 8080?', 'err'); } });
    return l;
  }
  var OVERLAYS = [
    { key: 'markers', label: 'Result markers', icon: 'map-pin', on: true },
    { key: 'ring', label: 'Search ring', icon: 'circle-dashed', on: true },
    { key: 'heat', label: 'Heatmap of results', icon: 'flame', on: false },
    { key: 'wmsAll', label: 'All services (GeoServer WMS)', icon: 'server', on: false }
  ];
  Object.keys(GROUPS).forEach(function (g) {
    if (g === 'other') return;
    OVERLAYS.push({ key: 'wms_' + g, label: GROUPS[g].label + ' (WMS)', icon: GROUPS[g].icon, color: GROUPS[g].color, on: false, cql: "category IN ('" + GROUPS[g].cats.join("','") + "')" });
  });
  function setOverlay(key, on) {
    state.overlays[key] = on;
    if (key === 'markers') { if (on) clusters.addTo(map); else map.removeLayer(clusters); }
    else if (key === 'ring') { drawRing(); }
    else if (key === 'heat') { drawHeat(); }
    else {
      var def = OVERLAYS.filter(function (o) { return o.key === key; })[0];
      if (on && !wms[key]) { wms[key] = wmsLayer(def.cql).addTo(map); }
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
  map.on('click', function (e) { if (document.body.classList.contains('introing')) return; setLocation({ lat: round6(e.latlng.lat), lng: round6(e.latlng.lng), name: 'Map point', source: 'map click' }); });

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
        if (!setLocation({ lat: round6(p.lat), lng: round6(p.lng), name: 'Dragged pin', source: 'drag' }, { noFly: true })) userMarker.setLatLng([state.loc.lat, state.loc.lng]);
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
    return true;
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
      setLocation({ lat: round6(pos.coords.latitude), lng: round6(pos.coords.longitude), name: 'Your location', source: 'GPS ±' + Math.round(pos.coords.accuracy || 0) + ' m' });
    }, function (err) {
      t.dismiss();
      var msg = { 1: 'Location permission was denied. Allow it in the browser, or tap the map / type coordinates.',
                  2: 'Your position is unavailable right now. Tap the map or type coordinates.',
                  3: 'Finding your location timed out. Try again, or tap the map.' }[err.code] || 'Could not get your location.';
      toast(msg + (state.loc ? ' Kept your previous location.' : ''), 'err');
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
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

  // address / PIN search (PuneStay geocoder: Nominatim, cached on the server)
  var q = $('q'), suggest = $('suggest'), geoAbort = null, geoTimer = null, suggestion = null;
  q.addEventListener('input', function () {
    clearTimeout(geoTimer);
    var term = q.value.trim();
    if (term.length < 3) { hideSuggest(); return; }
    geoTimer = setTimeout(function () { geocode(term, false); }, 350);
  });
  q.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); if (suggestion) pickSuggestion(); else geocode(q.value.trim(), true); }
    if (e.key === 'Escape') hideSuggest();
  });
  q.addEventListener('blur', function () { setTimeout(hideSuggest, 150); });
  $('btn-find').addEventListener('click', function () { if (suggestion) pickSuggestion(); else geocode(q.value.trim(), true); });
  function hideSuggest() { suggest.hidden = true; suggest.innerHTML = ''; suggestion = null; }
  function pickSuggestion() { var s = suggestion; hideSuggest(); setLocation({ lat: s.lat, lng: s.lng, name: s.name, source: s.pin ? 'PIN code' : 'address' }); }
  function geocode(term, submit) {
    if (!term) { if (submit) toast('Type an address, a locality or a 6-digit PIN code.', 'err'); return; }
    var pin = /^\d+$/.test(term);
    if (pin && !/^\d{6}$/.test(term)) { toast('A PIN code has 6 digits, for example 411005.', 'err'); return; }
    var query = pin ? term + ', Pune, Maharashtra' : (/pune/i.test(term) ? term : term + ', Pune');
    if (geoAbort) geoAbort.abort();
    geoAbort = new AbortController();
    var t = submit ? toast('Searching ' + term + '…', 'load', { sticky: true }) : null;
    fetch(API + '/geocode?q=' + encodeURIComponent(query), { signal: geoAbort.signal })
      .then(function (r) { return r.json().then(function (b) { if (!r.ok) throw new Error(b.detail || 'Geocoding failed (' + r.status + ')'); return b; }); })
      .then(function (hit) {
        if (t) t.dismiss();
        suggestion = { lat: round6(hit.lat), lng: round6(hit.lng), name: shortName(hit.display || term), pin: pin };
        if (submit) { pickSuggestion(); return; }
        suggest.innerHTML = '<li class="on" role="option">' + ic(pin ? 'hash' : 'map-pin') + '<span>' + esc(suggestion.name) + '</span><span class="mono">' + fmt(suggestion.lat, suggestion.lng) + '</span></li>';
        suggest.hidden = false;
        suggest.firstChild.addEventListener('mousedown', function (e) { e.preventDefault(); pickSuggestion(); });
        icons();
      })
      .catch(function (e) {
        if (e.name === 'AbortError') return;
        if (t) t.dismiss();
        hideSuggest();
        if (submit) toast((/No match/i.test(e.message) ? 'Address not found inside Pune. Try adding the locality name, or tap the map.' : e.message) + (state.loc ? ' Kept your previous location.' : ''), 'err');
      });
  }
  function shortName(display) { return display.split(',').slice(0, 3).join(',').trim(); }

  // ======================= filters =======================
  function renderGroupChips() {
    var present = {};
    categories.forEach(function (c) { present[groupOf(c.category)] = (present[groupOf(c.category)] || 0) + c.count; });
    var h = '<button type="button" class="chip' + (state.group ? '' : ' on') + '" data-group="" style="--c: var(--primary)">' + ic('layers') + ' All</button>';
    Object.keys(GROUPS).forEach(function (g) {
      if (!present[g]) return;
      h += '<button type="button" class="chip' + (state.group === g ? ' on' : '') + '" data-group="' + g + '" style="--c:' + GROUPS[g].color + '">' + ic(GROUPS[g].icon) + ' ' + esc(GROUPS[g].label) + ' <small>' + present[g] + '</small></button>';
    });
    $('group-chips').innerHTML = h;
    icons();
  }
  function renderTypeChips() {
    var step = $('type-step');
    if (!state.group) { step.hidden = true; return; }
    var cats = categories.filter(function (c) { return groupOf(c.category) === state.group; });
    var h = '<button type="button" class="chip' + (state.cat ? '' : ' on') + '" data-cat="" style="--c:' + GROUPS[state.group].color + '">' + ic('asterisk') + ' Any ' + esc(GROUPS[state.group].label.toLowerCase()) + '</button>';
    cats.forEach(function (c) {
      h += '<button type="button" class="chip' + (state.cat === c.category ? ' on' : '') + '" data-cat="' + c.category + '" style="--c:' + colorOf(c.category) + '">' + ic(iconOf(c.category)) + ' ' + esc(c.label) + ' <small>' + c.count + '</small></button>';
    });
    $('type-chips').innerHTML = h;
    step.hidden = false;
    renderSubSelect();
    icons();
  }
  function renderSubSelect() {
    var sel = $('subcategory'), wrap = $('sub-wrap');
    var cat = categories.filter(function (c) { return c.category === state.cat; })[0];
    sel.innerHTML = '<option value="">Any</option>';
    var subs = cat ? cat.subcategories : [];
    subs.forEach(function (s) { var o = document.createElement('option'); o.value = s.subcategory; o.textContent = nice(s.subcategory) + ' (' + s.count + ')'; sel.appendChild(o); });
    sel.value = state.sub && subs.some(function (s) { return s.subcategory === state.sub; }) ? state.sub : '';
    state.sub = sel.value;
    wrap.hidden = subs.length <= 1;
  }
  $('group-chips').addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    state.group = b.dataset.group; state.cat = ''; state.sub = '';
    renderGroupChips(); renderTypeChips(); afterFilterChange();
  });
  $('type-chips').addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    state.cat = b.dataset.cat; state.sub = '';
    renderTypeChips(); afterFilterChange();
  });
  $('subcategory').addEventListener('change', function (e) { state.sub = e.target.value; afterFilterChange(); });

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
    state.group = ''; state.cat = ''; state.sub = ''; setMode('radius', true); setRadius(2, true); setN(10, true);
    renderGroupChips(); renderTypeChips(); syncUrl(); toast('Filters reset', 'ok'); if (hasScanned) scan();
  });

  // ======================= the scan (PostGIS on the server) =======================
  var scanAbort = null, hasScanned = false;
  $('btn-scan').addEventListener('click', function () { scan(true); });
  function queryParams() {
    var p = new URLSearchParams({ lat: state.loc.lat, lng: state.loc.lng });
    if (state.cat) p.set('category', state.cat);
    else if (state.group) p.set('category', GROUPS[state.group].cats.filter(function (c) { return categories.some(function (k) { return k.category === c; }); }).join(','));
    if (state.sub) p.set('subcategory', state.sub);
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
    fetch(API + '/nearby?' + queryParams().toString(), { signal: scanAbort.signal })
      .then(function (r) { return r.json().then(function (b) { if (!r.ok) throw new Error(b.detail || 'The API answered ' + r.status); return b; }); })
      .then(function (fc) {
        clearTimeout(timeout); t.dismiss();
        state.results = fc.features || [];
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
      if (fix === 'allcats') { state.group = ''; state.cat = ''; state.sub = ''; renderGroupChips(); renderTypeChips(); }
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
        '<span class="res-main"><b>' + esc(p.name || 'Unnamed ' + nice(p.subcategory)) + '</b><small>' + esc(nice(p.subcategory)) + ' · ' + esc(p.label) + '</small></span>' +
        '<span class="res-dist">' + metres(p.distance_m) + '</span></div>' +
        '<div class="res-bar"><i data-w="' + Math.max(4, Math.round(100 * p.distance_m / maxD)) + '"></i></div>' +
        (p.address ? '<div class="res-addr">' + ic('map-pin') + '<span>' + esc(p.address) + '</span></div>' : '') +
        '<button class="res-more" type="button" aria-label="More details" aria-expanded="false">' + ic('chevron-down') + '</button>' +
        '<div class="res-detail"><dl>' +
          (p.phone ? '<dt>Phone</dt><dd><a href="tel:' + esc(p.phone) + '">' + esc(p.phone) + '</a></dd>' : '') +
          (p.website ? '<dt>Website</dt><dd><a href="' + esc(p.website) + '" target="_blank" rel="noopener">' + esc(p.website.replace(/^https?:\/\//, '')) + '</a></dd>' : '') +
          (p.opening_hours ? '<dt>Hours</dt><dd>' + esc(p.opening_hours) + '</dd>' : '') +
          '<dt>Bearing</dt><dd>' + (p.bearing_deg != null ? p.bearing_deg + '°' : '—') + '</dd>' +
          '<dt>Source</dt><dd>OpenStreetMap</dd>' +
          '<dt>Coords</dt><dd class="mono">' + fmt(lat_(f), lng_(f)) + '</dd></dl>' +
          '<div class="pop-actions"><a class="primary" href="' + directionsUrl(f) + '" target="_blank" rel="noopener">' + ic('navigation') + ' Directions ↗</a>' +
          '<button type="button" data-copy="' + fmt(lat_(f), lng_(f)) + '">' + ic('copy') + ' Copy coordinates</button></div></div>';
      li.addEventListener('click', function (e) {
        if (e.target.closest('.res-more')) { li.classList.toggle('open'); e.target.closest('.res-more').setAttribute('aria-expanded', String(li.classList.contains('open'))); return; }
        if (e.target.closest('[data-copy]')) { copyText(e.target.closest('[data-copy]').dataset.copy); return; }
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
    return '<div class="pop-head"><span class="tile" style="--c:' + colorOf(p.category) + '">' + ic(iconOf(p.category)) + '</span><span><b>' + esc(p.name || 'Unnamed ' + nice(p.subcategory)) + '</b><small>' + esc(nice(p.subcategory)) + ' · ' + esc(p.label) + '</small></span></div>' +
      '<div><span class="pop-dist">' + metres(p.distance_m) + '</span> from your pin' + (p.address ? '<br>' + esc(p.address) : '') + '</div>' +
      '<div class="pop-actions"><a class="primary" href="' + directionsUrl(f) + '" target="_blank" rel="noopener">' + ic('navigation') + ' Directions</a>' +
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
      var cols = ['rank', 'name', 'category', 'subcategory', 'distance_m', 'bearing_deg', 'address', 'phone', 'website', 'opening_hours', 'lat', 'lng'];
      var rows = [cols.join(',')].concat(state.results.map(function (f, i) {
        var p = f.properties, vals = [i + 1, p.name, p.label, p.subcategory, p.distance_m, p.bearing_deg, p.address, p.phone, p.website, p.opening_hours, lat_(f), lng_(f)];
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
      return '<button type="button" data-base="' + k + '" class="' + (activeBase === k ? 'on' : '') + '"><span class="thumb" style="background-image:url(' + BASEMAPS[k].thumb + ')"></span>' + esc(BASEMAPS[k].label) + '</button>';
    }).join('');
    $('overlays').innerHTML = OVERLAYS.map(function (o) {
      return '<label class="switch" style="--c:' + (o.color || 'var(--primary)') + '">' + ic(o.icon) + '<span>' + esc(o.label) + '</span><input type="checkbox" data-overlay="' + o.key + '"' + (state.overlays[o.key] ? ' checked' : '') + ' /><span class="tog"></span></label>';
    }).join('');
    icons();
  }
  $('basemaps').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { setBasemap(b.dataset.base, true); syncUrl(); } });
  $('overlays').addEventListener('change', function (e) { if (e.target.dataset.overlay) setOverlay(e.target.dataset.overlay, e.target.checked); });
  function renderLegend() {
    var present = {};
    categories.forEach(function (c) { present[groupOf(c.category)] = true; });
    $('legend-body').innerHTML = Object.keys(GROUPS).filter(function (g) { return present[g]; }).map(function (g) {
      return '<span style="--c:' + GROUPS[g].color + '"><i></i>' + ic(GROUPS[g].icon) + esc(GROUPS[g].label) + '</span>';
    }).join('') + '<span class="you"><i></i>' + ic('locate-fixed') + 'You are here</span>';
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
    if (e.key === 'Escape') { openHelp(false); toggleLayers(false); openCoords(false); dlMenu.hidden = true; hideSuggest(); if (!$('tour').hidden) endTour(); map.closePopup(); return; }
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
    { el: function () { return $('group-chips'); }, title: 'Pick a category', text: 'Choose a service category, then a service type if you want to narrow it down.' },
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
    return fetch(API + '/health').then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function (h) { $('api-banner').hidden = true; if (fromRetry) { toast('API is back', 'ok'); loadCategories(); } return h; })
      .catch(function () { $('api-banner').hidden = false; icons(); });
  }
  function loadCategories() {
    return fetch(API + '/nearby/categories')
      .then(function (r) { if (!r.ok) throw new Error('API error ' + r.status); return r.json(); })
      .then(function (list) {
        categories = list;
        var total = list.reduce(function (s, c) { return s + c.count; }, 0);
        var groups = {}; list.forEach(function (c) { groups[groupOf(c.category)] = true; });
        countUp($('stat-services'), total); countUp($('stat-types'), list.length); countUp($('stat-groups'), Object.keys(groups).length);
        if (state.cat && !list.some(function (c) { return c.category === state.cat; })) { state.cat = ''; }
        renderGroupChips(); renderTypeChips(); renderLegend();
        $('api-banner').hidden = true;
      })
      .catch(function () { $('api-banner').hidden = false; icons(); });
  }

  document.body.classList.add('introing');
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
