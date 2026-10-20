"""Crowd-sourced night-safety reports. Each report lowers the safety score of listings within 300 m."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from ..auth import current_user
from ..db import get_cursor
from ..geo import collection, in_pune, parse_bbox

router = APIRouter(prefix="/safety-reports", tags=["safety"])

CATEGORIES = ("dark_street", "harassment", "theft", "stray_dogs", "other")
LABEL = {"dark_street": "Dark street", "harassment": "Harassment", "theft": "Theft", "stray_dogs": "Stray dogs", "other": "Other"}


class ReportIn(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    category: Literal["dark_street", "harassment", "theft", "stray_dogs", "other"]
    note: str | None = Field(default=None, max_length=300)
    # Where the reporter's device is: a report only counts from within 500 m of the spot.
    device_lat: float = Field(ge=-90, le=90)
    device_lng: float = Field(ge=-180, le=180)
    accuracy_m: int | None = Field(default=None, ge=0, le=100000)


REPORT_RADIUS_M = 500
DAILY_REPORTS = 3


@router.get("", summary="Recent safety reports in a bbox (last 6 months), as GeoJSON")
def list_reports(bbox: str | None = Query(None, description="west,south,east,north"), limit: int = Query(1000, ge=1, le=5000), cur=Depends(get_cursor)):
    where, params = ["created_at > now() - interval '6 months'"], {"limit": limit}
    b = parse_bbox(bbox)
    if b:
        where.append("geom && ST_MakeEnvelope(%(w)s, %(s)s, %(e)s, %(n)s, 4326)")
        params.update(w=b[0], s=b[1], e=b[2], n=b[3])
    cur.execute(
        f"""SELECT id, category, note, created_at, ST_Y(geom) AS lat, ST_X(geom) AS lng
            FROM safety_reports WHERE {' AND '.join(where)} ORDER BY created_at DESC LIMIT %(limit)s""",
        params,
    )
    rows = cur.fetchall()
    for r in rows:
        r["label"] = LABEL[r["category"]]
    fc = collection(rows)
    fc["count"] = len(rows)
    return fc


@router.post("", status_code=201, summary="Report a spot that felt unsafe at night")
def create_report(body: ReportIn, user: dict = Depends(current_user), cur=Depends(get_cursor)):
    if not in_pune(body.lat, body.lng):
        raise HTTPException(400, "Point is outside the Pune area")
    cur.execute(
        "SELECT ST_Distance(ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography)::int AS d",
        (body.lng, body.lat, body.device_lng, body.device_lat),
    )
    d = cur.fetchone()["d"]
    if d > REPORT_RADIUS_M + min(body.accuracy_m or 0, 200):
        raise HTTPException(400, f"You are {d} m from that spot. Safety reports only count from within {REPORT_RADIUS_M} m, "
                                 f"so please report it when you are there.")
    cur.execute("SELECT count(*) AS n FROM safety_reports WHERE user_id = %s AND created_at > now() - interval '1 day'", (user["id"],))
    if cur.fetchone()["n"] >= DAILY_REPORTS:
        raise HTTPException(429, f"Daily limit reached: at most {DAILY_REPORTS} safety reports per account per day.")
    # One report per user per 100 m per day keeps spamming down.
    cur.execute(
        """SELECT 1 FROM safety_reports WHERE user_id = %s AND created_at > now() - interval '1 day'
           AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, 100)""",
        (user["id"], body.lng, body.lat),
    )
    if cur.fetchone():
        raise HTTPException(429, "You already reported this spot today")
    cur.execute(
        """INSERT INTO safety_reports (user_id, geom, category, note)
           VALUES (%s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s)
           RETURNING id, category, note, created_at, ST_Y(geom) AS lat, ST_X(geom) AS lng""",
        (user["id"], body.lng, body.lat, body.category, (body.note or "").strip() or None),
    )
    row = cur.fetchone()
    # Refresh safety scores of listings nearby (cheap: a few rows).
    cur.execute(
        """SELECT id FROM listings WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, 300)""",
        (body.lng, body.lat),
    )
    from ..services.nearby import refresh_derived  # local import avoids a cycle at module load
    for l in cur.fetchall():
        refresh_derived(cur, l["id"])
    row["label"] = LABEL[row["category"]]
    return row


@router.delete("/{report_id}", status_code=204, summary="Delete your own report")
def delete_report(report_id: int, user: dict = Depends(current_user), cur=Depends(get_cursor)):
    cur.execute("DELETE FROM safety_reports WHERE id = %s AND (user_id = %s OR %s = 'admin')", (report_id, user["id"], user["role"]))
    if cur.rowcount == 0:
        raise HTTPException(404, "Report not found")
