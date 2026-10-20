"""Computes derived columns for listings: nearest POIs and the night safety score.

Run after loading POIs and listings. Safe to rerun any time.
The backend will call the same SQL for a single listing after insert/update.

Usage:
    python scripts/compute_derived.py            # all listings
    python scripts/compute_derived.py 42         # one listing id
"""
import sys

from common import connect

NEAREST = {
    "bus_stop": "bus_stop",
    "metro": "metro",
    "mess": "mess",
    "hospital": "hospital",
}

# For one category, find the nearest POI for every listing (or one listing) using the
# KNN operator <-> on the GIST index, then store id and distance in metres.
NEAREST_SQL = """
UPDATE listings l
SET nearest_{col}_id = n.id,
    nearest_{col}_m  = n.dist_m
FROM (
  SELECT l2.id AS listing_id, p.id, p.dist_m
  FROM listings l2
  CROSS JOIN LATERAL (
    SELECT p.id,
           ST_Distance(p.geom::geography, l2.geom::geography)::int AS dist_m
    FROM pois p
    WHERE p.category = %(cat)s
    ORDER BY p.geom <-> l2.geom
    LIMIT 1
  ) p
  WHERE (%(id)s::int IS NULL OR l2.id = %(id)s::int)
) n
WHERE l.id = n.listing_id
"""

# Safety score 0..100:
#   street lights within 200 m        up to 40  (4 per lamp)
#   nearest police station            20 / 12 / 5 by distance band
#   nearby shops and food within 300m up to 20  (2 per place, "eyes on the street")
#   safety reports within 300 m, 6 mo  minus 5 each, up to -20
# If the city has no street_lamp data in OSM, the lamp term is simply 0 and the score
# is rescaled so a listing can still reach 100.
SAFETY_SQL = """
WITH has_lamps AS (
  -- Only trust lamp density when the city is actually mapped (OSM has ~130 lamps for all of Pune today).
  SELECT (SELECT count(*) FROM pois WHERE category = 'street_lamp') > 2000 AS yes
),
per_listing AS (
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
  FROM listings l
  WHERE (%(id)s::int IS NULL OR l.id = %(id)s::int)
),
scored AS (
  SELECT pl.id,
         CASE WHEN h.yes THEN LEAST(40, pl.lamps * 4) ELSE 0 END AS lamp_pts,
         CASE WHEN pl.police_m IS NULL THEN 5
              WHEN pl.police_m < 500 THEN 20
              WHEN pl.police_m < 1500 THEN 12
              ELSE 5 END AS police_pts,
         LEAST(20, pl.shops * 2) AS shop_pts,
         LEAST(20, pl.reports * 5) AS report_pen,
         CASE WHEN h.yes THEN 80.0 ELSE 40.0 END AS max_pts
  FROM per_listing pl, has_lamps h
)
UPDATE listings l
SET safety_score = GREATEST(0, LEAST(100,
      ROUND(((s.lamp_pts + s.police_pts + s.shop_pts) * 100.0 / s.max_pts) - s.report_pen)::int))
FROM scored s
WHERE l.id = s.id
"""


def main() -> None:
    listing_id = int(sys.argv[1]) if len(sys.argv) > 1 else None
    with connect() as conn, conn.cursor() as cur:
        for col, cat in NEAREST.items():
            cur.execute(NEAREST_SQL.format(col=col), {"cat": cat, "id": listing_id})
            print(f"nearest {cat}: updated {cur.rowcount} listings")
        cur.execute(SAFETY_SQL, {"id": listing_id})
        print(f"safety score: updated {cur.rowcount} listings")
        conn.commit()

        cur.execute("""
            SELECT id, name, nearest_bus_stop_m, nearest_metro_m, nearest_mess_m,
                   nearest_hospital_m, safety_score
            FROM listings WHERE (%s::int IS NULL OR id = %s::int) ORDER BY id LIMIT 10
        """, (listing_id, listing_id))
        print("\nid | name | bus_m | metro_m | mess_m | hosp_m | safety")
        for row in cur.fetchall():
            print(" | ".join(str(v) for v in row))


if __name__ == "__main__":
    main()
