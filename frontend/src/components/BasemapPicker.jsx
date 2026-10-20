import { useEffect, useRef, useState } from 'react'
import { Layers } from 'lucide-react'
import { BASEMAPS } from '../basemaps'

/** Google-Maps-style map type switcher: a small square at the bottom-left that opens a grid of basemaps. */
export default function BasemapPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = BASEMAPS.find((b) => b.key === value) || BASEMAPS[0]

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const swatchStyle = (b) => (b.thumb ? { backgroundImage: `url(${b.thumb})` } : { background: b.swatch })

  return (
    <div className="basemap" ref={ref}>
      {open && (
        <div className="basemap-menu" role="menu" aria-label="Map type">
          {BASEMAPS.map((b) => (
            <button type="button" key={b.key} role="menuitemradio" aria-checked={b.key === value} className={b.key === value ? 'on' : ''}
                    onClick={() => { onChange(b.key); setOpen(false) }}>
              <span className="swatch" style={swatchStyle(b)} />
              <span>{b.label}</span>
            </button>
          ))}
        </div>
      )}
      <button type="button" className="basemap-toggle" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} title="Map type">
        <span className="swatch" style={swatchStyle(current)} />
        <span className="basemap-label"><Layers size={13} /> {current.label}</span>
      </button>
    </div>
  )
}
