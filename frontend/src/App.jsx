import { useCallback, useEffect, useRef, useState } from 'react'
import { Bookmark, ChartColumn, List, Map, Radar, Search, SlidersHorizontal } from 'lucide-react'
import { useFavorites } from './favorites'
import { useNearby } from './nearby'
import SavedPage from './pages/SavedPage'
import { api } from './api/client'
import { useAuth } from './auth'
import { href, navigate, useHashRoute } from './router'
import Header from './components/Header'
import MapView from './components/MapView'
import FilterPanel, { DEFAULT_FILTERS, countActiveFilters } from './components/FilterPanel'
import ListingDrawer from './components/ListingDrawer'
import AuthModal from './components/AuthModal'
import AddListingPage from './pages/AddListingPage'
import MyListingsPage from './pages/MyListingsPage'
import ComparePage from './pages/ComparePage'
import AdminPage from './pages/AdminPage'
import SafetyReportModal from './components/SafetyReportModal'
import DirectionsPanel from './components/DirectionsPanel'
import BasemapPicker from './components/BasemapPicker'
import { loadBasemap, saveBasemap } from './basemaps'

const MOBILE = '(max-width: 767px)'

function useMediaQuery(query) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = (e) => setMatch(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}

export default function App() {
  const route = useHashRoute()
  const { user } = useAuth()
  const [authModal, setAuthModal] = useState(null) // null | 'login' | 'register'

  // Destination is app-wide so it survives page changes.
  const [destination, setDestination] = useState(null)

  const page = route.page
  const onMap = page === 'map' || page === 'listing'

  return (
    <div className="app">
      <MapScreen
        active={onMap}
        route={route}
        destination={destination}
        setDestination={setDestination}
        onSignIn={() => setAuthModal('login')}
        user={user}
      />
      {!onMap && <Header page={page} onSignIn={() => setAuthModal('login')} />}
      {page === 'add' && <AddListingPage key="add" onNeedSignIn={() => setAuthModal('register')} />}
      {page === 'edit' && <AddListingPage key={`edit-${route.arg}`} editId={route.arg} onNeedSignIn={() => setAuthModal('login')} />}
      {page === 'mine' && <MyListingsPage onNeedSignIn={() => setAuthModal('login')} />}
      {page === 'compare' && <ComparePage destination={destination} onDestination={setDestination} />}
      {page === 'admin' && <AdminPage onNeedSignIn={() => setAuthModal('login')} />}
      {page === 'saved' && <SavedPage />}
      {!onMap && !['add', 'edit', 'mine', 'compare', 'admin', 'saved'].includes(page) && <NotFound page={page} />}

      {authModal && <AuthModal mode={authModal} onClose={() => setAuthModal(null)} />}
    </div>
  )
}

function NotFound({ page }) {
  return (
    <>
      <div className="page"><div className="page-inner narrow"><div className="card center">
        <h1 className="page-title">Nothing here yet</h1>
        <p className="muted">The page "{page}" does not exist.</p>
        <a className="btn primary" href="#/" style={{ marginTop: 12 }}>Back to the map</a>
      </div></div></div>
    </>
  )
}

/** Floating page switcher over the map (the header holds the destination search on this page). */
function MapNav() {
  return (
    <nav className="map-nav" aria-label="Pages">
      <a className="on" href={href('/')}><Map size={15} /> Map</a>
      <a href="/" title="PuneStay Sonar: the Nearby Services page"><Search size={15} /> Nearby services</a>
      <a href={href('/compare')}><ChartColumn size={15} /> Compare areas</a>
      <a href={href('/saved')}><Bookmark size={15} /> Saved</a>
    </nav>
  )
}

/** The map page. Kept mounted only while active so the map does not reload between map visits. */
function MapScreen({ active, route, destination, setDestination, onSignIn, user }) {
  const isMobile = useMediaQuery(MOBILE)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [bbox, setBbox] = useState(null)
  const [listings, setListings] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [flyTo, setFlyTo] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(() => !window.matchMedia(MOBILE).matches)
  const [routeLine, setRouteLine] = useState(null)   // {listingId, destinationId, duration_s, distance_m, geometry}
  const [routeBusy, setRouteBusy] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [layers, setLayers] = useState({ heatmap: false, safety: false, flats: false })
  const [grid, setGrid] = useState(null)
  const [flatRents, setFlatRents] = useState(null)
  const [tab, setTab] = useState('list')          // sidebar: 'list' | 'filters' | 'nearby'
  const [hoverId, setHoverId] = useState(null)
  const fav = useFavorites()
  // Nearby Services (course brief) lives on the home map as a sidebar tab too.
  const nb = useNearby({ enabled: active })
  const [nearbyHover, setNearbyHover] = useState(null)
  const picking = tab === 'nearby' && !nb.origin && sidebarOpen
  // Directions (college / office or my location -> selected PG) and the basemap choice.
  const [dirOpen, setDirOpen] = useState(false)
  const [dirRoute, setDirRoute] = useState(null)
  const [userLoc, setUserLoc] = useState(null)
  const [basemap, setBasemapState] = useState(loadBasemap)
  const setBasemap = (k) => { setBasemapState(k); saveBasemap(k) }

  // Past flat rents (real 2021 observations, aggregated per housing society).
  useEffect(() => {
    if (!layers.flats || !bbox || !active) { setFlatRents(null); return }
    let cancelled = false
    api.flatRents(bbox).then((fc) => !cancelled && setFlatRents(fc)).catch(() => !cancelled && setFlatRents(null))
    return () => { cancelled = true }
  }, [layers.flats, bbox, active])
  const [reports, setReports] = useState(null)
  const [reportMode, setReportMode] = useState(false)
  const [reportAt, setReportAt] = useState(null)   // {lat, lng} chosen on the map
  const reqId = useRef(0)

  // Rent heatmap cells for the viewport.
  useEffect(() => {
    if (!layers.heatmap || !bbox || !active) { setGrid(null); return }
    let cancelled = false
    api.rentGrid(bbox, 500, filters.type || undefined).then((fc) => !cancelled && setGrid(fc)).catch(() => !cancelled && setGrid(null))
    return () => { cancelled = true }
  }, [layers.heatmap, bbox, filters.type, active, refreshKey])

  // Safety reports for the viewport.
  useEffect(() => {
    if (!layers.safety || !bbox || !active) { setReports(null); return }
    let cancelled = false
    api.safetyReports(bbox).then((fc) => !cancelled && setReports(fc)).catch(() => !cancelled && setReports(null))
    return () => { cancelled = true }
  }, [layers.safety, bbox, active, refreshKey])

  const startReport = () => {
    if (!user) { onSignIn(); return }
    setLayers((l) => ({ ...l, safety: true }))
    setReportMode(true)
    setSelectedId(null)
    if (isMobile) setSidebarOpen(false)
  }
  const pickOnMap = nb.pickOnMap
  const onMapClick = useCallback((ll) => {
    if (reportMode) setReportAt({ lat: ll.lat, lng: ll.lng })
    else if (tab === 'nearby') pickOnMap(ll)
  }, [reportMode, tab, pickOnMap])
  const onNearbySelect = useCallback((id) => { nb.setActiveId(id); setTab('nearby') }, [nb.setActiveId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Deep link #/listing/12: select it and fly there.
  useEffect(() => {
    if (route.page !== 'listing' || !route.arg) return
    const id = Number(route.arg)
    setSelectedId(id)
    api.listing(id).then((d) => setFlyTo({ lng: d.listing.lng, lat: d.listing.lat, zoom: 16 })).catch(() => {})
  }, [route.page, route.arg])

  // Crossing the phone/desktop breakpoint: open the docked sidebar on desktop, hide the sheet on phone.
  useEffect(() => { setSidebarOpen(!isMobile) }, [isMobile])

  // Fetch whenever the viewport, filters or destination change. Ignore stale responses.
  useEffect(() => {
    if (!bbox || !active) return
    const id = ++reqId.current
    setLoading(true)
    const params = {
      bbox,
      rent_max: filters.rent_max,
      type: filters.type,
      gender: filters.gender,
      food: filters.food ? 'true' : '',
      vacancy: filters.vacancy ? 'true' : '',
      rent_known: filters.rent_known ? 'true' : '',
      destination_id: destination?.id,
      max_commute_s: destination && filters.max_commute_min ? filters.max_commute_min * 60 : '',
      limit: 2000,
    }
    api.listings(params)
      .then((fc) => { if (id === reqId.current) { setListings(fc); setError(null) } })
      .catch((e) => { if (id === reqId.current) { setError(e.message); setListings({ type: 'FeatureCollection', features: [] }) } })
      .finally(() => { if (id === reqId.current) setLoading(false) })
  }, [bbox, filters, destination, active, refreshKey])

  const onViewportChange = useCallback((b) => setBbox(b), [])
  const onSelect = useCallback((id) => {
    setSelectedId(id)
    if (isMobile) setSidebarOpen(false)
    if (window.location.hash.startsWith('#/listing/')) window.history.replaceState(null, '', '#/')
  }, [isMobile])
  const closeDrawer = useCallback(() => { setSelectedId(null); if (window.location.hash.startsWith('#/listing/')) navigate('/') }, [])

  const onDestination = (d) => {
    setDestination(d)
    if (d) setFlyTo({ lng: d.lng, lat: d.lat, zoom: 13.5 })
    else setFilters((f) => ({ ...f, max_commute_min: '' }))
  }

  // Route from the selected listing to the chosen destination.
  const showRoute = useCallback(async () => {
    if (selectedId == null || !destination) return
    setRouteBusy(true)
    try {
      const r = await api.listingRoute(selectedId, destination.id)
      setRouteLine({ listingId: selectedId, destinationId: destination.id, ...r })
    } catch (e) {
      setError(e.message)
    } finally {
      setRouteBusy(false)
    }
  }, [selectedId, destination])

  useEffect(() => {
    if (routeLine && (routeLine.listingId !== selectedId || routeLine.destinationId !== destination?.id)) setRouteLine(null)
  }, [selectedId, destination, routeLine])

  if (!active) return null

  const count = listings?.count ?? listings?.features?.length
  const activeFilters = countActiveFilters(filters)
  const selFeature = selectedId != null ? listings?.features?.find((f) => f.id === selectedId) : null
  const dirTo = selFeature ? { id: selFeature.id, name: selFeature.properties.name, lng: selFeature.geometry.coordinates[0], lat: selFeature.geometry.coordinates[1] } : null
  const openNearby = () => { setTab('nearby'); setSidebarOpen(true); setDirOpen(false) }
  const toggleDirections = () => {
    if (dirOpen) setDirRoute(null)
    setDirOpen(!dirOpen)
    if (isMobile) setSidebarOpen(false)
  }
  const mapPadding = isMobile
    ? { top: 16, bottom: selectedId != null ? 320 : 16, left: 16, right: 16 }
    : { top: 24, bottom: 24, left: 24, right: selectedId != null ? 424 : 24 }

  return (
    <>
      <Header
        page="map"
        destination={destination}
        onDestination={onDestination}
        count={count}
        loading={loading}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        activeFilters={activeFilters}
        onSignIn={onSignIn}
        onNearby={openNearby}
        nearbyOn={tab === 'nearby' && sidebarOpen}
        onDirections={toggleDirections}
        directionsOn={dirOpen}
      />

      <div className="body">
        {sidebarOpen && (
          <FilterPanel
            filters={filters} onChange={setFilters} destination={destination} count={count} loading={loading}
            layers={layers} onLayers={setLayers} onReport={startReport}
            listings={listings} selectedId={selectedId} onSelect={onSelect} onHover={setHoverId} fav={fav}
            tab={tab} onTab={setTab}
            nearby={nb} onNearbyHover={setNearbyHover}
          />
        )}
        {isMobile && sidebarOpen && <div className="backdrop" onClick={() => setSidebarOpen(false)} />}

        <main className={`map-area${reportMode ? ' reporting' : ''}${picking ? ' picking' : ''}`}>
          <MapView
            listings={listings}
            selectedId={selectedId}
            onSelect={reportMode ? () => {} : onSelect}
            onViewportChange={onViewportChange}
            flyTo={flyTo}
            padding={mapPadding}
            route={(dirOpen && dirRoute) || routeLine?.geometry || null}
            destination={destination}
            basemap={basemap}
            userLocation={userLoc}
            grid={grid}
            reports={reports}
            flatRents={flatRents}
            onMapClick={onMapClick}
            hoverId={hoverId}
            nearby={{ origin: nb.origin, results: nb.results, radius: nb.radius, mode: nb.mode, activeId: nb.activeId, hoverId: nearbyHover }}
            onNearbySelect={onNearbySelect}
          />

          {!isMobile && <MapNav />}
          {dirOpen && (
            <DirectionsPanel
              destination={destination} onDestination={onDestination} to={dirTo}
              userLocation={userLoc} onUserLocation={(p) => { setUserLoc(p); setFlyTo({ lng: p.lng, lat: p.lat, zoom: 14 }) }}
              onRoute={setDirRoute} onClose={() => { setDirOpen(false); setDirRoute(null) }}
            />
          )}
          <BasemapPicker value={basemap} onChange={setBasemap} />

          {picking && !reportMode && !isMobile && (
            <div className="report-banner hint">
              <Radar size={15} /> Click the map where you want to find services
            </div>
          )}
          {reportMode && !reportAt && (
            <div className="report-banner">
              Tap the map where it felt unsafe at night
              <button type="button" className="btn sm" onClick={() => setReportMode(false)}>Cancel</button>
            </div>
          )}
          {reportAt && (
            <SafetyReportModal
              at={reportAt}
              onClose={() => { setReportAt(null); setReportMode(false) }}
              onSaved={() => { setReportAt(null); setReportMode(false); setRefreshKey((k) => k + 1) }}
            />
          )}

          {loading && !error && (
            <div className="status-pill"><span className="dot" />Searching this area…</div>
          )}
          {error && <div className="status-pill error" role="alert">{error}</div>}

          {isMobile && !sidebarOpen && selectedId == null && (
            <div className="mobile-bar">
              <button type="button" className="btn primary" onClick={() => { setTab('list'); setSidebarOpen(true) }}>
                <List size={16} /> {count != null ? `${count} places` : 'Places'}
              </button>
              <button type="button" className="btn" onClick={() => { setTab('filters'); setSidebarOpen(true) }}>
                <SlidersHorizontal size={16} /> Filters{activeFilters > 0 ? ` · ${activeFilters}` : ''}
              </button>
              <button type="button" className="btn" onClick={() => { setTab('nearby'); setSidebarOpen(true) }}>
                <Radar size={16} /> Nearby
              </button>
            </div>
          )}

          <ListingDrawer
            id={selectedId}
            onClose={closeDrawer}
            destination={destination}
            route={routeLine}
            routeBusy={routeBusy}
            onShowRoute={showRoute}
            onHideRoute={() => setRouteLine(null)}
            commute={listings?.features?.find((f) => f.id === selectedId)?.properties}
            saved={fav.has(selectedId)}
            onToggleSave={() => fav.toggle(selectedId)}
            user={user}
            onSignIn={onSignIn}
            onChanged={() => setRefreshKey((k) => k + 1)}
          />
        </main>
      </div>
    </>
  )
}
