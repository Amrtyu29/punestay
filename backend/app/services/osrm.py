"""Routing and commute times from OSRM, cached in commute_cache.

Two routers are tried in order:
  1. OSRM_URL           your own OSRM container (docker compose --profile routing up -d)
  2. OSRM_FALLBACK_URL  the public demo server, router.project-osrm.org, which covers India.
                        It is for demos and testing only (no SLA, rate limited), so results are
                        cached and batches stay under its 100-coordinate table limit.
If neither answers, listings simply come back without commute fields and nothing fails.
"""
import logging
import time

import requests

from ..config import OSRM_FALLBACK_URL, OSRM_URL

log = logging.getLogger(__name__)

PROFILE = {"car": "driving", "bike": "driving", "foot": "driving"}  # one OSRM graph for now
TABLE_BATCH = 99  # public demo server: max 100 coordinates per table request (1 source + 99)
HEADERS = {"User-Agent": "PuneStay student WebGIS project/0.4"}
TIMEOUT = 20

_routers = [u for u in (OSRM_URL, OSRM_FALLBACK_URL) if u]
_down_until: dict[str, float] = {}  # router url -> time until which we skip it


def _candidates() -> list[str]:
    now = time.monotonic()
    return [u for u in _routers if _down_until.get(u, 0) <= now]


def _get(path: str, params: dict) -> dict:
    """Try each router in order; remember a failing one for 60 s so every request does not wait."""
    last_exc: Exception | None = None
    for base in _candidates():
        try:
            r = requests.get(f"{base}{path}", params=params, headers=HEADERS, timeout=TIMEOUT)
            r.raise_for_status()
            body = r.json()
            if body.get("code") != "Ok":
                raise RuntimeError(f"OSRM {body.get('code')}: {body.get('message', '')}")
            return body
        except (requests.RequestException, RuntimeError, ValueError) as exc:
            last_exc = exc
            _down_until[base] = time.monotonic() + 60
            log.warning("router %s failed (%s); trying next", base, exc)
    raise RuntimeError(f"no router available: {last_exc}")


def route(from_lng: float, from_lat: float, to_lng: float, to_lat: float, mode: str = "car") -> dict:
    """Returns {duration_s, distance_m, geometry (GeoJSON LineString)} for one trip."""
    body = _get(
        f"/route/v1/{PROFILE.get(mode, 'driving')}/{from_lng},{from_lat};{to_lng},{to_lat}",
        {"overview": "full", "geometries": "geojson", "steps": "false", "alternatives": "false"},
    )
    r = body["routes"][0]
    return {
        "duration_s": int(round(r["duration"])),
        "distance_m": int(round(r["distance"])),
        "geometry": r["geometry"],
    }


def _table(dest_lng: float, dest_lat: float, points: list[tuple[int, float, float]], mode: str) -> dict[int, tuple[int, int]]:
    """Returns {listing_id: (duration_s, distance_m)} for the given (id, lng, lat) points."""
    coords = ";".join([f"{dest_lng},{dest_lat}"] + [f"{lng},{lat}" for _, lng, lat in points])
    body = _get(f"/table/v1/{PROFILE.get(mode, 'driving')}/{coords}", {"sources": "0", "annotations": "duration,distance"})
    durations = body["durations"][0][1:]
    distances = body["distances"][0][1:]
    out = {}
    for (lid, _, _), dur, dist in zip(points, durations, distances):
        if dur is not None and dist is not None:
            out[lid] = (int(round(dur)), int(round(dist)))
    return out


def fill_commutes(cur, destination_id: int, mode: str, rows: list[dict]) -> None:
    """For rows lacking commute_s, ask OSRM and store results in commute_cache.
    Mutates rows in place to add commute_s / commute_m. Silently skips if no router answers."""
    missing = [r for r in rows if r.get("commute_s") is None]
    if not missing:
        return

    cur.execute("SELECT ST_X(geom) AS lng, ST_Y(geom) AS lat FROM destinations WHERE id = %s", (destination_id,))
    dest = cur.fetchone()
    if not dest:
        return

    for i in range(0, len(missing), TABLE_BATCH):
        batch = missing[i:i + TABLE_BATCH]
        points = [(r["id"], r["lng"], r["lat"]) for r in batch]
        try:
            result = _table(dest["lng"], dest["lat"], points, mode)
        except (RuntimeError, KeyError) as exc:
            log.warning("commute fill skipped: %s", exc)
            return
        cur.executemany(
            """INSERT INTO commute_cache (listing_id, destination_id, mode, duration_s, distance_m)
               VALUES (%s, %s, %s, %s, %s)
               ON CONFLICT (listing_id, destination_id, mode)
               DO UPDATE SET duration_s = EXCLUDED.duration_s, distance_m = EXCLUDED.distance_m,
                             computed_at = now()""",
            [(lid, destination_id, mode, d, m) for lid, (d, m) in result.items()],
        )
        for r in batch:
            if r["id"] in result:
                r["commute_s"], r["commute_m"] = result[r["id"]]
