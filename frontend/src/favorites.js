import { useCallback, useEffect, useState } from 'react'

// Saved listings live in this browser only (localStorage), so no account is needed to shortlist places.
const KEY = 'punestay.saved'

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]').filter((n) => Number.isInteger(n)) } catch { return [] }
}
function write(ids) {
  try { localStorage.setItem(KEY, JSON.stringify(ids)) } catch { /* private mode: keep in memory only */ }
  window.dispatchEvent(new Event('punestay:saved'))
}

export function useFavorites() {
  const [ids, setIds] = useState(read)
  useEffect(() => {
    const on = () => setIds(read())
    window.addEventListener('punestay:saved', on)
    window.addEventListener('storage', on)
    return () => { window.removeEventListener('punestay:saved', on); window.removeEventListener('storage', on) }
  }, [])
  const has = useCallback((id) => ids.includes(id), [ids])
  const toggle = useCallback((id) => {
    const cur = read()
    write(cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur])
  }, [])
  return { ids, has, toggle, count: ids.length }
}
