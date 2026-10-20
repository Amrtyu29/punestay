import { useEffect, useRef, useState } from 'react'
import { Bookmark, ChartColumn, ChevronDown, Heart, LogOut, Map, MapPin, Moon, Plus, Radar, Route, Search, SlidersHorizontal, Sun } from 'lucide-react'
import DestinationSearch from './DestinationSearch'
import { useAuth } from '../auth'
import { useFavorites } from '../favorites'
import { href } from '../router'
import { useTheme } from '../theme'

export default function Header({ page, destination, onDestination, count, loading, sidebarOpen, onToggleSidebar, activeFilters, onSignIn,
                                 onNearby, onDirections, directionsOn, nearbyOn }) {
  const { user, logout } = useAuth()
  const { count: savedCount } = useFavorites()
  const { theme, toggle: toggleTheme } = useTheme()
  const onMap = page === 'map' || page === 'listing'

  return (
    <header className="header">
      <a className="brand" href={href('/')}>
        <span className="brand-mark"><MapPin size={18} strokeWidth={2.4} /></span>
        <span>
          <div className="brand-name">Pune<span className="hl">Stay</span></div>
          <div className="brand-tag">Find places near your college or office</div>
        </span>
      </a>

      <div className="header-center">
        {onMap
          ? <DestinationSearch value={destination} onPick={onDestination} />
          : (
            <nav className="nav">
              <a className={`nav-link${page === 'map' ? ' on' : ''}`} href={href('/')}><Map size={16} /> Map</a>
              <a className={`nav-link${page === 'nearby' ? ' on' : ''}`} href={href('/nearby')}><Search size={16} /> Nearby services</a>
              <a className={`nav-link${page === 'compare' ? ' on' : ''}`} href={href('/compare')}><ChartColumn size={16} /> Compare areas</a>
              <a className={`nav-link${page === 'saved' ? ' on' : ''}`} href={href('/saved')}><Bookmark size={16} /> Saved</a>
              {user && <a className={`nav-link${page === 'mine' ? ' on' : ''}`} href={href('/mine')}>My listings</a>}
              {user?.role === 'admin' && <a className={`nav-link${page === 'admin' ? ' on' : ''}`} href={href('/admin')}>Admin</a>}
            </nav>
          )}
      </div>

      <div className="header-right">
        <button type="button" className="btn ghost icon-link" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} title={theme === 'dark' ? 'Light theme' : 'Dark theme'}>
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        {onMap && (
          <span className="badge result-chip">
            {loading ? 'Loading…' : count == null ? '—' : `${count} in view`}
          </span>
        )}
        {onMap && (
          <button type="button" className={`btn${sidebarOpen ? '' : ' ghost'}`} onClick={onToggleSidebar} aria-pressed={sidebarOpen} aria-label="Toggle filters">
            <SlidersHorizontal size={16} />
            <span className="hide-sm">Filters</span>
            {activeFilters > 0 && <span className="count-badge">{activeFilters}</span>}
          </button>
        )}
        {onMap && (
          <button type="button" className={`btn${nearbyOn ? ' on-accent' : ' ghost'}`} onClick={onNearby} aria-pressed={!!nearbyOn} title="Nearby services: hospitals, bus stops, mess and more around any point">
            <Radar size={16} />
            <span className="hide-sm">Nearby</span>
          </button>
        )}
        {onMap && (
          <button type="button" className={`btn${directionsOn ? ' on-accent' : ' ghost'}`} onClick={onDirections} aria-pressed={!!directionsOn} title="Directions from your college or office to a PG">
            <Route size={16} />
            <span className="hide-sm">Directions</span>
          </button>
        )}
        <a className={`btn ghost icon-link${page === 'saved' ? ' on' : ''}`} href={href('/saved')} aria-label="Saved places" title="Saved places">
          <Heart size={17} className={savedCount ? 'heart-filled' : ''} />
          {savedCount > 0 && <span className="count-badge">{savedCount}</span>}
        </a>
        <a className="btn primary" href={href('/add')}><Plus size={16} /><span className="hide-sm">Add listing</span></a>
        {user ? <UserMenu user={user} onLogout={logout} page={page} /> : (
          <button type="button" className="btn ghost" onClick={onSignIn}>Sign in</button>
        )}
      </div>
    </header>
  )
}

function UserMenu({ user, onLogout, page }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  const initials = user.name.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="user-menu" ref={ref}>
      <button type="button" className="btn ghost" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <span className="avatar">{initials}</span>
        <span className="hide-sm">{user.name.split(' ')[0]}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head"><b>{user.name}</b><br /><span className="muted small">{user.email} · {user.role}</span></div>
          <a role="menuitem" className={`menu-item${page === 'mine' ? ' on' : ''}`} href={href('/mine')} onClick={() => setOpen(false)}>My listings</a>
          <a role="menuitem" className={`menu-item${page === 'nearby' ? ' on' : ''}`} href={href('/nearby')} onClick={() => setOpen(false)}>Nearby services</a>
          <a role="menuitem" className={`menu-item${page === 'compare' ? ' on' : ''}`} href={href('/compare')} onClick={() => setOpen(false)}>Compare areas</a>
          {user.role === 'admin' && <a role="menuitem" className="menu-item" href={href('/admin')} onClick={() => setOpen(false)}>Admin</a>}
          <button role="menuitem" type="button" className="menu-item" onClick={() => { setOpen(false); onLogout() }}><LogOut size={14} /> Sign out</button>
        </div>
      )}
    </div>
  )
}
