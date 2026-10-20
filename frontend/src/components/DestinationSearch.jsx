import { useEffect, useRef, useState } from 'react'
import { Briefcase, GraduationCap, Navigation, Search, X } from 'lucide-react'
import { api } from '../api/client'

/** Header search box: pick the college or office that commute times are measured to. */
export default function DestinationSearch({ value, onPick }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null) // null = nothing searched yet
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setResults(null); return }
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const fc = await api.destinations(term)
        if (cancelled) return
        setResults(fc.features.map((f) => ({
          id: f.id, name: f.properties.name, kind: f.properties.kind,
          lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1],
        })))
        setActive(0)
        setOpen(true)
      } catch { if (!cancelled) setResults([]) }
    }, 220)
    return () => { cancelled = true; clearTimeout(t) }
  }, [q])

  const choose = (d) => { onPick(d); setOpen(false); setQ('') }

  const onKey = (e) => {
    if (!open || !results?.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % results.length) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + results.length) % results.length) }
    if (e.key === 'Enter') { e.preventDefault(); choose(results[active]) }
    if (e.key === 'Escape') setOpen(false)
  }

  if (value) {
    return (
      <div className="search picked">
        <Navigation size={16} className="lead" />
        <input className="input" readOnly value={`Commute to ${value.name}`} onClick={() => { onPick(null); setTimeout(() => inputRef.current?.focus(), 0) }} />
        <button type="button" className="btn ghost icon sm clear" onClick={() => onPick(null)} aria-label="Clear destination">
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="search">
      <Search size={16} className="lead" />
      <input
        ref={inputRef}
        className="input"
        placeholder="Search college or office, e.g. COEP"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results?.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKey}
        aria-label="Search destination"
      />
      {q && (
        <button type="button" className="btn ghost icon sm clear" onMouseDown={(e) => e.preventDefault()} onClick={() => setQ('')} aria-label="Clear">
          <X size={14} />
        </button>
      )}
      {open && results && (
        <ul className="dropdown" role="listbox">
          {results.length === 0 && <li className="empty">No colleges or offices match “{q}”.</li>}
          {results.map((d, i) => (
            <li key={d.id} role="option" aria-selected={i === active} className={i === active ? 'active' : ''}
                onMouseDown={(e) => e.preventDefault()} onClick={() => choose(d)} onMouseEnter={() => setActive(i)}>
              <span className="ico">{d.kind === 'college' ? <GraduationCap size={16} /> : <Briefcase size={16} />}</span>
              <span className="name">{d.name}</span>
              <small>{d.kind}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
