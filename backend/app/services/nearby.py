"""Nearest POIs around a point, and the derived-column refresh for one listing.

The SQL here mirrors scripts/compute_derived.py so a newly added listing gets the same
nearest_* and safety_score values as the bulk job.
"""

NEARBY_CATEGORIES = ("bus_stop", "metro", "mess", "hospital", "pharmacy", "atm", "grocery", "police")

NEARBY_SQL = """
SELECT p.id, p.category, p.name,
       ST_Distance(p.geom::geography, pt.g::geography)::int AS distance_m,
       ST_Y(p.geom) AS lat, ST_X(p.geom) AS lng
FROM (SELECT ST_SetSRID(ST_MakePoint(%(lng)s, %(lat)s), 4326) AS g) pt
CROSS JOIN LATERAL (
  SELECT id, category, name, geom
  FROM pois
  WHERE category = %(cat)s
    AND ST_DWithin(geom::geography, pt.g::geography, %(radius)s)
  ORDER BY geom <-> pt.g
  LIMIT %(k)s
) p
"""


def nearby(cur, lat: float, lng: float, categories=NEARBY_CATEGORIES, k: int = 3, radius_m: int = 3000) -> dict:
    out: dict[str, list[dict]] = {}
    for cat in categories:
        cur.execute(NEARBY_SQL, {"lat": lat, "lng": lng, "cat": cat, "radius": radius_m, "k": k})
        out[cat] = cur.fetchall()
    return out


NEAREST_ONE_SQL = """
UPDATE listings l
SET nearest_{col}_id = p.id, nearest_{col}_m = p.dist_m
FROM (
  SELECT p.id, ST_Distance(p.geom::geography, l2.geom::geography)::int AS dist_m
  FROM listings l2, LATERAL (
    SELECT id, geom FROM pois WHERE category = %(cat)s ORDER BY geom <-> l2.geom LIMIT 1
  ) p
  WHERE l2.id = %(id)s
) p
WHERE l.id = %(id)s
"""

SAFETY_ONE_SQL = """
WITH has_lamps AS (
  SELECT (SELECT count(*) FROM pois WHERE category = 'street_lamp') > 2000 AS yes
),
pl AS (
  SELECT l.id,
         (SELECT count(*) FROM pois p WHERE p.category = 'street_lamp'
            AND ST_DWithin(p.geom::geography, l.geom::geography, 200)) AS lamps,
         (SELECT min(ST_Distance(p.geom::geography, l.geom::geography)) FROM pois p
            WHERE p.category = 'police') AS police_m,
         (SELECT count(*) FROM pois p WHERE p.category IN ('mess', 'grocery', 'atm', 'pharmacy')
            AND ST_DWithin(p.geom::geography, l.geom::geography, 300)) AS shops,
         (SELECT count(*) FROM safety_reports r
            WHERE ST_DWithin(r.geom::geography, l.geom::geography, 300)
              AND r.created_at > now() - interval '6 months') AS reports
  FROM listings l WHERE l.id = %(id)s
),
s AS (
  SELECT pl.id,
         CASE WHEN h.yes THEN LEAST(40, pl.lamps * 4) ELSE 0 END AS lamp_pts,
         CASE WHEN pl.police_m IS NULL THEN 5 WHEN pl.police_m < 500 THEN 20
              WHEN pl.police_m < 1500 THEN 12 ELSE 5 END AS police_pts,
         LEAST(20, pl.shops * 2) AS shop_pts,
         LEAST(20, pl.reports * 5) AS report_pen,
         CASE WHEN h.yes THEN 80.0 ELSE 40.0 END AS max_pts
  FROM pl, has_lamps h
)
UPDATE listings l
SET safety_score = GREATEST(0, LEAST(100,
      ROUND(((s.lamp_pts + s.police_pts + s.shop_pts) * 100.0 / s.max_pts) - s.report_pen)::int))
FROM s WHERE l.id = s.id
"""


def refresh_derived(cur, listing_id: int) -> None:
    """Recompute nearest POIs and safety score for one listing (called after insert/update)."""
    for col in ("bus_stop", "metro", "mess", "hospital"):
        cur.execute(NEAREST_ONE_SQL.format(col=col), {"cat": col, "id": listing_id})
    cur.execute(SAFETY_ONE_SQL, {"id": listing_id})
