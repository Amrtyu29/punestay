import { useEffect, useState } from 'react'

// Tiny hash router: '#/'(map), '#/add', '#/edit/12', '#/mine', '#/compare', '#/admin'.
// Query params (e.g. ?mock=1) stay in the real URL untouched.
function parse() {
  const h = window.location.hash.replace(/^#\/?/, '')
  const [path, qs = ''] = h.split('?')
  const [page = '', arg = ''] = path.split('/')
  // '#/nearby?lat=18.52&lng=73.85&category=hospital' -> shareable searches
  const query = Object.fromEntries(new URLSearchParams(qs))
  return { page: page || 'map', arg, query }
}

export function useHashRoute() {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const on = () => setRoute(parse())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export function navigate(path) {
  window.location.hash = path.startsWith('#') ? path : `#/${path.replace(/^\//, '')}`
}

export const href = (path) => `#/${path.replace(/^\//, '')}`
