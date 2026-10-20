from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..auth import require_role
from ..db import get_cursor
from ..services.coverage import coverage as coverage_report

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_role("admin"))])


class StatusIn(BaseModel):
    status: Literal["unverified", "verified", "hidden"]


class DecisionIn(BaseModel):
    decision: Literal["approve", "reject"]


@router.get("/stats", summary="Counts for the admin page")
def stats(cur=Depends(get_cursor)):
    cur.execute("""
        SELECT
          (SELECT count(*) FROM listings) AS listings,
          (SELECT count(*) FROM listings WHERE status = 'verified') AS verified,
          (SELECT count(*) FROM listings WHERE status = 'unverified') AS unverified,
          (SELECT count(*) FROM listings WHERE status = 'hidden') AS hidden,
          (SELECT count(*) FROM listings WHERE status = 'pending') AS pending,
          (SELECT count(*) FROM listing_claims WHERE status = 'pending') AS claims_pending,
          (SELECT count(*) FROM listings WHERE flag_count > 0 AND status <> 'hidden') AS flagged_open,
          (SELECT count(*) FROM listings WHERE updated_at < now() - interval '90 days') AS stale,
          (SELECT count(*) FROM users) AS users,
          (SELECT count(*) FROM safety_reports) AS safety_reports,
          (SELECT json_object_agg(source, n) FROM (SELECT source, count(*) AS n FROM listings GROUP BY source) s) AS by_source
    """)
    return cur.fetchone()


@router.get("/flagged", summary="Listings with flags or hidden, newest flag first")
def flagged(limit: int = Query(100, ge=1, le=500), cur=Depends(get_cursor)):
    cur.execute(
        """SELECT l.id, l.name, l.address, l.listing_type, l.rent_min, l.status, l.verify_count, l.flag_count,
                  l.source, l.updated_at, ST_Y(l.geom) AS lat, ST_X(l.geom) AS lng,
                  u.name AS owner_name, u.email AS owner_email,
                  (SELECT json_agg(json_build_object('user_id', a.user_id, 'action', a.action, 'value', a.value, 'at', a.created_at)
                                   ORDER BY a.created_at DESC)
                     FROM listing_actions a WHERE a.listing_id = l.id) AS actions
           FROM listings l LEFT JOIN users u ON u.id = l.owner_id
           WHERE l.flag_count > 0 OR l.status = 'hidden'
           ORDER BY l.flag_count DESC, l.updated_at DESC LIMIT %s""",
        (limit,),
    )
    return cur.fetchall()


@router.patch("/listings/{listing_id}/status", summary="Force a listing status (restore, hide, verify)")
def set_status(listing_id: int, body: StatusIn, cur=Depends(get_cursor)):
    cur.execute("UPDATE listings SET status = %s WHERE id = %s RETURNING id, status", (body.status, listing_id))
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Listing not found")
    if body.status != "hidden":
        # Restoring clears the flags so three old flags do not hide it again instantly.
        cur.execute("DELETE FROM listing_actions WHERE listing_id = %s AND action = 'flag'", (listing_id,))
        cur.execute("UPDATE listings SET flag_count = 0 WHERE id = %s", (listing_id,))
    return row


@router.get("/pending", summary="Listings from new accounts waiting for approval")
def pending(cur=Depends(get_cursor)):
    cur.execute(
        """SELECT l.id, l.name, l.address, l.listing_type, l.gender, l.rent_min, l.contact_phone, l.created_at,
                  ST_Y(l.geom) AS lat, ST_X(l.geom) AS lng,
                  u.id AS owner_id, u.name AS owner_name, u.email AS owner_email, u.phone AS owner_phone, u.created_at AS owner_since,
                  (SELECT count(*) FROM listing_photos p WHERE p.listing_id = l.id)::int AS photos
           FROM listings l JOIN users u ON u.id = l.owner_id
           WHERE l.status = 'pending' ORDER BY l.created_at"""
    )
    return cur.fetchall()


@router.patch("/pending/{listing_id}", summary="Approve (goes live, owner becomes trusted) or reject (deleted) a pending listing")
def decide_pending(listing_id: int, body: DecisionIn, cur=Depends(get_cursor)):
    cur.execute("SELECT owner_id FROM listings WHERE id = %s AND status = 'pending'", (listing_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, "No pending listing with that id")
    if body.decision == "approve":
        cur.execute("UPDATE listings SET status = 'unverified' WHERE id = %s", (listing_id,))
        cur.execute("UPDATE users SET trusted = true WHERE id = %s", (row["owner_id"],))
        return {"id": listing_id, "status": "unverified", "owner_trusted": True}
    cur.execute("DELETE FROM listings WHERE id = %s", (listing_id,))
    return {"id": listing_id, "status": "rejected"}


@router.get("/claims", summary="Owner claims on imported listings, pending first")
def claims(cur=Depends(get_cursor)):
    cur.execute(
        """SELECT c.id, c.status, c.phone AS claimed_phone, c.note, c.created_at, c.decided_at,
                  l.id AS listing_id, l.name AS listing_name, l.address, l.source, l.contact_phone AS listed_phone,
                  u.id AS user_id, u.name AS user_name, u.email AS user_email
           FROM listing_claims c JOIN listings l ON l.id = c.listing_id JOIN users u ON u.id = c.user_id
           ORDER BY (c.status <> 'pending'), c.created_at DESC LIMIT 200"""
    )
    return cur.fetchall()


@router.patch("/claims/{claim_id}", summary="Approve (user becomes owner) or reject a claim")
def decide_claim(claim_id: int, body: DecisionIn, cur=Depends(get_cursor)):
    cur.execute("SELECT listing_id, user_id, phone, status FROM listing_claims WHERE id = %s", (claim_id,))
    c = cur.fetchone()
    if not c:
        raise HTTPException(404, "Claim not found")
    if body.decision == "approve":
        cur.execute("SELECT owner_id FROM listings WHERE id = %s", (c["listing_id"],))
        if cur.fetchone()["owner_id"] is not None:
            raise HTTPException(400, "The listing already has an owner")
        cur.execute(
            """UPDATE listings SET owner_id = %s, contact_phone = COALESCE(contact_phone, %s), source = source
               WHERE id = %s""",
            (c["user_id"], c["phone"], c["listing_id"]),
        )
        cur.execute("UPDATE users SET trusted = true WHERE id = %s", (c["user_id"],))
        cur.execute("UPDATE listing_claims SET status = 'rejected', decided_at = now() WHERE listing_id = %s AND id <> %s AND status = 'pending'",
                    (c["listing_id"], claim_id))
    cur.execute("UPDATE listing_claims SET status = %s, decided_at = now() WHERE id = %s RETURNING id, status",
                ("approved" if body.decision == "approve" else "rejected", claim_id))
    return cur.fetchone()


@router.get("/coverage", summary="Data coverage: completeness, supply vs demand by locality, colleges with no listings")
def coverage(cur=Depends(get_cursor)):
    return coverage_report(cur)


@router.get("/users", summary="Accounts")
def users(limit: int = Query(200, ge=1, le=1000), cur=Depends(get_cursor)):
    cur.execute(
        """SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
                  (SELECT count(*) FROM listings l WHERE l.owner_id = u.id) AS listings
           FROM users u ORDER BY u.created_at DESC LIMIT %s""",
        (limit,),
    )
    return cur.fetchall()
