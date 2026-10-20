import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

/** Small map with one draggable marker. `value` is {lat, lng} or null; `onChange({lat, lng})` on drop or click. */
export default function PinMap({ value, onChange, height = 320 }) {
  const el = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const cb = useRef(onChange)
  cb.current = onChange

  useEffect(() => {
    const map = new maplibregl.Map({
      container: el.current, style: STYLE_URL,
      center: value ? [value.lng, value.lat] : [73.8567, 18.5204], zoom: value ? 15 : 11.5, minZoom: 9,
      maxBounds: [[73.4, 18.2], [74.3, 18.9]], attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('click', (e) => cb.current({ lat: e.lngLat.lat, lng: e.lngLat.lng }))
    mapRef.current = map
    return () => map.remove()
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!value) { markerRef.current?.remove(); markerRef.current = null; return }
    if (!markerRef.current) {
      const m = new maplibregl.Marker({ draggable: true, color: '#0f766e' }).setLngLat([value.lng, value.lat]).addTo(map)
      m.on('dragend', () => { const p = m.getLngLat(); cb.current({ lat: p.lat, lng: p.lng }) })
      markerRef.current = m
      map.easeTo({ center: [value.lng, value.lat], zoom: Math.max(map.getZoom(), 15) })
    } else {
      const cur = markerRef.current.getLngLat()
      if (Math.abs(cur.lat - value.lat) > 1e-7 || Math.abs(cur.lng - value.lng) > 1e-7) {
        markerRef.current.setLngLat([value.lng, value.lat])
        map.easeTo({ center: [value.lng, value.lat], zoom: Math.max(map.getZoom(), 15) })
      }
    }
  }, [value])

  return <div ref={el} className="pin-map" style={{ height }} />
}
