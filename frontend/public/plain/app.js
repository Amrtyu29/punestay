/*
 * PuneStay · Nearby Services in plain JavaScript (no framework, no build step).
 *
 * Course brief, Project 1: Nearby Services WebGIS
 *  - location by map click, typed latitude/longitude, or browser geolocation
 *  - category and subcategory filtering
 *  - search within a radius, nearest N, or both
 *  - distance-sorted list kept in sync with the Leaflet markers; popup + side panel
 *  - PostGIS does the spatial query on the server (GET /nearby); GeoServer WMS overlays
 *  - explicit messages for denied geolocation, invalid input, points outside Pune, empty results
 */

// ---------- settings ----------
// When this page is served by the Vite dev server or the built app, /api is proxied to FastAPI.
// When opened as a file:// page, call the API directly (needs CORS_ORIGINS to allow it).
var API = location.protocol === 'file:' ? 'http://localhost:8000' : '/api';
var GEOSERVER = 'http://localhost:8080/geoserver';
var PUNE = { lat: 18.5204, lng: 73.8567 };
// Keep in sync with PUNE_BBOX in .env; the API checks it too.
var BBOX = { south: 18.40, west: 73.62, north: 18.75, east: 74.05 };
var COLORS = {
  hospital: '#dc2626', pharmacy: '#db2777', police: '#1d4ed8', fire_station: '#ea580c', atm: '#0e7490', bank: '#0e7490',
  school: '#7c3aed', college: '#6d28d9', fuel: '#b45309', park: '#16a34a', bus_stop: '#0891b2', metro: '#0e7490',
  mess: '#d97706', grocery: '#65a30d', post_office: '#9f1239', library: '#4338ca', place_of_worship: '#78350f',
  toilets: '#475569', office: '#334155', lodging: '#7c3aed'
};

// ---------- state ----------
var origin = null;          // {lat, lng, source}
var mode = 'radius';        // 'radius' | 'nearest' | 'both'
var results = [];           // GeoJSON features from the last search
var activeId = null;        // highlighted result
var markers = {};           // id -> Leaflet marker
var circle = null;          // radius circle
var originMarker = null;
var wmsLayers = {};

// ---------- elements ----------
var $ = function (id) { return document.getElementById(id); };
var latInput = $('lat'), lngInput = $('lng'), categorySel = $('category'), subSel = $('subcategory');
var subWrap = $('sub-wrap'), radiusSel = $('radius'), nSel = $('n'), radiusWrap = $('radius-wrap'), nWrap = $('n-wrap');
var searchBtn = $('btn-search'), messageBox = $('message'), resultsList = $('results'), resultsEmpty = $('results-empty');
var resultsTitle = $('results-title'), originNote = $('origin-note');

// ---------- map ----------
var map = L.map('map', { center: PUNE, zoom: 12, minZoom: 10, maxBounds: [[18.2, 73.4], [18.9, 74.3]], zoomControl: false });
var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);
var satellite = L.layerGroup([
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagery &copy; Esri' }),
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 })
]);
var terrain = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '&copy; OpenTopoMap (CC-BY-SA)' });
L.control.layers({ Streets: osm, Satellite: satellite, Terrain: terrain }, null, { position: 'topright' }).addTo(map);
L.control.zoom({ position: 'topright' }).addTo(map);
L.control.scale({ imperial: false }).addTo(map);
var resultLayer = L.layerGroup().addTo(map);

map.on('click', function (e) {
  setOrigin({ lat: round6(e.latlng.lat), lng: round6(e.latlng.lng), source: 'map click' });
});

// ---------- helpers ----------
function round6(n) { return Math.round(n * 1e6) / 1e6; }
function metres(m) { return m == null ? '' : m < 1000 ? m + ' m' : (m / 1000).toFixed(1) + ' km'; }
function nice(s) { return String(s || '').replace(/_/g, ' '); }
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function insidePune(lat, lng) { return lat >= BBOX.south && lat <= BBOX.north && lng >= BBOX.west && lng <= BBOX.east; }
function showMessage(text, kind) {
  if (!text) { messageBox.hidden = true; messageBox.textContent = ''; return; }
  messageBox.hidden = false;
  messageBox.textContent = text;
  messageBox.className = 'message' + (kind === 'info' ? ' info' : '');
}
function icon(color, active) {
  var s = active ? 18 : 12;
  return L.divIcon({
    className: 'svc-marker',
    html: '<span style="display:block;width:' + s + 'px;height:' + s + 'px;border-radius:50%;background:' + color +
          ';border:' + (active ? 3 : 2) + 'px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25)"></span>',
    iconSize: [s, s], iconAnchor: [s / 2, s / 2], popupAnchor: [0, -s / 2]
  });
}

// ---------- 1. where ----------
function setOrigin(o) {
  origin = o;
  latInput.value = o.lat;
  lngInput.value = o.lng;
  originNote.textContent = 'Origin from ' + o.source + ': ' + o.lat + ', ' + o.lng + '. Drag the marker to adjust.';
  if (!originMarker) {
    originMarker = L.marker([o.lat, o.lng], { draggable: true, title: 'Search origin (drag me)', zIndexOffset: 1000 }).addTo(map);
    originMarker.on('dragend', function () {
      var p = originMarker.getLatLng();
      setOrigin({ lat: round6(p.lat), lng: round6(p.lng), source: 'drag' });
    });
  } else {
    originMarker.setLatLng([o.lat, o.lng]);
  }
  if (o.source !== 'map click' && o.source !== 'drag') map.setView([o.lat, o.lng], Math.max(map.getZoom(), 14));
  searchBtn.disabled = false;
  search();
}

$('btn-go').addEventListener('click', applyTyped);
latInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') applyTyped(); });
lngInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') applyTyped(); });

function applyTyped() {
  var lat = Number(latInput.value), lng = Number(lngInput.value);
  if (latInput.value.trim() === '' || lngInput.value.trim() === '' || isNaN(lat) || isNaN(lng)) {
    showMessage('Enter numeric latitude and longitude, for example 18.5204 and 73.8567.'); return;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    showMessage('Latitude must be within ±90 and longitude within ±180.'); return;
  }
  if (!insidePune(lat, lng)) {
    showMessage('That point is outside Pune (lat ' + BBOX.south + '–' + BBOX.north + ', lng ' + BBOX.west + '–' + BBOX.east + ').'); return;
  }
  showMessage('');
  setOrigin({ lat: lat, lng: lng, source: 'typed coordinates' });
}

$('btn-locate').addEventListener('click', function () {
  if (!('geolocation' in navigator)) {
    showMessage('Your browser does not support geolocation. Click the map or type coordinates instead.'); return;
  }
  showMessage('Finding your location…', 'info');
  navigator.geolocation.getCurrentPosition(function (pos) {
    var lat = pos.coords.latitude, lng = pos.coords.longitude;
    if (!insidePune(lat, lng)) {
      showMessage('Your location (' + lat.toFixed(4) + ', ' + lng.toFixed(4) + ') is outside Pune. The map stays on Pune; click it to search here.'); return;
    }
    showMessage('');
    setOrigin({ lat: round6(lat), lng: round6(lng), source: 'your location' });
  }, function (err) {
    var msg = {
      1: 'Location permission was denied. Allow it in the browser, or click the map / type coordinates.',
      2: 'Your position is unavailable right now. Click the map or type coordinates.',
      3: 'Finding your location timed out. Try again, or click the map.'
    }[err.code] || 'Could not get your location.';
    showMessage(msg);
  }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
});

// ---------- 2. what ----------
var categories = [];
fetch(API + '/nearby/categories')
  .then(function (r) { if (!r.ok) throw new Error('API error ' + r.status); return r.json(); })
  .then(function (list) {
    categories = list;
    list.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c.category;
      opt.textContent = c.label + ' (' + c.count + ')';
      categorySel.appendChild(opt);
    });
    categorySel.value = 'hospital';
    fillSubcategories();
    readLinkParameters();
  })
  .catch(function (e) { showMessage('Could not load the categories: ' + e.message + '. Is the API running on port 8000?'); });

function fillSubcategories() {
  var cat = categories.filter(function (c) { return c.category === categorySel.value; })[0];
  subSel.innerHTML = '<option value="">Any</option>';
  var subs = cat ? cat.subcategories : [];
  subs.forEach(function (s) {
    var opt = document.createElement('option');
    opt.value = s.subcategory;
    opt.textContent = nice(s.subcategory) + ' (' + s.count + ')';
    subSel.appendChild(opt);
  });
  subWrap.hidden = subs.length <= 1;
}
categorySel.addEventListener('change', function () { fillSubcategories(); search(); });
subSel.addEventListener('change', search);

// ---------- 3. how far ----------
$('mode').addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b) return;
  mode = b.dataset.mode;
  Array.prototype.forEach.call($('mode').children, function (x) { x.classList.toggle('on', x === b); });
  radiusWrap.hidden = mode === 'nearest';
  nWrap.hidden = mode === 'radius';
  search();
});
radiusSel.addEventListener('change', search);
nSel.addEventListener('change', search);
searchBtn.addEventListener('click', search);

// ---------- the search: one request to the PostGIS-backed API ----------
function search() {
  if (!origin) { showMessage('Pick a location first: click the map, use your location, or type coordinates.'); return; }
  var params = new URLSearchParams({ lat: origin.lat, lng: origin.lng });
  if (categorySel.value) params.set('category', categorySel.value);
  if (subSel.value) params.set('subcategory', subSel.value);
  if (mode === 'radius' || mode === 'both') params.set('radius_m', radiusSel.value);
  if (mode === 'nearest' || mode === 'both') params.set('limit', nSel.value);
  if (mode === 'radius') params.set('limit', '200');

  searchBtn.textContent = 'Searching…';
  showMessage('');
  fetch(API + '/nearby?' + params.toString())
    .then(function (r) {
      return r.json().then(function (body) {
        if (!r.ok) throw new Error(body.detail || ('API error ' + r.status));
        return body;
      });
    })
    .then(function (fc) {
      results = fc.features || [];
      activeId = null;
      draw();
      if (!results.length) showMessage(fc.message || 'No services found here. Try a larger radius or another category.', 'info');
    })
    .catch(function (e) { results = []; draw(); showMessage(e.message); })
    .finally(function () { searchBtn.textContent = 'Search'; });
}

// ---------- draw markers, circle and the list (kept in sync) ----------
function draw() {
  resultLayer.clearLayers();
  markers = {};
  if (circle) { map.removeLayer(circle); circle = null; }
  if (origin && (mode === 'radius' || mode === 'both')) {
    circle = L.circle([origin.lat, origin.lng], { radius: Number(radiusSel.value), color: '#14b8a6', weight: 1.5, fillOpacity: 0.06, dashArray: '4 4' }).addTo(map);
  }

  resultsList.innerHTML = '';
  resultsTitle.textContent = results.length ? results.length + ' result' + (results.length === 1 ? '' : 's') + ', nearest first' : 'Results';
  resultsEmpty.hidden = results.length > 0 || !!origin;

  if (!results.length) return;
  var bounds = L.latLngBounds([[origin.lat, origin.lng]]);

  results.forEach(function (f, i) {
    var p = f.properties, lng = f.geometry.coordinates[0], lat = f.geometry.coordinates[1];
    var color = COLORS[p.category] || '#14b8a6';

    // marker + popup
    var m = L.marker([lat, lng], { icon: icon(color, false) }).addTo(resultLayer);
    m.bindPopup('<b>' + escapeHtml(p.name || nice(p.subcategory)) + '</b><br>' + escapeHtml(p.label) + ' · ' + escapeHtml(nice(p.subcategory)) +
                '<br>' + metres(p.distance_m) + ' away' + (p.address ? '<br>' + escapeHtml(p.address) : '') + (p.phone ? '<br>☎ ' + escapeHtml(p.phone) : ''));
    m.on('click', function () { setActive(p.id); });
    if (i === 0) m.bindTooltip('nearest');
    markers[p.id] = m;
    bounds.extend([lat, lng]);

    // list row
    var li = document.createElement('li');
    li.dataset.id = p.id;
    li.innerHTML =
      '<span class="rank" style="background:' + color + '">' + (i + 1) + '</span>' +
      '<span class="main"><div class="name">' + escapeHtml(p.name || 'Unnamed ' + nice(p.subcategory)) + '</div>' +
      '<div class="detail">' + escapeHtml(p.label) + ' · ' + escapeHtml(nice(p.subcategory)) + (p.address ? ' · ' + escapeHtml(p.address) : '') + '</div>' +
      (p.phone ? '<div class="detail">☎ ' + escapeHtml(p.phone) + '</div>' : '') + '</span>' +
      '<span class="dist">' + metres(p.distance_m) + '</span>';
    li.addEventListener('click', function () { setActive(p.id); });
    resultsList.appendChild(li);
  });
  map.fitBounds(bounds.pad(0.15), { maxZoom: 16 });
}

function setActive(id) {
  activeId = id;
  results.forEach(function (f) {
    var p = f.properties, m = markers[p.id];
    if (m) m.setIcon(icon(COLORS[p.category] || '#14b8a6', p.id === id));
  });
  Array.prototype.forEach.call(resultsList.children, function (li) {
    var on = Number(li.dataset.id) === id;
    li.classList.toggle('active', on);
    if (on) li.scrollIntoView({ block: 'nearest' });
  });
  var m = markers[id];
  if (m) { m.openPopup(); m.setZIndexOffset(500); }
}

// ---------- GeoServer WMS overlays (optional; the page works without GeoServer) ----------
function toggleWms(key, layerName, on) {
  if (on && !wmsLayers[key]) {
    wmsLayers[key] = L.tileLayer.wms(GEOSERVER + '/punestay/wms', { layers: layerName, format: 'image/png', transparent: true, opacity: 0.8, attribution: 'GeoServer' }).addTo(map);
    wmsLayers[key].on('tileerror', function () { showMessage('GeoServer overlay could not be loaded. Is GeoServer running on port 8080?'); });
  } else if (!on && wmsLayers[key]) {
    map.removeLayer(wmsLayers[key]);
    delete wmsLayers[key];
  }
}
$('wms-services').addEventListener('change', function (e) { toggleWms('services', 'punestay:services', e.target.checked); });
$('wms-listings').addEventListener('change', function (e) { toggleWms('listings', 'punestay:listings_public', e.target.checked); });

// ---------- shareable links: ?lat=18.52&lng=73.85&category=hospital&radius=2000 ----------
function readLinkParameters() {
  var q = new URLSearchParams(location.search);
  if (q.get('category')) { categorySel.value = q.get('category'); fillSubcategories(); }
  if (q.get('radius')) radiusSel.value = q.get('radius');
  var lat = Number(q.get('lat')), lng = Number(q.get('lng'));
  if (q.get('lat') && q.get('lng') && !isNaN(lat) && !isNaN(lng) && insidePune(lat, lng)) {
    setOrigin({ lat: round6(lat), lng: round6(lng), source: 'link' });
  }
}
