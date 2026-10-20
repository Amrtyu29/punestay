import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { api } from '../api/client'
import { useFavorites } from '../favorites'
import ListingCard from '../components/ListingCard'
import { href, navigate } from '../router'

/** Places the viewer saved with the heart button (stored in this browser). */
export default function SavedPage() {
  const fav = useFavorites()
  const [rows, setRows] = useState(null)
  const [gone, setGone] = useState(0)

  useEffect(() => {
    let cancelled = false
    if (!fav.ids.length) { setRows([]); return }
    Promise.all(fav.ids.map((id) => api.listing(id).then((d) => ({ ...d.listing, photo_url: d.photos?.[0]?.url })).catch(() => null)))
      .then((list) => { if (!cancelled) { setRows(list.filter(Boolean)); setGone(list.filter((x) => !x).length) } })
    return () => { cancelled = true }
  }, [fav.ids])

  return (
    <div className="page reveal"><div className="page-inner">
      <div className="page-head">
        <div>
          <h1 className="page-title">Saved places</h1>
          <p className="muted">Your shortlist, kept in this browser. {rows?.length ? `${rows.length} place${rows.length === 1 ? '' : 's'}.` : ''}</p>
        </div>
        <a className="btn" href={href('/')}>Back to map</a>
      </div>
      {rows == null && <div className="card-grid">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 260, borderRadius: 16 }} />)}</div>}
      {rows?.length === 0 && (
        <div className="card center empty-state">
          <span className="empty-icon"><Heart size={26} /></span>
          <h3 style={{ textTransform: 'none', letterSpacing: 0, fontSize: 18, color: 'var(--text)' }}>Nothing saved yet</h3>
          <p className="muted">Tap the heart on any place to keep it here.</p>
          <a className="btn primary" href={href('/')} style={{ marginTop: 12 }}>Explore the map</a>
        </div>
      )}
      {rows?.length > 0 && (
        <div className="card-grid">
          {rows.map((l) => (
            <ListingCard key={l.id} l={l} saved onToggleSave={fav.toggle} onSelect={(id) => navigate(`/listing/${id}`)} />
          ))}
        </div>
      )}
      {gone > 0 && <p className="muted small" style={{ marginTop: 12 }}>{gone} saved place{gone === 1 ? ' is' : 's are'} no longer listed.</p>}
    </div></div>
  )
}
