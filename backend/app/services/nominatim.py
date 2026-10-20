"""Geocoding through the public Nominatim service, cached in the geocode_cache table.

Nominatim's usage policy: at most 1 request per second, a real User-Agent with contact,
and no bulk geocoding. The cache plus a process-wide throttle keeps us inside that.
"""
import threading
import time

import requests

from ..config import NOMINATIM_EMAIL, NOMINATIM_URL, PUNE_BBOX

_lock = threading.Lock()
_last_call = 0.0
MIN_INTERVAL = 1.1

# Nominatim answers 403 to any User-Agent that carries a placeholder contact such as you@example.com,
# so a placeholder is treated as "not set".
_CONTACT = NOMINATIM_EMAIL if NOMINATIM_EMAIL and "example." not in NOMINATIM_EMAIL.lower() else None
HEADERS = {"User-Agent": f"PuneStay student WebGIS project/0.4 ({_CONTACT or 'no-contact-set'})"}


def _throttled_get(path: str, params: dict) -> list | dict:
    global _last_call
    with _lock:
        wait = MIN_INTERVAL - (time.monotonic() - _last_call)
        if wait > 0:
            time.sleep(wait)
        _last_call = time.monotonic()
        r = requests.get(f"{NOMINATIM_URL}{path}", params=params, headers=HEADERS, timeout=15)
        r.raise_for_status()
        return r.json()


def search(cur, q: str) -> dict | None:
    """Forward geocode within Pune. Returns {lat, lng, display} or None. Cached in geocode_cache."""
    key = q.strip().lower()
    cur.execute("SELECT lat, lng, display FROM geocode_cache WHERE query = %s", (key,))
    hit = cur.fetchone()
    if hit:
        return None if hit["lat"] is None else dict(hit)

    b = PUNE_BBOX
    results = _throttled_get("/search", {
        "q": q, "format": "jsonv2", "limit": 1, "countrycodes": "in",
        "viewbox": f"{b['west']},{b['north']},{b['east']},{b['south']}", "bounded": 1,
    })
    if results:
        out = {"lat": float(results[0]["lat"]), "lng": float(results[0]["lon"]), "display": results[0].get("display_name")}
    else:
        out = None
    cur.execute(
        "INSERT INTO geocode_cache (query, lat, lng, display) VALUES (%s, %s, %s, %s) ON CONFLICT (query) DO NOTHING",
        (key, out["lat"] if out else None, out["lng"] if out else None, out["display"] if out else None),
    )
    return out


def reverse(cur, lat: float, lng: float) -> str | None:
    """Reverse geocode a pin to a short address line. Cached by rounded coordinate."""
    key = f"rev:{lat:.5f},{lng:.5f}"
    cur.execute("SELECT display FROM geocode_cache WHERE query = %s", (key,))
    hit = cur.fetchone()
    if hit:
        return hit["display"]
    res = _throttled_get("/reverse", {"lat": lat, "lon": lng, "format": "jsonv2", "zoom": 17})
    display = None
    if isinstance(res, dict) and res.get("address"):
        a = res["address"]
        parts = [a.get("road"), a.get("neighbourhood") or a.get("suburb"), a.get("city") or a.get("town") or "Pune"]
        display = ", ".join(p for p in parts if p)
    cur.execute(
        "INSERT INTO geocode_cache (query, lat, lng, display) VALUES (%s, %s, %s, %s) ON CONFLICT (query) DO NOTHING",
        (key, lat, lng, display),
    )
    return display
