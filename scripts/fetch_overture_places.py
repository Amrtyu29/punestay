"""Extracts accommodation places (PGs, hostels, co-living, guest houses, serviced apartments) for Pune from
Overture Maps Places and saves them as data/overture/lodging.geojson.

Overture Places are open data (CDLA Permissive 2.0) built from Meta and Microsoft business listings, so they
include many small PGs and hostels that OpenStreetMap volunteers never mapped. Nothing is scraped: DuckDB
reads the public GeoParquet release on AWS directly, filtered to the Pune bounding box.

Usage:
    python scripts/fetch_overture_places.py                 # latest release, accommodation only
    python scripts/fetch_overture_places.py --categories    # list every category present in Pune (to tune the filter)
    python scripts/fetch_overture_places.py --release 2026-09-23.1
"""
import argparse
import json
import re
import sys
from pathlib import Path

import duckdb
import requests

from common import DATA, bbox

BUCKET = "https://overturemaps-us-west-2.s3.amazonaws.com"

# Overture taxonomy names that mean "somewhere a student or worker can rent a bed or room".
# (2026 taxonomy, checked with --categories: in Pune 'hostel' has ~480 places and is where PGs land; generic
# 'lodging' / 'lodge' are mostly hotels, so those only count when the name says PG / hostel / co-living.)
CATEGORIES = {
    "hostel", "guest_house", "dormitory", "student_housing", "boarding_house", "rooming_house",
    "shared_living", "coliving_space",
}
# Name patterns that mark a PG / hostel / co-living whatever its category.
NAME_RE = r"(?i)(paying guest|\bp\.?g\.?\b|\bpgs\b|hostel|co-?living|coliving|ladies home|girls home|boys home|" \
          r"stanza|zolo|colive|housr|isthara|olive by|your-?space|hello ?world|nestaway|settl|tribe stays|" \
          r"room(s)? (for|on) rent|rooms? available|chawl|dharamshala|dharmashala)"


def latest_release() -> str:
    r = requests.get(f"{BUCKET}/?list-type=2&prefix=release/&delimiter=/", timeout=60)
    r.raise_for_status()
    rels = re.findall(r"<Prefix>release/([^/<]+)/</Prefix>", r.text)
    if not rels:
        raise SystemExit("Could not list Overture releases")
    return sorted(rels)[-1]


def connect():
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;")
    con.execute("SET s3_region='us-west-2'; SET s3_url_style='path';")
    return con


LOCAL = DATA / "overture" / "pune_places.parquet"


def remote(release: str) -> str:
    return f"read_parquet('s3://overturemaps-us-west-2/release/{release}/theme=places/type=place/*', hive_partitioning=1)"


def ensure_local(con, release: str, refresh: bool = False):
    """Download every place inside the Pune bbox to a local GeoParquet file, once per release.

    Uses Overture's official `overturemaps` downloader, which reads the STAC catalog to fetch only the files
    that cover Pune (about a minute). Scanning the global release directly with DuckDB took over 30 minutes.
    """
    import shutil
    import subprocess

    marker = LOCAL.with_suffix(".release")
    if LOCAL.exists() and LOCAL.stat().st_size > 0 and not refresh and marker.exists() and marker.read_text().strip() == release:
        return
    LOCAL.parent.mkdir(parents=True, exist_ok=True)
    s, w, n, e = bbox()
    exe = shutil.which("overturemaps") or str(Path(sys.executable).with_name("overturemaps.exe"))
    print("Downloading Pune places with the overturemaps CLI (about a minute)...", flush=True)
    subprocess.run([exe, "download", f"--bbox={w},{s},{e},{n}", "-f", "geoparquet", "-t", "place",
                    "-r", release, "-o", str(LOCAL)], check=True)
    marker.write_text(release)
    rows = con.execute(f"SELECT count(*) FROM read_parquet('{LOCAL.as_posix()}')").fetchone()[0]
    print(f"saved {rows} Pune places to {LOCAL}", flush=True)


def source(release: str) -> str:
    return f"read_parquet('{LOCAL.as_posix()}')"


def bbox_where() -> str:
    s, w, n, e = bbox()
    return (f"bbox['xmin'] BETWEEN {w} AND {e} AND bbox['ymin'] BETWEEN {s} AND {n}")


def list_categories(con, release):
    """Since 2025 releases Overture uses `taxonomy` (primary / hierarchy / alternates) plus `basic_category`."""
    q = f"""SELECT taxonomy['primary'] AS cat, basic_category, count(*) AS n FROM {source(release)}
            WHERE {bbox_where()} GROUP BY 1, 2 ORDER BY 3 DESC"""
    for cat, basic, n in con.execute(q).fetchall():
        print(f"{n:7}  {cat}  [{basic}]")


def fetch(con, release):
    cats = ", ".join(f"'{c}'" for c in sorted(CATEGORIES))
    q = f"""
      SELECT id, names['primary'] AS name, taxonomy['primary'] AS category, taxonomy['alternates'] AS alt,
             taxonomy['hierarchy'] AS hierarchy, basic_category, operating_status,
             confidence, websites, phones, socials,
             addresses[1]['freeform'] AS street, addresses[1]['locality'] AS locality, addresses[1]['postcode'] AS postcode,
             sources[1]['dataset'] AS dataset,
             ST_X(geometry) AS lng, ST_Y(geometry) AS lat
      FROM {source(release)}
      WHERE {bbox_where()}
        AND names['primary'] IS NOT NULL
        AND coalesce(operating_status, 'open') = 'open'
        AND (taxonomy['primary'] IN ({cats})
             OR basic_category IN ({cats})
             OR list_has_any(coalesce(taxonomy['alternates'], []), [{cats}])
             OR list_has_any(coalesce(taxonomy['hierarchy'], []), [{cats}])
             OR regexp_matches(names['primary'], '{NAME_RE}'))
    """
    rows = con.execute(q).fetchall()
    cols = [d[0] for d in con.description]
    feats = []
    for row in rows:
        r = dict(zip(cols, row))
        feats.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [r["lng"], r["lat"]]},
            "properties": {
                "overture_id": r["id"], "name": r["name"], "category": r["category"], "alternate": r["alt"],
                "hierarchy": r["hierarchy"], "basic_category": r["basic_category"],
                "confidence": r["confidence"], "phone": (r["phones"] or [None])[0], "website": (r["websites"] or [None])[0],
                "street": r["street"], "locality": r["locality"], "postcode": r["postcode"], "dataset": r["dataset"],
                "release": release,
            },
        })
    return feats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--release")
    ap.add_argument("--categories", action="store_true")
    ap.add_argument("--refresh", action="store_true", help="re-download the Pune subset even if cached")
    args = ap.parse_args()
    release = args.release or latest_release()
    print(f"Overture release {release}", flush=True)
    con = connect()
    ensure_local(con, release, args.refresh)
    if args.categories:
        list_categories(con, release)
        return
    feats = fetch(con, release)
    out = DATA / "overture" / "lodging.geojson"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False), encoding="utf-8")
    by = {}
    for f in feats:
        by[f["properties"]["category"]] = by.get(f["properties"]["category"], 0) + 1
    print(f"{len(feats)} places -> {out}")
    for k, v in sorted(by.items(), key=lambda kv: -kv[1])[:20]:
        print(f"  {v:5}  {k}")


if __name__ == "__main__":
    main()
