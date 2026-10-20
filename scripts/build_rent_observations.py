"""Loads real past flat rents into rent_observations and places them on the map.

Source: Kaggle "Rental price of India's IT capital, Pune" (CC0, July 2021), ~16k flat listings with
"Society, Locality, , Pune, Maharashtra" addresses, BHK, area, deposit and monthly rent. No coordinates.

Placement, most precise first:
  building  the society name matches a named OpenStreetMap apartment building / residential area within
            4 km of the listing's locality (OSM features fetched once and cached in data/overpass_extra/).
  locality  otherwise the row is kept for statistics at the locality centre and never drawn as a point.

These are past rents for flats, not live listings: the app shows them as a "past flat rents" layer and in
area statistics, never as places you can book.

Usage:
    python scripts/build_rent_observations.py               # fetch societies if needed, then load
    python scripts/build_rent_observations.py --refetch     # refresh the OSM societies cache
"""
import argparse
import csv
import hashlib
import json
import re
import sys
import time
from collections import defaultdict

import requests

from common import DATA, bbox, connect
from build_locality_rents import ALIASES, FALLBACK_COORDS, RAW, load_osm_localities, locality_of

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
CACHE = DATA / "overpass_extra" / "societies.geojson"
SOURCE = "kaggle-pune-2021"
GENERIC = re.compile(r"\b(society|soc|socity|apartments?|apts?|appartment|phase|ph|building|bldg|wing|tower|towers|"
                     r"chs|co ?op|cooperative|co-operative|housing|ltd|limited|the|and|new|old|no|plot|sector|"
                     r"a|b|c|d|e|f|i|ii|iii|iv|\d+)\b")


def norm(s: str) -> str:
    s = s.lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = GENERIC.sub(" ", s)
    return re.sub(r"\s+", " ", s).strip()


def fetch_societies() -> list[dict]:
    s, w, n, e = bbox()
    sel = ['nwr["building"~"^(apartments|residential|dormitory)$"]["name"]',
           'nwr["landuse"="residential"]["name"]',
           'nwr["place"~"^(neighbourhood|quarter|isolated_dwelling)$"]["name"]']
    body = "".join(f"{x}({s},{w},{n},{e});" for x in sel)
    q = f"[out:json][timeout:240];({body});out center tags;"
    for attempt in range(1, 5):
        try:
            r = requests.post(OVERPASS_URL, data={"data": q}, timeout=300,
                              headers={"User-Agent": "PuneStay student WebGIS project/0.9"})
            r.raise_for_status()
            els = r.json()["elements"]
            break
        except (requests.RequestException, ValueError) as exc:
            print(f"  overpass attempt {attempt} failed: {exc}", flush=True)
            time.sleep(20 * attempt)
    else:
        sys.exit("Overpass unavailable; try again later.")
    feats = []
    for el in els:
        c = el if el["type"] == "node" else el.get("center") or {}
        lat, lon = c.get("lat"), c.get("lon")
        name = el.get("tags", {}).get("name")
        if lat is None or not name:
            continue
        feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [lon, lat]},
                      "properties": {"ref": f"{el['type']}/{el['id']}", "name": name}})
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False), encoding="utf-8")
    return feats


LOC_CACHE = DATA / "overpass_extra" / "locality_geocode.json"


def geocode_localities(names: list[str]) -> dict:
    """Nominatim, 1 request per second, cached forever in data/overpass_extra/locality_geocode.json."""
    cache = json.loads(LOC_CACHE.read_text(encoding="utf-8")) if LOC_CACHE.exists() else {}
    s, w, n, e = bbox()
    todo = [x for x in names if x not in cache]
    if todo:
        print(f"Geocoding {len(todo)} locality names with Nominatim (1/s, cached)...", flush=True)
    for i, name in enumerate(todo, 1):
        try:
            r = requests.get("https://nominatim.openstreetmap.org/search", timeout=30,
                             headers={"User-Agent": "PuneStay student WebGIS project/0.9 (rent statistics, cached)"},
                             params={"q": f"{name}, Pune, Maharashtra", "format": "jsonv2", "limit": 1,
                                     "countrycodes": "in", "viewbox": f"{w},{n},{e},{s}", "bounded": 1})
            r.raise_for_status()
            hit = r.json()
            cache[name] = [float(hit[0]["lat"]), float(hit[0]["lon"]), hit[0].get("name") or name] if hit else None
        except (requests.RequestException, ValueError, KeyError, IndexError):
            cache[name] = None
        if i % 20 == 0:
            LOC_CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0), encoding="utf-8")
            print(f"  {i}/{len(todo)}", flush=True)
        time.sleep(1.1)
    LOC_CACHE.parent.mkdir(parents=True, exist_ok=True)
    LOC_CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0), encoding="utf-8")
    return cache


def km(a_lat, a_lng, b_lat, b_lng):
    import math
    r = math.pi / 180
    x = (b_lng - a_lng) * r * math.cos((a_lat + b_lat) / 2 * r)
    y = (b_lat - a_lat) * r
    return math.hypot(x, y) * 6371


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--refetch", action="store_true")
    args = ap.parse_args()

    if args.refetch or not CACHE.exists():
        print("Fetching named apartment buildings and residential areas from OpenStreetMap...", flush=True)
        societies = fetch_societies()
    else:
        societies = json.loads(CACHE.read_text(encoding="utf-8"))["features"]
    print(f"{len(societies)} named OSM residential features")

    # Index OSM societies by normalised name (several features can share a name across the city).
    by_name = defaultdict(list)
    for f in societies:
        k = norm(f["properties"]["name"])
        if len(k) >= 4:
            lng, lat = f["geometry"]["coordinates"]
            by_name[k].append((lat, lng, f["properties"]["ref"], f["properties"]["name"]))

    osm_locs = load_osm_localities()

    def known_point(loc: str):
        key = ALIASES.get(loc, loc).lower()
        hit = FALLBACK_COORDS.get(loc) or FALLBACK_COORDS.get(key) or osm_locs.get(key)
        return (hit[0], hit[1], hit[2]) if hit else None

    # Locality names in the dataset that we cannot place yet, with enough rows to matter -> geocode once.
    counts = defaultdict(int)
    for fname in ("train.csv", "test.csv"):
        with (RAW / fname).open(encoding="utf-8", newline="") as fh:
            for r in csv.DictReader(fh):
                loc = (locality_of(r.get("address", "")) or "").strip().lower()
                if loc and not known_point(loc):
                    counts[loc] += 1
    geo = geocode_localities(sorted(x for x, c in counts.items() if c >= 5))

    def locality_point(loc: str):
        hit = known_point(loc)
        if hit:
            return hit
        g = geo.get(loc)
        return (loc.title(), g[0], g[1]) if g else None

    loc_norms = {norm(k) for k in list(osm_locs) + list(FALLBACK_COORDS) + list(ALIASES)} | \
                {norm(v[2]) for v in geo.values() if v}

    # Candidate societies per locality (within 4 km) for fuzzy matching, built lazily.
    import difflib
    near_cache: dict = {}

    def fuzzy(society_norm: str, loc_name: str, loc_lat: float, loc_lng: float):
        if loc_name not in near_cache:
            near_cache[loc_name] = [(k, c) for k, cs in by_name.items() for c in cs if km(c[0], c[1], loc_lat, loc_lng) <= 4.0]
        cands = near_cache[loc_name]
        keys = list({k for k, _ in cands})
        best = difflib.get_close_matches(society_norm, keys, n=1, cutoff=0.88)
        if not best:
            return None
        return min((c for k, c in cands if k == best[0]), key=lambda c: km(c[0], c[1], loc_lat, loc_lng))

    rows, stats = [], defaultdict(int)
    seen = set()
    for fname in ("train.csv", "test.csv"):
        with (RAW / fname).open(encoding="utf-8", newline="") as fh:
            for r in csv.DictReader(fh):
                try:
                    rent = int(float(r["rent"]))
                    bhk = int(float(r["bedroom"]))
                    area = int(float(r.get("area") or 0))
                    deposit = int(float(r.get("deposit_amt") or 0)) or None
                except (ValueError, KeyError):
                    stats["bad_number"] += 1
                    continue
                if not (2000 <= rent <= 200000) or area <= 100 or not (1 <= bhk <= 6):
                    stats["outlier"] += 1
                    continue
                address = r.get("address", "")
                ref = hashlib.sha1(json.dumps(r, sort_keys=True).encode()).hexdigest()[:20]
                if ref in seen:
                    stats["duplicate"] += 1
                    continue
                seen.add(ref)
                society = address.split(",")[0].strip()
                loc = (locality_of(address) or "").strip().lower()
                lp = locality_point(loc) if loc else None
                if not lp:
                    stats["no_locality"] += 1
                    continue
                loc_name, loc_lat, loc_lng = lp

                precision, lat, lng, osm_ref = "locality", loc_lat, loc_lng, None
                sn = norm(society) if society else ""
                # A "society" that is really a locality name ("Hinjewadi") is not a building.
                if sn and (known_point(society.strip().lower()) or sn in loc_norms):
                    sn = ""
                cands = by_name.get(sn) if sn else None
                best = None
                if cands:
                    near = [c for c in cands if km(c[0], c[1], loc_lat, loc_lng) <= 4.0]
                    if near:
                        best = min(near, key=lambda c: km(c[0], c[1], loc_lat, loc_lng))
                if not best and len(sn) >= 5:
                    best = fuzzy(sn, loc_name, loc_lat, loc_lng)
                    if best:
                        stats["fuzzy"] += 1
                # Numbers carry meaning ("7 Avenues" is not "66 Avenue"): reject if both have different numbers.
                if best:
                    da, db = re.findall(r"\d+", society), re.findall(r"\d+", best[3])
                    if da and db and da != db:
                        best = None
                        stats["number_conflict"] += 1
                if best:
                    precision, lat, lng, osm_ref = "building", best[0], best[1], best[2]
                stats[precision] += 1
                rows.append((SOURCE, ref, 2021, bhk, area, rent, deposit, r.get("furnishing") or None,
                             r.get("avalable_for") or None, society or None, loc_name, precision, osm_ref, lng, lat))

    s, w, n, e = bbox()
    inside = [x for x in rows if s <= x[14] <= n and w <= x[13] <= e]
    stats["outside_bbox"] = len(rows) - len(inside)

    with connect() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM rent_observations WHERE source = %s", (SOURCE,))
        cur.executemany(
            """INSERT INTO rent_observations (source, source_ref, year, bhk, area_sqft, rent, deposit, furnishing,
                                              available_for, society, locality, precision, osm_ref, geom)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326))""",
            inside,
        )
        conn.commit()
    print(f"loaded {len(inside)} rent observations: " + ", ".join(f"{k}={v}" for k, v in sorted(stats.items())))


if __name__ == "__main__":
    main()
