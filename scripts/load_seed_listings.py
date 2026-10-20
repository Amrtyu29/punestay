"""Loads data/seed_listings.csv into the listings table.

Rows without lat/lng are geocoded with Nominatim (1 request per second, cached in
data/geocode_cache.json and in the geocode_cache table so reruns are instant).

CSV columns:
  name, address, lat, lng, listing_type (pg|flat|hostel), gender (male|female|any),
  rent_min, rent_max, deposit, food_included (true|false),
  amenities (semicolon separated, e.g. "wifi;ac;laundry"), contact_phone

Usage:
    python scripts/load_seed_listings.py
"""
import csv
import json
import time

import requests
from psycopg.types.json import Jsonb

from common import DATA, bbox, connect, env

NOMINATIM = "https://nominatim.openstreetmap.org/search"
CACHE_FILE = DATA / "geocode_cache.json"

INSERT = """
INSERT INTO listings (name, address, geom, listing_type, gender, rent_min, rent_max, deposit,
                      food_included, amenities, contact_phone, status, source, source_ref)
VALUES (%s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s, %s, %s, %s, %s, %s, %s, 'verified',
        'seed', %s)
ON CONFLICT (source, source_ref) WHERE source_ref IS NOT NULL DO NOTHING
RETURNING id
"""


def load_cache() -> dict:
    if CACHE_FILE.exists():
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    return {}


def geocode(address: str, cache: dict) -> tuple[float, float] | None:
    if address in cache:
        hit = cache[address]
        return (hit["lat"], hit["lng"]) if hit else None

    s, w, n, e = bbox()
    params = {
        "q": address, "format": "json", "limit": 1, "countrycodes": "in",
        "viewbox": f"{w},{n},{e},{s}", "bounded": 1,
    }
    headers = {"User-Agent": f"PuneStay student project ({env('NOMINATIM_EMAIL', 'unknown')})"}
    time.sleep(1.1)  # Nominatim usage policy: max 1 request per second
    r = requests.get(NOMINATIM, params=params, headers=headers, timeout=30)
    r.raise_for_status()
    results = r.json()
    if not results:
        cache[address] = None
        return None
    lat, lng = float(results[0]["lat"]), float(results[0]["lon"])
    cache[address] = {"lat": lat, "lng": lng, "display": results[0].get("display_name")}
    return lat, lng


def to_int(v: str) -> int | None:
    v = (v or "").strip()
    return int(float(v)) if v else None


def main() -> None:
    path = DATA / "seed_listings.csv"
    cache = load_cache()
    inserted, skipped = 0, 0

    with path.open(encoding="utf-8", newline="") as fh, connect() as conn, conn.cursor() as cur:
        for i, row in enumerate(csv.DictReader(fh), start=1):
            name = row["name"].strip()
            if not name:
                continue
            # Stable key: name + address, so inserting or deleting CSV rows never shifts the others.
            import hashlib
            source_ref = "seed:" + hashlib.sha1(f"{name}|{row['address'].strip()}".lower().encode()).hexdigest()[:16]
            lat, lng = row.get("lat", "").strip(), row.get("lng", "").strip()
            if lat and lng:
                lat, lng = float(lat), float(lng)
            else:
                hit = geocode(row["address"], cache)
                CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")
                if not hit:
                    print(f"  could not geocode: {name} | {row['address']}")
                    skipped += 1
                    continue
                lat, lng = hit
                cur.execute(
                    "INSERT INTO geocode_cache (query, lat, lng, display) VALUES (%s, %s, %s, %s) "
                    "ON CONFLICT (query) DO NOTHING",
                    (row["address"], lat, lng, cache[row["address"]].get("display")),
                )

            amenities = [a.strip() for a in (row.get("amenities") or "").split(";") if a.strip()]
            cur.execute(INSERT, (
                name, row["address"].strip(), lng, lat,
                row["listing_type"].strip().lower(), row["gender"].strip().lower(),
                to_int(row["rent_min"]), to_int(row.get("rent_max")), to_int(row.get("deposit")),
                (row.get("food_included") or "false").strip().lower() in ("true", "1", "yes"),
                Jsonb(amenities), (row.get("contact_phone") or "").strip() or None,
                source_ref,
            ))
            if cur.fetchone():
                inserted += 1
            else:
                skipped += 1  # already loaded earlier
        conn.commit()

    print(f"Inserted {inserted} listings, skipped {skipped}. Now run scripts/compute_derived.py")


if __name__ == "__main__":
    main()
