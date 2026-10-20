import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ChevronDown, ChevronUp, Crosshair, Layers, List, ListOrdered, LocateFixed, MapPin, Phone, Radar, RotateCcw, Search } from 'lucide-react'
import { metres } from '../format'
import { leafletBasemaps } from '../basemaps'
import { COLORS, DEFAULT_COLOR, NS, RADII, useNearby } from '../nearby'
import WeatherChip from '../components/WeatherChip'

/**
 * Nearby Services (course brief): location by map click, typed lat/lng or browser geolocation;
 * category and subcategory filters; radius and/or nearest-N; distance-sorted list synced with
 * Leaflet markers; popup and side-panel details; GeoServer WMS overlays; explicit error states.
 * Layout: card panel on the left, map with floating controls, status bar and a top-results strip.
 */

const PUNE = { lat: 18.5204, lng: 73.8567 }
const GEOSERVER = import.meta.env.VITE_GEOSERVER_URL || 'http://localhost:8080/geoserver'

function icon(color, active = false) {
  const s = active ? 18 : 12
  return L.divIcon({
    className: 'svc-marker',
    html: `<span style="display:block;width:${s}px;height:${s}px;border-radius:50%;background:${color};border:${active ? 3 : 2}px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25)"></span>`,
    iconSize: [s, s], iconAnchor: [s / 2, s / 2], popupAnchor: [0, -s / 2],
  })
}

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const nice = (s) => String(s || '').replace(/_/g, ' ')

export default function NearbyPage() {
  const nb = useNearby()
  const mapEl = useRef(null)
  const wrapRef = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)      // results layer group
  const originRef = useRef(null)     // origin marker
  const circleRef = useRef(null)     // radius circle
  const markersRef = useRef({})      // id -> marker
  const wmsRef = useRef({})
  const resultsRef = useRef(null)
  const pick = useRef(nb.pickOnMap)
  pick.current = nb.pickOnMap

  const [overlays, setOverlays] = useState({ services: false, listings: false })

  // Shareable links: #/nearby?lat=18.52&lng=73.85&category=hospital&radius=2000 start a search on load.
  useEffect(() => {
    const q = Object.fromEntries(new URLSearchParams((window.location.hash.split('?')[1] || '')))
    const lat = Number(q.lat), lng = Number(q.lng)
    if (q.category) nb.setCategory(q.category)
    if (q.radius && RADII.includes(Number(q.radius))) nb.setRadius(Number(q.radius))
    if (q.lat && q.lng && Number.isFinite(lat) && Number.isFinite(lng)) nb.setOrigin({ lat: +lat.toFixed(6), lng: +lng.toFixed(6), source: 'link' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [layersOpen, setLayersOpen] = useState(true)
  const [stripOpen, setStripOpen] = useState(true)
  const [wmsError, setWmsError] = useState(null)

  // Leaflet map, once. Basemaps + zoom live top-right like the main map; the wrapper keeps the map sized.
  useEffect(() => {
    const map = L.map(mapEl.current, { center: PUNE, zoom: 12, minZoom: 10, maxBounds: [[18.2, 73.4], [18.9, 74.3]], zoomControl: false })
    const bases = leafletBasemaps(L)
    bases.Streets.addTo(map)
    L.control.layers(bases, null, { position: 'topright', collapsed: true }).addTo(map)
    L.control.zoom({ position: 'topright' }).addTo(map)
    L.control.scale({ imperial: false }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    map.on('click', (e) => pick.current(e.latlng))
    mapRef.current = map
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(wrapRef.current)
    return () => { ro.disconnect(); map.remove() }
  }, [])

  // Origin marker follows the chosen origin.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const origin = nb.origin
    if (!origin) { originRef.current?.remove(); originRef.current = null; return }
    if (!originRef.current) {
      originRef.current = L.marker([origin.lat, origin.lng], { draggable: true, title: 'Search origin (drag me)', zIndexOffset: 1000 }).addTo(map)
      originRef.current.on('dragend', () => { const p = originRef.current.getLatLng(); nb.setOrigin({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6), source: 'drag' }) })
    } else {
      originRef.current.setLatLng([origin.lat, origin.lng])
    }
    if (origin.source !== 'map' && origin.source !== 'drag') map.setView([origin.lat, origin.lng], Math.max(map.getZoom(), 14))
  }, [nb.origin]) // eslint-disable-line react-hooks/exhaustive-deps

  // WMS overlays from GeoServer (optional; the page works without GeoServer).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const defs = { services: 'punestay:services', listings: 'punestay:listings_public' }
    for (const [key, layerName] of Object.entries(defs)) {
      if (overlays[key] && !wmsRef.current[key]) {
        wmsRef.current[key] = L.tileLayer.wms(`${GEOSERVER}/punestay/wms`, { layers: layerName, format: 'image/png', transparent: true, opacity: 0.8, attribution: 'GeoServer' }).addTo(map)
        wmsRef.current[key].on('tileerror', () => setWmsError('GeoServer overlay could not be loaded. Is GeoServer running on port 8080?'))
      } else if (!overlays[key] && wmsRef.current[key]) {
        wmsRef.current[key].remove(); delete wmsRef.current[key]
      }
    }
    if (!overlays.services && !overlays.listings) setWmsError(null)
  }, [overlays])

  // Draw results + radius circle.
  useEffect(() => {
    const map = mapRef.current, group = layerRef.current
    if (!map || !group) return
    group.clearLayers(); markersRef.current = {}
    circleRef.current?.remove(); circleRef.current = null
    const { origin, mode, radius, results } = nb
    if (origin && (mode === 'radius' || mode === 'both')) {
      circleRef.current = L.circle([origin.lat, origin.lng], { radius, color: '#14b8a6', weight: 1.5, fillOpacity: 0.06, dashArray: '4 4' }).addTo(map)
    }
    if (!results?.features?.length) return
    const bounds = L.latLngBounds([[origin.lat, origin.lng]])
    results.features.forEach((f, i) => {
      const p = f.properties
      const [lng, lat] = f.geometry.coordinates
      const m = L.marker([lat, lng], { icon: icon(COLORS[p.category] || DEFAULT_COLOR) }).addTo(group)
      m.bindPopup(`<b>${escapeHtml(p.name || p.subcategory)}</b><br>${escapeHtml(p.label)} · ${escapeHtml(nice(p.subcategory))}<br>${metres(p.distance_m)} away` +
        (p.address ? `<br>${escapeHtml(p.address)}` : '') + (p.phone ? `<br>☎ ${escapeHtml(p.phone)}` : ''))
      m.on('click', () => nb.setActiveId(p.id))
      markersRef.current[p.id] = m
      bounds.extend([lat, lng])
      if (i === 0) m.bindTooltip('nearest', { permanent: false })
    })
    map.fitBounds(bounds.pad(0.15), { maxZoom: 16 })
  }, [nb.results, nb.origin, nb.mode, nb.radius]) // eslint-disable-line react-hooks/exhaustive-deps

  // Highlight the active marker and open its popup.
  useEffect(() => {
    const feats = nb.results?.features || []
    for (const f of feats) {
      const m = markersRef.current[f.properties.id]
      if (m) m.setIcon(icon(COLORS[f.properties.category] || DEFAULT_COLOR, f.properties.id === nb.activeId))
    }
    const m = nb.activeId != null ? markersRef.current[nb.activeId] : null
    if (m) { m.openPopup(); m.setZIndexOffset(500) }
  }, [nb.activeId, nb.results])

  const rows = nb.results?.features || []
  const top = rows.slice(0, 4)
  const error = nb.error || wmsError

  return (
    <div className="nearby">
      <aside className="nearby-panel">
        <section className="np-card">
          <div className="np-title">
            <span className="np-icon"><Radar size={20} /></span>
            <div>
              <h1>Nearby services</h1>
              <p>Pick a point, choose what you need, and get the closest places sorted by distance.</p>
            </div>
          </div>

          <section className="nb-section">
            <div className="section-title"><span className="step">1</span> Where</div>
            <div className="actions-row" style={{ marginTop: 8 }}>
              <button type="button" className="btn sm primary" onClick={nb.useGeolocation} disabled={nb.geoState === 'asking'}>
                <LocateFixed size={14} /> {nb.geoState === 'asking' ? 'Locating…' : 'Use my location'}
              </button>
              <span className="muted small" style={{ alignSelf: 'center' }}><Crosshair size={12} /> or click the map</span>
            </div>
            <div className="latlng-row">
              <label className="field"><span className="field-label">Latitude</span>
                <input className="input" inputMode="decimal" placeholder="18.5204" value={nb.latText} onChange={(e) => nb.setLatText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && nb.applyTyped()} /></label>
              <label className="field"><span className="field-label">Longitude</span>
                <input className="input" inputMode="decimal" placeholder="73.8567" value={nb.lngText} onChange={(e) => nb.setLngText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && nb.applyTyped()} /></label>
              <button type="button" className="btn sm primary" onClick={nb.applyTyped} style={{ alignSelf: 'end', height: 36 }}>Go</button>
            </div>
            {nb.origin && <p className="muted small" style={{ marginTop: 6 }}>Origin from {nb.origin.source}: {nb.origin.lat}, {nb.origin.lng}. Drag the marker to adjust.</p>}
          </section>

          <section className="nb-section">
            <div className="section-title"><span className="step">2</span> What</div>
            <label className="field" style={{ marginTop: 8 }}><span className="field-label">Category</span>
              <select className="input" value={nb.category} onChange={(e) => nb.setCategory(e.target.value)}>
                <option value="">All services</option>
                {nb.categories.map((c) => <option key={c.category} value={c.category}>{c.label} ({c.count})</option>)}
              </select></label>
            {nb.subcats.length > 1 && (
              <label className="field"><span className="field-label">Subcategory</span>
                <select className="input" value={nb.subcategory} onChange={(e) => nb.setSubcategory(e.target.value)}>
                  <option value="">Any</option>
                  {nb.subcats.map((s) => <option key={s.subcategory} value={s.subcategory}>{nice(s.subcategory)} ({s.count})</option>)}
                </select></label>
            )}
          </section>

          <section className="nb-section" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <div className="section-title"><span className="step">3</span> How far</div>
            <div className="segmented" style={{ marginTop: 8 }}>
              {[['radius', 'Within radius'], ['nearest', 'Nearest N'], ['both', 'Both']].map(([v, l]) => (
                <button type="button" key={v} className={nb.mode === v ? 'on' : ''} onClick={() => nb.setMode(v)}>{l}</button>
              ))}
            </div>
            <div className="latlng-row" style={{ marginTop: 10 }}>
              {(nb.mode === 'radius' || nb.mode === 'both') && (
                <label className="field"><span className="field-label">Radius</span>
                  <select className="input" value={nb.radius} onChange={(e) => nb.setRadius(Number(e.target.value))}>{RADII.map((r) => <option key={r} value={r}>{metres(r)}</option>)}</select></label>
              )}
              {(nb.mode === 'nearest' || nb.mode === 'both') && (
                <label className="field"><span className="field-label">Nearest</span>
                  <select className="input" value={nb.n} onChange={(e) => nb.setN(Number(e.target.value))}>{NS.map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
              )}
            </div>
            <div className="actions-row" style={{ marginTop: 12 }}>
              <button type="button" className="btn primary" style={{ flex: 1 }} onClick={nb.search} disabled={nb.busy || !nb.origin}>
                <Search size={15} /> {nb.busy ? 'Searching…' : 'Search'}
              </button>
              {nb.origin && <button type="button" className="btn" onClick={nb.clear} title="Clear the search"><RotateCcw size={14} /></button>}
            </div>
          </section>
        </section>

        <section className="np-card">
          <button type="button" className="np-collapse" onClick={() => setLayersOpen((o) => !o)} aria-expanded={layersOpen}>
            <span className="section-title"><Layers size={14} /> GeoServer layers</span>
            {layersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {layersOpen && (
            <div style={{ marginTop: 6 }}>
              <label className="switch-row"><span>All services (WMS)</span><input type="checkbox" checked={overlays.services} onChange={(e) => setOverlays({ ...overlays, services: e.target.checked })} /><span className="switch" /></label>
              <label className="switch-row"><span>Listings (WMS)</span><input type="checkbox" checked={overlays.listings} onChange={(e) => setOverlays({ ...overlays, listings: e.target.checked })} /><span className="switch" /></label>
            </div>
          )}
        </section>

        <section className="np-card" ref={resultsRef}>
          <div className="section-title"><ListOrdered size={14} /> {nb.results ? `${rows.length} result${rows.length === 1 ? '' : 's'}, nearest first` : 'Results'}</div>
          {error && <div className="form-error" role="alert">{error}</div>}
          {!nb.results && !error && <p className="muted small" style={{ marginTop: 8 }}>Choose a location to see services here.</p>}
          <ol className="nb-list">
            {rows.map((f, i) => {
              const p = f.properties
              return (
                <li key={p.id} className={p.id === nb.activeId ? 'active' : ''} onClick={() => nb.setActiveId(p.id)} onMouseEnter={() => markersRef.current[p.id]?.setZIndexOffset(400)}>
                  <span className="nb-rank" style={{ background: COLORS[p.category] || DEFAULT_COLOR }}>{i + 1}</span>
                  <span className="nb-main">
                    <div className="v">{p.name || <span className="muted">Unnamed {nice(p.subcategory)}</span>}</div>
                    <div className="k">{p.label} · {nice(p.subcategory)}{p.address ? ` · ${p.address}` : ''}</div>
                    {(p.phone || p.opening_hours) && <div className="k">{p.phone ? `☎ ${p.phone}` : ''}{p.phone && p.opening_hours ? ' · ' : ''}{p.opening_hours || ''}</div>}
                  </span>
                  <span className="nb-dist">{metres(p.distance_m)}</span>
                </li>
              )
            })}
          </ol>
        </section>
      </aside>

      <div className="nearby-main">
        <div className="nearby-map-wrap" ref={wrapRef}>
          <div ref={mapEl} className="nearby-map" role="application" aria-label="Map. Click to set the search origin." />
          <button type="button" className="map-fab" onClick={nb.useGeolocation} title="Use my location" aria-label="Use my location"><LocateFixed size={18} /></button>
        </div>

        <div className="nearby-bar">
          <WeatherChip />
          <span className="sep" />
          <span className="nearby-loc"><MapPin size={15} /> {nb.origin ? `${nb.origin.lat}, ${nb.origin.lng}` : 'Pune, Maharashtra'}</span>
          <button type="button" className="btn sm ghost" style={{ marginLeft: 'auto' }} onClick={() => setStripOpen((o) => !o)} aria-expanded={stripOpen} title={stripOpen ? 'Hide top results' : 'Show top results'}>
            <List size={15} /> {stripOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>

        {stripOpen && (
          <div className="nearby-strip">
            <div className="strip-head">
              <span><Radar size={15} /> Nearby services <small className="muted">(top results)</small></span>
              {rows.length > 4 && <button type="button" className="link" onClick={() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>View all {rows.length}</button>}
            </div>
            {top.length === 0
              ? <p className="muted small">Pick a point on the map, or use your location, to see the closest services here.</p>
              : (
                <div className="strip-cards">
                  {top.map((f, i) => {
                    const p = f.properties
                    return (
                      <div key={p.id} className={`scard${p.id === nb.activeId ? ' active' : ''}`} onClick={() => nb.setActiveId(p.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && nb.setActiveId(p.id)}>
                        <div className="scard-top">
                          <span className="ico" style={{ background: COLORS[p.category] || DEFAULT_COLOR }}>{i + 1}</span>
                          <span style={{ minWidth: 0 }}>
                            <div className="name">{p.name || `Unnamed ${nice(p.subcategory)}`}</div>
                            <div className="sub">{p.label}</div>
                          </span>
                          <span className="dist">{metres(p.distance_m)}</span>
                        </div>
                        {p.address && <div className="line"><MapPin size={12} /><span>{p.address}</span></div>}
                        {p.phone && <div className="line"><Phone size={12} /><span>{p.phone}</span></div>}
                        <span className="view">View on map →</span>
                      </div>
                    )
                  })}
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  )
}
