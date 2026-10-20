from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from ..config import MAX_LISTINGS_PER_REQUEST
from ..db import get_cursor
from ..geo import collection, parse_bbox
from ..services.nearby import nearby
from ..services.osrm import fill_commutes

router = APIRouter(prefix="/listings", tags=["listings"])

LISTING_COLS = """
  l.id, l.owner_id, l.name, l.address, l.listing_type, l.gender, l.rent_min, l.rent_max, l.deposit,
  l.food_included, l.amenities, l.vacancy, l.status, l.is_demo, l.source, l.rent_estimated,
  l.website, l.safety_score,
  l.nearest_bus_stop_m, l.nearest_metro_m, l.nearest_mess_m, l.nearest_hospital_m,
  l.stale, l.lat, l.lng, l.created_at, l.updated_at
"""


@router.get("", summary="Listings in a map viewport, with filters, as GeoJSON")
def list_listings(
    cur=Depends(get_cursor),
    bbox: str | None = Query(None, description="west,south,east,north"),
    rent_min: int | None = Query(None, ge=0),
    rent_max: int | None = Query(None, ge=0),
    rent_known: bool = Query(False, description="true = only listings with a published rent"),
    type: Literal["pg", "flat", "hostel"] | None = None,
    gender: Literal["male", "female", "any"] | None = Query(None, description="'any' shows all listings"),
    food: bool | None = Query(None, description="true = only food-included"),
    vacancy: bool | None = Query(None, description="true = only listings with rooms available"),
    include_demo: bool = Query(True, description="include synthetic demo listings"),
    destination_id: int | None = Query(None, description="adds commute_s and commute_m per listing"),
    mode: Literal["car", "bike", "foot"] = "car",
    max_commute_s: int | None = Query(None, ge=0, description="drop listings farther than this (needs destination_id)"),
    limit: int = Query(500, ge=1, le=MAX_LISTINGS_PER_REQUEST),
):
    where, params = ["TRUE"], {}
    b = parse_bbox(bbox)
    if b:
        where.append("l.geom && ST_MakeEnvelope(%(w)s, %(s)s, %(e)s, %(n)s, 4326)")
        params.update(w=b[0], s=b[1], e=b[2], n=b[3])
    if rent_min is not None:
        where.append("l.rent_min >= %(rent_min)s")
        params["rent_min"] = rent_min
    if rent_max is not None:
        # Places whose rent is not published stay visible unless rent_known=true asks to hide them.
        where.append("(l.rent_min IS NULL OR l.rent_min <= %(rent_max)s)")
        params["rent_max"] = rent_max
    if rent_known:
        where.append("l.rent_min IS NOT NULL")
    if type:
        where.append("l.listing_type = %(type)s")
        params["type"] = type
    if gender and gender != "any":
        where.append("l.gender IN (%(gender)s, 'any')")
        params["gender"] = gender
    if food is not None:
        where.append("l.food_included = %(food)s")
        params["food"] = food
    if vacancy is not None:
        where.append("l.vacancy = %(vacancy)s")
        params["vacancy"] = vacancy
    if not include_demo:
        where.append("l.is_demo = FALSE")

    commute_join = ""
    commute_cols = ", NULL::int AS commute_s, NULL::int AS commute_m"
    if destination_id is not None:
        commute_join = """LEFT JOIN commute_cache cc
                            ON cc.listing_id = l.id AND cc.destination_id = %(dest)s AND cc.mode = %(mode)s"""
        commute_cols = ", cc.duration_s AS commute_s, cc.distance_m AS commute_m"
        params.update(dest=destination_id, mode=mode)

    params["limit"] = limit
    cur.execute(
        f"""SELECT {LISTING_COLS} {commute_cols}
            FROM listings_public l {commute_join}
            WHERE {' AND '.join(where)}
            ORDER BY l.status = 'verified' DESC, l.updated_at DESC
            LIMIT %(limit)s""",
        params,
    )
    rows = cur.fetchall()

    if destination_id is not None:
        fill_commutes(cur, destination_id, mode, rows)
        if max_commute_s is not None:
            rows = [r for r in rows if r.get("commute_s") is not None and r["commute_s"] <= max_commute_s]

    fc = collection(rows)
    fc["count"] = len(rows)
    return fc


@router.get("/{listing_id}", summary="One listing with photos and nearby places")
def get_listing(listing_id: int, cur=Depends(get_cursor)):
    cur.execute(f"SELECT {LISTING_COLS}, l.id AS _id FROM listings_public l WHERE l.id = %s", (listing_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Listing not found")
    row.pop("_id")

    cur.execute("SELECT id, url FROM listing_photos WHERE listing_id = %s ORDER BY id", (listing_id,))
    photos = cur.fetchall()

    cur.execute("SELECT contact_phone FROM listings WHERE id = %s", (listing_id,))
    contact = cur.fetchone()["contact_phone"]

    cur.execute(
        """SELECT d.id, d.name, d.kind, cc.mode, cc.duration_s, cc.distance_m
           FROM commute_cache cc JOIN destinations d ON d.id = cc.destination_id
           WHERE cc.listing_id = %s ORDER BY cc.duration_s LIMIT 10""",
        (listing_id,),
    )
    commutes = cur.fetchall()

    return {
        "listing": row,
        "contact_phone": contact,
        "photos": photos,
        "nearby": nearby(cur, row["lat"], row["lng"]),
        "commutes": commutes,
    }


@router.get("/{listing_id}/nearby", summary="Nearest bus stop, metro, mess, hospital, etc.")
def get_nearby(
    listing_id: int,
    cur=Depends(get_cursor),
    k: int = Query(3, ge=1, le=10),
    radius_m: int = Query(3000, ge=100, le=10000),
):
    cur.execute("SELECT lat, lng FROM listings_public WHERE id = %s", (listing_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Listing not found")
    return {"listing_id": listing_id, "nearby": nearby(cur, row["lat"], row["lng"], k=k, radius_m=radius_m)}
