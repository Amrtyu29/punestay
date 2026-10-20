from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from ..db import get_cursor
from ..geo import collection

router = APIRouter(prefix="/destinations", tags=["destinations"])


@router.get("", summary="Search colleges and offices by name")
def search_destinations(
    cur=Depends(get_cursor),
    q: str | None = Query(None, min_length=1, description="name contains, case-insensitive"),
    kind: Literal["college", "office"] | None = None,
    limit: int = Query(20, ge=1, le=200),
):
    where, params = ["TRUE"], {"limit": limit}
    if q:
        where.append("name ILIKE %(q)s")
        params["q"] = f"%{q}%"
    if kind:
        where.append("kind = %(kind)s")
        params["kind"] = kind
    cur.execute(
        f"""SELECT id, name, kind, ST_Y(geom) AS lat, ST_X(geom) AS lng
            FROM destinations WHERE {' AND '.join(where)}
            ORDER BY (lower(name) LIKE lower(%(prefix)s)) DESC, name
            LIMIT %(limit)s""",
        {**params, "prefix": f"{q}%" if q else ""},
    )
    rows = cur.fetchall()
    fc = collection(rows)
    fc["count"] = len(rows)
    return fc


@router.get("/{destination_id}", summary="One destination")
def get_destination(destination_id: int, cur=Depends(get_cursor)):
    cur.execute(
        "SELECT id, name, kind, ST_Y(geom) AS lat, ST_X(geom) AS lng FROM destinations WHERE id = %s",
        (destination_id,),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Destination not found")
    return row
