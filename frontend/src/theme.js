import { useEffect, useState } from 'react'

/** Dark Charcoal + Teal is the default look; Light stays available from the header toggle. */
const KEY = 'punestay.theme'
const THEME_COLOR = { dark: '#0b1416', light: '#0f766e' }

export function readTheme() {
  try { const t = localStorage.getItem(KEY); return t === 'light' || t === 'dark' ? t : 'dark' } catch { return 'dark' }
}

export function applyTheme(t) {
  document.documentElement.dataset.theme = t
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = THEME_COLOR[t]
}

/** Call before the first render so there is no light flash. */
export function initTheme() { applyTheme(readTheme()) }

export function useTheme() {
  const [theme, setTheme] = useState(readTheme)
  useEffect(() => {
    applyTheme(theme)
    try { localStorage.setItem(KEY, theme) } catch { /* private mode */ }
  }, [theme])
  return { theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }
}
