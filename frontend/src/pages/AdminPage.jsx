import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth'
import { href } from '../router'
import { rupees } from '../format'

export default function AdminPage({ onNeedSignIn }) {
  const { user, ready } = useAuth()
  const [stats, setStats] = useState(null)
  const [flagged, setFlagged] = useState(null)
  const [users, setUsers] = useState(null)
  const [cov, setCov] = useState(null)
  const [pending, setPending] = useState(null)
  const [claims, setClaims] = useState(null)
  const [error, setError] = useState(null)

  const load = () => {
    api.adminStats().then(setStats).catch((e) => setError(e.message))
    api.adminCoverage().then(setCov).catch(() => {})
    api.adminFlagged().then(setFlagged).catch(() => {})
    api.adminUsers().then(setUsers).catch(() => {})
    api.adminPending().then(setPending).catch(() => {})
    api.adminClaims().then(setClaims).catch(() => {})
  }
  const decidePending = async (id, decision) => {
    if (decision === 'reject' && !window.confirm('Reject and delete this pending listing?')) return
    try { await api.adminDecidePending(id, decision); load() } catch (e) { setError(e.message) }
  }
  const decideClaim = async (id, decision) => {
    try { await api.adminDecideClaim(id, decision); load() } catch (e) { setError(e.message) }
  }
  useEffect(() => { if (user?.role === 'admin') load() }, [user])

  if (!ready) return <div className="page"><div className="state">Loading…</div></div>
  if (!user || user.role !== 'admin') {
    return (
      <div className="page"><div className="page-inner narrow"><div className="card center">
        <h1 className="page-title">Admin</h1>
        <p className="muted">{user ? 'Your account is not an admin.' : 'Sign in with an admin account.'}</p>
        {!user && <button type="button" className="btn primary" onClick={onNeedSignIn} style={{ marginTop: 12 }}>Sign in</button>}
      </div></div></div>
    )
  }

  const setStatus = async (id, status) => {
    try { await api.adminSetStatus(id, status); load() } catch (e) { setError(e.message) }
  }

  return (
    <div className="page"><div className="page-inner">
      <div className="page-head">
        <div>
          <h1 className="page-title">Admin</h1>
          <p className="muted">Approvals, ownership claims, flags and data coverage for the whole map.</p>
        </div>
        <a className="btn" href={href('/')}>Back to map</a>
      </div>
      {error && <p className="form-error">{error}</p>}

      {stats && (
        <div className="stat-grid">
          <Stat label="Listings" value={stats.listings} />
          <Stat label="Verified" value={stats.verified} cls="good" />
          <Stat label="Unverified" value={stats.unverified} cls="mid" />
          <Stat label="Hidden" value={stats.hidden} cls="bad" />
          <Stat label="Awaiting approval" value={stats.pending} cls="mid" />
          <Stat label="Owner claims" value={stats.claims_pending} cls="mid" />
          <Stat label="Open flags" value={stats.flagged_open} />
          <Stat label="Stale (90d+)" value={stats.stale} />
          <Stat label="Users" value={stats.users} />
          <Stat label="Safety reports" value={stats.safety_reports} />
        </div>
      )}
      {stats?.by_source && (
        <p className="muted small" style={{ margin: '8px 0 20px' }}>
          By source: {Object.entries(stats.by_source).map(([k, v]) => `${k} ${v}`).join(' · ')}
        </p>
      )}

      <section className="card">
        <h3>New listings awaiting approval</h3>
        <p className="muted small" style={{ marginBottom: 10 }}>From accounts that have not had a listing approved yet. Approving also marks the account trusted, so its later listings go live directly.</p>
        {pending == null && <div className="state">Loading…</div>}
        {pending?.length === 0 && <p className="muted">Nothing waiting.</p>}
        {pending?.length > 0 && (
          <table className="admin">
            <thead><tr><th>Listing</th><th>Owner</th><th>Rent</th><th>Actions</th></tr></thead>
            <tbody>
              {pending.map((l) => (
                <tr key={l.id}>
                  <td><b>{l.name}</b><br /><span className="muted small">{l.address} · {l.listing_type} · {l.photos} photo{l.photos === 1 ? '' : 's'} · {new Date(l.created_at).toLocaleDateString('en-IN')}</span></td>
                  <td className="small">{l.owner_name}<br /><span className="muted">{l.owner_email}{l.owner_phone ? ` · ${l.owner_phone}` : ''}</span><br /><span className="muted">joined {new Date(l.owner_since).toLocaleDateString('en-IN')}</span></td>
                  <td>{rupees(l.rent_min)}</td>
                  <td><div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="btn sm primary" onClick={() => decidePending(l.id, 'approve')}>Approve</button>
                    <button type="button" className="btn sm" onClick={() => decidePending(l.id, 'reject')}>Reject</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h3>Ownership claims on imported places</h3>
        <p className="muted small" style={{ marginBottom: 10 }}>Call the number already listed for the place and check the claimant runs it before approving.</p>
        {claims == null && <div className="state">Loading…</div>}
        {claims?.length === 0 && <p className="muted">No claims yet.</p>}
        {claims?.length > 0 && (
          <table className="admin">
            <thead><tr><th>Listing</th><th>Claimed by</th><th>Phones</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {claims.map((c) => (
                <tr key={c.id}>
                  <td><a href={href(`/listing/${c.listing_id}`)}>{c.listing_name}</a><br /><span className="muted small">{c.address} · from {c.source}</span></td>
                  <td className="small">{c.user_name}<br /><span className="muted">{c.user_email}</span></td>
                  <td className="small">listed: {c.listed_phone || <span className="muted">none</span>}<br />claimed: {c.claimed_phone}</td>
                  <td><span className={`badge ${c.status === 'approved' ? 'success' : c.status === 'rejected' ? 'danger' : 'warn'}`}>{c.status}</span></td>
                  <td>{c.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="btn sm primary" onClick={() => decideClaim(c.id, 'approve')}>Approve</button>
                      <button type="button" className="btn sm" onClick={() => decideClaim(c.id, 'reject')}>Reject</button>
                    </div>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {cov && <Coverage cov={cov} />}

      <section className="card">
        <h3>Flagged and hidden listings</h3>
        {flagged == null && <div className="state">Loading…</div>}
        {flagged?.length === 0 && <p className="muted">Nothing flagged. Nice.</p>}
        {flagged?.length > 0 && (
          <table className="admin">
            <thead><tr><th>Listing</th><th>Status</th><th>Flags</th><th>Owner</th><th>Actions</th></tr></thead>
            <tbody>
              {flagged.map((l) => (
                <tr key={l.id}>
                  <td><a href={href(`/listing/${l.id}`)}>{l.name}</a><br /><span className="muted small">{l.address} · {rupees(l.rent_min)}</span></td>
                  <td><span className={`badge ${l.status === 'verified' ? 'success' : l.status === 'hidden' ? 'danger' : 'warn'}`}>{l.status}</span></td>
                  <td>{l.flag_count} <span className="muted small">/ {l.verify_count} ok</span>
                    {l.actions?.length > 0 && <div className="muted small">{l.actions.filter((a) => a.action === 'flag' && a.value).map((a) => a.value).join('; ')}</div>}</td>
                  <td className="small">{l.owner_name || <span className="muted">{l.source}</span>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {l.status !== 'verified' && <button type="button" className="btn sm" onClick={() => setStatus(l.id, 'verified')}>Verify</button>}
                      {l.status !== 'hidden' && <button type="button" className="btn sm" onClick={() => setStatus(l.id, 'hidden')}>Hide</button>}
                      {l.status === 'hidden' && <button type="button" className="btn sm" onClick={() => setStatus(l.id, 'unverified')}>Restore</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h3>Accounts</h3>
        {users?.length > 0 ? (
          <table className="admin">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Listings</th><th>Joined</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}><td>{u.name}</td><td className="small">{u.email}</td><td><span className="badge">{u.role}</span></td><td>{u.listings}</td><td className="small muted">{new Date(u.created_at).toLocaleDateString('en-IN')}</td></tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted">No accounts yet.</p>}
      </section>
    </div></div>
  )
}

function Coverage({ cov }) {
  const k = cov.completeness
  const pct = (n) => (k.listings ? Math.round((100 * n) / k.listings) : 0)
  const bars = [
    ['Phone number', k.with_phone], ['Rent confirmed', k.rent_confirmed], ['Boys / girls known', k.gender_known],
    ['Amenities known', k.amenities_known], ['Photos', k.with_photos], ['Verified by 3 people', k.verified],
    ['Found in two open datasets', k.in_two_sources],
  ]
  const ro = cov.rent_observations || {}
  return (
    <section className="card">
      <h3>Data coverage: what is still missing</h3>
      <div className="cov-bars">
        {bars.map(([label, n]) => (
          <div className="cov-row" key={label}>
            <span className="cov-label">{label}</span>
            <span className="cov-track"><span className="cov-fill" style={{ width: `${pct(n)}%` }} /></span>
            <span className="cov-num">{n} / {k.listings}</span>
          </div>
        ))}
      </div>
      <p className="muted small" style={{ margin: '10px 0 16px' }}>
        Past flat rents: {(ro.building || 0) + (ro.locality || 0)} real 2021 rents, {ro.building || 0} placed on a named building.
      </p>

      {cov.thin_localities?.length > 0 && (
        <>
          <h3 style={{ marginTop: 8 }}>Localities with demand but few listings (2 km)</h3>
          <table className="admin">
            <thead><tr><th>Locality</th><th>Colleges</th><th>Offices</th><th>Listings</th><th>Past flat rents</th></tr></thead>
            <tbody>
              {cov.thin_localities.map((r) => (
                <tr key={r.locality}><td>{r.locality}</td><td>{r.colleges}</td><td>{r.offices}</td><td><b>{r.listings}</b></td><td>{r.past_flat_rents}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {cov.colleges_without_listings_1500m?.length > 0 && (
        <p className="small" style={{ marginTop: 12 }}>
          <b>{cov.colleges_without_listings_1500m.length}</b> of {cov.colleges_total} colleges have no listing within 1.5 km, for example{' '}
          {cov.colleges_without_listings_1500m.slice(0, 6).map((c) => c.name).join(', ')}.
        </p>
      )}
    </section>
  )
}

function Stat({ label, value, cls = '' }) {
  return (
    <div className={`stat ${cls}`}>
      <div className="stat-value">{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}
