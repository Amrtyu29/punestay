from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from ..db import get_cursor
from ..geo import in_pune
from ..services import nominatim, osrm

router = APIRouter(tags=["routing"])


def _lnglat(value: str, name: str) -> tuple[float, float]:
    try:
        lng, lat = (float(x) for x in value.split(","))
    except ValueError as exc:
        raise HTTPException(400, f"{name} must be 'lng,lat'") from exc
    if not in_pune(lat, lng):
        raise HTTPException(400, f"{name} is outside the Pune area")
    return lng, lat


@router.get("/route", summary="Road route between two points (GeoJSON line, duration, distance)")
def get_route(
    frm: str = Query(..., alias="from", description="lng,lat"),
    to: str = Query(..., description="lng,lat"),
    mode: Literal["car", "bike", "foot"] = "car",
):
    f, t = _lnglat(frm, "from"), _lnglat(to, "to")
    try:
        return osrm.route(f[0], f[1], t[0], t[1], mode)
    except (RuntimeError, KeyError, IndexError) as exc:
        raise HTTPException(503, f"Routing unavailable: {exc}") from exc


@router.get("/route/listing/{listing_id}/destination/{destination_id}", summary="Route from a listing to a destination")
def listing_route(listing_id: int, destination_id: int, mode: Literal["car", "bike", "foot"] = "car", cur=Depends(get_cursor)):
    cur.execute("SELECT ST_X(geom) AS lng, ST_Y(geom) AS lat FROM listings WHERE id = %s", (listing_id,))
    l = cur.fetchone()
    cur.execute("SELECT ST_X(geom) AS lng, ST_Y(geom) AS lat FROM destinations WHERE id = %s", (destination_id,))
    d = cur.fetchone()
    if not l or not d:
        raise HTTPException(404, "Listing or destination not found")
    try:
        r = osrm.route(l["lng"], l["lat"], d["lng"], d["lat"], mode)
    except (RuntimeError, KeyError, IndexError) as exc:
        raise HTTPException(503, f"Routing unavailable: {exc}") from exc
    cur.execute(
        """INSERT INTO commute_cache (listing_id, destination_id, mode, duration_s, distance_m)
           VALUES (%s, %s, %s, %s, %s)
           ON CONFLICT (listing_id, destination_id, mode)
           DO UPDATE SET duration_s = EXCLUDED.duration_s, distance_m = EXCLUDED.distance_m, computed_at = now()""",
        (listing_id, destination_id, mode, r["duration_s"], r["distance_m"]),
    )
    return r


@router.get("/geocode", summary="Address to coordinates within Pune (cached, 1 req/s to Nominatim)")
def geocode(q: str = Query(..., min_length=3, max_length=200), cur=Depends(get_cursor)):
    try:
        hit = nominatim.search(cur, q)
    except Exception as exc:  # network or Nominatim error
        raise HTTPException(503, f"Geocoding unavailable: {exc}") from exc
    if not hit:
        raise HTTPException(404, "No match inside Pune. Try adding the locality name, or drop the pin by hand.")
    return hit


@router.get("/geocode/reverse", summary="Pin to a short address line")
def reverse_geocode(lat: float = Query(..., ge=-90, le=90), lng: float = Query(..., ge=-180, le=180), cur=Depends(get_cursor)):
    if not in_pune(lat, lng):
        raise HTTPException(400, "Point is outside the Pune area")
    try:
        display = nominatim.reverse(cur, lat, lng)
    except Exception as exc:
        raise HTTPException(503, f"Geocoding unavailable: {exc}") from exc
    return {"lat": lat, "lng": lng, "display": display}
