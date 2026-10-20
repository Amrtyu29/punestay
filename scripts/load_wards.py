"""Loads ward or locality polygons from data/wards.geojson into the wards table.

Get the file from the Pune Municipal Corporation open data portal
(search "ward boundary" or "prabhag"), or draw rough locality polygons in QGIS
and export as GeoJSON in WGS84 (EPSG:4326). Each feature needs a "name" property
(or "ward_name" / "prabhag" / "NAME").

Usage:
    python scripts/load_wards.py [path/to/file.geojson]
"""
import json
import sys

from common import DATA, connect

NAME_KEYS = ("name", "ward_name", "WARD_NAME", "prabhag", "PRABHAG", "NAME", "Name")


def main() -> None:
    path = DATA / (sys.argv[1] if len(sys.argv) > 1 else "wards.geojson")
    if not path.exists():
        raise SystemExit(f"Missing {path}. See the docstring for where to get it.")

    fc = json.loads(path.read_text(encoding="utf-8"))
    with connect() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM wards")
        n = 0
        for f in fc["features"]:
            props = f.get("properties") or {}
            name = next((str(props[k]) for k in NAME_KEYS if props.get(k)), None)
            geom = json.dumps(f["geometry"])
            cur.execute(
                "INSERT INTO wards (name, geom) VALUES (%s, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)))",
                (name, geom),
            )
            n += 1
        conn.commit()
    print(f"Loaded {n} wards from {path.name}")


if __name__ == "__main__":
    main()
