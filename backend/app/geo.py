"""GeoJSON helpers and bbox parsing shared by the routers."""
from fastapi import HTTPException

from .config import PUNE_BBOX


def parse_bbox(bbox: str | None) -> tuple[float, float, float, float] | None:
    """Parses 'west,south,east,north' (the order MapLibre's getBounds().toArray() flattens to)."""
    if not bbox:
        return None
    try:
        w, s, e, n = (float(x) for x in bbox.split(","))
    except ValueError as exc:
        raise HTTPException(400, "bbox must be 'west,south,east,north'") from exc
    if not (w < e and s < n):
        raise HTTPException(400, "bbox must have west < east and south < north")
    return w, s, e, n


def in_pune(lat: float, lng: float) -> bool:
    return PUNE_BBOX["south"] <= lat <= PUNE_BBOX["north"] and PUNE_BBOX["west"] <= lng <= PUNE_BBOX["east"]


def feature(row: dict, *, id_key: str = "id", lat_key: str = "lat", lng_key: str = "lng") -> dict:
    """Turns a dict row with lat/lng columns into a GeoJSON Feature. Geometry columns are dropped."""
    props = {k: v for k, v in row.items() if k not in (lat_key, lng_key, "geom")}
    return {
        "type": "Feature",
        "id": row[id_key],
        "geometry": {"type": "Point", "coordinates": [row[lng_key], row[lat_key]]},
        "properties": props,
    }


def collection(rows: list[dict], **kw) -> dict:
    return {"type": "FeatureCollection", "features": [feature(r, **kw) for r in rows]}
