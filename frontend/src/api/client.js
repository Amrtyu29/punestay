// Thin fetch wrapper around the FastAPI backend.
// In dev, Vite proxies /api -> http://localhost:8000 (see vite.config.js).
// All data comes from the real API and database; there is no demo or mock data.

const BASE = import.meta.env.VITE_API_BASE || '/api'

const TOKEN_KEY = 'punestay.token'
let token = null
try { token = localStorage.getItem(TOKEN_KEY) } catch { /* private mode etc. */ }

export function getToken() { return token }
export function setToken(t) {
  token = t
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
}

export class ApiError extends Error {
  constructor(status, detail) {
    super(detail || `API error ${status}`)
    this.status = status
  }
}

function qs(params = {}) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, v)
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

async function request(method, path, { params, body, form } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  let payload
  if (form) payload = form
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }
  let res
  try {
    res = await fetch(`${BASE}${path}${qs(params)}`, { method, headers, body: payload })
  } catch {
    throw new ApiError(0, 'Cannot reach the API. Is uvicorn running on port 8000?')
  }
  if (res.status === 204) return null
  if (!res.ok) {
    let detail = res.statusText
    try {
      const j = await res.json()
      detail = typeof j.detail === 'string' ? j.detail : Array.isArray(j.detail) ? j.detail.map((d) => d.msg).join('; ') : detail
    } catch { /* ignore */ }
    if (res.status === 401 && token) {
      setToken(null)
      window.dispatchEvent(new Event('punestay:signed-out'))   // AuthProvider clears the user
    }
    throw new ApiError(res.status, detail)
  }
  return res.json()
}

const get = (path, params) => request('GET', path, { params })
const post = (path, body, params) => request('POST', path, { body, params })
const put = (path, body) => request('PUT', path, { body })
const patch = (path, body) => request('PATCH', path, { body })
const del = (path) => request('DELETE', path)

const realApi = {
  health: () => get('/health'),
  listings: (params) => get('/listings', params),
  listing: (id) => get(`/listings/${id}`),
  destinations: (q, kind) => get('/destinations', { q, kind, limit: 10 }),
  pois: (category, bbox) => get('/pois', { category, bbox, limit: 2000 }),
  listingRoute: (listingId, destinationId, mode = 'car') => get(`/route/listing/${listingId}/destination/${destinationId}`, { mode }),
  route: (from, to, mode = 'car') => get('/route', { from: `${from.lng},${from.lat}`, to: `${to.lng},${to.lat}`, mode }),
  geocode: (q) => get('/geocode', { q }),
  reverseGeocode: (lat, lng) => get('/geocode/reverse', { lat, lng }),

  // auth
  register: (body) => post('/auth/register', body),
  login: (email, password) => post('/auth/login', { email, password }),
  me: () => get('/auth/me'),

  // owner
  near: (lat, lng, name) => get('/listings/near', { lat, lng, name }),
  createListing: (body) => post('/listings', body),
  listingForEdit: (id) => get(`/listings/${id}/edit`),
  updateListing: (id, body) => put(`/listings/${id}`, body),
  deleteListing: (id) => del(`/listings/${id}`),
  setVacancy: (id, vacancy) => patch(`/listings/${id}/vacancy`, { vacancy }),
  myListings: () => get('/listings/mine/all'),
  uploadPhotos: (id, files) => {
    const form = new FormData()
    for (const f of files) form.append('files', f)
    return request('POST', `/listings/${id}/photos`, { form })
  },
  deletePhoto: (id, photoId) => del(`/listings/${id}/photos/${photoId}`),

  // community
  verify: (id, device) => post(`/listings/${id}/verify`, device),   // device = {lat, lng, accuracy_m}
  claim: (id, body) => post(`/listings/${id}/claim`, body),
  myClaim: (id) => get(`/listings/${id}/my-claim`),
  flag: (id, reason) => post(`/listings/${id}/flag`, undefined, { reason }),
  rentUpdate: (id, rent_min, rent_max) => post(`/listings/${id}/rent-update`, { rent_min, rent_max }),
  myActions: (id) => get(`/listings/${id}/my-actions`),

  // nearby services (course brief)
  nearbyCategories: () => get('/nearby/categories'),
  nearby: (params) => get('/nearby', params),

  // past flat rents (real 2021 observations)
  flatRents: (bbox, bhk) => get('/flat-rents', { bbox, bhk }),
  adminCoverage: () => get('/admin/coverage'),

  // areas and safety
  areas: (min_listings = 2) => get('/areas', { min_listings }),
  compareAreas: (a, b, destination_id) => get('/areas/compare', { a, b, destination_id }),
  rentGrid: (bbox, cell_m = 500, listing_type) => get('/areas/grid', { bbox, cell_m, listing_type }),
  safetyReports: (bbox) => get('/safety-reports', { bbox }),
  createSafetyReport: (body) => post('/safety-reports', body),

  // admin
  adminStats: () => get('/admin/stats'),
  adminFlagged: () => get('/admin/flagged'),
  adminSetStatus: (id, status) => patch(`/admin/listings/${id}/status`, { status }),
  adminPending: () => get('/admin/pending'),
  adminDecidePending: (id, decision) => patch(`/admin/pending/${id}`, { decision }),
  adminClaims: () => get('/admin/claims'),
  adminDecideClaim: (id, decision) => patch(`/admin/claims/${id}`, { decision }),
  adminUsers: () => get('/admin/users'),
}

export const api = realApi
