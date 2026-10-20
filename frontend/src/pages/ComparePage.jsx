import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { api } from '../api/client'
import DestinationSearch from '../components/DestinationSearch'
import { metres, minutes, rupees } from '../format'

const ROWS = [
  { k: 'listings', label: 'Listings on the map', fmt: (v) => v, better: 'high' },
  { k: 'median_rent_pg', label: 'Median PG rent', fmt: rupees, better: 'low' },
  { k: 'median_rent_flat', label: 'Median flat rent', fmt: rupees, better: 'low' },
  { k: 'median_rent', label: 'Median rent (all)', fmt: rupees, better: 'low' },
  { k: 'flat_1bhk_est', label: '1 BHK flat, typical (2025 est.)', fmt: rupees, better: 'low' },
  { k: 'flat_2bhk_est', label: '2 BHK flat, typical (2025 est.)', fmt: rupees, better: 'low' },
  { k: 'flat_obs', label: 'Past flat rents behind that', fmt: (v) => (v == null ? '—' : `${v}`), better: null },
  { k: 'range', label: 'Rent range', fmt: (v, r) => `${rupees(r.min_rent)} – ${rupees(r.max_rent)}`, better: null },
  { k: 'avg_commute_s', label: 'Average travel time', fmt: minutes, better: 'low', needsDest: true },
  { k: 'avg_safety', label: 'Night safety score', fmt: (v) => (v == null ? '—' : `${v} / 100`), better: 'high' },
  { k: 'pct_vacant', label: 'Listings with rooms now', fmt: (v) => (v == null ? '—' : `${v}%`), better: 'high' },
  { k: 'avg_bus_stop_m', label: 'Nearest bus stop (avg)', fmt: metres, better: 'low' },
  { k: 'avg_metro_m', label: 'Nearest metro (avg)', fmt: metres, better: 'low' },
  { k: 'avg_mess_m', label: 'Nearest mess / food (avg)', fmt: metres, better: 'low' },
  { k: 'avg_hospital_m', label: 'Nearest hospital (avg)', fmt: metres, better: 'low' },
]

export default function ComparePage({ destination, onDestination }) {
  const [areas, setAreas] = useState(null)
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.areas(2).then((rows) => {
      setAreas(rows)
      if (rows.length >= 2) { setA(String(rows[0].locality_id)); setB(String(rows[1].locality_id)) }
    }).catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!a || !b || a === b) { setResult(null); return }
    let cancelled = false
    setBusy(true); setError(null)
    api.compareAreas(a, b, destination?.id)
      .then((r) => !cancelled && setResult(r))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setBusy(false))
    return () => { cancelled = true }
  }, [a, b, destination])

  const options = useMemo(() => (areas || []).map((r) => <option key={r.locality_id} value={r.locality_id}>{r.locality} ({r.listings})</option>), [areas])

  return (
    <div className="page"><div className="page-inner narrow">
      <div className="page-head">
        <div>
          <h1 className="page-title">Compare two areas</h1>
          <p className="muted">Rent, safety and transport, computed from the listings and OpenStreetMap data on the map. Pick your college or office to add travel time.</p>
        </div>
      </div>

      <div className="card">
        <div className="compare-pick">
          <label className="field"><span className="field-label">Area A</span>
            <select className="input" value={a} onChange={(e) => setA(e.target.value)}>{options}</select></label>
          <button type="button" className="btn icon" aria-label="Swap" onClick={() => { setA(b); setB(a) }}><ArrowLeftRight size={16} /></button>
          <label className="field"><span className="field-label">Area B</span>
            <select className="input" value={b} onChange={(e) => setB(e.target.value)}>{options}</select></label>
        </div>
        <div style={{ marginTop: 12 }}>
          <span className="field-label">Travel time to</span>
          <DestinationSearch value={destination} onPick={onDestination} />
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      {!areas && !error && <div className="state">Loading areas…</div>}
      {areas?.length < 2 && <div className="card center" style={{ marginTop: 16 }}>Not enough listings yet to compare areas.</div>}
      {a === b && a && <p className="muted small" style={{ marginTop: 12 }}>Pick two different areas.</p>}

      {result && (
        <div className="card" style={{ marginTop: 16, opacity: busy ? 0.6 : 1 }}>
          <table className="compare">
            <thead><tr><th></th><th>{result.a.locality}</th><th>{result.b.locality}</th></tr></thead>
            <tbody>
              {ROWS.filter((r) => !r.needsDest || destination).map((r) => {
                const va = r.k === 'range' ? 1 : result.a[r.k], vb = r.k === 'range' ? 1 : result.b[r.k]
                let winA = false, winB = false
                if (r.better && va != null && vb != null && va !== vb) {
                  winA = r.better === 'low' ? va < vb : va > vb
                  winB = !winA
                }
                return (
                  <tr key={r.k}>
                    <th>{r.label}</th>
                    <td className={winA ? 'win' : ''}>{r.fmt(va, result.a)}</td>
                    <td className={winB ? 'win' : ''}>{r.fmt(vb, result.b)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {destination && (result.a.commute_known === 0 || result.b.commute_known === 0) && (
            <p className="muted small" style={{ marginTop: 10 }}>Travel time needs the routing service; it was not reachable for one of the areas.</p>
          )}
          <p className="muted small" style={{ marginTop: 10 }}>Green cells mark the better value. PG and hostel medians use only published rents (owner-entered or agreed by two students), so they show “—” until rents are reported. Flat rows come from real 2021 Pune flat rents, scaled to 2025 with the ANAROCK Q1 2025 report.</p>
        </div>
      )}
    </div></div>
  )
}
