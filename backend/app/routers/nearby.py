"""Nearby Services: the course-brief feature. Given a point, return services around it.

- category and optional subcategory filtering
- search by radius, by nearest-N, or both (within radius, at most N)
- results sorted by road-free straight-line distance in metres (PostGIS geography, EPSG:4326 -> WGS84 ellipsoid)
- explicit, friendly errors for bad input and an explicit empty result
"""
from fastapi import APIRouter, Depends, HTTPException, Query

from ..config import PUNE_BBOX
from ..db import get_cursor
from ..geo import collection, in_pune

router = APIRouter(prefix="/nearby", tags=["nearby services"])

# Human labels for the map legend and pickers. Keys are pois.category values.
CATEGORIES = {
    "hospital": "Hospitals and clinics", "pharmacy": "Pharmacies", "police": "Police stations",
    "fire_station": "Fire stations", "atm": "ATMs and banks", "bank": "Banks", "school": "Schools",
    "college": "Colleges", "fuel": "Fuel and charging", "park": "Parks and gardens", "bus_stop": "Bus stops",
    "metro": "Metro stations", "mess": "Food and mess", "grocery": "Grocery", "post_office": "Post offices",
    "library": "Libraries", "place_of_worship": "Places of worship", "toilets": "Public toilets",
    "office": "Offices and IT parks", "lodging": "Hostels and PGs",
}

SUBCATEGORY_SQL = """COALESCE(p.tags->>'amenity', p.tags->>'shop', p.tags->>'leisure', p.tags->>'railway',
                              p.tags->>'highway', p.tags->>'office', p.tags->>'tourism', p.category)"""


def _origin(lat: float | None, lng: float | None) -> tuple[float, float]:
    if lat is None or lng is None:
        raise HTTPException(400, "Give a location: lat and lng (click the map, type coordinates, or use your location).")
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise HTTPException(400, "Latitude must be between -90 and 90 and longitude between -180 and 180.")
    if not in_pune(lat, lng):
        b = PUNE_BBOX
        raise HTTPException(400, f"That point is outside the Pune area covered by this app "
                                 f"(lat {b['south']}–{b['north']}, lng {b['west']}–{b['east']}).")
    return lat, lng


@router.get("/categories", summary="Service categories with counts and their subcategories")
def categories(cur=Depends(get_cursor)):
    cur.execute(
        f"""SELECT p.category, {SUBCATEGORY_SQL} AS subcategory, count(*)::int AS n
            FROM pois p WHERE p.category NOT IN ('locality', 'street_lamp')
            GROUP BY 1, 2 ORDER BY 1, 3 DESC"""
    )
    out: dict[str, dict] = {}
    for r in cur.fetchall():
        c = out.setdefault(r["category"], {"category": r["category"], "label": CATEGORIES.get(r["category"], r["category"]), "count": 0, "subcategories": []})
        c["count"] += r["n"]
        c["subcategories"].append({"subcategory": r["subcategory"], "count": r["n"]})
    order = list(CATEGORIES)
    return sorted(out.values(), key=lambda c: order.index(c["category"]) if c["category"] in order else 99)


@router.get("", summary="Services near a point, sorted by distance")
def nearby(
    cur=Depends(get_cursor),
    lat: float | None = Query(None, description="origin latitude (WGS84)"),
    lng: float | None = Query(None, description="origin longitude (WGS84)"),
    category: str | None = Query(None, description="one or more pois categories, comma separated; empty = all"),
    subcategory: str | None = Query(None, description="OSM value, e.g. clinic, kindergarten, charging_station"),
    radius_m: int | None = Query(None, ge=50, le=25000, description="search radius in metres"),
    limit: int | None = Query(None, ge=1, le=200, description="nearest N"),
    q: str | None = Query(None, max_length=80, description="name contains"),
):
    olat, olng = _origin(lat, lng)
    if radius_m is None and limit is None:
        radius_m, limit = 2000, 20   # sensible default: 20 nearest within 2 km
    cats = [c.strip() for c in (category or "").split(",") if c.strip()]
    unknown = [c for c in cats if c not in CATEGORIES]
    if unknown:
        raise HTTPException(400, f"Unknown category: {', '.join(unknown)}. See /nearby/categories.")

    where, params = ["p.category NOT IN ('locality', 'street_lamp')"], {"lat": olat, "lng": olng}
    if cats:
        where.append("p.category = ANY(%(cats)s)")
        params["cats"] = cats
    if subcategory:
        where.append(f"{SUBCATEGORY_SQL} = %(sub)s")
        params["sub"] = subcategory.strip().lower()
    if q:
        where.append("p.name ILIKE %(q)s")
        params["q"] = f"%{q.strip()}%"
    if radius_m is not None:
        where.append("ST_DWithin(p.geom::geography, o.g::geography, %(radius)s)")
        params["radius"] = radius_m
    params["limit"] = limit or 200

    cur.execute(
        f"""SELECT p.id, p.category, {SUBCATEGORY_SQL} AS subcategory, p.name,
                   p.tags->>'phone' AS phone, p.tags->>'website' AS website, p.tags->>'opening_hours' AS opening_hours,
                   concat_ws(', ', p.tags->>'addr:housename', p.tags->>'addr:street', p.tags->>'addr:suburb') AS address,
                   ST_Distance(p.geom::geography, o.g::geography)::int AS distance_m,
                   degrees(ST_Azimuth(o.g, p.geom))::int AS bearing_deg,
                   ST_Y(p.geom) AS lat, ST_X(p.geom) AS lng
            FROM (SELECT ST_SetSRID(ST_MakePoint(%(lng)s, %(lat)s), 4326) AS g) o, pois p
            WHERE {' AND '.join(where)}
            ORDER BY p.geom <-> o.g
            LIMIT %(limit)s""",
        params,
    )
    rows = cur.fetchall()
    for r in rows:
        r["label"] = CATEGORIES.get(r["category"], r["category"])
        r["address"] = r["address"] or None
    fc = collection(rows)
    fc["count"] = len(rows)
    fc["origin"] = {"lat": olat, "lng": olng}
    fc["query"] = {"category": cats or None, "subcategory": subcategory, "radius_m": radius_m, "limit": limit}
    if not rows:
        fc["message"] = (f"No {', '.join(CATEGORIES.get(c, c).lower() for c in cats) if cats else 'services'} "
                         f"found{f' within {radius_m} m' if radius_m else ''}. Try a larger radius or another category.")
    return fc
