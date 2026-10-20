import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, getToken, setToken } from './api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  // Restore the session from a stored token.
  useEffect(() => {
    if (!getToken()) { setReady(true); return }
    api.me().then(setUser).catch(() => setToken(null)).finally(() => setReady(true))
  }, [])

  const login = useCallback(async (email, password) => {
    const r = await api.login(email, password)
    setToken(r.token); setUser(r.user)
    return r.user
  }, [])

  const register = useCallback(async (body) => {
    const r = await api.register(body)
    setToken(r.token); setUser(r.user)
    return r.user
  }, [])

  const logout = useCallback(() => { setToken(null); setUser(null) }, [])

  // A 401 from any call (expired token) signs the user out everywhere.
  useEffect(() => {
    const on = () => setUser(null)
    window.addEventListener('punestay:signed-out', on)
    return () => window.removeEventListener('punestay:signed-out', on)
  }, [])

  const value = useMemo(() => ({ user, ready, login, register, logout }), [user, ready, login, register, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

const NO_AUTH = { user: null, ready: false, login: async () => {}, register: async () => {}, logout: () => {} }

export function useAuth() {
  // The fallback keeps components alive during a hot reload of this module.
  return useContext(AuthContext) || NO_AUTH
}
