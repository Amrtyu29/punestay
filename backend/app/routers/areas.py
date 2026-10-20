"""Area statistics: per-locality summaries, side-by-side comparison, and a rent heatmap grid.

Localities come from OpenStreetMap place nodes (pois.category = 'locality'); each listing belongs
to its nearest locality point. When ward polygons are loaded (wards table) they are used instead
for the /areas/wards endpoint.
"""
from fastapi import APIRouter, Depends, HTTPException, Query

from ..config import RENT_UPLIFT
from ..db import get_cursor
from ..geo import parse_bbox
from ..services.osrm import fill_commutes

router = APIRouter(prefix="/areas", tags=["areas"])

# Listing -> nearest locality, computed on the fly (fast enough for a few thousand rows thanks to the GIST index).
LISTING_LOCALITY = """
  SELECT l.id, l.listing_type, l.rent_min, l.vacancy, l.safety_score, l.status,
         l.nearest_bus_stop_m, l.nearest_metro_m, l.nearest_mess_m, l.nearest_hospital_m,
         ST_X(l.geom) AS lng, ST_Y(l.geom) AS lat,
         loc.id AS locality_id, loc.name AS locality
  FROM listings l
  CROSS JOIN LATERAL (
    -- Prefer well-known localities (tags.major, set by scripts/load_extra_localities.py); fall back to any OSM place.
    SELECT p.id, p.name FROM pois p WHERE p.category = 'locality' AND p.name IS NOT NULL
    ORDER BY (p.tags->>'major' IS DISTINCT FROM 'true'), p.geom <-> l.geom LIMIT 1
  ) loc
  WHERE l.status <> 'hidden'
"""

STATS = """
  SELECT locality_id, locality,
         count(*)::int AS listings,
         count(*) FILTER (WHERE listing_type = 'pg')::int AS pgs,
         count(*) FILTER (WHERE listing_type = 'flat')::int AS flats,
         count(*) FILTER (WHERE listing_type = 'hostel')::int AS hostels,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY rent_min)::int AS median_rent,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY rent_min) FILTER (WHERE listing_type = 'pg')::int AS median_rent_pg,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY rent_min) FILTER (WHERE listing_type = 'flat')::int AS median_rent_flat,
         min(rent_min)::int AS min_rent, max(rent_min)::int AS max_rent,
         round(avg(safety_score))::int AS avg_safety,
         -- share of listings whose owner reports rooms available, among those with a known status
         round(100.0 * count(*) FILTER (WHERE vacancy) / NULLIF(count(vacancy), 0))::int AS pct_vacant,
         round(avg(nearest_bus_stop_m))::int AS avg_bus_stop_m,
         round(avg(nearest_metro_m))::int AS avg_metro_m,
         round(avg(nearest_mess_m))::int AS avg_mess_m,
         round(avg(nearest_hospital_m))::int AS avg_hospital_m,
         round(avg(lng)::numeric, 5)::float AS lng, round(avg(lat)::numeric, 5)::float AS lat
  FROM ({inner}) t
  {where}
  GROUP BY locality_id, locality
"""


@router.get("", summary="Every locality with at least `min_listings` listings, with rent and safety stats")
def list_areas(min_listings: int = Query(3, ge=1), cur=Depends(get_cursor)):
    cur.execute(STATS.format(inner=LISTING_LOCALITY, where="") + " HAVING count(*) >= %s ORDER BY listings DESC", (min_listings,))
    return cur.fetchall()


@router.get("/compare", summary="Two localities side by side, optionally with commute to a destination")
def compare(a: int = Query(..., description="locality id"), b: int = Query(..., description="locality id"),
            destination_id: int | None = None, cur=Depends(get_cursor)):
    cur.execute(STATS.format(inner=LISTING_LOCALITY, where="WHERE locality_id IN (%(a)s, %(b)s)"), {"a": a, "b": b})
    rows = {r["locality_id"]: r for r in cur.fetchall()}
    if a not in rows or b not in rows:
        raise HTTPException(404, "One of the localities has no listings")

    if destination_id is not None:
        # Average commute of each locality's listings to the destination (uses / fills the commute cache).
        cur.execute(
            f"""SELECT t.id, t.lng, t.lat, t.locality_id, cc.duration_s AS commute_s, cc.distance_m AS commute_m
                FROM ({LISTING_LOCALITY}) t
                LEFT JOIN commute_cache cc ON cc.listing_id = t.id AND cc.destination_id = %s AND cc.mode = 'car'
                WHERE t.locality_id IN (%s, %s)""",
            (destination_id, a, b),
        )
        listings = cur.fetchall()
        fill_commutes(cur, destination_id, "car", listings)
        for lid in (a, b):
            secs = [l["commute_s"] for l in listings if l["locality_id"] == lid and l.get("commute_s") is not None]
            rows[lid]["avg_commute_s"] = int(sum(secs) / len(secs)) if secs else None
            rows[lid]["commute_known"] = len(secs)

    # Real past flat rents (rent_observations) belonging to each locality, uplifted to a 2025 estimate.
    for lid in (a, b):
        cur.execute(
            """SELECT count(*)::int AS n,
                      percentile_cont(0.5) WITHIN GROUP (ORDER BY r.rent) FILTER (WHERE r.bhk = 1) AS m1,
                      percentile_cont(0.5) WITHIN GROUP (ORDER BY r.rent) FILTER (WHERE r.bhk = 2) AS m2
               FROM rent_observations r
               CROSS JOIN LATERAL (
                 SELECT p.id FROM pois p WHERE p.category = 'locality' AND p.name IS NOT NULL
                 ORDER BY (p.tags->>'major' IS DISTINCT FROM 'true'), p.geom <-> r.geom LIMIT 1
               ) loc
               WHERE ST_DWithin(r.geom, (SELECT geom FROM pois WHERE id = %(lid)s), 0.05) AND loc.id = %(lid)s""",
            {"lid": lid},
        )
        f = cur.fetchone()
        rnd = lambda v: int(round(v * RENT_UPLIFT / 100.0) * 100) if v is not None else None
        rows[lid].update(flat_obs=f["n"], flat_1bhk_est=rnd(f["m1"]), flat_2bhk_est=rnd(f["m2"]))

    return {"a": rows[a], "b": rows[b]}


@router.get("/grid", summary="Rent heatmap: square grid cells with the median of real observed rents (GeoJSON)")
def grid(bbox: str = Query(..., description="west,south,east,north"), cell_m: int = Query(500, ge=200, le=2000),
         source: str = Query("flats", pattern="^(flats|listings)$",
                             description="flats = real 2021 flat rents placed on buildings; listings = published listing rents"),
         listing_type: str | None = Query(None, pattern="^(pg|flat|hostel)$"), cur=Depends(get_cursor)):
    w, s, e, n = parse_bbox(bbox)
    if (e - w) * (n - s) > 0.25:
        raise HTTPException(400, "Zoom in: the bbox is too large for the grid")
    env = "ST_MakeEnvelope(%(w)s, %(s)s, %(e)s, %(n)s, 4326)"
    if source == "flats":
        pts = f"""SELECT ST_Transform(r.geom, 3857) AS g, r.rent FROM rent_observations r
                  WHERE r.precision = 'building' AND r.geom && {env}"""
    else:
        type_filter = "AND l.listing_type = %(type)s" if listing_type else ""
        pts = f"""SELECT ST_Transform(l.geom, 3857) AS g, l.rent_min AS rent FROM listings l
                  WHERE l.status <> 'hidden' AND l.rent_min IS NOT NULL AND l.geom && {env} {type_filter}"""
    cur.execute(
        f"""WITH env AS (SELECT ST_Transform({env}, 3857) AS g),
            cells AS (SELECT (ST_SquareGrid(%(cell)s, env.g)).geom AS cell FROM env),
            pts AS ({pts})
            SELECT ST_AsGeoJSON(ST_Transform(c.cell, 4326))::json AS geometry,
                   count(p.g)::int AS listings,
                   percentile_cont(0.5) WITHIN GROUP (ORDER BY p.rent)::int AS median_rent
            FROM cells c JOIN pts p ON ST_Contains(c.cell, p.g)
            GROUP BY c.cell""",
        {"w": w, "s": s, "e": e, "n": n, "cell": cell_m, "type": listing_type},
    )
    feats = [{"type": "Feature", "geometry": r["geometry"], "properties": {"listings": r["listings"], "median_rent": r["median_rent"]}} for r in cur.fetchall()]
    return {"type": "FeatureCollection", "features": feats, "count": len(feats)}


@router.get("/wards", summary="Ward polygons with listing stats (only if wards were loaded)")
def wards(cur=Depends(get_cursor)):
    cur.execute(
        """SELECT w.id, w.name, ST_AsGeoJSON(ST_SimplifyPreserveTopology(w.geom, 0.0002))::json AS geometry,
                  count(l.id)::int AS listings,
                  percentile_cont(0.5) WITHIN GROUP (ORDER BY l.rent_min)::int AS median_rent,
                  round(avg(l.safety_score))::int AS avg_safety
           FROM wards w LEFT JOIN listings l ON l.status <> 'hidden' AND ST_Contains(w.geom, l.geom)
           GROUP BY w.id, w.name, w.geom ORDER BY w.name"""
    )
    rows = cur.fetchall()
    feats = [{"type": "Feature", "id": r["id"], "geometry": r["geometry"],
              "properties": {k: r[k] for k in ("name", "listings", "median_rent", "avg_safety")}} for r in rows]
    return {"type": "FeatureCollection", "features": feats, "count": len(feats)}
