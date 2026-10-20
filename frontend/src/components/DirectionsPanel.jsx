import { useEffect, useState } from 'react'
import { Bike, Car, ExternalLink, Footprints, LocateFixed, MapPin, X } from 'lucide-react'
import DestinationSearch from './DestinationSearch'
import { api } from '../api/client'
import { locateDevice } from '../geo'
import { metres, minutes } from '../format'

const MODES = [['car', 'Drive', Car], ['bike', 'Bike', Bike], ['foot', 'Walk', Footprints]]
const GMODE = { car: 'driving', bike: 'bicycling', foot: 'walking' }

/**
 * Directions from a college / office (or the phone's location) to the PG selected on the map.
 * Draws the road route on the map through onRoute(geometry) and offers the same trip in Google Maps.
 */
export default function DirectionsPanel({ destination, onDestination, to, onClose, onRoute, userLocation, onUserLocation }) {
  const [fromKind, setFromKind] = useState(userLocation ? 'me' : 'place')
  const [mode, setMode] = useState('car')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const from = fromKind === 'me' ? userLocation : destination

  useEffect(() => {
    if (!from || !to) { setResult(null); onRoute(null); return }
    let cancelled = false
    setBusy(true); setError(null)
    api.route({ lng: from.lng, lat: from.lat }, { lng: to.lng, lat: to.lat }, mode)
      .then((r) => { if (!cancelled) { setResult(r); onRoute(r.geometry) } })
      .catch((e) => { if (!cancelled) { setError(e.message); setResult(null); onRoute(null) } })
      .finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
  }, [from?.lat, from?.lng, to?.lat, to?.lng, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const locate = async () => {
    setError(null)
    try { const d = await locateDevice(); onUserLocation(d); setFromKind('me') } catch (e) { setError(e.message) }
  }

  const gmaps = from && to
    ? `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=${GMODE[mode]}`
    : null

  return (
    <section className="dir-card" aria-label="Directions">
      <div className="dir-head">
        <span>Directions</span>
        <button type="button" className="btn ghost icon sm" onClick={onClose} aria-label="Close directions"><X size={15} /></button>
      </div>

      <div className="segmented">
        <button type="button" className={fromKind === 'place' ? 'on' : ''} onClick={() => setFromKind('place')}>From college / office</button>
        <button type="button" className={fromKind === 'me' ? 'on' : ''} onClick={() => (userLocation ? setFromKind('me') : locate())}><LocateFixed size={13} /> From me</button>
      </div>

      <div className="dir-row">
        <span className="dir-dot a" />
        <div>
          {fromKind === 'place'
            ? <DestinationSearch value={destination} onPick={onDestination} />
            : userLocation
              ? <div className="dir-to"><b>Your location</b> <span className="muted">· {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}</span> <button type="button" className="link" onClick={locate}>refresh</button></div>
              : <button type="button" className="btn sm" onClick={locate}><LocateFixed size={14} /> Use my location</button>}
        </div>
      </div>
      <div className="dir-row">
        <span className="dir-dot b" />
        <div className="dir-to">
          {to
            ? <><MapPin size={13} /> <b>{to.name}</b></>
            : <span className="muted">Pick a PG: tap a pin on the map or a card in Places.</span>}
        </div>
      </div>

      <div className="segmented dir-modes">
        {MODES.map(([k, label, Icon]) => (
          <button type="button" key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}><Icon size={14} /> {label}</button>
        ))}
      </div>

      {busy && <p className="muted small" style={{ marginTop: 10 }}>Finding the route…</p>}
      {error && <div className="form-error">{error}</div>}
      {result && !busy && (
        <>
          <div className="dir-result">
            <span className="time">{minutes(result.duration_s)}</span>
            <span className="muted">{metres(result.distance_m)} by road</span>
          </div>
          <a className="btn sm block" href={gmaps} target="_blank" rel="noreferrer noopener" style={{ marginTop: 8 }}>
            <ExternalLink size={14} /> Open in Google Maps
          </a>
        </>
      )}
      {!result && !busy && !error && !(from && to) && (
        <p className="muted small" style={{ marginTop: 10 }}>Choose where you start and a PG to see travel time and the route.</p>
      )}
    </section>
  )
}
