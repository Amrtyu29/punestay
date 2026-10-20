"""Loads data/overpass/*.geojson into the pois table and fills destinations.

Re-runnable: existing (category, osm_id) rows are updated, not duplicated.

Usage:
    python scripts/load_pois.py
"""
import json

from psycopg.types.json import Jsonb

from common import OVERPASS_DIR, connect

UPSERT_POI = """
INSERT INTO pois (osm_id, category, name, geom, tags)
VALUES (%s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s)
ON CONFLICT (category, osm_id) DO UPDATE
  SET name = EXCLUDED.name, geom = EXCLUDED.geom,
      -- keep the 'major' mark set by load_extra_localities.py across reloads
      tags = EXCLUDED.tags || CASE WHEN pois.tags ? 'major' THEN '{"major": true}'::jsonb ELSE '{}'::jsonb END
"""

UPSERT_DEST = """
INSERT INTO destinations (osm_id, name, kind, geom)
SELECT osm_id, name, %s, geom FROM pois
WHERE category = %s AND name IS NOT NULL
ON CONFLICT (kind, osm_id) DO UPDATE
  SET name = EXCLUDED.name, geom = EXCLUDED.geom
"""


def main() -> None:
    files = sorted(OVERPASS_DIR.glob("*.geojson"))
    if not files:
        raise SystemExit("No GeoJSON in data/overpass. Run scripts/fetch_overpass.py first.")

    with connect() as conn, conn.cursor() as cur:
        for path in files:
            category = path.stem
            fc = json.loads(path.read_text(encoding="utf-8"))
            rows = []
            for f in fc["features"]:
                lon, lat = f["geometry"]["coordinates"]
                p = f["properties"]
                # Node, way and relation ids are separate sequences; encode the type so they never collide.
                # node: id, way: -(id*4+2), relation: -(id*4+3). Synthetic rows use ids below -10^12.
                if p["osm_type"] == "node":
                    osm_id = p["osm_id"]
                elif p["osm_type"] == "way":
                    osm_id = -(p["osm_id"] * 4 + 2)
                else:
                    osm_id = -(p["osm_id"] * 4 + 3)
                rows.append((osm_id, category, p.get("name"), lon, lat, Jsonb(p.get("tags", {}))))
            cur.executemany(UPSERT_POI, rows)
            print(f"{category}: {len(rows)} rows")

        cur.execute(UPSERT_DEST, ("college", "college"))
        cur.execute(UPSERT_DEST, ("office", "office"))
        cur.execute("SELECT kind, count(*) FROM destinations GROUP BY kind ORDER BY kind")
        for kind, n in cur.fetchall():
            print(f"destinations/{kind}: {n}")
        conn.commit()


if __name__ == "__main__":
    main()
