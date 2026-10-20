"""Data coverage: what the listings data already covers and where it is still thin.

Used by GET /admin/coverage and by scripts/coverage_report.py (which writes data/COVERAGE.md).
`cur` must return dict rows.
"""


def coverage(cur) -> dict:
    out: dict = {}

    cur.execute("""
        SELECT count(*)::int AS listings,
               count(*) FILTER (WHERE status <> 'hidden')::int AS visible,
               count(*) FILTER (WHERE contact_phone IS NOT NULL)::int AS with_phone,
               count(*) FILTER (WHERE website IS NOT NULL)::int AS with_website,
               count(*) FILTER (WHERE rent_min IS NOT NULL)::int AS rent_confirmed,
               count(*) FILTER (WHERE status = 'verified')::int AS verified,
               count(*) FILTER (WHERE gender <> 'any')::int AS gender_known,
               count(*) FILTER (WHERE food_included)::int AS food_known,
               count(*) FILTER (WHERE amenities <> '[]'::jsonb)::int AS amenities_known,
               (SELECT count(DISTINCT listing_id) FROM listing_photos)::int AS with_photos,
               count(*) FILTER (WHERE cardinality(also_in) > 0)::int AS in_two_sources
        FROM listings""")
    out["completeness"] = cur.fetchone()

    cur.execute("""SELECT source, listing_type, count(*)::int AS n FROM listings
                   GROUP BY 1, 2 ORDER BY 1, 2""")
    out["by_source_type"] = cur.fetchall()

    cur.execute("""SELECT listing_type, gender, count(*)::int AS n FROM listings GROUP BY 1, 2 ORDER BY 1, 2""")
    out["by_type_gender"] = cur.fetchall()

    # Supply vs demand around each well-known locality (2 km): colleges + offices vs listings.
    cur.execute("""
        WITH loc AS (SELECT id, name, geom FROM pois WHERE category = 'locality' AND tags->>'major' = 'true')
        SELECT loc.name AS locality,
               (SELECT count(*) FROM destinations d WHERE d.kind = 'college'
                  AND ST_DWithin(d.geom::geography, loc.geom::geography, 2000))::int AS colleges,
               (SELECT count(*) FROM destinations d WHERE d.kind = 'office'
                  AND ST_DWithin(d.geom::geography, loc.geom::geography, 2000))::int AS offices,
               (SELECT count(*) FROM listings l WHERE l.status <> 'hidden'
                  AND ST_DWithin(l.geom::geography, loc.geom::geography, 2000))::int AS listings,
               (SELECT count(*) FROM listings l WHERE l.status <> 'hidden' AND l.listing_type = 'flat'
                  AND ST_DWithin(l.geom::geography, loc.geom::geography, 2000))::int AS flats,
               (SELECT count(*) FROM rent_observations r WHERE r.precision = 'building'
                  AND ST_DWithin(r.geom::geography, loc.geom::geography, 2000))::int AS past_flat_rents
        FROM loc ORDER BY loc.name""")
    rows = cur.fetchall()
    for r in rows:
        demand = r["colleges"] * 3 + r["offices"]
        r["demand_score"] = demand
        r["listings_per_10_demand"] = round(10 * r["listings"] / demand, 1) if demand else None
    out["localities"] = rows
    out["thin_localities"] = sorted([r for r in rows if r["colleges"] + r["offices"] >= 5 and r["listings"] <= 3],
                                    key=lambda r: -r["demand_score"])[:20]

    cur.execute("""
        SELECT d.name, ST_Y(d.geom) AS lat, ST_X(d.geom) AS lng,
               (SELECT count(*) FROM listings l WHERE l.status <> 'hidden'
                  AND ST_DWithin(l.geom::geography, d.geom::geography, 1500))::int AS listings_1500m
        FROM destinations d WHERE d.kind = 'college' AND length(d.name) > 4
        ORDER BY listings_1500m, d.name""")
    colleges = cur.fetchall()
    out["colleges_without_listings_1500m"] = [c for c in colleges if c["listings_1500m"] == 0]
    out["colleges_total"] = len(colleges)

    cur.execute("SELECT precision, count(*)::int AS n FROM rent_observations GROUP BY 1")
    out["rent_observations"] = {r["precision"]: r["n"] for r in cur.fetchall()}
    return out
