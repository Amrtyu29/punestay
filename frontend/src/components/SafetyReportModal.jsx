import { useState } from 'react'
import { X } from 'lucide-react'
import { api } from '../api/client'
import { locateDevice } from '../geo'

const CATEGORIES = [
  ['dark_street', 'Dark street, no lighting'],
  ['harassment', 'Harassment or catcalling'],
  ['theft', 'Theft or snatching'],
  ['stray_dogs', 'Aggressive stray dogs'],
  ['other', 'Something else'],
]

export default function SafetyReportModal({ at, onClose, onSaved }) {
  const [category, setCategory] = useState('dark_street')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const device = await locateDevice()
      await api.createSafetyReport({ lat: at.lat, lng: at.lng, category, note: note.trim() || null,
                                     device_lat: device.lat, device_lng: device.lng, accuracy_m: device.accuracy_m })
      onSaved()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit} role="dialog" aria-modal="true" aria-label="Report an unsafe spot">
        <button type="button" className="btn ghost icon modal-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        <h2 className="title" style={{ fontSize: 18, marginBottom: 4 }}>What happened here?</h2>
        <p className="muted small" style={{ marginBottom: 12 }}>Reports stay anonymous on the map and lower the safety score of listings within 300 m for six months. Your phone must be within 500 m of the spot, so report it while you are there.</p>
        <div className="stack" style={{ gap: 6 }}>
          {CATEGORIES.map(([v, label]) => (
            <label key={v} className={`chip choice${category === v ? ' on' : ''}`} style={{ height: 36, justifyContent: 'flex-start', cursor: 'pointer' }}>
              <input type="radio" name="cat" value={v} checked={category === v} onChange={() => setCategory(v)} style={{ marginRight: 8 }} />
              {label}
            </label>
          ))}
        </div>
        <label className="field" style={{ marginTop: 12 }}><span className="field-label">Details (optional)</span>
          <input className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. lane behind the bus depot after 10 pm" /></label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn primary block" disabled={busy} style={{ marginTop: 16 }}>{busy ? 'Saving…' : 'Submit report'}</button>
      </form>
    </div>
  )
}
