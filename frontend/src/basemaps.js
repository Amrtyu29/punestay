/**
 * Basemaps for both maps: Google-Maps-style choice of Streets, Satellite, Terrain, Light, Dark and OSM.
 * All sources are free with attribution: OpenFreeMap vector styles, Esri World Imagery, OpenTopoMap,
 * OpenStreetMap and CARTO raster tiles.
 */

const OFM = 'https://tiles.openfreemap.org/styles'
const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'

const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const ESRI_IMG = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const ESRI_LABELS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
const ESRI_ATTR = 'Imagery &copy; Esri, Maxar, Earthstar Geographics'
const OTM_URL = 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png'
const OTM_ATTR = '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA), ' + OSM_ATTR
const CARTO_LIGHT = 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
const CARTO_DARK = 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
const CARTO_ATTR = OSM_ATTR + ' &copy; <a href="https://carto.com/attributions">CARTO</a>'

// A tile over central Pune used as the thumbnail in the picker (z12).
const THUMB = { z: 12, x: 2887, y: 1820 }
const thumb = (tpl) => tpl.replace('{z}', THUMB.z).replace('{x}', THUMB.x).replace('{y}', THUMB.y)

/** MapLibre style object for one or more raster tile layers. Glyphs are needed for our own text layers. */
function rasterStyle(layers) {
  const sources = {}, out = []
  layers.forEach((l, i) => {
    const id = `raster-${i}`
    sources[id] = { type: 'raster', tiles: [l.url], tileSize: 256, maxzoom: l.maxzoom || 19, attribution: l.attribution || '' }
    out.push({ id: `${id}-layer`, type: 'raster', source: id })
  })
  return { version: 8, glyphs: GLYPHS, sources, layers: out }
}

export const BASEMAPS = [
  { key: 'streets', label: 'Streets', style: `${OFM}/liberty`, swatch: 'linear-gradient(135deg, #eaf3e6 0%, #fdf3d0 55%, #cfe4f3 100%)', dark: false },
  { key: 'satellite', label: 'Satellite', style: rasterStyle([{ url: ESRI_IMG, attribution: ESRI_ATTR }, { url: ESRI_LABELS }]), thumb: thumb(ESRI_IMG), dark: true },
  { key: 'terrain', label: 'Terrain', style: rasterStyle([{ url: OTM_URL, attribution: OTM_ATTR, maxzoom: 17 }]), thumb: thumb(OTM_URL), dark: false },
  { key: 'light', label: 'Light', style: `${OFM}/positron`, swatch: 'linear-gradient(135deg, #f7f7f5 0%, #e9ebe6 100%)', dark: false },
  { key: 'dark', label: 'Dark', style: `${OFM}/dark`, swatch: 'linear-gradient(135deg, #1b1f27 0%, #2b3140 100%)', dark: true },
  { key: 'osm', label: 'OSM', style: rasterStyle([{ url: OSM_URL, attribution: OSM_ATTR }]), thumb: thumb(OSM_URL), dark: false },
]

export const DEFAULT_BASEMAP = 'streets'
const STORAGE_KEY = 'punestay.basemap'

export function loadBasemap() {
  try { const k = localStorage.getItem(STORAGE_KEY); return BASEMAPS.some((b) => b.key === k) ? k : DEFAULT_BASEMAP } catch { return DEFAULT_BASEMAP }
}
export function saveBasemap(key) { try { localStorage.setItem(STORAGE_KEY, key) } catch { /* private mode */ } }

/** Leaflet base layers for the Nearby Services page (label -> layer). */
export function leafletBasemaps(L) {
  return {
    Streets: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, subdomains: 'abc', attribution: OSM_ATTR }),
    Satellite: L.layerGroup([L.tileLayer(ESRI_IMG, { maxZoom: 19, attribution: ESRI_ATTR }), L.tileLayer(ESRI_LABELS, { maxZoom: 19 })]),
    Terrain: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, subdomains: 'abc', attribution: OTM_ATTR }),
    Light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', { maxZoom: 19, subdomains: 'abcd', attribution: CARTO_ATTR }),
    Dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', { maxZoom: 19, subdomains: 'abcd', attribution: CARTO_ATTR }),
  }
}
