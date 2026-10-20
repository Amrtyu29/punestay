"""Downloads POI data for Pune from OpenStreetMap through the Overpass API.

Writes one GeoJSON file per category into data/overpass/.
Ways and relations are returned as their centre point so everything becomes a Point.

Usage:
    python scripts/fetch_overpass.py            # all categories
    python scripts/fetch_overpass.py bus_stop metro
"""
import json
import sys
import time

import requests

from common import OVERPASS_DIR, bbox

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
HEADERS = {"User-Agent": "PuneStay student WebGIS project/0.1 (Overpass fetch script)"}

# category -> list of Overpass selectors (without the bbox). "nwr" = node, way, relation.
CATEGORIES: dict[str, list[str]] = {
    "bus_stop":    ['node["highway"="bus_stop"]'],
    "metro":       ['nwr["railway"="station"]["station"="subway"]',
                    'nwr["railway"="station"]["subway"="yes"]',
                    'nwr["railway"="station"]["network"~"Pune Metro",i]'],
    "mess":        ['nwr["amenity"~"^(restaurant|fast_food|cafe|food_court)$"]'],
    "hospital":    ['nwr["amenity"~"^(hospital|clinic|doctors)$"]'],
    "pharmacy":    ['nwr["amenity"="pharmacy"]'],
    "atm":         ['nwr["amenity"~"^(atm|bank)$"]'],
    "grocery":     ['nwr["shop"~"^(supermarket|convenience|grocery|general)$"]'],
    "police":      ['nwr["amenity"="police"]'],
    "street_lamp": ['node["highway"="street_lamp"]'],
    "college":     ['nwr["amenity"~"^(college|university)$"]["name"]'],
    "office":      ['nwr["office"]["name"]',
                    'nwr["landuse"="commercial"]["name"]',
                    'nwr["name"~"IT Park|Tech Park|Infotech|Software Park|SEZ",i]'],
    "locality":    ['node["place"~"^(suburb|neighbourhood|quarter|town|village)$"]["name"]'],
    # Nearby Services categories from the course brief.
    "school":      ['nwr["amenity"~"^(school|kindergarten)$"]'],
    "fuel":        ['nwr["amenity"~"^(fuel|charging_station)$"]'],
    "park":        ['nwr["leisure"~"^(park|garden|playground|sports_centre|stadium)$"]'],
    "bank":        ['nwr["amenity"="bank"]'],
    "fire_station": ['nwr["amenity"="fire_station"]'],
    "post_office": ['nwr["amenity"="post_office"]'],
    "library":     ['nwr["amenity"="library"]'],
    "place_of_worship": ['nwr["amenity"="place_of_worship"]["name"]'],
    "toilets":     ['nwr["amenity"="toilets"]'],
    # Real accommodation already mapped in OSM: hostels, dormitories, and anything named as a PG.
    # These are genuine locations for the listings table (rent and contact still need to be added).
    # Not tourism=apartment: in Pune it is mostly used for ordinary housing societies, not rentals.
    "lodging":     ['nwr["tourism"~"^(hostel|guest_house)$"]',
                    'nwr["building"~"^(dormitory|hostel|student_accommodation)$"]',
                    'nwr["amenity"~"^(dormitory|boarding_house|student_accommodation)$"]',
                    'nwr["name"~"Paying Guest|Boys Hostel|Girls Hostel|Ladies Hostel|Gents Hostel|Hostel",i]',
                    'nwr["name"~"(^|[^A-Za-z])PGs?([^A-Za-z]|$)"]',
                    # Co-living operators active in Pune.
                    'nwr["name"~"Co-?Living|Coliving|Stanza|Zolo|Colive|Housr|Isthara|Your-?Space|Hello ?World|NestAway|Settl|Tribe Stays|Olive by",i]'],
}


def build_query(selectors: list[str]) -> str:
    s, w, n, e = bbox()
    body = "".join(f"{sel}({s},{w},{n},{e});" for sel in selectors)
    return f"[out:json][timeout:180];({body});out center tags;"


def to_feature(el: dict) -> dict | None:
    if el["type"] == "node":
        lat, lon = el.get("lat"), el.get("lon")
    else:
        c = el.get("center") or {}
        lat, lon = c.get("lat"), c.get("lon")
    if lat is None or lon is None:
        return None
    tags = el.get("tags", {})
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": {"osm_id": el["id"], "osm_type": el["type"],
                       "name": tags.get("name") or tags.get("name:en"), "tags": tags},
    }


def fetch(category: str, retries: int = 4) -> int:
    query = build_query(CATEGORIES[category])
    for attempt in range(1, retries + 1):
        try:
            r = requests.post(OVERPASS_URL, data={"data": query}, headers=HEADERS, timeout=240)
            if r.status_code == 429 or r.status_code == 504:
                raise requests.HTTPError(f"{r.status_code} from Overpass")
            r.raise_for_status()
            elements = r.json().get("elements", [])
            break
        except (requests.RequestException, ValueError) as exc:
            wait = 15 * attempt
            print(f"  {category}: attempt {attempt} failed ({exc}); retrying in {wait}s", flush=True)
            time.sleep(wait)
    else:
        print(f"  {category}: giving up")
        return 0

    features = [f for f in (to_feature(el) for el in elements) if f]
    # Drop duplicates (same element can match two selectors).
    seen, unique = set(), []
    for f in features:
        key = (f["properties"]["osm_type"], f["properties"]["osm_id"])
        if key not in seen:
            seen.add(key)
            unique.append(f)

    OVERPASS_DIR.mkdir(parents=True, exist_ok=True)
    out = OVERPASS_DIR / f"{category}.geojson"
    out.write_text(json.dumps({"type": "FeatureCollection", "features": unique}, ensure_ascii=False),
                   encoding="utf-8")
    return len(unique)


def main() -> None:
    wanted = sys.argv[1:] or list(CATEGORIES)
    unknown = [c for c in wanted if c not in CATEGORIES]
    if unknown:
        raise SystemExit(f"Unknown categories: {unknown}. Choose from {list(CATEGORIES)}")

    for cat in wanted:
        print(f"Fetching {cat}...", flush=True)
        n = fetch(cat)
        print(f"  {cat}: {n} features -> data/overpass/{cat}.geojson", flush=True)
        time.sleep(3)  # be polite to the public Overpass server


if __name__ == "__main__":
    main()
