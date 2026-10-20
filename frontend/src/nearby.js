import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api/client'

/**
 * Shared state + logic for the Nearby Services search (course brief), used by the home-map
 * sidebar tab and the stand-alone Leaflet page. Location by map click, typed lat/lng or
 * geolocation; category/subcategory; radius and/or nearest-N; distance-sorted results.
 */

// Keep in sync with PUNE_BBOX in .env (the API validates too).
export const BBOX = { south: 18.4, west: 73.62, north: 18.75, east: 74.05 }
export const RADII = [500, 1000, 2000, 3000, 5000, 10000]
export const NS = [5, 10, 20, 50, 100]

export const COLORS = {
  hospital: '#dc2626', pharmacy: '#db2777', police: '#1d4ed8', fire_station: '#ea580c', atm: '#0e7490', bank: '#0e7490',
  school: '#7c3aed', college: '#6d28d9', fuel: '#b45309', park: '#16a34a', bus_stop: '#0891b2', metro: '#0e7490',
  mess: '#d97706', grocery: '#65a30d', post_office: '#9f1239', library: '#4338ca', place_of_worship: '#78350f',
  toilets: '#475569', office: '#334155', lodging: '#7c3aed',
}
export const DEFAULT_COLOR = '#0f766e'

export function useNearby({ enabled = true } = {}) {
  const [categories, setCategories] = useState([])
  const [origin, setOrigin] = useState(null)         // {lat, lng, source}
  const [latText, setLatText] = useState('')
  const [lngText, setLngText] = useState('')
  const [category, setCategory] = useState('hospital')
  const [subcategory, setSubcategory] = useState('')
  const [mode, setMode] = useState('radius')         // 'radius' | 'nearest' | 'both'
  const [radius, setRadius] = useState(2000)
  const [n, setN] = useState(10)
  const [results, setResults] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [geoState, setGeoState] = useState('idle')   // idle | asking | denied | unavailable | ok

  useEffect(() => {
    if (!enabled) return
    api.nearbyCategories().then(setCategories).catch((e) => setError(e.message))
  }, [enabled])

  useEffect(() => {
    if (origin) { setLatText(String(origin.lat)); setLngText(String(origin.lng)) }
  }, [origin])

  const subcats = useMemo(() => (categories.find((c) => c.category === category)?.subcategories || []), [categories, category])
  useEffect(() => { setSubcategory('') }, [category])

  const applyTyped = () => {
    const lat = Number(latText), lng = Number(lngText)
    if (latText.trim() === '' || lngText.trim() === '' || Number.isNaN(lat) || Number.isNaN(lng)) { setError('Enter numeric latitude and longitude, for example 18.5204 and 73.8567.'); return }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) { setError('Latitude must be within ±90 and longitude within ±180.'); return }
    if (lat < BBOX.south || lat > BBOX.north || lng < BBOX.west || lng > BBOX.east) { setError(`That point is outside Pune (lat ${BBOX.south}–${BBOX.north}, lng ${BBOX.west}–${BBOX.east}).`); return }
    setError(null); setOrigin({ lat, lng, source: 'typed' })
  }

  const useGeolocation = () => {
    if (!('geolocation' in navigator)) { setGeoState('unavailable'); setError('Your browser does not support geolocation. Click the map or type coordinates instead.'); return }
    setGeoState('asking'); setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        if (lat < BBOX.south || lat > BBOX.north || lng < BBOX.west || lng > BBOX.east) {
          setGeoState('ok'); setError(`Your location (${lat.toFixed(4)}, ${lng.toFixed(4)}) is outside Pune. The map stays on Pune; click it to search here.`); return
        }
        setGeoState('ok'); setOrigin({ lat: +lat.toFixed(6), lng: +lng.toFixed(6), source: 'geolocation' })
      },
      (err) => {
        const msg = { 1: 'Location permission was denied. Allow it in the browser, or click the map / type coordinates.',
                      2: 'Your position is unavailable right now. Click the map or type coordinates.',
                      3: 'Finding your location timed out. Try again, or click the map.' }[err.code] || 'Could not get your location.'
        setGeoState(err.code === 1 ? 'denied' : 'unavailable'); setError(msg)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  const search = useCallback(async () => {
    if (!origin) { setError('Pick a location first: click the map, use your location, or type coordinates.'); return }
    setBusy(true); setError(null); setActiveId(null)
    try {
      const params = { lat: origin.lat, lng: origin.lng, category: category || undefined, subcategory: subcategory || undefined }
      if (mode === 'radius' || mode === 'both') params.radius_m = radius
      if (mode === 'nearest' || mode === 'both') params.limit = n
      if (mode === 'radius') params.limit = 200
      const fc = await api.nearby(params)
      setResults(fc)
      if (!fc.count) setError(fc.message || 'No services found here. Try a larger radius or another category.')
    } catch (e) {
      setResults(null); setError(e.message)
    } finally { setBusy(false) }
  }, [origin, category, subcategory, mode, radius, n])

  // Search automatically when the origin or filters change (after a location is chosen).
  useEffect(() => { if (origin && enabled) search() }, [origin, category, subcategory, mode, radius, n, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  const clear = () => { setOrigin(null); setResults(null); setActiveId(null); setError(null); setLatText(''); setLngText('') }
  const pickOnMap = (ll) => setOrigin({ lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6), source: 'map' })

  return {
    categories, subcats, origin, setOrigin, pickOnMap, latText, setLatText, lngText, setLngText,
    category, setCategory, subcategory, setSubcategory, mode, setMode, radius, setRadius, n, setN,
    results, activeId, setActiveId, busy, error, setError, geoState, applyTyped, useGeolocation, search, clear,
  }
}
