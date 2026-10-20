/** Browser geolocation as a promise with plain-English errors. Resolves {lat, lng, accuracy_m}. */
export function locateDevice({ timeout = 12000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Your browser does not support location, so this action is not available here.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), accuracy_m: Math.round(p.coords.accuracy || 0) }),
      (err) => {
        const msg = {
          1: 'Location permission was denied. Allow location for this site to confirm places or report spots.',
          2: 'Your position is unavailable right now. Try again outdoors or with GPS on.',
          3: 'Finding your location timed out. Try again.',
        }[err.code] || 'Could not get your location.'
        reject(new Error(msg))
      },
      { enableHighAccuracy: true, timeout, maximumAge: 30000 },
    )
  })
}
