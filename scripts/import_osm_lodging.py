"""Turns real OpenStreetMap lodging (hostels, dormitories, places named as PGs) into listings.

Input:  data/overpass/lodging.geojson   (from scripts/fetch_overpass.py lodging)
        data/overpass/locality.geojson  (for a fallback address and the locality name)
Output: rows in the listings table with source='osm', status='unverified', rent_min = NULL.

The name, location, and any phone/website come straight from OSM, so they are genuine.
Rent is NOT in OSM and is never invented: it stays NULL ("rent not published") until the owner
adds it or two students report the same rent. Rerunning never duplicates rows and never touches a
rent that has been filled in.

Usage:
    python scripts/import_osm_lodging.py            # import
    python scripts/import_osm_lodging.py --dry-run  # just print what would be imported
"""
import csv
import json
import math
import re
import sys

from psycopg.types.json import Jsonb

from common import DATA, OVERPASS_DIR, connect

GIRLS = re.compile(r"girl'?s?|ladies|women|woman|mahila|female", re.I)
BOYS = re.compile(r"\bboy'?s?\b|\bgents?\b|\bmen'?s?\b|\bmale\b", re.I)
BOTH = re.compile(r"unisex|co-?ed|boys? (and|&) girls?|girls? (and|&) boys?|men (and|&) women", re.I)
PG = re.compile(r"paying guest|(^|[^a-z])pgs?([^a-z]|$)", re.I)
HOSTEL = re.compile(r"hostel|dormitory", re.I)
# Co-living operators: rooms are rented per bed like a PG.
BRAND = re.compile(r"co-?living|coliving|stanza|zolo|colive|housr|isthara|your-?space|hello ?world|nestaway|settl|tribe stays|olive by", re.I)

# Not open-market rentals: campus halls, institutional hostels, guest houses, generic building labels.
INSTITUTIONAL = re.compile(
    r"hall of residence|hostel\s*(no|number|-)\b|\bwing\b|\bbuilding\b|\bblock\b|research|guest ?house|"
    r"officers?|government|govt|touring|asram|ashram|quarters|\bmess$|canteen|"
    r"symbiosis|iiser|\bdiat\b|\bgmc\b|\bbj\b|\bcoep\b|\bmit\b|\bvit\b|\bpict\b|bharati|sppu|university|"
    r"college|institute|school|\biit\b|\bnda\b|\bcme\b|afmc|\bncl\b|\bnio\b|army|navy|air ?force|police|"
    r"medical|nursing|engineering|hall$|"
    r"i2it|isquareit|pccoe|\bari\b|ftii|bmcc|nicmar|bvdu|\bzeal\b|\bmjv\b|jain|vidyalaya|baramati|"
    r"\broads?\b|\brd\b|security|office|demolished|training|academy|dharmashala|bulding|"
    r"polytechnic|ambedkar|shaskiya|shasakiya|samaj kalyan|social welfare|backward class|tribal|adivasi|"
    r"government|sainik|military|ashram shala|"
    r"^(petunia|lotus|calendula|nalanda|west [a-z])$",
    re.I,
)


def is_institutional(name, tags):
    if INSTITUTIONAL.search(name):
        return True
    if tags.get("highway") or tags.get("power") or tags.get("railway"):  # roads, power lines
        return True
    # tourism=apartment marks ordinary housing societies in Pune; keep it only when the name says PG / hostel.
    if tags.get("tourism") == "apartment" and not (PG.search(name) or HOSTEL.search(name) or BRAND.search(name)):
        return True
    operator = (tags.get("operator") or "").lower()
    if any(w in operator for w in ("university", "college", "institute", "government", "trust")):
        return True
    if tags.get("tourism") == "guest_house":
        return True
    if len(re.sub(r"[^a-z]", "", name.lower())) < 4:  # 'O Building', '57.', etc.
        return True
    return False

INSERT = """
INSERT INTO listings (name, address, geom, listing_type, gender, rent_min, rent_max, deposit,
                      food_included, amenities, contact_phone, website, status, source, source_ref,
                      rent_estimated)
VALUES (%(name)s, %(address)s, ST_SetSRID(ST_MakePoint(%(lng)s, %(lat)s), 4326), %(type)s, %(gender)s,
        NULL, NULL, NULL, %(food)s, %(amenities)s, %(phone)s, %(website)s,
        'unverified', 'osm', %(ref)s, FALSE)
ON CONFLICT (source, source_ref) WHERE source_ref IS NOT NULL DO UPDATE
  SET name = EXCLUDED.name, address = EXCLUDED.address, geom = EXCLUDED.geom,
      contact_phone = COALESCE(EXCLUDED.contact_phone, listings.contact_phone),
      website = COALESCE(EXCLUDED.website, listings.website),
      -- the name-based classification only changes on rows nobody has claimed or priced yet
      listing_type = CASE WHEN listings.owner_id IS NULL AND listings.rent_min IS NULL THEN EXCLUDED.listing_type ELSE listings.listing_type END,
      gender = CASE WHEN listings.owner_id IS NULL AND listings.rent_min IS NULL THEN EXCLUDED.gender ELSE listings.gender END
RETURNING id, (xmax = 0) AS inserted
"""


def km(a_lat, a_lng, b_lat, b_lng):
    r = math.pi / 180
    x = (b_lng - a_lng) * r * math.cos((a_lat + b_lat) / 2 * r)
    y = (b_lat - a_lat) * r
    return math.hypot(x, y) * 6371


def load_geojson(name):
    path = OVERPASS_DIR / f"{name}.geojson"
    if not path.exists():
        raise SystemExit(f"Missing {path}. Run: python scripts/fetch_overpass.py {name}")
    return json.loads(path.read_text(encoding="utf-8"))["features"]


def load_rents(dry=False):
    path = DATA / "locality_rents.csv"
    if not path.exists():
        if dry:
            print(f"(dry run) {path.name} missing, rents will show as None")
            return []
        raise SystemExit(
            f"Missing {path}. Create it from published locality rent reports (see the docstring)."
        )
    rows = []
    with path.open(encoding="utf-8", newline="") as fh:
        for r in csv.DictReader(fh):
            try:
                rows.append({
                    "locality": r["locality"].strip(),
                    "lat": float(r["lat"]), "lng": float(r["lng"]),
                    "pg_shared": int(r["pg_shared"]) if r.get("pg_shared") else None,
                    "pg_single": int(r["pg_single"]) if r.get("pg_single") else None,
                    "hostel": int(r["hostel"]) if r.get("hostel") else None,
                    "flat_1bhk": int(r["flat_1bhk"]) if r.get("flat_1bhk") else None,
                })
            except (KeyError, ValueError) as exc:
                raise SystemExit(f"Bad row in locality_rents.csv: {r} ({exc})")
    if not rows and not dry:
        raise SystemExit("locality_rents.csv has no rows.")
    return rows


def nearest(rows, lat, lng):
    if not rows:
        return {"locality": None, "lat": lat, "lng": lng, "pg_shared": None, "pg_single": None, "hostel": None, "flat_1bhk": None}
    return min(rows, key=lambda r: km(lat, lng, r["lat"], r["lng"]))


def locality_rent(rows, lat, lng, max_km=3.0):
    """Rent figures from the nearest locality within max_km; farther out, the city-wide median of all localities.
    Either way the listing is flagged rent_estimated, so the app says it is an estimate."""
    loc = nearest(rows, lat, lng)
    if not rows or km(lat, lng, loc["lat"], loc["lng"]) <= max_km:
        return loc
    import statistics
    med = lambda k: int(statistics.median(v for v in (r[k] for r in rows) if v)) if any(r[k] for r in rows) else None
    return {"locality": None, "lat": lat, "lng": lng, "pg_shared": med("pg_shared"), "pg_single": med("pg_single"),
            "hostel": med("hostel"), "flat_1bhk": med("flat_1bhk")}


def classify(name, tags):
    if tags.get("building") == "dormitory" or tags.get("amenity") == "dormitory":
        ltype = "hostel"
    elif PG.search(name):
        ltype = "pg"
    elif HOSTEL.search(name) or tags.get("tourism") == "hostel":
        ltype = "hostel"
    elif tags.get("tourism") == "guest_house":
        ltype = "pg"
    else:
        ltype = "pg"
    girls, boys = bool(GIRLS.search(name)), bool(BOYS.search(name))
    if BOTH.search(name) or (girls and boys):
        gender = "any"
    elif girls:
        gender = "female"
    elif boys:
        gender = "male"
    else:
        gender = "any"
    return ltype, gender


def rent_for(ltype, gender, loc):
    """Returns (rent_min, rent_max) from the locality averages, or None if the table lacks them."""
    if ltype == "hostel":
        base = loc["hostel"] or loc["pg_shared"]
        return (base, None) if base else None
    if ltype == "flat":
        base = loc["flat_1bhk"]
        return (base, None) if base else None
    lo, hi = loc["pg_shared"], loc["pg_single"]
    if lo and hi:
        return (min(lo, hi), max(lo, hi))
    if lo or hi:
        return (lo or hi, None)
    return None


def address_for(tags, loc_name):
    parts = [tags.get("addr:housename"), tags.get("addr:housenumber"), tags.get("addr:street"),
             tags.get("addr:suburb") or tags.get("addr:neighbourhood")]
    parts = [p for p in parts if p]
    if not parts:
        parts = [f"near {loc_name}"] if loc_name else []
    parts.append("Pune")
    return ", ".join(parts)


def amenities_for(tags):
    out = []
    if tags.get("internet_access") in ("wlan", "yes"):
        out.append("wifi")
    if tags.get("air_conditioning") == "yes":
        out.append("ac")
    if tags.get("parking") or tags.get("amenity") == "parking":
        out.append("parking")
    if tags.get("wheelchair") == "yes":
        out.append("wheelchair")
    return out


def main():
    dry = "--dry-run" in sys.argv
    lodging = load_geojson("lodging")
    loc_path = OVERPASS_DIR / "locality.geojson"
    localities = [f for f in (load_geojson("locality") if loc_path.exists() else []) if f["properties"].get("name")]
    rows, institutional, unnamed, duplicates = [], [], 0, 0
    for f in lodging:
        p = f["properties"]
        tags = p.get("tags", {})
        name = re.sub(r"\s+", " ", (p.get("name") or "").strip())
        if not name:
            unnamed += 1
            continue
        if is_institutional(name, tags):
            institutional.append(name)
            continue
        lng, lat = f["geometry"]["coordinates"]
        # The same place is sometimes mapped twice (a building outline and a point): keep the first.
        if any(r["name"].lower() == name.lower() and km(lat, lng, r["lat"], r["lng"]) < 0.08 for r in rows):
            duplicates += 1
            continue
        ltype, gender = classify(name, tags)
        near_name = None
        if localities:
            near_loc = min(localities, key=lambda g: km(lat, lng, g["geometry"]["coordinates"][1], g["geometry"]["coordinates"][0]))
            near_name = near_loc["properties"]["name"]
        rows.append({
            "name": name,
            "address": address_for(tags, near_name),
            "lat": lat, "lng": lng,
            "type": ltype, "gender": gender,
            "food": "mess" in name.lower() or tags.get("food") == "yes",
            "amenities": Jsonb(amenities_for(tags)),
            "phone": tags.get("phone") or tags.get("contact:phone"),
            "website": tags.get("website") or tags.get("contact:website"),
            "ref": f"{p['osm_type']}/{p['osm_id']}",
            "_locality": near_name,
        })

    print(f"{len(lodging)} OSM features: {len(rows)} importable, {len(institutional)} institutional/generic skipped, "
          f"{unnamed} unnamed, {duplicates} mapped twice")
    if dry and institutional:
        print("  skipped as institutional/generic: " + "; ".join(institutional[:25]) + (" …" if len(institutional) > 25 else ""))
    by_type = {}
    for r in rows:
        by_type[(r["type"], r["gender"])] = by_type.get((r["type"], r["gender"]), 0) + 1
    for (t, g), n in sorted(by_type.items()):
        print(f"  {t:6} {g:6} {n}")
    with_phone = sum(1 for r in rows if r["phone"])
    print(f"  with real phone number from OSM: {with_phone}")

    if dry:
        for r in rows:
            phone = " phone" if r["phone"] else ""
            print(f"  {r['ref']:16} {r['name'][:42]:42} {r['type']:6} {r['gender']:6} ({r['_locality']}){phone}")
        return

    inserted = updated = 0
    with connect() as conn, conn.cursor() as cur:
        for r in rows:
            params = {k: v for k, v in r.items() if not k.startswith("_")}
            cur.execute(INSERT, params)
            _, was_insert = cur.fetchone()
            if was_insert:
                inserted += 1
            else:
                updated += 1
        conn.commit()
    print(f"Inserted {inserted}, updated {updated}. Now run: python scripts/compute_derived.py")


if __name__ == "__main__":
    main()
