import { useEffect, useState } from 'react'
import { Flag, Pencil, ShieldCheck, Trash2 } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../auth'
import { href } from '../router'
import { rupees, TYPE_LABEL } from '../format'

export default function MyListingsPage({ onNeedSignIn }) {
  const { user, ready } = useAuth()
  const [rows, setRows] = useState(null)
  const [claims, setClaims] = useState([])
  const [trusted, setTrusted] = useState(false)
  const [error, setError] = useState(null)

  const load = () => api.myListings()
    .then((d) => { setRows(d.listings); setClaims(d.claims || []); setTrusted(!!d.trusted) })
    .catch((e) => setError(e.message))
  useEffect(() => { if (user) load() }, [user])

  if (!ready) return <div className="page"><div className="state">Loading…</div></div>
  if (!user) {
    return (
      <div className="page"><div className="page-inner narrow">
        <h1 className="page-title">My listings</h1>
        <div className="card center">
          <p>Sign in to see and manage the places you added.</p>
          <button type="button" className="btn primary" onClick={onNeedSignIn} style={{ marginTop: 12 }}>Sign in</button>
        </div>
      </div></div>
    )
  }

  const toggle = async (l) => {
    setRows((r) => r.map((x) => (x.id === l.id ? { ...x, vacancy: !l.vacancy } : x)))
    try { await api.setVacancy(l.id, !l.vacancy) } catch (e) { setError(e.message); load() }
  }
  const remove = async (l) => {
    if (!window.confirm(`Remove "${l.name}" from the map? This cannot be undone.`)) return
    try { await api.deleteListing(l.id); setRows((r) => r.filter((x) => x.id !== l.id)) } catch (e) { setError(e.message) }
  }

  return (
    <div className="page"><div className="page-inner narrow">
      <div className="page-head">
        <h1 className="page-title">My listings</h1>
        <a className="btn primary" href={href('/add')}>Add another</a>
      </div>
      {error && <p className="form-error">{error}</p>}
      {rows == null && <div className="state">Loading…</div>}
      {rows != null && !trusted && (
        <p className="muted small" style={{ marginBottom: 12 }}>
          New account: your first listing is checked by an admin before it appears on the map. After that, listings go live immediately.
        </p>
      )}
      {claims.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h3>Ownership claims</h3>
          <div className="rows">
            {claims.map((c) => (
              <div className="row" key={c.id}>
                <span className="main"><div className="v"><a href={href(`/listing/${c.listing_id}`)}>{c.name}</a></div>
                  <div className="k">{c.status === 'pending' ? 'Waiting for an admin to call and confirm' : c.status === 'approved' ? 'Approved, the listing is yours' : 'Not approved'}</div></span>
                <span className={`badge ${c.status === 'approved' ? 'success' : c.status === 'rejected' ? 'danger' : 'warn'}`}>{c.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {rows?.length === 0 && claims.length === 0 && (
        <div className="card center">
          <p>You have not added any place yet.</p>
          <a className="btn primary" href={href('/add')} style={{ marginTop: 12 }}>Add your first listing</a>
        </div>
      )}
      <div className="stack">
        {rows?.map((l) => (
          <div className="card listing-row" key={l.id}>
            <div className="listing-main">
              <div className="badges">
                {l.status === 'pending' && <span className="badge">Waiting for admin approval</span>}
                {l.status === 'verified' && <span className="badge success"><ShieldCheck size={12} /> Verified</span>}
                {l.status === 'unverified' && <span className="badge warn">Unverified · {l.verify_count}/3 confirmations</span>}
                {l.status === 'hidden' && <span className="badge danger">Hidden after {l.flag_count} flags</span>}
                {l.flag_count > 0 && l.status !== 'hidden' && <span className="badge danger"><Flag size={12} /> {l.flag_count} flag{l.flag_count === 1 ? '' : 's'}</span>}
                {l.photo_count === 0 && <span className="badge">No photos</span>}
              </div>
              <a className="listing-name" href={href(`/listing/${l.id}`)}>{l.name}</a>
              <div className="muted small">{l.address}</div>
              <div className="small" style={{ marginTop: 4 }}>
                {TYPE_LABEL[l.listing_type]} · <b>{rupees(l.rent_min)}</b>{l.rent_max ? ` – ${rupees(l.rent_max)}` : ''} / month
                · <span className="muted">updated {new Date(l.updated_at).toLocaleDateString('en-IN')}</span>
              </div>
            </div>
            <div className="listing-actions">
              <label className="switch-row" title="Students only see listings with rooms available when they filter for it">
                <span>{l.vacancy ? 'Rooms available' : 'Full'}</span>
                <input type="checkbox" checked={!!l.vacancy} onChange={() => toggle(l)} /><span className="switch" />
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <a className="btn sm" href={href(`/edit/${l.id}`)}><Pencil size={13} /> Edit</a>
                <button type="button" className="btn sm" onClick={() => remove(l)}><Trash2 size={13} /> Remove</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div></div>
  )
}
