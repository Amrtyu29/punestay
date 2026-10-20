from fastapi import APIRouter, Depends, HTTPException, Query

from ..db import get_cursor
from ..geo import collection, parse_bbox
from ..services.nearby import nearby

router = APIRouter(prefix="/pois", tags=["pois"])

CATEGORIES = ("bus_stop", "metro", "mess", "hospital", "pharmacy", "atm", "grocery",
              "police", "street_lamp", "college", "office", "locality")


@router.get("/categories", summary="POI categories and counts")
def categories(cur=Depends(get_cursor)):
    cur.execute("SELECT category, count(*) AS count FROM pois GROUP BY category ORDER BY category")
    return cur.fetchall()


@router.get("", summary="POI layer for the map, as GeoJSON")
def list_pois(
    cur=Depends(get_cursor),
    category: str = Query(..., description="one of " + ", ".join(CATEGORIES)),
    bbox: str | None = Query(None, description="west,south,east,north"),
    q: str | None = Query(None, description="name contains"),
    limit: int = Query(1000, ge=1, le=5000),
):
    if category not in CATEGORIES:
        raise HTTPException(400, f"category must be one of {CATEGORIES}")
    where, params = ["category = %(cat)s"], {"cat": category, "limit": limit}
    b = parse_bbox(bbox)
    if b:
        where.append("geom && ST_MakeEnvelope(%(w)s, %(s)s, %(e)s, %(n)s, 4326)")
        params.update(w=b[0], s=b[1], e=b[2], n=b[3])
    if q:
        where.append("name ILIKE %(q)s")
        params["q"] = f"%{q}%"
    cur.execute(
        f"""SELECT id, category, name, ST_Y(geom) AS lat, ST_X(geom) AS lng
            FROM pois WHERE {' AND '.join(where)}
            ORDER BY name NULLS LAST LIMIT %(limit)s""",
        params,
    )
    rows = cur.fetchall()
    fc = collection(rows)
    fc["count"] = len(rows)
    return fc


@router.get("/nearby", summary="Nearest POIs around any point (used by the Add Listing form preview)")
def pois_nearby(
    cur=Depends(get_cursor),
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    k: int = Query(3, ge=1, le=10),
    radius_m: int = Query(3000, ge=100, le=10000),
):
    return {"lat": lat, "lng": lng, "nearby": nearby(cur, lat, lng, k=k, radius_m=radius_m)}
