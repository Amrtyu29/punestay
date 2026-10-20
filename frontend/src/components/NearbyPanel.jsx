import { Crosshair, ExternalLink, LocateFixed, RotateCcw, Search } from 'lucide-react'
import { metres } from '../format'
import { COLORS, DEFAULT_COLOR, NS, RADII } from '../nearby'

/** Nearby Services controls + distance-sorted results, shown as a tab of the home-map sidebar. */
export default function NearbyPanel({ nb, onHover }) {
  const rows = nb.results?.features || []
  return (
    <>
      <div className="sidebar-scroll nb-panel">
        <p className="muted small" style={{ margin: '4px 0 6px' }}>
          Pick a point, choose what you need, and get the closest places sorted by distance.
        </p>

        <section className="nb-section">
          <div className="section-title"><span className="step">1</span> Where</div>
          <div className="actions-row" style={{ marginTop: 8 }}>
            <button type="button" className="btn sm primary" onClick={nb.useGeolocation} disabled={nb.geoState === 'asking'}>
              <LocateFixed size={14} /> {nb.geoState === 'asking' ? 'Locating…' : 'Use my location'}
            </button>
            <span className="muted small" style={{ alignSelf: 'center' }}><Crosshair size={12} /> or click the map</span>
          </div>
          <div className="latlng-row">
            <label className="field"><span className="field-label">Latitude</span>
              <input className="input" inputMode="decimal" placeholder="18.5204" value={nb.latText} onChange={(e) => nb.setLatText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && nb.applyTyped()} /></label>
            <label className="field"><span className="field-label">Longitude</span>
              <input className="input" inputMode="decimal" placeholder="73.8567" value={nb.lngText} onChange={(e) => nb.setLngText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && nb.applyTyped()} /></label>
            <button type="button" className="btn sm" onClick={nb.applyTyped} style={{ alignSelf: 'end', height: 36 }}>Go</button>
          </div>
          {nb.origin
            ? <p className="muted small" style={{ marginTop: 6 }}>Origin from {nb.origin.source}: {nb.origin.lat}, {nb.origin.lng}.</p>
            : <p className="muted small" style={{ marginTop: 6 }}>No point chosen yet. Click anywhere on the map.</p>}
        </section>

        <section className="nb-section">
          <div className="section-title"><span className="step">2</span> What</div>
          <label className="field" style={{ marginTop: 8 }}><span className="field-label">Category</span>
            <select className="input" value={nb.category} onChange={(e) => nb.setCategory(e.target.value)}>
              <option value="">All services</option>
              {nb.categories.map((c) => <option key={c.category} value={c.category}>{c.label} ({c.count})</option>)}
            </select></label>
          {nb.subcats.length > 1 && (
            <label className="field"><span className="field-label">Subcategory</span>
              <select className="input" value={nb.subcategory} onChange={(e) => nb.setSubcategory(e.target.value)}>
                <option value="">Any</option>
                {nb.subcats.map((s) => <option key={s.subcategory} value={s.subcategory}>{s.subcategory.replace(/_/g, ' ')} ({s.count})</option>)}
              </select></label>
          )}
        </section>

        <section className="nb-section">
          <div className="section-title"><span className="step">3</span> How far</div>
          <div className="segmented" style={{ marginTop: 8 }}>
            {[['radius', 'Within radius'], ['nearest', 'Nearest N'], ['both', 'Both']].map(([v, l]) => (
              <button type="button" key={v} className={nb.mode === v ? 'on' : ''} onClick={() => nb.setMode(v)}>{l}</button>
            ))}
          </div>
          <div className="latlng-row" style={{ marginTop: 10 }}>
            {(nb.mode === 'radius' || nb.mode === 'both') && (
              <label className="field"><span className="field-label">Radius</span>
                <select className="input" value={nb.radius} onChange={(e) => nb.setRadius(Number(e.target.value))}>{RADII.map((r) => <option key={r} value={r}>{metres(r)}</option>)}</select></label>
            )}
            {(nb.mode === 'nearest' || nb.mode === 'both') && (
              <label className="field"><span className="field-label">Nearest</span>
                <select className="input" value={nb.n} onChange={(e) => nb.setN(Number(e.target.value))}>{NS.map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
            )}
          </div>
          <div className="actions-row" style={{ marginTop: 10 }}>
            <button type="button" className="btn primary" style={{ flex: 1 }} onClick={nb.search} disabled={nb.busy || !nb.origin}>
              <Search size={15} /> {nb.busy ? 'Searching…' : 'Search'}
            </button>
            {nb.origin && <button type="button" className="btn" onClick={nb.clear} title="Clear the search"><RotateCcw size={14} /></button>}
          </div>
        </section>

        {nb.error && <div className="form-error" role="alert" style={{ marginTop: 10 }}>{nb.error}</div>}

        <section className="nb-section" style={{ borderBottom: 'none' }}>
          <div className="section-title">{nb.results ? `${rows.length} result${rows.length === 1 ? '' : 's'}, nearest first` : 'Results'}</div>
          {!nb.results && !nb.error && <p className="muted small" style={{ marginTop: 8 }}>Choose a location to see services here.</p>}
          <ol className="nb-list">
            {rows.map((f, i) => {
              const p = f.properties
              return (
                <li key={p.id} className={p.id === nb.activeId ? 'active' : ''} onClick={() => nb.setActiveId(p.id)}
                    onMouseEnter={() => onHover?.(p.id)} onMouseLeave={() => onHover?.(null)}>
                  <span className="nb-rank" style={{ background: COLORS[p.category] || DEFAULT_COLOR }}>{i + 1}</span>
                  <span className="nb-main">
                    <div className="v">{p.name || <span className="muted">Unnamed {p.subcategory.replace(/_/g, ' ')}</span>}</div>
                    <div className="k">{p.label} · {p.subcategory.replace(/_/g, ' ')}{p.address ? ` · ${p.address}` : ''}</div>
                    {(p.phone || p.opening_hours) && <div className="k">{p.phone ? `☎ ${p.phone}` : ''}{p.phone && p.opening_hours ? ' · ' : ''}{p.opening_hours || ''}</div>}
                  </span>
                  <span className="nb-dist">{metres(p.distance_m)}</span>
                </li>
              )
            })}
          </ol>
        </section>
      </div>
      <div className="sidebar-footer">
        <a className="btn ghost sm" href="#/nearby"><ExternalLink size={13} /> Open the full Leaflet + GeoServer page</a>
      </div>
    </>
  )
}
