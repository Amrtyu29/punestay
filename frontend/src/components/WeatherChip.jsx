import { useEffect, useState } from 'react'
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Moon, Sun } from 'lucide-react'

/**
 * Current weather for Pune from Open-Meteo (free, no key, real observations/model data).
 * Always queries the city centre, never the viewer's position, so nothing personal leaves the browser.
 */
const PUNE = { lat: 18.52, lng: 73.86 }
const URL = `https://api.open-meteo.com/v1/forecast?latitude=${PUNE.lat}&longitude=${PUNE.lng}&current=temperature_2m,weather_code,is_day&timezone=Asia%2FKolkata`
const KEY = 'punestay.weather'
const TTL = 15 * 60 * 1000

const TEXT = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Snow', 73: 'Snow', 75: 'Snow', 77: 'Snow grains', 80: 'Showers', 81: 'Showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
}
function iconFor(code, day) {
  if (code === 0) return day ? Sun : Moon
  if (code <= 2) return CloudSun
  if (code === 3) return Cloud
  if (code <= 48) return CloudFog
  if (code <= 67 || (code >= 80 && code <= 82)) return CloudRain
  if (code <= 77 || code === 85 || code === 86) return CloudSnow
  return CloudLightning
}

export default function WeatherChip() {
  const [w, setW] = useState(null)   // null = loading, false = unavailable
  useEffect(() => {
    try {
      const c = JSON.parse(sessionStorage.getItem(KEY) || 'null')
      if (c && Date.now() - c.t < TTL) { setW(c.v); return }
    } catch { /* ignore */ }
    let cancelled = false
    fetch(URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        const v = { t: Math.round(j.current.temperature_2m), code: j.current.weather_code, day: j.current.is_day === 1 }
        if (!cancelled) setW(v)
        try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), v })) } catch { /* ignore */ }
      })
      .catch(() => { if (!cancelled) setW(false) })
    return () => { cancelled = true }
  }, [])

  if (w === false) return null
  if (!w) return <span className="weather"><span className="w-ico skeleton" /><span><b>…</b><small>Weather</small></span></span>
  const Icon = iconFor(w.code, w.day)
  return (
    <span className="weather" title="Current weather in Pune (Open-Meteo)">
      <Icon size={20} className="w-ico" />
      <span><b>{w.t}°C</b><small>{TEXT[w.code] || 'Weather'}</small></span>
    </span>
  )
}
