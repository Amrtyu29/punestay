# PuneStay

WebGIS rental map for students and IT workers in Pune. See [PROJECT_PLAN.md](PROJECT_PLAN.md)
for the full plan. This README covers Week 1: database, data, and routing engine.

## Status (2026-10-19)

Weeks 1 to 7 are built and tested against real data: 111 real listings (105 PGs, hostels and
co-living buildings from OpenStreetMap plus 6 seed rows), 6,800 OpenStreetMap places in 13
categories, 91 localities with calibrated rent averages, routing through the public OSRM server,
accounts, listing creation with photos, community verification, safety reports, area comparison,
rent heatmap and an admin page. `python backend/tests/smoke_api.py` runs 34 end-to-end checks.

Quick start on this laptop (no Docker needed):

```bash
powershell -ExecutionPolicy Bypass -File scripts\pg_start.ps1
```

```bash
python -m uvicorn backend.app.main:app --reload --port 8000
```

```bash
npm run dev --prefix frontend
```

```bash
powershell -ExecutionPolicy Bypass -File scripts\geoserver_start.ps1
```

Then open http://localhost:5173 (PuneStay Sonar, the course-brief Nearby Services page) and http://localhost:5173/app/
(the PuneStay map app with listings, directions, compare, admin). Admin account for the local database: `admin@punestay.in`
with password `admin-password-123` (created by the smoke test; change it before any deployment).
Admin registration needs both `ADMIN_EMAIL` and `ADMIN_SETUP_TOKEN` in `.env`, and the token must be
sent as `admin_token` when registering. `JWT_SECRET` must be set in `.env` too; without it the API
uses a random secret per run and sessions end on every restart.

## Prerequisites

| Tool | Why | Install |
|---|---|---|
| Python 3.11+ | data scripts, API | already installed |
| Node 18+ | frontend | already installed |
| PostgreSQL 16 + PostGIS 3.6 | the database | **portable, no admin rights**: `scripts\setup_portable_pg.ps1` (see below), or Docker |
| Docker Desktop (optional) | OSRM routing engine, or PostGIS via compose | https://www.docker.com/products/docker-desktop/ |
| QGIS (optional) | look at the data, draw ward polygons | https://qgis.org |

### Database without Docker (what this laptop uses)

`scripts\setup_portable_pg.ps1` downloads nothing itself; it expects the two official zips in
`%LOCALAPPDATA%\PuneStay\downloads` (EDB PostgreSQL 16 Windows binaries, OSGeo PostGIS bundle for pg16),
unpacks them to `%LOCALAPPDATA%\PuneStay\pgsql`, creates a cluster in `%LOCALAPPDATA%\PuneStay\pgdata`
on port **5433**, and applies `db\init\01_schema.sql`. Start and stop with `scripts\pg_start.ps1` and
`scripts\pg_stop.ps1`. Everything lives outside OneDrive on purpose.

Routing: without a local OSRM container the API falls back to the public demo server
`router.project-osrm.org` (set in `.env` as `OSRM_FALLBACK_URL`). That is fine for demos; build the
local OSRM (step 9 below) for anything heavier.

If you do have Docker, `docker compose up -d db` works exactly as before (host port 5433).

## Week 1 setup, in order

### 1. Environment file

```bash
copy .env.example .env
```

Optionally put your email in `NOMINATIM_EMAIL` in `.env` (contact for the geocoding service; leave it empty rather than using a placeholder, which Nominatim rejects with 403).

Note: this machine already has a local PostgreSQL 16 running on port 5432 (without PostGIS).
The Docker database therefore listens on **5433** on the host. All scripts and the API read
the port from `.env`, so nothing else changes. If you ever want to use the local PostgreSQL
instead of Docker, install PostGIS through its Stack Builder and set `POSTGRES_PORT=5432`
with that server's user and password.

### 2. Start the database

```bash
docker compose up -d db
```

The schema in `db/init/01_schema.sql` runs automatically the first time.
Check it worked:

```bash
docker exec punestay_db psql -U punestay -d punestay -c "\dt"
```

You should see `listings`, `pois`, `destinations`, `wards`, and the other tables.

To wipe and recreate the database (for example after editing the schema):

```bash
docker compose down -v
```

then `docker compose up -d db` again.

### 3. Python dependencies

```bash
python -m venv .venv
```

```bash
.venv\Scripts\activate
```

```bash
pip install -r scripts\requirements.txt
```

### 4. Download POIs from OpenStreetMap

```bash
python scripts\fetch_overpass.py
```

Writes one GeoJSON per category into `data/overpass/`. Takes a few minutes.
If Overpass is busy you can rerun just the failed ones, for example
`python scripts\fetch_overpass.py mess office`.

### 5. Load POIs and destinations

```bash
python scripts\load_pois.py
```

### 6. Real listings from OpenStreetMap

OSM already has about 110 genuine private PGs, hostels and co-living buildings in Pune
(`fetch_overpass.py lodging`). The importer turns them into `unverified` listings with
`source='osm'`. OSM has no rents and none are invented: `rent_min` stays empty and the app shows
"Rent not published" until the owner adds it or two students report the same figure.

Preview and import:

```bash
python scripts\import_osm_lodging.py --dry-run
```

```bash
python scripts\import_osm_lodging.py
```

### 7. Compute nearest POIs and safety score

```bash
python scripts\compute_derived.py
```

### 8. Wards (optional, needed for the area comparison page)

Put a GeoJSON of ward or locality polygons at `data/wards.geojson`, then:

```bash
python scripts\load_wards.py
```

### 9. Routing engine (OSRM)

Download and clip OpenStreetMap roads for Pune (needs Docker):

```bash
powershell -ExecutionPolicy Bypass -File scripts\download_osm.ps1
```

Build the routing graph (a few minutes):

```bash
powershell -ExecutionPolicy Bypass -File scripts\build_osrm.ps1
```

Start the router:

```bash
docker compose --profile routing up -d
```

Test it in the browser. Shivajinagar to Kothrud:

http://localhost:5000/route/v1/driving/73.8567,18.5204;73.8077,18.5074?overview=false

You should get JSON with a `duration` in seconds.

## Quick checks in PostGIS

Open a SQL prompt:

```bash
docker exec -it punestay_db psql -U punestay -d punestay
```

How many POIs per category:

```sql
SELECT category, count(*) FROM pois GROUP BY category ORDER BY 2 DESC;
```

Nearest bus stop to Fergusson College:

```sql
SELECT name, ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(73.8390, 18.5223), 4326)::geography)::int AS m
FROM pois WHERE category = 'bus_stop'
ORDER BY geom <-> ST_SetSRID(ST_MakePoint(73.8390, 18.5223), 4326) LIMIT 3;
```

## Folder layout

```
db/init/01_schema.sql        database schema (auto-applied)
docker-compose.yml           db + osrm services
scripts/                     data download and loading
data/raw/                    downloaded source files, one folder per dataset, each with a README.txt
data/DATA_SOURCES.md         catalog of every real data source found, verified and how to get it
data/                        downloaded and seed data (mostly git-ignored)
PROJECT_PLAN.md              full 8-week plan
```

## Week 2: backend API

Install the backend dependencies into the same virtual environment:

```bash
pip install -r backend\requirements.txt
```

Run the API from the project root (auto-reloads on code changes):

```bash
python -m uvicorn backend.app.main:app --reload --port 8000
```

Open http://localhost:8000/docs for the interactive API docs.

| Endpoint | What it does |
|---|---|
| `GET /health` | database reachable or not |
| `GET /listings?bbox=w,s,e,n&rent_max=8000&type=pg&gender=male&vacancy=true` | listings in the viewport as GeoJSON |
| `GET /listings?destination_id=12&max_commute_s=1200` | same, with commute time per listing (needs OSRM) |
| `GET /listings/{id}` | full detail, photos, nearby places, cached commutes |
| `GET /listings/{id}/nearby` | nearest bus stop, metro, mess, hospital, etc. |
| `GET /pois?category=bus_stop&bbox=...` | POI layer for the map |
| `GET /pois/nearby?lat=&lng=` | nearest POIs around any point |
| `GET /pois/categories` | counts per category |
| `GET /destinations?q=coep` | search colleges and offices |

Example, PGs under 8000 near Kothrud:

http://localhost:8000/listings?bbox=73.79,18.49,73.83,18.52&rent_max=8000&type=pg

The API starts even when the database is down and returns 503 on data endpoints until
`docker compose up -d db` is running.

To run the API in Docker instead: `docker compose --profile api up -d --build`.

## Week 3: map frontend

React + Vite + MapLibre GL JS in `frontend/`. Base map tiles come from OpenFreeMap (free, no key).

Install once:

```bash
npm install --prefix frontend
```

Run (with the API also running on port 8000):

```bash
npm run dev --prefix frontend
```

Open http://localhost:5173. The dev server proxies `/api/*` to the FastAPI server, so there is
no CORS setup needed. To point at a different API set `VITE_API_URL` before starting.

There is no demo or mock data: the app always reads the real database.

What the page does:

- Header: brand, destination search (college or office), result count, Filters toggle.
- Sidebar (docked on desktop, bottom sheet on phones): commute limit, budget slider, type and
  gender segmented controls, food / vacancy / "only published rent" switches, legend.
- Map loads listings for the current viewport from `/listings` on every pan or zoom, with filters.
  Clusters when zoomed out; single pins are coloured by rent band (green under 7k, amber 7k to 12k,
  red 12k+), grey when the rent is not published. Unverified listings get a grey ring, full ones are
  faded, the selected one a dark ring. Rents are never estimated: imported places show "Rent not
  published" until the owner adds it or two students report the same figure.
- Picking a destination adds commute time per listing (needs OSRM) and a max-commute filter.
- Clicking a pin opens the detail drawer: photos, status badges, rent and deposit, fact grid
  (type, gender, food, night safety), amenities, travel times, nearby places, and a Call button.
- Breakpoints: phone under 768px (two-row header, bottom sheets), tablet to 1024px (narrower
  sidebar and drawer), desktop above.

Design system lives in `frontend/src/styles.css`: colour, spacing, radius, shadow and type tokens
at the top, then primitives (`.btn`, `.input`, `.badge`, `.segmented`, `.switch-row`), then components.
Icons are from `lucide-react`; the font is Inter.

Files:

```
frontend/src/App.jsx                         state, data fetching, layout shell
frontend/src/components/Header.jsx           top bar
frontend/src/components/DestinationSearch.jsx college / office search with keyboard support
frontend/src/components/FilterPanel.jsx      sidebar filters
frontend/src/components/MapView.jsx          MapLibre map, cluster + pin layers
frontend/src/components/ListingDrawer.jsx    detail panel with loading skeleton
frontend/src/api/client.js                   fetch wrapper for the FastAPI backend
frontend/src/styles.css                      design tokens and all styling
```

## Weeks 4 to 7: routing, accounts, community, safety, areas

Backend endpoints added (see http://localhost:8000/docs for all of them):

| Area | Endpoints |
|---|---|
| Routing | `GET /route`, `GET /route/listing/{id}/destination/{id}`, commute times on `/listings?destination_id=` (cached in `commute_cache`) |
| Geocoding | `GET /geocode?q=`, `GET /geocode/reverse` (Nominatim, 1 req/s, cached in `geocode_cache`) |
| Accounts | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` (PBKDF2 passwords, JWT bearer tokens) |
| Owner | `POST /listings`, `PUT /listings/{id}`, `PATCH /listings/{id}/vacancy`, `DELETE /listings/{id}`, `GET /listings/mine/all`, photos under `/listings/{id}/photos`, `GET /listings/near` duplicate check |
| Community | `POST /listings/{id}/verify` (3 = verified), `/flag` (3 = hidden), `/rent-update` (applied when two agree) |
| Safety | `GET/POST /safety-reports` (lowers safety score within 300 m for six months, one per user per spot per day) |
| Areas | `GET /areas`, `GET /areas/compare?a=&b=&destination_id=`, `GET /areas/grid` (rent heatmap cells), `GET /areas/wards` |
| Admin | `GET /admin/stats`, `GET /admin/flagged`, `PATCH /admin/listings/{id}/status`, `GET /admin/users` |

Frontend pages (hash routes): `#/` map, `#/listing/12` deep link, `#/add`, `#/edit/12`, `#/mine`,
`#/compare`, `#/admin`, `#/saved` (heart-saved places, kept in the browser's localStorage). The map
sidebar has two tabs, Places (cards synced with the pins: hover highlights, click opens) and Filters;
on phones a bottom bar opens either as a sheet. Pins show the rent (or commute minutes) as a label
from zoom 13. Cards and the drawer use a per-listing colour field instead of fake photos. Sign-in is a dialog. Map layers: rent heatmap and safety reports; "Report an
unsafe spot" enters a tap-the-map mode.

### Trust and anti-spam rules

Anyone can register, so the data is protected by rules rather than by who can sign up:

| Rule | Where |
|---|---|
| "I am here, it is real" counts only when the phone's location is within 300 m of the place (plus GPS accuracy, up to 200 m). The distance is stored with the confirmation. | `POST /listings/{id}/verify` with `{lat, lng, accuracy_m}` |
| Safety reports must be filed from within 500 m of the spot. | `POST /safety-reports` with `device_lat`, `device_lng` |
| A new account's listings are `pending` (not on the map) until an admin approves one; the account is then `trusted` and later listings go live directly as unverified. Rejecting deletes the listing. | `GET /admin/pending`, `PATCH /admin/pending/{id}` |
| Daily limits per account: 3 new listings, 10 confirmations / flags / rent suggestions, 3 safety reports, 3 claims. | 429 responses |
| Owners of imported places (OpenStreetMap, Overture) claim them with "This is my PG"; an admin calls the number already listed and approves, which assigns the owner and marks the account trusted. Other claims on the same place are rejected automatically. | `POST /listings/{id}/claim`, `GET /admin/claims`, `PATCH /admin/claims/{id}` |
| Unchanged: three different accounts to verify or hide, no self-verification, admin only via setup token. | |

### Real data

See [data/DATA_SOURCES.md](data/DATA_SOURCES.md) for every source found and verified (19 confirmed).
What is loaded today:

- 22 OpenStreetMap service categories via Overpass (`scripts/fetch_overpass.py`), about 10,000 places.
- 520 real PGs, hostels and co-living buildings: 110 from OpenStreetMap and 410 from Overture Maps,
  393 with a phone number. No rents are invented; they show "Rent not published" until reported.
- 8,391 real 2021 flat rents (`rent_observations`, CC0 Kaggle data) for the flat heatmap, the
  "Past flat rents" layer and the flat rows on the Compare page (scaled to 2025 with the ANAROCK
  Q1 2025 Pune report, factor 1.63, and labelled as such).
- `data/locality_rents.csv` is used only to place locality names and calibrate that factor; it is not
  used for any listing's rent.
- `scripts/load_extra_localities.py` adds well-known localities OSM lacks (Kothrud, Hadapsar, ...) so
  area statistics use familiar names.

### More PG, hostel, co-living and flat data

| Source | What it adds | Script |
|---|---|---|
| OpenStreetMap (wider area to 73.62–74.05 E, 18.40–18.75 N) | PGs, hostels, dormitories, `student_accommodation`, co-living brands (Zolo, Stanza, Hello World, Colive, …) | `fetch_overpass.py lodging` then `import_osm_lodging.py` |
| Overture Maps Places (CDLA Permissive 2.0) | small PGs and hostels from Meta / Microsoft business listings that OSM lacks; merged with OSM when the same place appears in both (`listings.also_in`) | `fetch_overture_places.py` then `import_overture_lodging.py` |
| Kaggle CC0 Pune rentals, 2021 | real flat rents by housing society, placed on named OSM buildings; shown as the "Past flat rents" layer and in Compare, never as bookable listings | `build_rent_observations.py` |

`fetch_overture_places.py` copies the Pune part of the global release to `data/overture/pune_places.parquet`
once (slow, network bound), then all filtering is local. In OSM, `tourism=apartment` is skipped because Pune
mappers use it for ordinary housing societies.

What is still missing is measured, not guessed: the Admin page has a "Data coverage" panel, and
`python scripts\coverage_report.py` writes `data/COVERAGE.md` (completeness of phone, rent, gender, photos;
localities with colleges and offices but few listings; colleges with no listing within 1.5 km).

### Tests

With the database and API running:

```bash
python backend\tests\smoke_api.py
```

## Nearby Services (course brief, Project 1)

The brief's required system is **PuneStay Sonar**, the home page at http://localhost:5173, written in plain HTML,
CSS and JavaScript with no framework and no build step: `frontend/index.html`, `frontend/public/css/style.css` and
`frontend/public/js/app.js`. It uses Leaflet, Leaflet.markercluster, Leaflet.heat and Lucide icons from CDNs and
the `/listings/nearby`, `/listings/nearby/summary`, `/listings/{id}` and `/geocode` API. The service it finds is
accommodation: the category is **PG or hostel** and the subcategory is **anyone, boys or girls**. It has an intro
screen, a first-visit tour, a help modal with shortcuts, address and PIN-code search, glass panels with a dark and
a light theme, five basemaps, a heatmap, GeoServer WMS overlays (all listings, and bus stops and metro stations via a
CQL filter on the `services` view), an in-page detail panel per place with the nearest bus stop, metro, mess,
hospital, pharmacy, ATM, grocery and police station, CSV and GeoJSON downloads, shareable links such as
`/?lat=18.52&lng=73.85&type=hostel&gender=female&radius=2000`, and a bottom sheet on phones. The generic
22-category services search remains available in the app's **Nearby** sidebar tab and through `GET /nearby`.

Maps and geocoding in Sonar follow the providers' usage rules. Basemaps (all free, no key): OpenStreetMap, Humanitarian
OSM, Esri light and dark gray canvases, OpenTopoMap and Esri World Imagery, each with its own attribution; the dark or
light one follows the theme until a choice is saved. As-you-type suggestions come only from our own database (colleges,
offices and localities through `/destinations` and `/areas`), because Nominatim forbids autocomplete; Nominatim is used
through the backend's cached, throttled (1 request/s) `/geocode` and `/geocode/reverse` only when you press Find or
Enter, or to name a clicked pin. "lat, lng" typed into the box is taken as coordinates, and a number must be a 6-digit
PIN code. Serve the page from the Vite dev server (`npm run dev`, port 5173) or `npm run preview` (port 4173): both
proxy `/api` to FastAPI, and browser geolocation needs localhost or HTTPS, never `file://`. Served from any other
origin, the page calls `http://localhost:8000` directly, so add that origin to `CORS_ORIGINS` in `.env`.

The React map app at http://localhost:5173/app/ (`frontend/app/index.html`, `frontend/src/`) is the extension:
listings with clustering and cards, commute filters and directions, the rent heatmap, compare areas, saved places,
adding and claiming listings with the trust rules, and the admin pages. Its home map also has a **Nearby** sidebar
tab that reuses the same `/nearby` query (`frontend/src/nearby.js`).

Both front ends ship in a Dark Charcoal + Teal theme by default, with a light theme behind the sun/moon button
(`frontend/src/theme.js` in the app; CSS variables in Sonar). Sonar follows the system theme until you choose.

Both front ends offer Google-Maps-style map types (`frontend/src/basemaps.js` in the app, the Layers panel in Sonar):
Streets, Light and Dark, Esri World Imagery with a labels overlay for Satellite, OpenTopoMap for Terrain, and plain
OSM. The app's home map also has a **Directions** tool in the header: from a college / office (or the phone's location) to the selected
PG by car, bike or foot, using the same OSRM route endpoint, with a link to open the trip in Google Maps.

| Brief requirement | Where |
|---|---|
| Location by map click, lat/lng, browser geolocation | `frontend/public/js/app.js` (map click and drag, coordinates popover with per-field validation, "Use my location" with denied / unavailable / timeout / insecure-context messages, address and PIN search) |
| Category and subcategory filtering | Sonar: category PG / hostel (`type`) and subcategory anyone / boys / girls (`gender`) on `GET /listings/nearby`; the app's Nearby tab: `GET /nearby/categories` lists 20 service categories with OSM subcategories |
| Radius and/or nearest-N | `GET /listings/nearby?radius_m=&limit=` (same contract as `GET /nearby`); Sonar offers "Within a radius" (slider with a live ring) and "Nearest N" (dashed ring to the farthest result) |
| Distance-sorted list synced with markers | list rows and Leaflet markers highlight each other; popups show details |
| PostGIS query with proper CRS | points stored in EPSG:4326, distances with the `geography` type (metres on the WGS84 ellipsoid), KNN ordering on the GIST index |
| GeoServer layers | workspace `punestay`: `services`, `pois`, `listings_public`, `destinations`, `safety_reports`, `wards` (WMS + WFS); switchable WMS overlays on the page |
| Error handling | 400 with a plain message for missing / invalid / outside-Pune points and unknown categories; explicit empty result with a hint |

### GeoServer without Docker

Needs Java 17 or 21 (this laptop has JDK 21 in Program Files). Put the GeoServer binary zip in
`%LOCALAPPDATA%\PuneStay\downloads\geoserver` (the project's build server works when geoserver.org blocks
scripts: `https://build.geoserver.org/geoserver/2.28.x/geoserver-2.28.x-latest-bin.zip`), then:

```bash
powershell -ExecutionPolicy Bypass -File scripts\setup_geoserver.ps1
```

That unpacks it to `%LOCALAPPDATA%\PuneStay\geoserver`, starts it on port 8080, and runs
`scripts\configure_geoserver.py`, which creates the workspace, the PostGIS store and the layers through
the REST API. Later: `scripts\geoserver_start.ps1` / `scripts\geoserver_stop.ps1`.
Admin UI: http://localhost:8080/geoserver (admin / geoserver, change it for anything public).

Example requests:

```
http://localhost:8080/geoserver/punestay/wms?service=WMS&version=1.1.0&request=GetMap&layers=punestay:services&bbox=73.7,18.4,74.0,18.7&width=800&height=800&srs=EPSG:4326&format=image/png
http://localhost:8080/geoserver/punestay/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=punestay:services&count=5&outputFormat=application/json
http://localhost:8000/nearby?lat=18.5204&lng=73.8567&category=hospital&subcategory=clinic&radius_m=1500&limit=10
```

## Next: Week 8

Polish and presentation: PWA install prompt, Marathi labels, README screenshots, demo video.
