import { Home, IndianRupee, Layers, Navigation, RotateCcw, ShieldAlert, SlidersHorizontal } from 'lucide-react'
import { rupees } from '../format'
import ListingCard from './ListingCard'
import NearbyPanel from './NearbyPanel'

export const DEFAULT_FILTERS = {
  rent_max: 15000,
  type: '',
  gender: '',
  food: false,
  vacancy: false,
  rent_known: false,
  max_commute_min: '',
}

export function countActiveFilters(f) {
  let n = 0
  if (f.rent_max !== DEFAULT_FILTERS.rent_max) n++
  if (f.type) n++
  if (f.gender) n++
  if (f.food) n++
  if (f.vacancy) n++
  if (f.rent_known) n++
  if (f.max_commute_min) n++
  return n
}

export default function FilterPanel({ filters, onChange, destination, count, loading, layers, onLayers, onReport,
                                      listings, selectedId, onSelect, onHover, fav, tab, onTab, nearby, onNearbyHover }) {
  const set = (patch) => onChange({ ...filters, ...patch })
  const active = countActiveFilters(filters)
  const rows = (listings?.features || []).map((f) => f.properties)
  const showList = tab === 'list'
  const showNearby = tab === 'nearby'
  const showFilters = !showList && !showNearby
  const nearbyCount = nearby?.results?.features?.length

  return (
    <aside className="sidebar" aria-label={showList ? 'Results' : showNearby ? 'Nearby services' : 'Filters'}>
      <div className="sidebar-tabs three" role="tablist">
        <button type="button" role="tab" aria-selected={showFilters} className={showFilters ? 'on' : ''} onClick={() => onTab('filters')}>
          Filters{active > 0 && <span className="count-badge">{active}</span>}
        </button>
        <button type="button" role="tab" aria-selected={showList} className={showList ? 'on' : ''} onClick={() => onTab('list')}>
          Places{count != null && <span className="count-badge soft">{count}</span>}
        </button>
        <button type="button" role="tab" aria-selected={showNearby} className={showNearby ? 'on' : ''} onClick={() => onTab('nearby')}>
          Nearby{nearbyCount != null && <span className="count-badge soft">{nearbyCount}</span>}
        </button>
      </div>

      {showNearby && nearby && <NearbyPanel nb={nearby} onHover={onNearbyHover} />}

      {showList && (
        <div className="sidebar-scroll list-scroll">
          {loading && !rows.length && [0, 1, 2].map((i) => <div key={i} className="skeleton lcard-skel" />)}
          {!loading && rows.length === 0 && (
            <div className="empty-state small">
              <p className="muted">No places in this part of the map{active ? ' with these filters' : ''}.</p>
              {active > 0 && <button type="button" className="btn sm" onClick={() => onChange({ ...DEFAULT_FILTERS })}>Clear filters</button>}
            </div>
          )}
          {rows.map((l) => (
            <ListingCard key={l.id} l={l} active={l.id === selectedId} saved={fav.has(l.id)}
                         onSelect={onSelect} onHover={onHover} onToggleSave={fav.toggle} />
          ))}
        </div>
      )}

      {showFilters && <div className="sidebar-scroll">
        <div className="result-line">
          <span>{loading ? 'Updating…' : count == null ? 'Move the map to search' : <><b>{count}</b> listing{count === 1 ? '' : 's'} in view</>}</span>
          {active > 0 && (
            <button type="button" className="btn ghost sm" onClick={() => onChange({ ...DEFAULT_FILTERS })}>
              <RotateCcw size={13} /> Reset
            </button>
          )}
        </div>

        <section className="section">
          <div className="section-head">
            <span className="section-title"><Navigation size={14} /> Commute</span>
          </div>
          {destination ? (
            <>
              <div className="commute-card">
                <Navigation size={16} className="ico" />
                <span className="name">{destination.name}</span>
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <label className="field-label" htmlFor="max-commute">Max travel time</label>
                <select id="max-commute" className="input" value={filters.max_commute_min} onChange={(e) => set({ max_commute_min: e.target.value })}>
                  <option value="">Any</option>
                  {[10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>Up to {m} min</option>)}
                </select>
              </div>
            </>
          ) : (
            <p className="commute-hint">Search your college or office above to see travel time for every listing.</p>
          )}
        </section>

        <section className="section">
          <div className="section-head">
            <span className="section-title"><IndianRupee size={14} /> Budget</span>
            <span className="section-value">up to {rupees(filters.rent_max)}</span>
          </div>
          <input
            className="range" type="range" min="3000" max="40000" step="500"
            value={filters.rent_max} onChange={(e) => set({ rent_max: Number(e.target.value) })}
            aria-label="Maximum rent per month"
          />
          <div className="range-scale"><span>₹3k</span><span>₹20k</span><span>₹40k</span></div>
        </section>

        <section className="section">
          <div className="section-head"><span className="section-title"><Home size={14} /> Type</span></div>
          <Segmented
            value={filters.type} onChange={(type) => set({ type })}
            options={[['', 'All'], ['pg', 'PG'], ['flat', 'Flat'], ['hostel', 'Hostel']]}
          />
          <div className="field">
            <span className="field-label" style={{ marginTop: 12 }}>For</span>
            <Segmented
              value={filters.gender} onChange={(gender) => set({ gender })}
              options={[['', 'Anyone'], ['male', 'Boys'], ['female', 'Girls']]}
            />
          </div>
        </section>

        <section className="section">
          <div className="section-head"><span className="section-title"><SlidersHorizontal size={14} /> Options</span></div>
          <Switch checked={filters.food} onChange={(food) => set({ food })} label="Food included" />
          <Switch checked={filters.vacancy} onChange={(vacancy) => set({ vacancy })} label="Rooms available now" />
          <Switch checked={filters.rent_known} onChange={(rent_known) => set({ rent_known })} label="Only places with a published rent" />
        </section>

        <section className="section">
          <div className="section-head"><span className="section-title"><Layers size={14} /> Map layers</span></div>
          <Switch checked={!!layers?.heatmap} onChange={(heatmap) => onLayers({ ...layers, heatmap })} label="Flat rent heatmap (2021 data)" />
          {layers?.heatmap && <div className="heat-legend"><span>₹10k</span><i /><span>₹45k / month</span></div>}
          <Switch checked={!!layers?.safety} onChange={(safety) => onLayers({ ...layers, safety })} label="Night safety reports" />
          <Switch checked={!!layers?.flats} onChange={(flats) => onLayers({ ...layers, flats })} label="Past flat rents (2021 data)" />
          {layers?.flats && <p className="muted small" style={{ margin: '2px 0 6px' }}>Real rents from 16,000 Pune flat listings in 2021, by housing society. Click a dot for 1, 2 and 3 BHK medians and a 2025 estimate.</p>}
          <button type="button" className="btn block" style={{ marginTop: 8 }} onClick={onReport}>
            <ShieldAlert size={15} /> Report an unsafe spot
          </button>
        </section>
      </div>}

      {showFilters && <div className="sidebar-footer">
        <div className="legend">
          <span><i style={{ background: '#16a34a' }} /> under ₹7,000</span>
          <span><i style={{ background: '#f59e0b' }} /> ₹7,000 – 12,000</span>
          <span><i style={{ background: '#e11d48' }} /> ₹12,000 and up</span>
          <span><i className="ring" /> unverified</span>
          <span><i style={{ background: '#9ca3af' }} /> rent not published</span>
        </div>
      </div>}
    </aside>
  )
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}

function Switch({ checked, onChange, label }) {
  return (
    <label className="switch-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" aria-hidden="true" />
    </label>
  )
}
