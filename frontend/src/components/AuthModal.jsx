import { useEffect, useState } from 'react'
import { MapPin, X } from 'lucide-react'
import { useAuth } from '../auth'

/** Sign in / create account dialog. `mode` is 'login' or 'register'. */
export default function AuthModal({ mode: initialMode = 'login', onClose, onDone }) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState(initialMode)
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'student' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const user = mode === 'login'
        ? await login(form.email.trim(), form.password)
        : await register({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || null, password: form.password, role: form.role })
      onDone?.(user)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit} role="dialog" aria-modal="true" aria-label={mode === 'login' ? 'Sign in' : 'Create account'}>
        <button type="button" className="btn ghost icon modal-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        <div className="modal-brand">
          <span className="brand-mark"><MapPin size={20} strokeWidth={2.4} /></span>
          <div>
            <b>{mode === 'login' ? 'Welcome back' : 'Join PuneStay'}</b>
            <span className="muted small">{mode === 'login' ? 'Sign in to add, confirm or claim places.' : 'One account to list a place or confirm one.'}</span>
          </div>
        </div>
        <div className="segmented" style={{ marginBottom: 16 }}>
          <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>Sign in</button>
          <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>Create account</button>
        </div>

        {mode === 'register' && (
          <>
            <label className="field"><span className="field-label">Your name</span>
              <input className="input" required minLength={2} value={form.name} onChange={set('name')} autoComplete="name" /></label>
            <div className="segmented" style={{ marginTop: 12 }} role="radiogroup" aria-label="I am a">
              <button type="button" className={form.role === 'student' ? 'on' : ''} onClick={() => setForm({ ...form, role: 'student' })}>Looking for a place</button>
              <button type="button" className={form.role === 'owner' ? 'on' : ''} onClick={() => setForm({ ...form, role: 'owner' })}>I own a PG / flat</button>
            </div>
          </>
        )}
        <label className="field"><span className="field-label">Email</span>
          <input className="input" type="email" required value={form.email} onChange={set('email')} autoComplete="email" /></label>
        {mode === 'register' && (
          <label className="field"><span className="field-label">Phone (shown to students only if you add a listing)</span>
            <input className="input" type="tel" pattern="[0-9+\- ]{8,15}" value={form.phone} onChange={set('phone')} autoComplete="tel" /></label>
        )}
        <label className="field"><span className="field-label">Password{mode === 'register' ? ' (8+ characters)' : ''}</span>
          <input className="input" type="password" required minLength={mode === 'register' ? 8 : 1} value={form.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>

        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn primary block" disabled={busy} style={{ marginTop: 16 }}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </div>
  )
}
