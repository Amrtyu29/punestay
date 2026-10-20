import { useEffect, useState } from 'react'
import {
  Bus, Car, Flag, Heart, Hospital, Home, ImageOff, Landmark, MapPin, Navigation, Phone, Pill, Shield, ShieldCheck,
  ShoppingBasket, TrainFront, Users, Utensils, X,
} from 'lucide-react'
import { hueFor } from './ListingCard'
import { api } from '../api/client'
import { locateDevice } from '../geo'
import { CATEGORY_LABEL, GENDER_LABEL, TYPE_LABEL, metres, minutes, rupees, safetyLevel } from '../format'

const CATEGORY_ICON = {
  bus_stop: Bus, metro: TrainFront, mess: Utensils, hospital: Hospital,
  pharmacy: Pill, atm: Landmark, grocery: ShoppingBasket, police: Shield,
}

export default function ListingDrawer({ id, onClose, destination, route, routeBusy, onShowRoute, onHideRoute, commute, user, onSignIn, onChanged, saved, onToggleSave }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (id == null) return
    if (reload === 0) setData(null)
    setError(null)
    let cancelled = false
    api.listing(id).then((d) => !cancelled && setData(d)).catch((e) => !cancelled && setError(e.message))
    return () => { cancelled = true }
  }, [id, reload])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (id == null) return null

  return (
    <aside className="drawer" role="dialog" aria-label="Listing details">
      <button type="button" className="btn icon drawer-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
      {error && <div className="state error">{error}</div>}
      {!data && !error && <Skeleton />}
      {data && (
        <Detail
          data={data} destination={destination} route={route} routeBusy={routeBusy}
          onShowRoute={onShowRoute} onHideRoute={onHideRoute} commute={commute}
          user={user} onSignIn={onSignIn} saved={saved} onToggleSave={onToggleSave}
          onChanged={() => { setReload((r) => r + 1); onChanged?.() }}
        />
      )}
    </aside>
  )
}

/** Verify / flag / suggest-rent controls, plus an Edit link for the owner. */
function CommunityActions({ listing, user, onSignIn, onChanged }) {
  const [mine, setMine] = useState([])
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)
  const [rentOpen, setRentOpen] = useState(false)
  const [rent, setRent] = useState('')

  useEffect(() => {
    if (!user) { setMine([]); return }
    api.myActions(listing.id).then((a) => setMine(a.map((x) => x.action))).catch(() => {})
  }, [user, listing.id])

  const isOwner = user && listing.owner_id === user.id
  const claimable = !!user && listing.owner_id == null && (listing.source === 'osm' || listing.source === 'overture')
  const [claimOpen, setClaimOpen] = useState(false)
  const [claim, setClaim] = useState(null)       // my existing claim, if any
  const [claimPhone, setClaimPhone] = useState(user?.phone || '')
  useEffect(() => {
    if (!claimable) { setClaim(null); return }
    api.myClaim(listing.id).then(setClaim).catch(() => {})
  }, [claimable, listing.id])

  const act = async (fn, name, done) => {
    if (!user) { onSignIn(); return }
    setBusy(name); setMsg(null)
    try {
      const r = await fn()
      setMine((m) => (m.includes(name) ? m : [...m, name]))
      setMsg(done(r))
      onChanged()
    } catch (e) { setMsg(e.message) } finally { setBusy(null) }
  }

  // "I have seen it" needs the phone's location: the server accepts it only from within 300 m.
  const verifyHere = () => act(async () => {
    setMsg('Checking your location…')
    const device = await locateDevice()
    return api.verify(listing.id, device)
  }, 'verify', (r) => `Thanks. ${r.verify_count}/3 confirmations${r.status === 'verified' ? ', now verified' : ''}.`)

  if (isOwner || user?.role === 'admin') {
    return (
      <section>
        <h3>{isOwner ? 'Your listing' : 'Admin'}</h3>
        <div className="actions-row">
          <a className="btn sm" href={`#/edit/${listing.id}`}>Edit details</a>
          {isOwner && <a className="btn sm" href="#/mine">Mark full / available</a>}
        </div>
      </section>
    )
  }

  return (
    <section>
      <h3>Is this right?</h3>
      <div className="actions-row">
        <button type="button" className="btn sm" disabled={busy || mine.includes('verify')} onClick={verifyHere}
                title="Only counts when your phone is within 300 m of the place">
          <ShieldCheck size={14} /> {mine.includes('verify') ? 'You confirmed it' : 'I am here, it is real'}
        </button>
        <button type="button" className="btn sm" disabled={busy || mine.includes('flag')}
                onClick={() => act(() => api.flag(listing.id, 'wrong or closed'), 'flag', (r) => (r.status === 'hidden' ? 'Hidden after 3 flags. Thanks.' : `Flagged (${r.flag_count}/3). Thanks.`))}>
          <Flag size={14} /> {mine.includes('flag') ? 'You flagged it' : 'Wrong or closed'}
        </button>
        <button type="button" className="btn sm ghost" onClick={() => (user ? setRentOpen((o) => !o) : onSignIn())}>Suggest rent</button>
      </div>
      {rentOpen && (
        <form className="inline-form" onSubmit={(e) => { e.preventDefault(); act(() => api.rentUpdate(listing.id, Number(rent), null), 'rent_update', (r) => (r.applied ? `Rent updated to ₹${r.applied.rent_min.toLocaleString('en-IN')} (two people agree).` : 'Noted. Applied once another person confirms.')); setRentOpen(false) }}>
          <input className="input" type="number" min={500} max={500000} step={100} required placeholder="Actual rent ₹" value={rent} onChange={(e) => setRent(e.target.value)} />
          <button type="submit" className="btn sm primary" disabled={busy}>Send</button>
        </form>
      )}
      {msg && <p className="ok-note">{msg}</p>}
      {!user && <p className="muted small" style={{ marginTop: 6 }}>Sign in to confirm or flag listings. Confirming works only from the place itself.</p>}
      {user && !mine.includes('verify') && <p className="muted small" style={{ marginTop: 6 }}>Confirming uses your phone's location and counts only within 300 m of the place.</p>}

      {claimable && (
        <div style={{ marginTop: 12 }}>
          {claim ? (
            <p className="muted small">
              {claim.status === 'pending' && 'Your ownership claim is waiting for an admin to call and confirm.'}
              {claim.status === 'approved' && 'Your claim was approved.'}
              {claim.status === 'rejected' && 'Your claim was not approved. Flag the listing if the details are wrong.'}
            </p>
          ) : claimOpen ? (
            <form className="inline-form" style={{ flexWrap: 'wrap' }} onSubmit={(e) => {
              e.preventDefault()
              act(() => api.claim(listing.id, { phone: claimPhone.trim(), note: null }), 'claim', (r) => r.message)
                .then(() => { setClaim({ status: 'pending' }); setClaimOpen(false) })
            }}>
              <input className="input" type="tel" required pattern="[0-9+\- ]{8,15}" placeholder="Your phone number" value={claimPhone} onChange={(e) => setClaimPhone(e.target.value)} style={{ flex: 1 }} />
              <button type="submit" className="btn sm primary" disabled={busy}>Send claim</button>
              <span className="muted small" style={{ width: '100%' }}>An admin calls the number already listed for this place to confirm you run it.</span>
            </form>
          ) : (
            <button type="button" className="btn sm ghost" onClick={() => setClaimOpen(true)}>This is my PG, I run it</button>
          )}
        </div>
      )}
    </section>
  )
}

function CommuteCard({ destination, route, routeBusy, onShowRoute, onHideRoute, commute }) {
  if (!destination) return null
  const secs = route?.duration_s ?? commute?.commute_s
  const dist = route?.distance_m ?? commute?.commute_m
  return (
    <div className="commute-card" style={{ alignItems: 'flex-start' }}>
      <Navigation size={16} className="ico" style={{ marginTop: 2 }} />
      <span className="main" style={{ flex: 1, minWidth: 0 }}>
        <div className="name" style={{ fontWeight: 600, fontSize: 13 }}>To {destination.name}</div>
        <div style={{ fontSize: 13, marginTop: 2 }}>
          {secs != null ? <><b>{minutes(secs)}</b> by road · {metres(dist)}</> : <span className="muted">Travel time not available</span>}
        </div>
      </span>
      {route
        ? <button type="button" className="btn sm" onClick={onHideRoute}>Hide route</button>
        : <button type="button" className="btn sm primary" onClick={onShowRoute} disabled={routeBusy}>{routeBusy ? 'Routing…' : 'Show route'}</button>}
    </div>
  )
}

function Detail({ data, destination, route, routeBusy, onShowRoute, onHideRoute, commute, user, onSignIn, onChanged, saved, onToggleSave }) {
  const l = data.listing
  const safety = safetyLevel(l.safety_score)
  // Imported from an open dataset and not yet claimed: gender / food are unknown, not "no".
  const imported = (l.source === 'osm' || l.source === 'overture') && l.owner_id == null
  const amenities = Array.isArray(l.amenities) ? l.amenities : []
  const nearbyCats = Object.keys(data.nearby || {}).filter((c) => data.nearby[c]?.length)

  return (
    <>
      <div className="drawer-scroll">
        <Hero photos={data.photos} listing={l} saved={saved} onToggleSave={onToggleSave} />
        <div className="drawer-body">
          <div>
            <div className="badges">
              {l.status === 'verified'
                ? <span className="badge success"><ShieldCheck size={12} /> Verified</span>
                : <span className="badge warn">Unverified</span>}
              {l.vacancy != null && <span className={`badge ${l.vacancy ? 'success' : 'danger'}`}>{l.vacancy ? 'Rooms available' : 'Currently full'}</span>}
              {l.stale && <span className="badge">May be outdated</span>}
              {imported && <span className="badge">From {l.source === 'osm' ? 'OpenStreetMap' : 'Overture Maps'}</span>}
            </div>
            <h2 className="title" style={{ marginTop: 10 }}>{l.name}</h2>
            <div className="address"><MapPin size={14} /><span>{l.address}</span></div>
          </div>

          <CommuteCard destination={destination} route={route} routeBusy={routeBusy} onShowRoute={onShowRoute} onHideRoute={onHideRoute} commute={commute} />

          {l.rent_min != null ? (
            <div className="price-block">
              <span className="price">{rupees(l.rent_min)}</span>
              {l.rent_max && l.rent_max !== l.rent_min && <span className="price-unit">– {rupees(l.rent_max)}</span>}
              <span className="price-unit">/ month</span>
              {l.deposit != null && <span className="price-deposit">Deposit {rupees(l.deposit)}</span>}
            </div>
          ) : (
            <div className="price-block">
              <span className="price" style={{ fontSize: 18 }}>Rent not published</span>
              <span className="price-deposit">
                {data.contact_phone ? 'Call to ask the current rent.' : 'Ask the owner for the current rent.'} Know it? Use “Suggest rent” below.
              </span>
            </div>
          )}

          <div className="facts">
            <Fact icon={Home} k="Type" v={TYPE_LABEL[l.listing_type] || l.listing_type} />
            <Fact icon={Users} k="For" v={imported && l.gender === 'any' ? 'Not stated' : (GENDER_LABEL[l.gender] || l.gender)} />
            <Fact icon={Utensils} k="Food" v={l.food_included ? 'Included' : imported ? 'Not stated' : 'Not included'} />
            <Fact icon={ShieldCheck} k="Night safety" v={safety.text} cls={safety.cls} />
          </div>

          {amenities.length > 0 && (
            <section>
              <h3>Amenities</h3>
              <div className="chip-list">{amenities.map((a) => <span key={a} className="chip">{a}</span>)}</div>
            </section>
          )}

          {data.commutes?.length > 0 && (
            <section>
              <h3>Travel time</h3>
              <div className="rows">
                {data.commutes.map((c) => (
                  <div className="row" key={`${c.id}-${c.mode}`}>
                    <span className="ico"><Car size={16} /></span>
                    <span className="main"><div className="v">{c.name}</div><div className="k">{metres(c.distance_m)} by road</div></span>
                    <span className="end"><b>{minutes(c.duration_s)}</b></span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <CommunityActions listing={l} user={user} onSignIn={onSignIn} onChanged={onChanged} />

          <section>
            <h3>Nearby</h3>
            {nearbyCats.length === 0
              ? <p className="muted small">Nothing within 3 km in the database yet.</p>
              : (
                <div className="rows">
                  {nearbyCats.map((c) => {
                    const first = data.nearby[c][0]
                    const Icon = CATEGORY_ICON[c] || MapPin
                    return (
                      <div className="row" key={c}>
                        <span className="ico"><Icon size={16} /></span>
                        <span className="main"><div className="k">{CATEGORY_LABEL[c] || c}</div><div className="v">{first.name || 'Unnamed'}</div></span>
                        <span className="end">{metres(first.distance_m)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
          </section>
        </div>
      </div>

      {(data.contact_phone || /^https?:\/\//i.test(l.website || '')) && (
        <div className="drawer-footer" style={{ display: 'flex', gap: 8 }}>
          {data.contact_phone && (
            <a className="btn primary block" href={`tel:${data.contact_phone}`}><Phone size={16} /> Call {data.contact_phone}</a>
          )}
          {/^https?:\/\//i.test(l.website || '') && (
            <a className="btn block" href={l.website} target="_blank" rel="noreferrer noopener">Website</a>
          )}
        </div>
      )}
    </>
  )
}

function Fact({ icon: Icon, k, v, cls = '' }) {
  return (
    <div className={`fact ${cls}`}>
      <Icon size={18} className="ico" />
      <span><div className="k">{k}</div><div className="v">{v}</div></span>
    </div>
  )
}

function Hero({ photos, listing, saved, onToggleSave }) {
  const [idx, setIdx] = useState(0)
  const heart = (
    <button type="button" className={`heart hero-heart${saved ? ' on' : ''}`} aria-pressed={!!saved} aria-label={saved ? 'Remove from saved' : 'Save'} onClick={onToggleSave}>
      <Heart size={18} />
    </button>
  )
  if (!photos?.length) {
    const initials = (listing.name || '?').replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
    return (
      <div className="hero hero-empty" style={{ '--h': hueFor(listing.id) }}>
        <span className="hero-initials">{initials}</span>
        <span className="hero-note"><ImageOff size={13} /> No photos yet</span>
        {heart}
      </div>
    )
  }
  const n = photos.length
  return (
    <div className="hero">
      <div className="strip" onScroll={(e) => setIdx(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
        {photos.map((p) => <img key={p.id} src={p.url} alt="" loading="lazy" />)}
      </div>
      {n > 1 && <div className="hero-dots">{photos.map((p, i) => <i key={p.id} className={i === idx ? 'on' : ''} />)}</div>}
      {heart}
      <span className="badge photo-count">{photos.length} photo{photos.length === 1 ? '' : 's'}</span>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="drawer-scroll" aria-busy="true">
      <div className="hero skeleton" style={{ borderRadius: 0 }} />
      <div className="drawer-body">
        <div className="skeleton" style={{ height: 22, width: 160 }} />
        <div className="skeleton" style={{ height: 28, width: '80%' }} />
        <div className="skeleton" style={{ height: 32, width: 140 }} />
        <div className="facts">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 56 }} />)}
        </div>
        <div className="skeleton" style={{ height: 120 }} />
      </div>
    </div>
  )
}
