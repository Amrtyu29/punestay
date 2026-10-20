"""End-to-end smoke test against a running API (default http://127.0.0.1:8000) and real database.

Creates two throwaway accounts (an owner and a student) with random emails, adds a listing, uploads a
photo, verifies / flags it, files a safety report, checks areas and routing, then deletes what it made.

Run from the project root with the API and database up:
    python backend/tests/smoke_api.py
"""
import io
import os
import sys
import uuid

import requests

BASE = os.environ.get("API_BASE", "http://127.0.0.1:8000")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@punestay.in")
TEST_DOMAIN = "punestay-smoke.in"   # .local / .test / example.com are rejected by the email validator
ok_count = 0


def check(cond, msg):
    global ok_count
    if cond:
        ok_count += 1
        print(f"  ok   {msg}")
    else:
        print(f"  FAIL {msg}")
        sys.exit(1)


def call(method, path, token=None, **kw):
    headers = kw.pop("headers", {})
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = requests.request(method, f"{BASE}{path}", headers=headers, timeout=60, **kw)
    return r


def main():
    tag = uuid.uuid4().hex[:8]
    print(f"API {BASE}")

    r = call("GET", "/health")
    check(r.status_code == 200 and r.json()["database"], "health: database reachable")

    # ---- public reads
    r = call("GET", "/listings", params={"bbox": "73.70,18.40,74.00,18.70", "limit": 500})
    check(r.status_code == 200 and r.json()["count"] > 50, f"listings in Pune bbox: {r.json().get('count')}")
    first = r.json()["features"][0]["id"]
    r = call("GET", f"/listings/{first}")
    check(r.status_code == 200 and "nearby" in r.json() and r.json()["listing"]["safety_score"] is not None, "listing detail with nearby + safety")
    r = call("GET", "/destinations", params={"q": "coep"})
    check(r.status_code == 200 and r.json()["count"] >= 1, "destination search 'coep'")
    dest = r.json()["features"][0]["id"]
    r = call("GET", "/listings", params={"bbox": "73.80,18.48,73.90,18.58", "destination_id": dest, "limit": 60})
    with_commute = sum(1 for f in r.json()["features"] if f["properties"].get("commute_s") is not None)
    check(r.status_code == 200, f"listings with commute to destination: {with_commute}/{r.json()['count']} (needs a router)")
    r = call("GET", "/areas", params={"min_listings": 2})
    check(r.status_code == 200 and len(r.json()) >= 2, f"areas: {len(r.json())} localities, top = {r.json()[0]['locality']}")
    a, b = r.json()[0]["locality_id"], r.json()[1]["locality_id"]
    r = call("GET", "/areas/compare", params={"a": a, "b": b})
    check(r.status_code == 200 and "a" in r.json(), "areas/compare")
    r = call("GET", "/areas/grid", params={"bbox": "73.78,18.48,73.90,18.60", "cell_m": 1000})
    check(r.status_code == 200 and r.json()["count"] > 0, f"rent grid cells: {r.json()['count']}")
    r = call("GET", "/safety-reports", params={"bbox": "73.70,18.40,74.00,18.70"})
    check(r.status_code == 200, f"safety reports list: {r.json().get('count')}")
    # ---- nearby services (course brief)
    r = call("GET", "/nearby/categories")
    check(r.status_code == 200 and len(r.json()) >= 15, f"nearby categories: {len(r.json())}")
    r = call("GET", "/nearby", params={"lat": 18.5204, "lng": 73.8567, "category": "hospital", "radius_m": 1500, "limit": 5})
    d = [f["properties"]["distance_m"] for f in r.json()["features"]]
    check(r.status_code == 200 and r.json()["count"] == 5 and d == sorted(d) and max(d) <= 1500, "nearby: 5 hospitals within 1.5 km, sorted")
    r = call("GET", "/nearby", params={"lat": 18.5204, "lng": 73.8567, "category": "school", "subcategory": "kindergarten", "limit": 3})
    check(r.status_code == 200 and all(f["properties"]["subcategory"] == "kindergarten" for f in r.json()["features"]), "nearby: subcategory filter")
    check(call("GET", "/nearby", params={"lng": 73.85}).status_code == 400, "nearby: missing lat rejected")
    check(call("GET", "/nearby", params={"lat": 19.9, "lng": 73.85}).status_code == 400, "nearby: outside Pune rejected")
    check(call("GET", "/nearby", params={"lat": 18.52, "lng": 73.85, "category": "unicorn"}).status_code == 400, "nearby: unknown category rejected")
    r = call("GET", "/nearby", params={"lat": 18.69, "lng": 73.99, "category": "metro", "radius_m": 100})
    check(r.status_code == 200 and r.json()["count"] == 0 and r.json().get("message"), "nearby: empty result carries a message")
    r = call("GET", "/route", params={"from": "73.8567,18.5204", "to": "73.8077,18.5074"})
    check(r.status_code in (200, 503), f"route endpoint ({'ok' if r.status_code == 200 else 'router unavailable'})")

    # ---- accounts
    ro = call("POST", "/auth/register", json={"name": "Smoke Owner", "email": f"owner-{tag}@{TEST_DOMAIN}", "phone": "9800000000", "password": "password123", "role": "owner"})
    rs = call("POST", "/auth/register", json={"name": "Smoke Student", "email": f"student-{tag}@{TEST_DOMAIN}", "password": "password123", "role": "student"})
    if ro.status_code != 200 or rs.status_code != 200:
        print("   register responses:", ro.status_code, ro.text[:300], "|", rs.status_code, rs.text[:300])
    owner, student = ro.json(), rs.json()
    check("token" in owner and "token" in student, "register owner + student")
    r = call("POST", "/auth/login", json={"email": f"owner-{tag}@{TEST_DOMAIN}", "password": "wrong"})
    check(r.status_code == 401, "login with wrong password rejected")
    r = call("GET", "/auth/me", token=owner["token"])
    check(r.status_code == 200 and r.json()["role"] == "owner", "auth/me")

    # ---- listing lifecycle
    body = {"name": f"Smoke Test PG {tag}", "address": "Karve Road, Kothrud, Pune", "lat": 18.5074, "lng": 73.8077,
            "listing_type": "pg", "gender": "female", "rent_min": 7500, "rent_max": 9000, "deposit": 15000,
            "food_included": True, "amenities": ["wifi", "laundry"], "contact_phone": "9800000000", "vacancy": True}
    r = call("POST", "/listings", json=body)
    check(r.status_code == 401, "creating a listing needs sign-in")
    r = call("POST", "/listings", token=owner["token"], json=body)
    check(r.status_code == 201 and r.json()["status"] == "pending" and r.json()["nearest_bus_stop_m"] is not None,
          "new owner's listing is created as pending, derived columns filled")
    lid = r.json()["id"]
    check(call("GET", f"/listings/{lid}").status_code == 404, "pending listing is not public")
    r = call("POST", f"/listings/{lid}/verify", token=student["token"], json={"lat": 18.5074, "lng": 73.8077})
    check(r.status_code == 400 and "approval" in r.json()["detail"], "pending listing cannot be verified yet")

    # ---- admin approval (needs the admin account)
    admin = call("POST", "/auth/register", json={"name": "Admin", "email": ADMIN_EMAIL, "password": "admin-password-123", "role": "student",
                                                 "admin_token": os.environ.get("ADMIN_SETUP_TOKEN", "local-admin-setup-9b2e7c")})
    if admin.status_code == 409:
        admin = call("POST", "/auth/login", json={"email": ADMIN_EMAIL, "password": "admin-password-123"})
    check(admin.status_code == 200 and admin.json()["user"]["role"] == "admin", "admin account available")
    tok = admin.json()["token"]
    r = call("GET", "/admin/pending", token=tok)
    check(r.status_code == 200 and any(p["id"] == lid for p in r.json()), "admin sees it in the pending queue")
    r = call("PATCH", f"/admin/pending/{lid}", token=tok, json={"decision": "approve"})
    check(r.status_code == 200 and r.json()["status"] == "unverified", "admin approves, listing goes live")
    check(call("GET", "/auth/me", token=owner["token"]).json()["trusted"] is True, "owner is now trusted")
    r = call("POST", "/listings", token=owner["token"], json={**body, "name": f"Second PG {tag}"})
    check(r.status_code == 201 and r.json()["status"] == "unverified", "trusted owner's next listing goes live directly")
    lid2 = r.json()["id"]
    call("POST", "/listings", token=owner["token"], json={**body, "name": f"Third PG {tag}"})
    r = call("POST", "/listings", token=owner["token"], json={**body, "name": f"Fourth PG {tag}"})
    check(r.status_code == 429, "fourth listing in a day is refused (daily limit 3)")
    call("DELETE", f"/listings/{lid2}", token=owner["token"])
    r = call("GET", "/listings/near", params={"lat": 18.5074, "lng": 73.8077, "name": "Smoke Test"})
    check(r.status_code == 200 and any(m["id"] == lid for m in r.json()["matches"]), "duplicate check finds it")

    img = io.BytesIO()
    from PIL import Image
    Image.new("RGB", (1600, 1200), (120, 90, 200)).save(img, "JPEG")
    r = call("POST", f"/listings/{lid}/photos", token=owner["token"], files=[("files", ("a.jpg", img.getvalue(), "image/jpeg"))])
    check(r.status_code == 201 and r.json()[0]["url"].startswith("/uploads/"), "photo upload resized and served")
    photo_url = r.json()[0]["url"]
    check(call("GET", photo_url).status_code == 200, "photo file is served")

    r = call("PATCH", f"/listings/{lid}/vacancy", token=owner["token"], json={"vacancy": False})
    check(r.status_code == 200 and r.json()["vacancy"] is False, "owner marks full")
    r = call("PATCH", f"/listings/{lid}/vacancy", token=student["token"], json={"vacancy": True})
    check(r.status_code == 403, "student cannot change someone else's listing")
    r = call("POST", f"/listings/{lid}/verify", token=owner["token"], json={"lat": 18.5080, "lng": 73.8080})
    check(r.status_code == 400, "owner cannot verify own listing")
    r = call("POST", f"/listings/{lid}/verify", token=student["token"], json={"lat": 18.5300, "lng": 73.8500})
    check(r.status_code == 400 and " m from this place" in r.json()["detail"], "verify from 5 km away is refused")
    r = call("POST", f"/listings/{lid}/verify", token=student["token"], json={"lat": 18.5080, "lng": 73.8080, "accuracy_m": 25})
    check(r.status_code == 200 and r.json()["verify_count"] == 1, "student verifies from the spot (1/3)")
    r = call("POST", f"/listings/{lid}/verify", token=student["token"], json={"lat": 18.5080, "lng": 73.8080})
    check(r.status_code == 200 and r.json()["verify_count"] == 1, "second verify by same user does not double count")
    r = call("POST", f"/listings/{lid}/rent-update", token=student["token"], json={"rent_min": 8000})
    check(r.status_code == 200 and "applied" not in r.json(), "rent suggestion stored, not applied with one vote")
    r = call("POST", "/listings", token=owner["token"], json={**body, "name": f"XSS {tag}", "website": "javascript:alert(1)"})
    check(r.status_code == 422, "javascript: website rejected")
    r = call("GET", f"/listings/{lid}")
    check(r.status_code == 200 and r.json()["listing"]["owner_id"] == owner["user"]["id"], "detail exposes owner_id for the owner check")
    r = call("GET", f"/listings/{lid}/edit", token=owner["token"])
    check(r.status_code == 200 and r.json()["contact_phone"] == "9800000000", "owner edit endpoint returns full row")
    r = call("GET", f"/listings/{lid}/edit", token=student["token"])
    check(r.status_code == 403, "edit endpoint refuses non-owner")
    r = call("GET", "/listings/mine/all", token=owner["token"])
    check(r.status_code == 200 and any(x["id"] == lid for x in r.json()["listings"]), "owner sees it in /listings/mine")

    # ---- safety report
    r = call("POST", "/safety-reports", token=student["token"], json={"lat": 18.5076, "lng": 73.8079, "category": "dark_street", "note": "smoke test",
                                                                       "device_lat": 18.5300, "device_lng": 73.8500})
    check(r.status_code == 400, "safety report from 5 km away is refused")
    r = call("POST", "/safety-reports", token=student["token"], json={"lat": 18.5076, "lng": 73.8079, "category": "dark_street", "note": "smoke test",
                                                                       "device_lat": 18.5078, "device_lng": 73.8081, "accuracy_m": 30})
    check(r.status_code == 201, "safety report created from the spot")
    rid = r.json()["id"]
    r = call("POST", "/safety-reports", token=student["token"], json={"lat": 18.5076, "lng": 73.8079, "category": "theft", "device_lat": 18.5078, "device_lng": 73.8081})
    check(r.status_code == 429, "same spot same day is rate limited")

    # ---- claim an imported place
    r = call("GET", "/listings", params={"bbox": "73.62,18.40,74.05,18.75", "limit": 2000})
    imported = next(f for f in r.json()["features"] if f["properties"]["source"] in ("osm", "overture") and f["properties"]["owner_id"] is None)
    iid = imported["id"]
    r = call("POST", f"/listings/{iid}/claim", token=owner["token"], json={"phone": "9800000000", "note": "smoke test claim"})
    check(r.status_code == 201 and r.json()["status"] == "pending", "owner claims an imported listing")
    r = call("GET", "/admin/claims", token=tok)
    claim = next((c for c in r.json() if c["listing_id"] == iid and c["status"] == "pending"), None)
    check(claim is not None, "admin sees the claim")
    r = call("PATCH", f"/admin/claims/{claim['id']}", token=tok, json={"decision": "approve"})
    check(r.status_code == 200 and r.json()["status"] == "approved", "admin approves the claim")
    r = call("GET", f"/listings/{iid}")
    check(r.json()["listing"]["owner_id"] == owner["user"]["id"], "claimant is now the owner")
    r = call("GET", f"/listings/{iid}/edit", token=owner["token"])
    check(r.status_code == 200, "new owner can open the edit form")
    # Hand the place back: the throwaway account is deleted after the test, which clears owner_id.
    r = call("GET", f"/listings/{lid}")
    check(r.status_code == 200 and r.json()["listing"]["safety_score"] is not None, f"listing safety score after report: {r.json()['listing']['safety_score']}")

    # ---- admin
    r = call("GET", "/admin/stats", token=tok)
    check(r.status_code == 200 and r.json()["listings"] > 0, f"admin stats: {r.json()['listings']} listings, {r.json()['users']} users")
    r = call("GET", "/admin/stats", token=student["token"])
    check(r.status_code == 403, "student cannot read admin stats")
    r = call("PATCH", f"/admin/listings/{lid}/status", token=tok, json={"status": "verified"})
    check(r.status_code == 200 and r.json()["status"] == "verified", "admin verifies listing")

    # ---- cleanup
    r = call("DELETE", f"/safety-reports/{rid}", token=student["token"])
    check(r.status_code == 204, "student deletes own safety report")
    r = call("DELETE", f"/listings/{lid}", token=owner["token"])
    check(r.status_code == 204, "owner deletes listing")
    check(call("GET", f"/listings/{lid}").status_code == 404, "deleted listing is gone")
    mine = call("GET", "/listings/mine/all", token=owner["token"]).json()["listings"]
    for l in mine:
        if l["id"] != iid:
            call("DELETE", f"/listings/{l['id']}", token=owner["token"])
    check(len(call("GET", "/listings/mine/all", token=owner["token"]).json()["listings"]) == 1, "all smoke listings removed (only the claimed place remains, released when the account is deleted)")
    print(f"\n{ok_count} checks passed")


if __name__ == "__main__":
    main()
