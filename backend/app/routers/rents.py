"""Past flat rents (rent_observations): real observed rents, shown as a reference layer, never as listings."""
from fastapi import APIRouter, Depends, HTTPException, Query

from ..config import RENT_UPLIFT
from ..db import get_cursor
from ..geo import parse_bbox

router = APIRouter(prefix="/flat-rents", tags=["flat rents"])


@router.get("", summary="Past flat rents aggregated per housing society (GeoJSON points)")
def flat_rents(bbox: str = Query(..., description="west,south,east,north"), bhk: int | None = Query(None, ge=1, le=6),
               cur=Depends(get_cursor)):
    w, s, e, n = parse_bbox(bbox)
    params = {"w": w, "s": s, "e": e, "n": n, "bhk": bhk, "f": RENT_UPLIFT}
    cur.execute(
        """SELECT osm_ref, min(society) AS society, min(locality) AS locality, count(*)::int AS n,
                  percentile_cont(0.5) WITHIN GROUP (ORDER BY rent)::int AS median_rent,
                  percentile_cont(0.5) WITHIN GROUP (ORDER BY rent) FILTER (WHERE bhk = 1)::int AS median_1bhk,
                  percentile_cont(0.5) WITHIN GROUP (ORDER BY rent) FILTER (WHERE bhk = 2)::int AS median_2bhk,
                  percentile_cont(0.5) WITHIN GROUP (ORDER BY rent) FILTER (WHERE bhk = 3)::int AS median_3bhk,
                  round(percentile_cont(0.5) WITHIN GROUP (ORDER BY rent) * %(f)s / 100)::int * 100 AS est_2025,
                  min(year) AS year, ST_X(ST_Centroid(ST_Collect(geom))) AS lng, ST_Y(ST_Centroid(ST_Collect(geom))) AS lat
           FROM rent_observations
           WHERE precision = 'building' AND geom && ST_MakeEnvelope(%(w)s, %(s)s, %(e)s, %(n)s, 4326)
             AND (%(bhk)s::int IS NULL OR bhk = %(bhk)s::int)
           GROUP BY osm_ref ORDER BY n DESC LIMIT 3000""",
        params,
    )
    rows = cur.fetchall()
    feats = [{"type": "Feature", "id": r["osm_ref"], "geometry": {"type": "Point", "coordinates": [r["lng"], r["lat"]]},
              "properties": {k: v for k, v in r.items() if k not in ("lng", "lat")}} for r in rows]
    return {"type": "FeatureCollection", "features": feats, "count": len(feats), "uplift": RENT_UPLIFT}


@router.get("/summary", summary="How many observations, how precisely placed")
def summary(cur=Depends(get_cursor)):
    cur.execute("""SELECT source, year, precision, count(*)::int AS n,
                          percentile_cont(0.5) WITHIN GROUP (ORDER BY rent)::int AS median_rent
                   FROM rent_observations GROUP BY 1, 2, 3 ORDER BY 1, 2, 3""")
    rows = cur.fetchall()
    if not rows:
        raise HTTPException(404, "No rent observations loaded. Run scripts/build_rent_observations.py")
    return {"uplift_2021_2025": RENT_UPLIFT, "groups": rows}
