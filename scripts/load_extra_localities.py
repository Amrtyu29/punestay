"""Marks the well-known localities (the ones in data/locality_rents.csv) as "major" in the pois table,
adding any that OSM lacks as place nodes (Kothrud, Hadapsar, Koregaon Park, ...).

Area statistics group listings by the nearest MAJOR locality, so names people actually use win over
tiny OSM colonies and vastis. Synthetic osm_id values are below -10^12 and never collide with real ones.

Usage:
    python scripts/load_extra_localities.py
"""
import csv

from psycopg.types.json import Jsonb

from common import DATA, connect


def main():
    path = DATA / "locality_rents.csv"
    rows = list(csv.DictReader(path.open(encoding="utf-8", newline="")))
    added = marked = 0
    with connect() as conn, conn.cursor() as cur:
        cur.execute("UPDATE pois SET tags = tags - 'major' WHERE category = 'locality' AND tags ? 'major'")
        for i, r in enumerate(rows):
            lat, lng = float(r["lat"]), float(r["lng"])
            cur.execute(
                """SELECT id FROM pois WHERE category = 'locality' AND lower(name) = lower(%s)
                   AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, 3000)
                   ORDER BY geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326) LIMIT 1""",
                (r["locality"], lng, lat, lng, lat),
            )
            hit = cur.fetchone()
            if hit:
                cur.execute("UPDATE pois SET tags = tags || '{\"major\": true}'::jsonb WHERE id = %s", (hit["id"],) if isinstance(hit, dict) else (hit[0],))
                marked += 1
                continue
            cur.execute(
                """INSERT INTO pois (osm_id, category, name, geom, tags)
                   VALUES (%s, 'locality', %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s)
                   ON CONFLICT (category, osm_id) DO UPDATE
                     SET name = EXCLUDED.name, geom = EXCLUDED.geom, tags = EXCLUDED.tags""",
                (-(10**12) - i, r["locality"], lng, lat, Jsonb({"place": "locality", "source": "locality_rents.csv", "major": True})),
            )
            added += 1
        conn.commit()
    print(f"marked {marked} existing OSM localities as major, added {added} new ones")


if __name__ == "__main__":
    main()
