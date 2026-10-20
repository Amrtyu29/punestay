import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { COLORS as SVC_COLORS, DEFAULT_COLOR as SVC_DEFAULT } from '../nearby'
import { BASEMAPS, DEFAULT_BASEMAP } from '../basemaps'
import { metres } from '../format'

const PUNE_CENTER = [73.8567, 18.5204]
const EMPTY = { type: 'FeatureCollection', features: [] }

// Colours match the design tokens in styles.css.
const RENT_LOW = '#16a34a'
const RENT_MID = '#f59e0b'
const RENT_HIGH = '#e11d48'
const CLUSTER = '#0f766e'
const INK = '#0f172a'
const CORAL = '#f0633d'
const BLUE = '#2563eb'

const styleOf = (key) => (BASEMAPS.find((b) => b.key === key) || BASEMAPS.find((b) => b.key === DEFAULT_BASEMAP)).style

/**
 * Renders the MapLibre map with clustered listing pins.
 * Props:
 *   listings       GeoJSON FeatureCollection from /listings
 *   selectedId     highlighted listing id
 *   onSelect(id)   pin clicked
 *   onViewportChange(bbox)  called (debounced) after pan/zoom with "w,s,e,n"
 *   flyTo          {lng, lat, zoom} to animate to (destination chosen)
 *   padding        {left,right,top,bottom} px kept clear of panels when centring
 *   route          GeoJSON LineString to draw (or null)
 *   destination    {lng, lat, name} to mark on the map (or null)
 *   grid           rent heatmap FeatureCollection of polygons with median_rent (or null)
 *   reports        safety reports FeatureCollection (or null)
 *   onMapClick     ({lng, lat}) for clicks on empty map
 *   nearby         {origin, results, radius, mode, activeId, hoverId} for the Nearby Services tab (or null)
 *   onNearbySelect(id)  a nearby-service marker was clicked
 *   basemap        key from basemaps.js; switching rebuilds every custom layer on the new style
 *   userLocation   {lat, lng} blue dot (or null)
 */
export default function MapView({ listings, selectedId, onSelect, onViewportChange, flyTo, padding, route, destination, grid, reports, onMapClick, flatRents, hoverId, nearby, onNearbySelect, basemap = DEFAULT_BASEMAP, userLocation }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const callbacks = useRef({ onSelect, onViewportChange, onMapClick, onNearbySelect })
  callbacks.current = { onSelect, onViewportChange, onMapClick, onNearbySelect }
  const paddingRef = useRef(padding)
  paddingRef.current = padding
  const nearbyPopup = useRef(null)
  // Latest data for every custom source, so the layers can be rebuilt after a basemap change.
  const dataRef = useRef({})
  dataRef.current = { listings, grid, reports, flatRents, route, destination, nearby, userLocation }
  // Bumped every time a style finishes loading and our layers exist again.
  const [ready, setReady] = useState(0)

  // Create the map once.
  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleOf(basemap),
      center: PUNE_CENTER,
      zoom: 12,
      minZoom: 9,
      maxBounds: [[73.4, 18.2], [74.3, 18.9]],
      attributionControl: { compact: true },
    })
    map.__basemap = basemap
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    if ('geolocation' in navigator) {
      map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), 'bottom-right')
    }
    mapRef.current = map
    if (import.meta.env.DEV) window.__map = map // handy for debugging in the browser console

    // Every style load (first paint and each basemap switch) rebuilds our sources and layers.
    map.on('style.load', () => {
      setupLayers(map)
      applyData(map, dataRef.current)
      setReady((r) => r + 1)
    })

    // Interaction handlers are bound once; they are delegated by layer id, so they survive style changes.
    map.on('click', 'clusters', (e) => {
      const f = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0]
      map.getSource('listings').getClusterExpansionZoom(f.properties.cluster_id).then((zoom) => {
        map.easeTo({ center: f.geometry.coordinates, zoom, padding: paddingRef.current })
      })
    })
    map.on('click', 'pins', (e) => {
      const f = e.features[0]
      callbacks.current.onSelect(f.properties.id)
      map.easeTo({ center: f.geometry.coordinates, padding: paddingRef.current, duration: 400 })
    })
    map.on('mousemove', 'pins', (e) => {
      const id = e.features[0]?.properties?.id
      if (id !== map.__hover) setHover(map, id)
    })
    map.on('mouseleave', 'pins', () => setHover(map, null))
    map.on('click', 'reports', (e) => {
      const p = e.features[0].properties
      new maplibregl.Popup({ closeButton: false, offset: 10 })
        .setLngLat(e.features[0].geometry.coordinates)
        .setHTML(`<b>${p.label || p.category}</b>${p.note ? `<br>${String(p.note).replace(/</g, '&lt;')}` : ''}<br><small>${new Date(p.created_at).toLocaleDateString('en-IN')}</small>`)
        .addTo(map)
    })
    map.on('click', 'flat-rents', (e) => {
      const p = e.features[0].properties
      const r = (v) => (v == null || v === 'null' ? '—' : `₹${Number(v).toLocaleString('en-IN')}`)
      new maplibregl.Popup({ closeButton: true, offset: 8, maxWidth: '260px' })
        .setLngLat(e.features[0].geometry.coordinates)
        .setHTML(`<b>${String(p.society || 'Housing society').replace(/</g, '&lt;')}</b><br><small>${String(p.locality || '').replace(/</g, '&lt;')} · ${p.n} flat rent${p.n == 1 ? '' : 's'} in ${p.year}</small>` +
          `<table style="margin-top:6px;font-size:12px"><tr><td>1 BHK</td><td><b>${r(p.median_1bhk)}</b></td></tr><tr><td>2 BHK</td><td><b>${r(p.median_2bhk)}</b></td></tr><tr><td>3 BHK</td><td><b>${r(p.median_3bhk)}</b></td></tr></table>` +
          `<small>All sizes, 2025 estimate: <b>${r(p.est_2025)}</b></small>`)
        .addTo(map)
    })
    map.on('click', 'nearby-pts', (e) => callbacks.current.onNearbySelect?.(e.features[0].properties.id))
    map.on('mousemove', 'nearby-pts', (e) => setNearbyHover(map, e.features[0]?.properties?.id))
    map.on('mouseleave', 'nearby-pts', () => setNearbyHover(map, null))
    for (const layer of ['clusters', 'pins', 'flat-rents', 'nearby-pts', 'reports']) {
      map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'))
      map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''))
    }
    map.on('click', (e) => {
      const layers = ['pins', 'clusters', 'reports', 'flat-rents', 'nearby-pts'].filter((id) => map.getLayer(id))
      const hit = layers.length ? map.queryRenderedFeatures(e.point, { layers }) : []
      if (!hit.length) callbacks.current.onMapClick?.({ lng: e.lngLat.lng, lat: e.lngLat.lat })
    })

    let timer
    const emit = () => {
      clearTimeout(timer)
      timer = setTimeout(() => callbacks.current.onViewportChange(bboxOf(map)), 250)
    }
    map.on('moveend', emit)
    map.once('load', emit)

    return () => map.remove()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Basemap switch: a new style wipes our layers; 'style.load' above puts them back.
  useEffect(() => {
    const map = mapRef.current
    if (!map || map.__basemap === basemap) return
    map.__basemap = basemap
    map.setStyle(styleOf(basemap), { diff: false })
  }, [basemap])

  // Push new data into the sources (and again after each style load, see `ready`).
  useEffect(() => { srcSet(mapRef.current, 'listings', listings || EMPTY) }, [listings, ready])
  useEffect(() => { srcSet(mapRef.current, 'grid', grid || EMPTY) }, [grid, ready])
  useEffect(() => { srcSet(mapRef.current, 'reports', reports || EMPTY) }, [reports, ready])
  useEffect(() => { srcSet(mapRef.current, 'flat-rents', flatRents || EMPTY) }, [flatRents, ready])
  useEffect(() => { srcSet(mapRef.current, 'destination', pointFC(destination, { name: destination?.name })) }, [destination, ready])
  useEffect(() => { srcSet(mapRef.current, 'user-loc', pointFC(userLocation)) }, [userLocation, ready])

  // Hover from the results list.
  useEffect(() => {
    const map = mapRef.current
    if (map && map.getSource('listings')) setHover(map, hoverId ?? null)
  }, [hoverId, listings, ready])

  // Highlight the selected pin.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getSource('listings')) return
    const prev = map.__selected
    if (prev != null) map.setFeatureState({ source: 'listings', id: prev }, { selected: false })
    if (selectedId != null) map.setFeatureState({ source: 'listings', id: selectedId }, { selected: true })
    map.__selected = selectedId
  }, [selectedId, listings, ready])

  useEffect(() => {
    if (flyTo && mapRef.current) {
      mapRef.current.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: flyTo.zoom ?? 13.5, padding: paddingRef.current })
    }
  }, [flyTo])

  // Route line: draw and fit it into the unobstructed part of the map.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getSource('route')) return
    map.getSource('route').setData(route ? { type: 'Feature', geometry: route, properties: {} } : EMPTY)
    const coords = route?.coordinates || []
    if (coords.length > 1) {
      const b = coords.reduce((acc, c) => acc.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]))
      const p = paddingRef.current || {}
      map.fitBounds(b, { padding: { top: (p.top || 24) + 40, bottom: (p.bottom || 24) + 40, left: (p.left || 24) + 40, right: (p.right || 24) + 40 }, maxZoom: 15, duration: 600 })
    }
  }, [route, ready])

  // Nearby Services: origin pin, radius circle, ranked markers, active popup.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getSource('nearby-pts')) return
    applyNearby(map, nearby)
  }, [nearby?.origin, nearby?.results, nearby?.radius, nearby?.mode, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fit the map to the results when a new search comes back.
  useEffect(() => {
    const map = mapRef.current
    const origin = nearby?.origin, feats = nearby?.results?.features
    if (!map || !origin || !feats?.length) return
    const b = feats.reduce((acc, f) => acc.extend(f.geometry.coordinates), new maplibregl.LngLatBounds([origin.lng, origin.lat], [origin.lng, origin.lat]))
    const p = paddingRef.current || {}
    map.fitBounds(b, { padding: { top: (p.top || 24) + 40, bottom: (p.bottom || 24) + 40, left: (p.left || 24) + 40, right: (p.right || 24) + 40 }, maxZoom: 16, duration: 600 })
  }, [nearby?.results]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getSource('nearby-pts')) return
    const prev = map.__nearbyActive
    if (prev != null) map.setFeatureState({ source: 'nearby-pts', id: prev }, { active: false })
    const id = nearby?.activeId ?? null
    if (id != null) map.setFeatureState({ source: 'nearby-pts', id }, { active: true })
    map.__nearbyActive = id
    nearbyPopup.current?.remove(); nearbyPopup.current = null
    const f = id != null ? nearby?.results?.features?.find((x) => x.properties.id === id) : null
    if (f) {
      const p = f.properties, esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
      nearbyPopup.current = new maplibregl.Popup({ closeButton: true, offset: 12, maxWidth: '260px' })
        .setLngLat(f.geometry.coordinates)
        .setHTML(`<b>${esc(p.name || p.subcategory)}</b><br>${esc(p.label)} · ${esc(String(p.subcategory).replace(/_/g, ' '))}<br>${metres(p.distance_m)} away` +
          (p.address ? `<br>${esc(p.address)}` : '') + (p.phone ? `<br>☎ ${esc(p.phone)}` : ''))
        .addTo(map)
      map.easeTo({ center: f.geometry.coordinates, padding: paddingRef.current, duration: 400 })
    }
  }, [nearby?.activeId, nearby?.results, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current
    if (map && map.getSource('nearby-pts')) setNearbyHover(map, nearby?.hoverId ?? null)
  }, [nearby?.hoverId, nearby?.results, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the map sized to its container when the sidebar opens or closes.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !containerRef.current) return
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  return <div ref={containerRef} className="map" />
}

/** Sources and layers for everything PuneStay draws. Safe to call after every style load. */
function setupLayers(map) {
  if (map.getSource('listings')) return

  map.addSource('listings', { type: 'geojson', data: EMPTY, cluster: true, clusterRadius: 48, clusterMaxZoom: 15, promoteId: 'id' })
  map.addLayer({
    id: 'clusters', type: 'circle', source: 'listings', filter: ['has', 'point_count'],
    paint: {
      'circle-color': CLUSTER, 'circle-opacity': 0.92,
      'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 26],
      'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff',
    },
  })
  map.addLayer({
    id: 'cluster-count', type: 'symbol', source: 'listings', filter: ['has', 'point_count'],
    layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12, 'text-font': ['Noto Sans Bold'] },
    paint: { 'text-color': '#ffffff' },
  })

  // Rent heatmap grid (under everything else we draw).
  map.addSource('grid', { type: 'geojson', data: EMPTY })
  map.addLayer({
    id: 'grid-fill', type: 'fill', source: 'grid',
    paint: {
      // Real 2021 flat rents (median per cell), see /areas/grid?source=flats.
      'fill-color': ['interpolate', ['linear'], ['get', 'median_rent'], 10000, '#dcfce7', 18000, '#fde68a', 28000, '#fca5a5', 45000, '#dc2626'],
      'fill-opacity': 0.45,
    },
  }, 'clusters')
  map.addLayer({ id: 'grid-line', type: 'line', source: 'grid', paint: { 'line-color': '#ffffff', 'line-width': 1, 'line-opacity': 0.6 } }, 'clusters')

  // Safety reports.
  map.addSource('reports', { type: 'geojson', data: EMPTY })
  map.addLayer({ id: 'reports-halo', type: 'circle', source: 'reports', paint: { 'circle-color': '#dc2626', 'circle-opacity': 0.15, 'circle-radius': 18 } }, 'clusters')
  map.addLayer({ id: 'reports', type: 'circle', source: 'reports', paint: { 'circle-color': '#dc2626', 'circle-radius': 5, 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' } }, 'clusters')

  // Past flat rents: one dot per housing society, sized by sample count, coloured by the 2025 estimate.
  map.addSource('flat-rents', { type: 'geojson', data: EMPTY })
  map.addLayer({
    id: 'flat-rents', type: 'circle', source: 'flat-rents',
    paint: {
      'circle-color': ['interpolate', ['linear'], ['get', 'est_2025'], 12000, '#bbf7d0', 25000, '#fde68a', 40000, '#fdba74', 60000, '#f87171'],
      'circle-radius': ['interpolate', ['linear'], ['get', 'n'], 1, 4, 10, 7, 50, 11],
      'circle-stroke-width': 1, 'circle-stroke-color': '#64748b', 'circle-opacity': 0.85,
    },
  }, 'clusters')

  // Nearby Services: radius circle under the pins; markers go above them (moved to the top below).
  map.addSource('nearby-circle', { type: 'geojson', data: EMPTY })
  map.addLayer({ id: 'nearby-circle-fill', type: 'fill', source: 'nearby-circle', paint: { 'fill-color': CLUSTER, 'fill-opacity': 0.06 } }, 'clusters')
  map.addLayer({ id: 'nearby-circle-line', type: 'line', source: 'nearby-circle', paint: { 'line-color': CLUSTER, 'line-width': 1.5, 'line-dasharray': [2, 2] } }, 'clusters')
  map.addSource('nearby-pts', { type: 'geojson', data: EMPTY, promoteId: 'id' })
  const svcColor = ['match', ['get', 'category'], ...Object.entries(SVC_COLORS).flat(), SVC_DEFAULT]
  map.addLayer({
    id: 'nearby-pts', type: 'circle', source: 'nearby-pts',
    paint: {
      'circle-color': svcColor,
      'circle-radius': ['case', ['boolean', ['feature-state', 'active'], false], 12, ['boolean', ['feature-state', 'hover'], false], 11, 9],
      'circle-stroke-width': ['case', ['boolean', ['feature-state', 'active'], false], 3, 2],
      'circle-stroke-color': ['case', ['boolean', ['feature-state', 'active'], false], INK, '#ffffff'],
    },
  })
  map.addLayer({
    id: 'nearby-rank', type: 'symbol', source: 'nearby-pts',
    layout: { 'text-field': ['to-string', ['get', 'rank']], 'text-size': 10, 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true },
    paint: { 'text-color': '#ffffff' },
  })
  map.addLayer({
    id: 'nearby-labels', type: 'symbol', source: 'nearby-pts', minzoom: 14,
    layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-font': ['Noto Sans Bold'], 'text-offset': [1.1, 0], 'text-anchor': 'left', 'text-max-width': 14, 'text-optional': true },
    paint: { 'text-color': INK, 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
  })
  map.addSource('nearby-origin', { type: 'geojson', data: EMPTY })
  map.addLayer({ id: 'nearby-origin-halo', type: 'circle', source: 'nearby-origin', paint: { 'circle-color': CORAL, 'circle-opacity': 0.25, 'circle-radius': 18 } })
  map.addLayer({ id: 'nearby-origin', type: 'circle', source: 'nearby-origin', paint: { 'circle-color': CORAL, 'circle-radius': 8, 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' } })
  map.addLayer({
    id: 'nearby-origin-label', type: 'symbol', source: 'nearby-origin',
    layout: { 'text-field': 'Search here', 'text-size': 11, 'text-font': ['Noto Sans Bold'], 'text-offset': [0, 1.4], 'text-anchor': 'top' },
    paint: { 'text-color': '#c2410c', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
  })

  // Route line under the pins, destination marker and user location on top.
  map.addSource('route', { type: 'geojson', data: EMPTY })
  map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.9 } })
  map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': CLUSTER, 'line-width': 5 } })
  map.addSource('destination', { type: 'geojson', data: EMPTY })
  map.addLayer({ id: 'destination-halo', type: 'circle', source: 'destination', paint: { 'circle-color': CLUSTER, 'circle-opacity': 0.18, 'circle-radius': 22 } })
  map.addLayer({ id: 'destination-pin', type: 'circle', source: 'destination', paint: { 'circle-color': INK, 'circle-radius': 7, 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' } })
  map.addLayer({
    id: 'destination-label', type: 'symbol', source: 'destination',
    layout: { 'text-field': ['get', 'name'], 'text-size': 12, 'text-font': ['Noto Sans Bold'], 'text-offset': [0, 1.4], 'text-anchor': 'top', 'text-max-width': 12 },
    paint: { 'text-color': INK, 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
  })
  map.addSource('user-loc', { type: 'geojson', data: EMPTY })
  map.addLayer({ id: 'user-loc-halo', type: 'circle', source: 'user-loc', paint: { 'circle-color': BLUE, 'circle-opacity': 0.18, 'circle-radius': 20 } })
  map.addLayer({ id: 'user-loc', type: 'circle', source: 'user-loc', paint: { 'circle-color': BLUE, 'circle-radius': 7, 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' } })

  // Single pins: colour by rent band, grey ring if unverified, dark ring if selected, faded if full.
  map.addLayer({
    id: 'pins', type: 'circle', source: 'listings', filter: ['!', ['has', 'point_count']],
    paint: {
      // Grey when the rent is not published; otherwise coloured by rent band.
      'circle-color': ['case', ['==', ['typeof', ['get', 'rent_min']], 'number'], ['step', ['get', 'rent_min'], RENT_LOW, 7000, RENT_MID, 12000, RENT_HIGH], '#9ca3af'],
      'circle-radius': ['case', ['boolean', ['feature-state', 'selected'], false], 11, ['boolean', ['feature-state', 'hover'], false], 10, 7],
      'circle-opacity': ['case', ['==', ['get', 'vacancy'], false], 0.45, 1],
      'circle-stroke-width': ['case', ['boolean', ['feature-state', 'selected'], false], 3, ['boolean', ['feature-state', 'hover'], false], 3, 2],
      'circle-stroke-color': ['case', ['boolean', ['feature-state', 'selected'], false], INK, ['==', ['get', 'status'], 'verified'], '#ffffff', '#9ca3af'],
    },
  })
  // Price label beside each pin (commute minutes when a destination is chosen, else the rent).
  map.addLayer({
    id: 'pin-labels', type: 'symbol', source: 'listings',
    filter: ['all', ['!', ['has', 'point_count']], ['any', ['has', 'commute_s'], ['==', ['typeof', ['get', 'rent_min']], 'number']]],
    minzoom: 13,
    layout: {
      'text-field': ['case',
        ['has', 'commute_s'], ['concat', ['to-string', ['round', ['/', ['get', 'commute_s'], 60]]], ' min'],
        ['concat', '₹', ['to-string', ['round', ['/', ['get', 'rent_min'], 1000]]], 'k']],
      'text-size': 11, 'text-font': ['Noto Sans Bold'], 'text-offset': [0.95, 0], 'text-anchor': 'left',
      'text-allow-overlap': false, 'text-optional': true,
    },
    paint: { 'text-color': INK, 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 },
  })

  // Nearby-service markers sit above listing pins so they stay clickable.
  for (const id of ['nearby-pts', 'nearby-rank', 'nearby-labels', 'nearby-origin-halo', 'nearby-origin', 'nearby-origin-label', 'user-loc-halo', 'user-loc']) map.moveLayer(id)
}

/** Push every piece of current data into the freshly built sources. */
function applyData(map, d) {
  srcSet(map, 'listings', d.listings || EMPTY)
  srcSet(map, 'grid', d.grid || EMPTY)
  srcSet(map, 'reports', d.reports || EMPTY)
  srcSet(map, 'flat-rents', d.flatRents || EMPTY)
  srcSet(map, 'route', d.route ? { type: 'Feature', geometry: d.route, properties: {} } : EMPTY)
  srcSet(map, 'destination', pointFC(d.destination, { name: d.destination?.name }))
  srcSet(map, 'user-loc', pointFC(d.userLocation))
  applyNearby(map, d.nearby)
  if (map.__selected != null) map.setFeatureState({ source: 'listings', id: map.__selected }, { selected: true })
}

function applyNearby(map, nearby) {
  const origin = nearby?.origin
  srcSet(map, 'nearby-origin', pointFC(origin))
  const showCircle = origin && nearby.mode !== 'nearest'
  srcSet(map, 'nearby-circle', showCircle ? circlePolygon(origin.lng, origin.lat, nearby.radius) : EMPTY)
  const feats = (nearby?.results?.features || []).map((f, i) => ({ ...f, id: f.properties.id, properties: { ...f.properties, rank: i + 1 } }))
  srcSet(map, 'nearby-pts', { type: 'FeatureCollection', features: feats })
  map.__nearbyActive = null
}

function srcSet(map, id, data) { map?.getSource(id)?.setData(data) }

function pointFC(p, props = {}) {
  return p ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: props }] } : EMPTY
}

function setHover(map, id) {
  const prev = map.__hover
  if (prev != null) map.setFeatureState({ source: 'listings', id: prev }, { hover: false })
  if (id != null) map.setFeatureState({ source: 'listings', id }, { hover: true })
  map.__hover = id ?? null
}

function setNearbyHover(map, id) {
  const prev = map.__nearbyHover
  if (prev != null) map.setFeatureState({ source: 'nearby-pts', id: prev }, { hover: false })
  if (id != null) map.setFeatureState({ source: 'nearby-pts', id }, { hover: true })
  map.__nearbyHover = id ?? null
}

/** GeoJSON polygon approximating a circle of `radiusM` metres around lng/lat (64 vertices). */
function circlePolygon(lng, lat, radiusM, steps = 64) {
  const dLat = radiusM / 111320
  const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180))
  const ring = []
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)])
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} }
}

function bboxOf(map) {
  const b = map.getBounds()
  return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(5)).join(',')
}
