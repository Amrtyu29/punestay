import { Heart, MapPin, ShieldCheck, Train, Bus, Utensils } from 'lucide-react'
import { GENDER_LABEL, TYPE_LABEL, metres, minutes, rupees } from '../format'

// A deterministic soft colour per listing, so cards without photos still feel distinct (no fake images).
const HUES = [222, 262, 196, 160, 24, 340, 290, 180]
export function hueFor(id) { return HUES[Math.abs(Number(id) || 0) % HUES.length] }

/** Compact property card used in the results list and the Saved page. */
export default function ListingCard({ l, active, saved, onSelect, onHover, onToggleSave, compact = false }) {
  const hue = hueFor(l.id)
  const initials = (l.name || '?').replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
  const rentKnown = l.rent_min != null
  return (
    <article
      className={`lcard${active ? ' active' : ''}${compact ? ' compact' : ''}`}
      onClick={() => onSelect?.(l.id)}
      onMouseEnter={() => onHover?.(l.id)}
      onMouseLeave={() => onHover?.(null)}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect?.(l.id)}
      aria-label={l.name}
    >
      <div className="lcard-media" style={{ '--h': hue }}>
        {l.photo_url ? <img src={l.photo_url} alt="" loading="lazy" /> : <span className="lcard-initials">{initials}</span>}
        <button
          type="button"
          className={`heart${saved ? ' on' : ''}`}
          aria-label={saved ? 'Remove from saved' : 'Save'}
          aria-pressed={saved}
          onClick={(e) => { e.stopPropagation(); onToggleSave?.(l.id) }}
        >
          <Heart size={16} />
        </button>
        <div className="lcard-tags">
          {l.status === 'verified' && <span className="tag verified"><ShieldCheck size={11} /> Verified</span>}
          {l.vacancy === false && <span className="tag full">Full</span>}
        </div>
      </div>
      <div className="lcard-body">
        <div className="lcard-top">
          <h4 className="lcard-name">{l.name}</h4>
          <div className="lcard-price">
            {rentKnown ? <><b>{rupees(l.rent_min)}</b><span>/mo</span></> : <span className="muted">Rent not published</span>}
          </div>
        </div>
        <div className="lcard-sub"><MapPin size={12} /><span>{l.address}</span></div>
        <div className="lcard-meta">
          <span className="chip tiny">{TYPE_LABEL[l.listing_type] || l.listing_type}</span>
          {l.gender !== 'any' && <span className="chip tiny">{GENDER_LABEL[l.gender]}</span>}
          {l.commute_s != null && <span className="chip tiny accent">{minutes(l.commute_s)} away</span>}
          {l.nearest_metro_m != null && l.nearest_metro_m <= 1200 && <span className="chip tiny"><Train size={11} /> {metres(l.nearest_metro_m)}</span>}
          {l.nearest_bus_stop_m != null && l.nearest_metro_m > 1200 && <span className="chip tiny"><Bus size={11} /> {metres(l.nearest_bus_stop_m)}</span>}
          {l.food_included && <span className="chip tiny"><Utensils size={11} /> Food</span>}
        </div>
      </div>
    </article>
  )
}
