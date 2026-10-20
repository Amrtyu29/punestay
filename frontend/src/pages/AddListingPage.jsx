import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ImagePlus, LocateFixed, X } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../auth'
import PinMap from '../components/PinMap'
import { navigate } from '../router'
import { rupees } from '../format'

const AMENITIES = ['wifi', 'ac', 'laundry', 'parking', 'lift', 'security', 'mess', 'geyser', 'cctv', 'power_backup', 'housekeeping', 'wheelchair']
const LABEL = { power_backup: 'Power backup', ac: 'AC', cctv: 'CCTV', wifi: 'Wi-Fi' }

const EMPTY = {
  name: '', address: '', listing_type: 'pg', gender: 'any', rent_min: '', rent_max: '', deposit: '',
  food_included: false, amenities: [], contact_phone: '', website: '', vacancy: true,
}

/** Add a new listing, or edit one (`editId`). */
export default function AddListingPage({ editId, onNeedSignIn }) {
  const { user, ready } = useAuth()
  const [form, setForm] = useState(EMPTY)
  const [pin, setPin] = useState(null)
  const [addressTouched, setAddressTouched] = useState(false)
  const [photos, setPhotos] = useState([])        // File objects (new)
  const [existingPhotos, setExistingPhotos] = useState([])
  const [dupes, setDupes] = useState([])
  const [geoBusy, setGeoBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [loaded, setLoaded] = useState(!editId)
  const pendingSubmit = useRef(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  // Edit mode: load the listing through the owner endpoint (works for hidden listings too).
  useEffect(() => {
    if (!editId || !ready) return
    if (!user) { setLoaded(true); return }
    api.listingForEdit(editId).then((l) => {
      setForm({
        name: l.name, address: l.address, listing_type: l.listing_type, gender: l.gender,
        rent_min: l.rent_min ?? '', rent_max: l.rent_max ?? '', deposit: l.deposit ?? '',
        food_included: !!l.food_included, amenities: l.amenities || [], contact_phone: l.contact_phone || '',
        website: l.website || '', vacancy: !!l.vacancy,
      })
      setPin({ lat: l.lat, lng: l.lng })
      setExistingPhotos(l.photos || [])
      setAddressTouched(true)
      setLoaded(true)
    }).catch((e) => { setError(e.message); setLoaded(true) })
  }, [editId, ready, user])

  // Reverse geocode when the pin moves and the user has not typed an address.
  useEffect(() => {
    if (!pin || addressTouched) return
    let cancelled = false
    const t = setTimeout(() => {
      api.reverseGeocode(pin.lat, pin.lng).then((r) => { if (!cancelled && r.display) setForm((f) => ({ ...f, address: r.display })) }).catch(() => {})
    }, 400)
    return () => { cancelled = true; clearTimeout(t) }
  }, [pin, addressTouched])

  // Duplicate check near the pin.
  useEffect(() => {
    if (!pin) { setDupes([]); return }
    let cancelled = false
    const t = setTimeout(() => {
      api.near(pin.lat, pin.lng, form.name.trim() || undefined)
        .then((r) => { if (!cancelled) setDupes((r.matches || []).filter((m) => String(m.id) !== String(editId))) })
        .catch(() => {})
    }, 500)
    return () => { cancelled = true; clearTimeout(t) }
  }, [pin, form.name, editId])

  const locate = async () => {
    if (!form.address.trim()) return
    setGeoBusy(true); setError(null)
    try {
      const r = await api.geocode(form.address.trim())
      setPin({ lat: r.lat, lng: r.lng })
    } catch (e) { setError(e.message) } finally { setGeoBusy(false) }
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((p) => setPin({ lat: p.coords.latitude, lng: p.coords.longitude }), () => setError('Could not read your location'))
  }

  const toggleAmenity = (a) => setForm((f) => ({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a] }))

  const addPhotos = (files) => {
    const imgs = [...files].filter((f) => f.type.startsWith('image/'))
    setPhotos((p) => [...p, ...imgs].slice(0, 5 - existingPhotos.length))
  }

  const submit = async (e) => {
    e?.preventDefault()
    setError(null)
    if (!pin) { setError('Drop the pin on the map where the place is.'); return }
    if (!user) { pendingSubmit.current = true; onNeedSignIn(); return }
    setBusy(true)
    try {
      const body = {
        name: form.name.trim(), address: form.address.trim(), lat: pin.lat, lng: pin.lng,
        listing_type: form.listing_type, gender: form.gender,
        rent_min: Number(form.rent_min), rent_max: form.rent_max ? Number(form.rent_max) : null,
        deposit: form.deposit ? Number(form.deposit) : null, food_included: form.food_included,
        amenities: form.amenities, contact_phone: form.contact_phone.trim() || null,
        website: form.website.trim() || null, vacancy: form.vacancy,
      }
      const saved = editId ? await api.updateListing(editId, body) : await api.createListing(body)
      if (photos.length) await api.uploadPhotos(saved.id, photos)
      // New accounts' listings wait for admin approval and are not on the public map yet.
      navigate(saved.status === 'pending' ? '/mine' : `/listing/${saved.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // After signing in from the submit button, continue the submit.
  useEffect(() => {
    if (user && pendingSubmit.current) { pendingSubmit.current = false; submit() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  if (!ready || !loaded) return <div className="page"><div className="state">Loading…</div></div>
  if (editId && !user) {
    return (
      <div className="page"><div className="page-inner narrow"><div className="card center">
        <p>Sign in with the account that added this listing to edit it.</p>
        <button type="button" className="btn primary" onClick={onNeedSignIn} style={{ marginTop: 12 }}>Sign in</button>
      </div></div></div>
    )
  }
  if (editId && error && !form.name) {
    return (
      <div className="page"><div className="page-inner narrow"><div className="card center">
        <p className="form-error">{error}</p>
        <a className="btn" href="#/mine" style={{ marginTop: 12 }}>Back to my listings</a>
      </div></div></div>
    )
  }

  return (
    <div className="page">
      <form className="page-inner form-grid" onSubmit={submit}>
        <div className="form-col">
          <div className="page-head"><div>
          <h1 className="page-title">{editId ? 'Edit listing' : 'Add a PG, hostel or flat'}</h1>
          <p className="muted">
            {!user
              ? <>You will be asked to sign in when you submit. A new account's first listing is checked by an admin before it appears on the map; after that, listings go live right away as <span className="badge warn">Unverified</span>.</>
              : !user.trusted
              ? <>Because your account is new, an admin checks your first listing before it appears on the map. After that, your listings go live right away.</>
              : <>It appears on the map right away as <span className="badge warn">Unverified</span>. Once three students confirm it from the spot, it becomes verified.</>}
          </p>
          </div></div>

          <section className="card">
            <h3>Basics</h3>
            <label className="field"><span className="field-label">Name of the place</span>
              <input className="input" required minLength={3} maxLength={120} value={form.name} onChange={set('name')} placeholder="e.g. Shree Sai Girls PG" /></label>
            <div className="row2">
              <label className="field"><span className="field-label">Type</span>
                <select className="input" value={form.listing_type} onChange={set('listing_type')}>
                  <option value="pg">PG</option><option value="hostel">Hostel</option><option value="flat">Flat</option>
                </select></label>
              <label className="field"><span className="field-label">For</span>
                <select className="input" value={form.gender} onChange={set('gender')}>
                  <option value="any">Anyone</option><option value="male">Boys only</option><option value="female">Girls only</option>
                </select></label>
            </div>
          </section>

          <section className="card">
            <h3>Rent</h3>
            <div className="row2">
              <label className="field"><span className="field-label">Rent per month (₹) *</span>
                <input className="input" type="number" required min={500} max={500000} step={100} value={form.rent_min} onChange={set('rent_min')} placeholder="7000" /></label>
              <label className="field"><span className="field-label">Up to (₹, optional)</span>
                <input className="input" type="number" min={500} max={500000} step={100} value={form.rent_max} onChange={set('rent_max')} placeholder="9000" /></label>
            </div>
            <div className="row2">
              <label className="field"><span className="field-label">Deposit (₹)</span>
                <input className="input" type="number" min={0} step={500} value={form.deposit} onChange={set('deposit')} placeholder="10000" /></label>
              <div className="field"><span className="field-label">&nbsp;</span>
                <label className="switch-row" style={{ padding: '6px 0' }}><span>Food included</span>
                  <input type="checkbox" checked={form.food_included} onChange={set('food_included')} /><span className="switch" /></label></div>
            </div>
          </section>

          <section className="card">
            <h3>Amenities</h3>
            <div className="chip-list">
              {AMENITIES.map((a) => (
                <button type="button" key={a} className={`chip choice${form.amenities.includes(a) ? ' on' : ''}`} onClick={() => toggleAmenity(a)}>
                  {LABEL[a] || a.replace('_', ' ')}
                </button>
              ))}
            </div>
          </section>

          <section className="card">
            <h3>Contact</h3>
            <div className="row2">
              <label className="field"><span className="field-label">Phone students can call</span>
                <input className="input" type="tel" pattern="[0-9+\- ]{8,15}" value={form.contact_phone} onChange={set('contact_phone')} placeholder="98xxxxxxxx" /></label>
              <label className="field"><span className="field-label">Website or Instagram (optional)</span>
                <input className="input" type="url" value={form.website} onChange={set('website')} placeholder="https://" /></label>
            </div>
            <label className="switch-row"><span>Rooms available right now</span>
              <input type="checkbox" checked={form.vacancy} onChange={set('vacancy')} /><span className="switch" /></label>
          </section>

          <section className="card">
            <h3>Photos <span className="muted" style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· up to 5</span></h3>
            <div className="photo-grid">
              {existingPhotos.map((p) => (
                <div className="thumb" key={`e${p.id}`}>
                  <img src={p.url} alt="" />
                  <button type="button" className="thumb-x" aria-label="Remove" onClick={async () => { await api.deletePhoto(editId, p.id).catch(() => {}); setExistingPhotos((x) => x.filter((q) => q.id !== p.id)) }}><X size={12} /></button>
                </div>
              ))}
              {photos.map((f, i) => (
                <div className="thumb" key={`n${i}`}>
                  <img src={URL.createObjectURL(f)} alt="" onLoad={(e) => URL.revokeObjectURL(e.target.src)} />
                  <button type="button" className="thumb-x" aria-label="Remove" onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}><X size={12} /></button>
                </div>
              ))}
              {existingPhotos.length + photos.length < 5 && (
                <label className="thumb add">
                  <ImagePlus size={20} /><span>Add</span>
                  <input type="file" accept="image/*" multiple hidden onChange={(e) => { addPhotos(e.target.files); e.target.value = '' }} />
                </label>
              )}
            </div>
          </section>
        </div>

        <div className="map-col">
          <section className="card sticky">
            <h3>Where is it?</h3>
            <label className="field"><span className="field-label">Address</span>
              <div className="input-row">
                <input className="input" required minLength={5} maxLength={300} value={form.address}
                       onChange={(e) => { setAddressTouched(true); setForm((f) => ({ ...f, address: e.target.value })) }}
                       placeholder="Lane, locality, Pune" />
                <button type="button" className="btn" onClick={locate} disabled={geoBusy || !form.address.trim()} title="Find this address on the map">
                  {geoBusy ? '…' : 'Find'}
                </button>
              </div></label>
            <p className="muted small" style={{ margin: '8px 0' }}>
              Then drag the pin to the exact gate. Or <button type="button" className="link" onClick={useMyLocation}><LocateFixed size={12} /> use my location</button>.
            </p>
            <PinMap value={pin} onChange={(p) => setPin(p)} height={300} />
            {pin && <p className="muted small" style={{ marginTop: 6 }}>Pin: {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}</p>}

            {dupes.length > 0 && (
              <div className="warn-box">
                <AlertTriangle size={16} />
                <div>
                  <b>Already on the map nearby.</b> Is one of these the same place?
                  <ul>
                    {dupes.map((d) => <li key={d.id}><a href={`#/listing/${d.id}`}>{d.name}</a> · {rupees(d.rent_min)} · {d.distance_m} m away</li>)}
                  </ul>
                  If it is, please do not add it again. If it is your listing, sign in with the account that added it.
                </div>
              </div>
            )}

            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn primary block" disabled={busy} style={{ marginTop: 12 }}>
              {busy ? 'Saving…' : user ? (editId ? 'Save changes' : 'Publish listing') : 'Sign in and publish'}
            </button>
            {!user && <p className="muted small" style={{ marginTop: 8, textAlign: 'center' }}>You need an account so you can edit it later and mark it full.</p>}
          </section>
        </div>
      </form>
    </div>
  )
}
