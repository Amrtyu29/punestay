"""Merges Overture Maps accommodation places (data/overture/lodging.geojson) into listings.

For every Overture place that looks like a PG, hostel or co-living building:
  - if a listing already exists within 150 m with a similar name (pg_trgm similarity >= 0.45), the two are the
    same place: missing phone / website are copied over and 'overture' is added to listings.also_in;
  - otherwise a new listing is created with source='overture', status='unverified' and rent_min = NULL
    ("rent not published"): Overture has no prices and the app never invents one.

Hotels, resorts, apartment complexes and institutional (college / government) hostels are skipped, using the
same rules as scripts/import_osm_lodging.py.

Usage:
    python scripts/import_overture_lodging.py --dry-run
    python scripts/import_overture_lodging.py
"""
import json
import re
import sys

from psycopg.types.json import Jsonb

from common import DATA, connect
from import_osm_lodging import classify, is_institutional, km

SRC = DATA / "overture" / "lodging.geojson"
MIN_CONFIDENCE = 0.5
KEEP_CATEGORIES = {"hostel", "guest_house", "dormitory", "student_housing", "boarding_house", "coliving_space",
                   "shared_living", "rooming_house", "accommodation"}
STRONG_NAME = re.compile(r"(?i)(paying guest|\bp\.?g\.?s?\b|hostel|co-?living|coliving|stanza|zolo|colive|housr|"
                         r"isthara|your-?space|hello ?world|nestaway|settl|tribe stays|olive by|ladies home|girls home|boys home)")
SKIP_NAME = re.compile(r"(?i)\b(hotel|resort|lodge and restaurant|banquet|spa|inn & suites|oyo|treebo|fabhotel|"
                       r"zostel|backpacker)\b")


def wanted(p: dict) -> bool:
    name = p.get("name") or ""
    if (p.get("confidence") or 0) < MIN_CONFIDENCE:
        return False
    if SKIP_NAME.search(name):
        return False
    if STRONG_NAME.search(name):
        return True
    cats = {p.get("category"), p.get("basic_category"), *(p.get("alternate") or [])}
    return bool(cats & KEEP_CATEGORIES)


def short_name(full: str) -> str:
    """'Zolo Aquascape - PG in Kondhwa | Unisex PG' -> 'Zolo Aquascape' (keeps names that have no suffix)."""
    s = full.split(" | ")[0].strip()
    s = re.sub(r"(?i)\s+[-–]\s+(pg|paying guest|hostel|co-?living)s?\b.*$", "", s).strip()
    return s if len(s) >= 3 else full


def clean_phone(s):
    if not s:
        return None
    s = re.sub(r"[^\d+]", "", s)
    if s.startswith("+91"):
        s = s[3:]
    s = s.lstrip("0")
    return s if 8 <= len(s) <= 12 else None


def clean_web(s):
    return s if s and re.match(r"^https?://[^\s<>\"']+$", s) and len(s) <= 300 else None


def main():
    dry = "--dry-run" in sys.argv
    if not SRC.exists():
        sys.exit(f"Missing {SRC}. Run: python scripts/fetch_overture_places.py")
    feats = json.loads(SRC.read_text(encoding="utf-8"))["features"]

    # Dedupe Overture against itself first (same name within 60 m).
    kept, skipped = [], {"low_confidence_or_category": 0, "institutional": 0, "self_duplicate": 0}
    for f in feats:
        p = f["properties"]
        full_name = re.sub(r"\s+", " ", (p.get("name") or "").strip())
        name = short_name(full_name)
        if not wanted(p):
            skipped["low_confidence_or_category"] += 1
            continue
        if is_institutional(full_name, {}):
            skipped["institutional"] += 1
            continue
        lng, lat = f["geometry"]["coordinates"]
        if any(k["name"].lower() == name.lower() and km(lat, lng, k["lat"], k["lng"]) < 0.06 for k in kept):
            skipped["self_duplicate"] += 1
            continue
        kept.append({"name": name, "full_name": full_name, "lat": lat, "lng": lng, "p": p})
    print(f"{len(feats)} Overture places, {len(kept)} candidates; skipped {skipped}")

    merged = inserted = 0
    samples = []
    with connect() as conn, conn.cursor() as cur:
        for k in kept:
            p = k["p"]
            phone, web = clean_phone(p.get("phone")), clean_web(p.get("website"))
            cur.execute(
                """SELECT id, name, contact_phone, website, similarity(lower(name), lower(%(name)s)) AS sim,
                          ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(%(lng)s, %(lat)s), 4326)::geography) AS d
                   FROM listings
                   WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(%(lng)s, %(lat)s), 4326)::geography, 150)
                     AND source <> 'overture'
                   ORDER BY sim DESC LIMIT 1""",
                {"name": k["name"], "lat": k["lat"], "lng": k["lng"]},
            )
            hit = cur.fetchone()
            if hit and hit[4] >= 0.45:
                merged += 1
                if not dry:
                    cur.execute(
                        """UPDATE listings SET contact_phone = COALESCE(contact_phone, %s), website = COALESCE(website, %s),
                                  also_in = (SELECT array_agg(DISTINCT x) FROM unnest(also_in || ARRAY['overture']) x)
                           WHERE id = %s""",
                        (phone, web, hit[0]),
                    )
                continue

            # Classify on the full listing title (it often says "Unisex PG" or "for Men"), display the short name.
            ltype, gender = classify(k["full_name"], {})
            address = ", ".join(x for x in [p.get("street"), p.get("locality"), "Pune"] if x)
            if len(samples) < 25:
                samples.append(f"  {k['name'][:44]:44} {ltype:6} {gender:6} phone={'y' if phone else '-'} {p.get('category')}")
            inserted += 1
            if dry:
                continue
            cur.execute(
                """INSERT INTO listings (name, address, geom, listing_type, gender, rent_min, rent_max, food_included,
                                         amenities, contact_phone, website, status, source, source_ref, rent_estimated)
                   VALUES (%s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s, NULL, NULL, FALSE, %s, %s, %s,
                           'unverified', 'overture', %s, FALSE)
                   ON CONFLICT (source, source_ref) WHERE source_ref IS NOT NULL DO UPDATE
                     SET name = EXCLUDED.name, geom = EXCLUDED.geom,
                         contact_phone = COALESCE(listings.contact_phone, EXCLUDED.contact_phone),
                         website = COALESCE(listings.website, EXCLUDED.website)""",
                (k["name"], address[:300] or "Pune", k["lng"], k["lat"], ltype, gender, Jsonb([]),
                 phone, web, f"overture:{p['overture_id']}"),
            )
        if not dry:
            conn.commit()
    print(f"merged into existing listings: {merged}, new or refreshed listings: {inserted}")
    print("\n".join(samples))
    if not dry:
        print("Now run: python scripts/compute_derived.py")


if __name__ == "__main__":
    main()
