"""Creating and maintaining listings: owners add and edit, everyone can verify or flag."""
import io
import json
import statistics
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from PIL import Image, UnidentifiedImageError
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field

from ..auth import current_user
from ..config import MAX_PHOTO_MB, UPLOAD_DIR
from ..db import get_cursor
from ..geo import in_pune
from ..services.nearby import refresh_derived

router = APIRouter(prefix="/listings", tags=["listings: write"])

VERIFY_THRESHOLD = 3
FLAG_THRESHOLD = 3
MAX_PHOTOS = 5
VERIFY_RADIUS_M = 300          # "I have seen it" only counts from within this distance of the place
DAILY_LISTINGS = 3             # new listings per account per day
DAILY_ACTIONS = 10             # verify + flag + rent suggestions per account per day


def _daily_limit(cur, sql: str, params: tuple, limit: int, what: str) -> None:
    cur.execute(sql, params)
    if cur.fetchone()["n"] >= limit:
        raise HTTPException(429, f"Daily limit reached: at most {limit} {what} per account per day. Try again tomorrow.")
AMENITIES = {"wifi", "ac", "laundry", "parking", "lift", "security", "mess", "geyser", "cctv", "wheelchair", "power_backup", "housekeeping"}


class ListingIn(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    address: str = Field(min_length=5, max_length=300)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    listing_type: Literal["pg", "flat", "hostel"]
    gender: Literal["male", "female", "any"] = "any"
    rent_min: int = Field(ge=500, le=500_000)
    rent_max: int | None = Field(default=None, ge=500, le=500_000)
    deposit: int | None = Field(default=None, ge=0, le=5_000_000)
    food_included: bool = False
    amenities: list[str] = []
    contact_phone: str | None = Field(default=None, pattern=r"^[0-9+\- ]{8,15}$")
    website: str | None = Field(default=None, max_length=300, pattern=r"^https?://[^\s<>\"']+$")
    vacancy: bool = True

    def clean(self) -> "ListingIn":
        if not in_pune(self.lat, self.lng):
            raise HTTPException(400, "The pin must be inside the Pune area")
        if self.website == "":
            self.website = None
        if self.rent_max is not None and self.rent_max < self.rent_min:
            raise HTTPException(400, "rent_max must be at least rent_min")
        bad = [a for a in self.amenities if a not in AMENITIES]
        if bad:
            raise HTTPException(400, f"Unknown amenities: {bad}. Allowed: {sorted(AMENITIES)}")
        return self


class VacancyIn(BaseModel):
    vacancy: bool


class DeviceIn(BaseModel):
    """Where the user's device is right now (browser geolocation), to prove they are at the place."""
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    accuracy_m: int | None = Field(default=None, ge=0, le=100000)


class ClaimIn(BaseModel):
    phone: str = Field(pattern=r"^[0-9+\- ]{8,15}$")
    note: str | None = Field(default=None, max_length=300)


class RentUpdateIn(BaseModel):
    rent_min: int = Field(ge=500, le=500_000)
    rent_max: int | None = Field(default=None, ge=500, le=500_000)


def _owned(cur, listing_id: int, user: dict) -> dict:
    cur.execute("SELECT id, owner_id FROM listings WHERE id = %s", (listing_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Listing not found")
    if user["role"] != "admin" and row["owner_id"] != user["id"]:
        raise HTTPException(403, "Only the owner of this listing (or an admin) can change it")
    return row


@router.get("/near", summary="Possible duplicates near a pin (used before adding)")
def near(
    lat: float = Query(..., ge=-90, le=90), lng: float = Query(..., ge=-180, le=180),
    name: str | None = Query(None, max_length=120), radius_m: int = Query(40, ge=5, le=300),
    cur=Depends(get_cursor),
):
    cur.execute(
        """SELECT id, name, address, listing_type, rent_min, status,
                  ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(%(lng)s, %(lat)s), 4326)::geography)::int AS distance_m,
                  CASE WHEN %(name)s::text IS NULL THEN NULL ELSE similarity(lower(name), lower(%(name)s::text)) END AS name_similarity
           FROM listings
           WHERE status <> 'hidden'
             AND (ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(%(lng)s, %(lat)s), 4326)::geography, %(radius)s)
                  OR (%(name)s::text IS NOT NULL AND similarity(lower(name), lower(%(name)s::text)) > 0.6
                      AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(%(lng)s, %(lat)s), 4326)::geography, 500)))
           ORDER BY distance_m LIMIT 5""",
        {"lat": lat, "lng": lng, "name": name, "radius": radius_m},
    )
    rows = cur.fetchall()
    return {"count": len(rows), "matches": rows}


@router.post("", status_code=201, summary="Add a listing (owner or student)")
def create_listing(body: ListingIn, user: dict = Depends(current_user), cur=Depends(get_cursor)):
    body.clean()
    _daily_limit(cur, "SELECT count(*) AS n FROM listings WHERE owner_id = %s AND created_at > now() - interval '1 day'",
                 (user["id"],), DAILY_LISTINGS, "new listings")
    # A brand-new account's listings wait for an admin; once one is approved the account is trusted.
    status = "unverified" if (user.get("trusted") or user["role"] == "admin") else "pending"
    cur.execute(
        """INSERT INTO listings (owner_id, name, address, geom, listing_type, gender, rent_min, rent_max, deposit,
                                 food_included, amenities, contact_phone, website, vacancy, status, source)
           VALUES (%s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                   %s, 'user')
           RETURNING id""",
        (user["id"], body.name.strip(), body.address.strip(), body.lng, body.lat, body.listing_type, body.gender,
         body.rent_min, body.rent_max, body.deposit, body.food_included, Jsonb(sorted(set(body.amenities))),
         body.contact_phone, body.website, body.vacancy, status),
    )
    listing_id = cur.fetchone()["id"]
    refresh_derived(cur, listing_id)
    row = _full_row(cur, listing_id)
    if status == "pending":
        row["message"] = "Saved. Because this is a new account, an admin checks the listing before it appears on the map."
    return row


FULL_ROW = """
SELECT id, owner_id, name, address, listing_type, gender, rent_min, rent_max, deposit, food_included, amenities,
       contact_phone, website, vacancy, status, verify_count, flag_count, is_demo, source, rent_estimated,
       safety_score, nearest_bus_stop_m, nearest_metro_m, nearest_mess_m, nearest_hospital_m,
       (updated_at < now() - interval '90 days') AS stale, ST_Y(geom) AS lat, ST_X(geom) AS lng,
       created_at, updated_at
FROM listings WHERE id = %s
"""


def _full_row(cur, listing_id: int) -> dict:
    """The owner's view of a listing: every column, regardless of status (hidden rows included)."""
    cur.execute(FULL_ROW, (listing_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Listing not found")
    cur.execute("SELECT id, url FROM listing_photos WHERE listing_id = %s ORDER BY id", (listing_id,))
    row["photos"] = cur.fetchall()
    return row


@router.get("/{listing_id}/edit", summary="Full listing for its owner (works for hidden listings too)")
def listing_for_edit(listing_id: int, user: dict = Depends(current_user), cur=Depends(get_cursor)):
    _owned(cur, listing_id, user)
    return _full_row(cur, listing_id)


@router.put("/{listing_id}", summary="Edit a listing you own")
def update_listing(listing_id: int, body: ListingIn, user: dict = Depends(current_user), cur=Depends(get_cursor)):
    body.clean()
    _owned(cur, listing_id, user)
    cur.execute(
        """UPDATE listings SET name=%s, address=%s, geom=ST_SetSRID(ST_MakePoint(%s, %s), 4326), listing_type=%s,
                  gender=%s, rent_min=%s, rent_max=%s, deposit=%s, food_included=%s, amenities=%s, contact_phone=%s,
                  website=%s, vacancy=%s, rent_estimated=FALSE
           WHERE id=%s
           RETURNING ST_Distance(geom::geography, (SELECT geom FROM listings WHERE id=%s)::geography) AS moved_m""",
        (body.name.strip(), body.address.strip(), body.lng, body.lat, body.listing_type, body.gender, body.rent_min,
         body.rent_max, body.deposit, body.food_included, Jsonb(sorted(set(body.amenities))), body.contact_phone,
         body.website, body.vacancy, listing_id, listing_id),
    )
    # The pin may have moved: commute times to every destination are stale, so drop them.
    cur.execute("DELETE FROM commute_cache WHERE listing_id = %s", (listing_id,))
    refresh_derived(cur, listing_id)
    return _full_row(cur, listing_id)


@router.patch("/{listing_id}/vacancy", summary="Owner toggles rooms available / full")
def set_vacancy(listing_id: int, body: VacancyIn, user: dict = Depends(current_user), cur=Depends(get_cursor)):
    _owned(cur, listing_id, user)
    cur.execute("UPDATE listings SET vacancy = %s WHERE id = %s RETURNING id, vacancy, updated_at", (body.vacancy, listing_id))
    return cur.fetchone()


@router.delete("/{listing_id}", status_code=204, summary="Remove a listing you own")
def delete_listing(listing_id: int, user: dict = Depends(current_user), cur=Depends(get_cursor)):
    _owned(cur, listing_id, user)
    cur.execute("DELETE FROM listings WHERE id = %s", (listing_id,))
    import shutil
    shutil.rmtree(UPLOAD_DIR / "listings" / str(listing_id), ignore_errors=True)


@router.get("/mine/all", summary="Listings owned by the signed-in user, including hidden ones")
def my_listings(user: dict = Depends(current_user), cur=Depends(get_cursor)):
    cur.execute("SELECT c.id, c.listing_id, c.status, c.created_at, l.name FROM listing_claims c JOIN listings l ON l.id = c.listing_id WHERE c.user_id = %s ORDER BY c.created_at DESC", (user["id"],))
    claims = cur.fetchall()
    cur.execute(
        """SELECT l.id, l.name, l.address, l.listing_type, l.gender, l.rent_min, l.rent_max, l.vacancy, l.status,
                  l.verify_count, l.flag_count, l.updated_at, ST_Y(l.geom) AS lat, ST_X(l.geom) AS lng,
                  (SELECT count(*) FROM listing_photos p WHERE p.listing_id = l.id) AS photo_count
           FROM listings l WHERE l.owner_id = %s ORDER BY l.updated_at DESC""",
        (user["id"],),
    )
    return {"listings": cur.fetchall(), "claims": claims, "trusted": bool(user.get("trusted"))}


# ---------------------------------------------------------------- photos

@router.post("/{listing_id}/photos", status_code=201, summary="Upload up to 5 photos (jpeg/png/webp)")
async def upload_photos(listing_id: int, files: list[UploadFile] = File(...), user: dict = Depends(current_user), cur=Depends(get_cursor)):
    _owned(cur, listing_id, user)
    cur.execute("SELECT count(*) AS n FROM listing_photos WHERE listing_id = %s", (listing_id,))
    have = cur.fetchone()["n"]
    if have + len(files) > MAX_PHOTOS:
        raise HTTPException(400, f"At most {MAX_PHOTOS} photos per listing ({have} already uploaded)")

    # Validate every file before writing anything, so a bad second file cannot orphan the first.
    images = []
    for f in files:
        raw = await f.read()
        if len(raw) > MAX_PHOTO_MB * 1024 * 1024:
            raise HTTPException(413, f"{f.filename}: larger than {MAX_PHOTO_MB} MB")
        try:
            img = Image.open(io.BytesIO(raw))
            img.verify()
            img = Image.open(io.BytesIO(raw)).convert("RGB")
        except (UnidentifiedImageError, OSError):
            raise HTTPException(400, f"{f.filename}: not a readable image")
        images.append(img)

    folder = UPLOAD_DIR / "listings" / str(listing_id)
    folder.mkdir(parents=True, exist_ok=True)
    saved = []
    for img in images:
        img.thumbnail((1200, 1200))
        name = f"{uuid.uuid4().hex}.jpg"
        img.save(folder / name, "JPEG", quality=85, optimize=True)
        url = f"/uploads/listings/{listing_id}/{name}"
        cur.execute("INSERT INTO listing_photos (listing_id, url) VALUES (%s, %s) RETURNING id, url", (listing_id, url))
        saved.append(cur.fetchone())
    return saved


@router.delete("/{listing_id}/photos/{photo_id}", status_code=204, summary="Remove a photo")
def delete_photo(listing_id: int, photo_id: int, user: dict = Depends(current_user), cur=Depends(get_cursor)):
    _owned(cur, listing_id, user)
    cur.execute("DELETE FROM listing_photos WHERE id = %s AND listing_id = %s RETURNING url", (photo_id, listing_id))
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Photo not found")
    path = UPLOAD_DIR / row["url"].lstrip("/").removeprefix("uploads/")
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass


# ---------------------------------------------------------------- community actions

def _record_action(cur, listing_id: int, user: dict, action: str, value: str | None = None,
                   distance_m: int | None = None) -> dict:
    cur.execute("SELECT id, owner_id, status FROM listings WHERE id = %s", (listing_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Listing not found")
    if row["status"] == "pending":
        raise HTTPException(400, "This listing is still waiting for admin approval")
    if row["owner_id"] == user["id"] and action in ("verify", "flag"):
        raise HTTPException(400, "You cannot verify or flag your own listing")
    _daily_limit(cur, "SELECT count(*) AS n FROM listing_actions WHERE user_id = %s AND created_at > now() - interval '1 day'",
                 (user["id"],), DAILY_ACTIONS, "confirmations, flags or rent suggestions")
    cur.execute(
        """INSERT INTO listing_actions (listing_id, user_id, action, value, distance_m) VALUES (%s, %s, %s, %s, %s)
           ON CONFLICT (listing_id, user_id, action) DO UPDATE
             SET value = EXCLUDED.value, distance_m = EXCLUDED.distance_m, created_at = now()""",
        (listing_id, user["id"], action, value, distance_m),
    )
    cur.execute(
        """UPDATE listings l SET
             verify_count = (SELECT count(*) FROM listing_actions a WHERE a.listing_id = l.id AND a.action = 'verify'),
             flag_count   = (SELECT count(*) FROM listing_actions a WHERE a.listing_id = l.id AND a.action = 'flag')
           WHERE l.id = %s RETURNING verify_count, flag_count, status""",
        (listing_id,),
    )
    counts = cur.fetchone()
    new_status = counts["status"]
    if counts["flag_count"] >= FLAG_THRESHOLD:
        new_status = "hidden"
    elif counts["verify_count"] >= VERIFY_THRESHOLD and counts["status"] == "unverified":
        new_status = "verified"
    if new_status != counts["status"]:
        cur.execute("UPDATE listings SET status = %s WHERE id = %s", (new_status, listing_id))
    return {"listing_id": listing_id, "verify_count": counts["verify_count"], "flag_count": counts["flag_count"], "status": new_status}


@router.post("/{listing_id}/verify", summary="I have seen this place, it is real (only counts from within 300 m)")
def verify_listing(listing_id: int, body: DeviceIn, user: dict = Depends(current_user), cur=Depends(get_cursor)):
    cur.execute(
        "SELECT ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography)::int AS d FROM listings WHERE id = %s",
        (body.lng, body.lat, listing_id),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Listing not found")
    allowed = VERIFY_RADIUS_M + min(body.accuracy_m or 0, 200)   # tolerate a poor GPS fix, up to 200 m
    if row["d"] > allowed:
        raise HTTPException(400, f"You are {row['d']} m from this place. Confirmations only count from within "
                                 f"{VERIFY_RADIUS_M} m, so please do it when you are there.")
    return _record_action(cur, listing_id, user, "verify", distance_m=row["d"])


# ---------------------------------------------------------------- claims (imported places)

@router.post("/{listing_id}/claim", status_code=201, summary="This is my PG: ask to take over an imported listing")
def claim_listing(listing_id: int, body: ClaimIn, user: dict = Depends(current_user), cur=Depends(get_cursor)):
    cur.execute("SELECT owner_id, source, contact_phone FROM listings WHERE id = %s", (listing_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Listing not found")
    if row["owner_id"] is not None:
        raise HTTPException(400, "This listing already has an owner. If that is wrong, flag it.")
    _daily_limit(cur, "SELECT count(*) AS n FROM listing_claims WHERE user_id = %s AND created_at > now() - interval '1 day'",
                 (user["id"],), DAILY_LISTINGS, "claims")
    cur.execute(
        """INSERT INTO listing_claims (listing_id, user_id, phone, note) VALUES (%s, %s, %s, %s)
           ON CONFLICT (listing_id, user_id) DO UPDATE SET phone = EXCLUDED.phone, note = EXCLUDED.note,
                                                           status = 'pending', created_at = now(), decided_at = NULL
           RETURNING id, status, created_at""",
        (listing_id, user["id"], body.phone.strip(), (body.note or "").strip() or None),
    )
    claim = cur.fetchone()
    claim["message"] = ("Thanks. An admin will call the number on record" +
                        (f" ({row['contact_phone']})" if row["contact_phone"] else "") +
                        " to confirm, then you can set the rent and availability.")
    return claim


@router.get("/{listing_id}/my-claim", summary="My claim on this listing, if any")
def my_claim(listing_id: int, user: dict = Depends(current_user), cur=Depends(get_cursor)):
    cur.execute("SELECT id, status, created_at, decided_at FROM listing_claims WHERE listing_id = %s AND user_id = %s", (listing_id, user["id"]))
    return cur.fetchone()


@router.post("/{listing_id}/flag", summary="This listing is fake, closed, or wrong")
def flag_listing(listing_id: int, reason: str | None = Query(None, max_length=200), user: dict = Depends(current_user), cur=Depends(get_cursor)):
    return _record_action(cur, listing_id, user, "flag", reason)


@router.post("/{listing_id}/rent-update", summary="Suggest the current rent; applied once two people agree")
def rent_update(listing_id: int, body: RentUpdateIn, user: dict = Depends(current_user), cur=Depends(get_cursor)):
    if body.rent_max is not None and body.rent_max < body.rent_min:
        raise HTTPException(400, "rent_max must be at least rent_min")
    out = _record_action(cur, listing_id, user, "rent_update", json.dumps({"rent_min": body.rent_min, "rent_max": body.rent_max}))
    cur.execute("SELECT value FROM listing_actions WHERE listing_id = %s AND action = 'rent_update' ORDER BY created_at DESC LIMIT 10", (listing_id,))
    suggestions = [json.loads(r["value"]) for r in cur.fetchall() if r["value"]]
    out["suggestions"] = len(suggestions)
    # Apply only when at least two people agree within 15 percent of the median.
    mins = [s["rent_min"] for s in suggestions]
    if len(mins) >= 2:
        med = statistics.median(mins)
        agreeing = [m for m in mins if abs(m - med) <= 0.15 * med]
        if len(agreeing) >= 2:
            rent_min = int(statistics.median(agreeing))
            maxes = [s["rent_max"] for s in suggestions if s.get("rent_max")]
            cur.execute("SELECT rent_max FROM listings WHERE id = %s", (listing_id,))
            current_max = cur.fetchone()["rent_max"]
            rent_max = int(statistics.median(maxes)) if maxes else current_max
            if rent_max is not None and rent_max < rent_min:
                rent_max = rent_min
            cur.execute("UPDATE listings SET rent_min = %s, rent_max = %s, rent_estimated = FALSE WHERE id = %s", (rent_min, rent_max, listing_id))
            out["applied"] = {"rent_min": rent_min, "rent_max": rent_max}
    return out


@router.get("/{listing_id}/my-actions", summary="What the signed-in user already did on this listing")
def my_actions(listing_id: int, user: dict = Depends(current_user), cur=Depends(get_cursor)):
    cur.execute("SELECT action, value, created_at FROM listing_actions WHERE listing_id = %s AND user_id = %s", (listing_id, user["id"]))
    return cur.fetchall()
