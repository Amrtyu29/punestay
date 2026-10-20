export const rupees = (n) => (n == null ? '—' : `₹${Number(n).toLocaleString('en-IN')}`)

export const rupeesShort = (n) => (n >= 1000 ? `₹${(n / 1000).toFixed(n % 1000 ? 1 : 0)}k` : rupees(n))

export const metres = (m) => (m == null ? '—' : m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`)

export const minutes = (s) => (s == null ? '—' : `${Math.max(1, Math.round(s / 60))} min`)

export const TYPE_LABEL = { pg: 'PG', flat: 'Flat', hostel: 'Hostel' }
export const GENDER_LABEL = { male: 'Boys only', female: 'Girls only', any: 'Anyone' }

export const CATEGORY_LABEL = {
  bus_stop: 'Bus stop',
  metro: 'Metro station',
  mess: 'Mess / food',
  hospital: 'Hospital',
  pharmacy: 'Pharmacy',
  atm: 'ATM / bank',
  grocery: 'Grocery',
  police: 'Police station',
}

export function safetyLevel(score) {
  if (score == null) return { text: 'Not rated', cls: '' }
  if (score >= 70) return { text: `${score} · Good`, cls: 'good' }
  if (score >= 45) return { text: `${score} · Okay`, cls: 'mid' }
  return { text: `${score} · Low`, cls: 'bad' }
}
