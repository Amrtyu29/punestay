# PuneStay: WebGIS Rental Map for Students and IT Workers in Pune

> Status 2026-10-20: Weeks 1 to 7 are implemented and tested on real data (see README.md "Status").
> Changes from this plan: the database runs as a portable PostgreSQL + PostGIS (no Docker on this laptop),
> routing uses the public OSRM demo server until a local OSRM is built, and listings come from
> OpenStreetMap plus owner submissions rather than synthetic data. Week 8 (polish, demo) remains.

A Google-Maps-style web service where students and freshers find PGs and flats in Pune,
compare areas by commute time, transport, food, and night safety, and where PG owners
add their own listings so the map stays alive.

Assumed timeline: 8 weeks. If you have less, follow the "Minimum to submit" note in each phase.

---

## 1. Goals

1. Search PGs and flats on a map, filtered by rent, type, gender, food, and vacancy.
2. For any listing, show commute time to a chosen college or office, nearest bus stop,
   metro, mess, hospital, and a night safety score.
3. Compare two areas side by side (median rent, commute, safety, transport).
4. Let owners and students add new listings with a map pin and photos.
   New listings appear instantly with an "unverified" badge; community confirms or flags.
5. Owners toggle "rooms available" or "full" from their phone.

What makes it unique: nothing in Pune combines rental listings with GIS-derived
commute, transport, and safety analysis, and nothing lets owners self-list on a map.

---

## 2. Features

### MVP (must have)
- Map with listing pins, clustered when zoomed out
- Filters: rent range, PG or flat, boys / girls / any, food included, vacancy now
- Listing detail panel: photos, rent, deposit, amenities, owner contact
- "Set my destination": pick a college or office; every listing shows commute time
- Nearby panel: nearest bus stop, metro station, mess, hospital with walking distance
- Add listing form with map pin, address geocoding, photo upload
- Login with two roles: owner and student
- Verify / flag buttons on each listing
- Vacancy toggle for owners

### Phase 2 (strong extras)
- Night safety score per listing (street lights, police distance, user reports)
- Area comparison page: pick two areas, see stats side by side
- Area heatmap: median rent by ward or grid cell
- "May be outdated" tag after 90 days without update
- Admin page for moderation

### Phase 3 (if time allows)
- Marathi language toggle
- Save and share shortlists
- Email or WhatsApp link to owner
- Mobile PWA with install prompt

---

## 3. Architecture

```
Browser (React + MapLibre GL JS)
        |
        | REST (JSON / GeoJSON)
        v
FastAPI backend (Python)
   |          |            |
   v          v            v
PostGIS    OSRM         Photo storage
(data)    (routing)     (local folder or Cloudinary)
```

### Tech stack

| Layer | Choice | Why |
|---|---|---|
| Database | PostgreSQL 16 + PostGIS 3 | Spatial queries, nearest-neighbour, distance, polygons |
| Backend | FastAPI (Python 3.11) | Easy, fast, auto API docs, good with GeoJSON |
| Routing | OSRM in Docker, Pune OSM extract | Free, fast, gives real road commute times |
| Geocoding | Nominatim public API (1 request/sec) or self-hosted Photon | Free address to coordinates |
| Frontend | React (Vite) + MapLibre GL JS | Free vector maps, no API key needed |
| Base map tiles | OpenFreeMap or MapTiler free tier | Free vector tiles |
| Auth | JWT with password hashing (passlib) | Simple, no third party |
| Photos | Local `uploads/` folder for dev, Cloudinary free tier for demo | Keeps it free |
| ORM | SQLAlchemy 2 + GeoAlchemy2 | PostGIS support in Python |
| Deployment | Docker Compose (db, osrm, api, web) | One command to run everything |

---

## 4. Data

### 4.1 Free base data

| Data | Source | How |
|---|---|---|
| Roads (for OSRM and distances) | Geofabrik, Maharashtra extract, clipped to Pune | `osmium extract` with a Pune bounding box |
| Colleges, universities | OpenStreetMap via Overpass | `amenity=college`, `amenity=university` |
| Offices, IT parks | OpenStreetMap via Overpass | `office=*`, `landuse=commercial`, `name~"IT Park\|Tech Park"` |
| PMPML bus stops | Pune Open Data portal + OSM | `highway=bus_stop` in OSM; PMC portal CSV |
| Metro stations | OpenStreetMap | `railway=station` + `station=subway` |
| Mess, restaurants | OpenStreetMap | `amenity=restaurant`, `amenity=fast_food`, `cuisine=*` |
| Hospitals, clinics, pharmacies | OpenStreetMap | `amenity=hospital`, `clinic`, `pharmacy` |
| ATMs, grocery | OpenStreetMap | `amenity=atm`, `shop=supermarket`, `shop=convenience` |
| Police stations | OpenStreetMap | `amenity=police` |
| Street lights | Pune Open Data portal (if available) else OSM `highway=street_lamp` | CSV or Overpass |
| Ward boundaries | Pune Open Data portal | Shapefile or GeoJSON |
| Locality names (Kothrud, Wakad, etc.) | OpenStreetMap | `place=suburb`, `place=neighbourhood` |

Pune bounding box for Overpass and osmium: `18.40,73.70,18.70,74.00` (south, west, north, east).

### 4.2 Rental listings (three layers)

1. **Seed data (150 to 200 real listings)**
   Collect manually from public Facebook groups, college notice boards, and local broker boards
   in 5 areas: Kothrud, Viman Nagar, Hinjewadi, Wakad, Kharadi.
   Record: name, address, rent, deposit, type, gender, food, amenities, contact (owner permission).
   Geocode with Nominatim. Store in a CSV, load with a script.

2. **User submissions (the real pipeline)**
   The Add Listing feature. This is the long-term data source.

3. **Synthetic demo data (1000 to 2000 listings)**
   Generated by a script using real area rent averages (from public locality price trend pages).
   Flag `is_demo = true` in the database and show a small "demo" label.
   Lets the map look full and lets you test clustering and performance.

### 4.3 Derived data (computed by you)

- Commute time from listing to destination: OSRM `/table` or `/route` API, cached per pair.
- Nearest bus stop, metro, mess, hospital: PostGIS `<->` KNN operator.
- Night safety score (0 to 100), computed per listing:
  - street light density within 200 m (40 percent weight)
  - distance to nearest police station (20 percent)
  - distance to nearest main road with shops (20 percent)
  - user safety reports within 300 m, last 6 months (20 percent, negative)
- Area statistics: median rent, listing count, average commute to top 5 destinations, per ward.

### 4.4 Data preparation steps

1. Download Maharashtra `.osm.pbf` from Geofabrik.
2. Clip to Pune with `osmium extract -b 73.70,18.40,74.00,18.70`.
3. Build OSRM: `osrm-extract`, `osrm-partition`, `osrm-customize` with the car or foot profile.
4. Run Overpass queries for each POI category, export GeoJSON.
5. Load GeoJSON into PostGIS with `ogr2ogr` or a Python script using GeoPandas.
6. Load seed listings CSV, geocode, insert.
7. Run the synthetic data generator.
8. Run the derived-data job (nearest POIs, safety score).

---

## 5. Database schema (PostGIS)

```sql
-- users
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT CHECK (role IN ('student','owner','admin')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- listings
CREATE TABLE listings (
  id SERIAL PRIMARY KEY,
  owner_id INT REFERENCES users(id),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  geom GEOMETRY(Point, 4326) NOT NULL,
  listing_type TEXT CHECK (listing_type IN ('pg','flat','hostel')) NOT NULL,
  gender TEXT CHECK (gender IN ('male','female','any')) NOT NULL,
  rent_min INT NOT NULL,
  rent_max INT,
  deposit INT,
  food_included BOOLEAN DEFAULT false,
  amenities JSONB DEFAULT '[]',      -- ["wifi","ac","laundry","parking"]
  vacancy BOOLEAN DEFAULT true,
  status TEXT CHECK (status IN ('unverified','verified','hidden')) DEFAULT 'unverified',
  verify_count INT DEFAULT 0,
  flag_count INT DEFAULT 0,
  is_demo BOOLEAN DEFAULT false,
  safety_score INT,
  nearest_bus_stop_id INT,
  nearest_bus_stop_m INT,
  nearest_metro_id INT,
  nearest_metro_m INT,
  nearest_mess_id INT,
  nearest_mess_m INT,
  nearest_hospital_id INT,
  nearest_hospital_m INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX listings_geom_idx ON listings USING GIST (geom);

-- photos
CREATE TABLE listing_photos (
  id SERIAL PRIMARY KEY,
  listing_id INT REFERENCES listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL
);

-- pois (all OSM point data in one table)
CREATE TABLE pois (
  id SERIAL PRIMARY KEY,
  osm_id BIGINT,
  category TEXT NOT NULL,   -- bus_stop, metro, mess, hospital, college, office, police, street_lamp
  name TEXT,
  geom GEOMETRY(Point, 4326) NOT NULL,
  tags JSONB
);
CREATE INDEX pois_geom_idx ON pois USING GIST (geom);
CREATE INDEX pois_category_idx ON pois (category);

-- destinations (colleges / offices the user can choose)
CREATE TABLE destinations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT CHECK (kind IN ('college','office')),
  geom GEOMETRY(Point, 4326) NOT NULL
);

-- commute cache
CREATE TABLE commute_cache (
  listing_id INT REFERENCES listings(id) ON DELETE CASCADE,
  destination_id INT REFERENCES destinations(id) ON DELETE CASCADE,
  mode TEXT,                 -- car, bike, foot
  duration_s INT,
  distance_m INT,
  PRIMARY KEY (listing_id, destination_id, mode)
);

-- community actions
CREATE TABLE listing_actions (
  id SERIAL PRIMARY KEY,
  listing_id INT REFERENCES listings(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id),
  action TEXT CHECK (action IN ('verify','flag','rent_update')),
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (listing_id, user_id, action)
);

-- safety reports
CREATE TABLE safety_reports (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  geom GEOMETRY(Point, 4326) NOT NULL,
  category TEXT,             -- dark_street, harassment, theft, stray_dogs, other
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX safety_reports_geom_idx ON safety_reports USING GIST (geom);

-- wards
CREATE TABLE wards (
  id SERIAL PRIMARY KEY,
  name TEXT,
  geom GEOMETRY(MultiPolygon, 4326)
);
```

---

## 6. API endpoints (FastAPI)

### Public
- `GET /listings?bbox=&rent_min=&rent_max=&type=&gender=&food=&vacancy=&destination_id=`
  returns GeoJSON FeatureCollection with commute time if destination given
- `GET /listings/{id}` full detail plus nearby POIs
- `GET /listings/{id}/nearby` nearest bus stop, metro, mess, hospital, ATM
- `GET /destinations?q=` search colleges and offices
- `GET /pois?category=&bbox=` POI layer for the map
- `GET /areas` list of wards or localities with stats
- `GET /areas/compare?a=&b=` side-by-side stats
- `GET /geocode?q=` proxy to Nominatim with rate limit and caching
- `GET /route?from=&to=&mode=` proxy to OSRM, returns polyline and duration

### Auth
- `POST /auth/register` `{name, email, phone, password, role}`
- `POST /auth/login` returns JWT

### Authenticated
- `POST /listings` create listing (owner or student)
- `PUT /listings/{id}` edit own listing
- `PATCH /listings/{id}/vacancy` `{vacancy: true|false}` owner only
- `POST /listings/{id}/photos` multipart upload
- `POST /listings/{id}/verify`
- `POST /listings/{id}/flag`
- `POST /safety-reports` `{lat, lng, category, note}`

### Admin
- `GET /admin/flagged`
- `PATCH /admin/listings/{id}/status`

### Rules enforced in backend
- 3 verifies from different users moves status to `verified`
- 3 flags hides the listing and sends it to admin queue
- New listing within 30 m of an existing one with similar name returns a warning
- Listing not updated for 90 days returns `stale: true` in the response
- After every insert or update, recompute nearest POIs and safety score for that listing

---

## 7. Frontend pages

1. **Map page (main)**
   - Full-screen MapLibre map, Pune centred
   - Left panel: filters and destination search
   - Pins clustered; colour by rent band; grey outline for unverified; "demo" label for synthetic
   - Click pin opens detail drawer with photos, rent, amenities, commute, nearby list, verify / flag
   - "Draw route" button shows OSRM route from listing to destination
   - Toggle layers: bus stops, metro, mess, hospitals, safety heatmap
2. **Add listing page**
   - Map with draggable pin, address box with geocode button, form, photo upload
   - Duplicate warning if too close to an existing listing
3. **Owner dashboard**
   - My listings with vacancy toggle and edit
4. **Compare areas page**
   - Two dropdowns, table of stats, two mini maps
5. **Login / register**
6. **Admin page** (simple table of flagged listings)

---

## 8. Spatial computations

### Nearest POI (PostGIS)
```sql
SELECT id, name, ST_Distance(geom::geography, :pt::geography) AS dist_m
FROM pois
WHERE category = 'bus_stop'
ORDER BY geom <-> :pt
LIMIT 1;
```

### Listings in viewport with filters
```sql
SELECT id, name, rent_min, listing_type, vacancy, status, ST_AsGeoJSON(geom) AS geom
FROM listings
WHERE geom && ST_MakeEnvelope(:w, :s, :e, :n, 4326)
  AND status <> 'hidden'
  AND rent_min BETWEEN :rmin AND :rmax
  AND (:gender = 'any' OR gender IN (:gender, 'any'));
```

### Commute time
Call OSRM `/table/v1/driving/{lng,lat;lng,lat;...}?sources=0` with the destination as
source and up to 100 listings as destinations. Cache results in `commute_cache`.

### Safety score
```sql
WITH l AS (SELECT id, geom FROM listings WHERE id = :id),
lights AS (SELECT count(*) c FROM pois p, l WHERE p.category='street_lamp'
           AND ST_DWithin(p.geom::geography, l.geom::geography, 200)),
police AS (SELECT min(ST_Distance(p.geom::geography, l.geom::geography)) d
           FROM pois p, l WHERE p.category='police'),
reports AS (SELECT count(*) c FROM safety_reports r, l
            WHERE ST_DWithin(r.geom::geography, l.geom::geography, 300)
            AND r.created_at > now() - interval '6 months')
SELECT LEAST(100, GREATEST(0,
  LEAST(40, lights.c * 4)
  + CASE WHEN police.d < 500 THEN 20 WHEN police.d < 1500 THEN 12 ELSE 5 END
  + 20
  - LEAST(20, reports.c * 5)
)) AS score
FROM lights, police, reports;
```
(If street light data is not available for Pune, drop that term and rescale.)

### Area stats
```sql
SELECT w.name,
       count(l.id) AS listings,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY l.rent_min) AS median_rent,
       avg(l.safety_score) AS avg_safety
FROM wards w
LEFT JOIN listings l ON ST_Contains(w.geom, l.geom)
GROUP BY w.name;
```

---

## 9. Build plan (8 weeks)

### Week 1: Setup and data
- Install Docker, PostgreSQL + PostGIS, Python, Node
- Download Pune OSM extract, build OSRM, test one route in the browser
- Run Overpass queries, load POIs into PostGIS
- Load ward boundaries
- Create all tables from the schema above
- Deliverable: a PostGIS database with POIs and a working OSRM container

Minimum to submit: skip wards and street lights.

### Week 2: Backend core
- FastAPI project with SQLAlchemy and GeoAlchemy2
- `GET /listings` with bbox and filters, returning GeoJSON
- `GET /listings/{id}` and `/nearby`
- `GET /pois`, `GET /destinations`
- Load seed listings (start collecting them this week)
- Deliverable: API docs at `/docs` returning real data

### Week 3: Map frontend
- React + Vite + MapLibre, Pune base map
- Fetch listings for current viewport, cluster pins
- Filter panel wired to API
- Detail drawer with nearby list
- Deliverable: usable map with filters and detail

### Week 4: Commute and routing
- Destination search box
- OSRM table call, commute time shown on each pin and in the drawer
- Route line drawn on map
- Commute cache table
- Deliverable: "show me PGs within 20 minutes of COEP" works

Minimum to submit: weeks 1 to 4 give a complete MVP without user accounts.

### Week 5: Accounts and Add Listing
- Register, login, JWT
- Add listing page with draggable pin, geocode, form, photo upload
- Duplicate check
- Owner dashboard with vacancy toggle
- Deliverable: a new PG added from the phone appears on the map within seconds

### Week 6: Community and moderation
- Verify, flag, rent update actions
- Status rules (3 verifies, 3 flags)
- Stale listing tag
- Admin page
- Synthetic data generator, mark `is_demo`
- Deliverable: moderation loop works end to end

### Week 7: Safety and area comparison
- Safety reports endpoint and map reporting
- Safety score job, colour on pins
- Area stats and compare page
- Rent heatmap layer
- Deliverable: compare Kothrud vs Viman Nagar in one screen

### Week 8: Polish, deploy, present
- Docker Compose for everything
- Mobile layout check
- Seed demo users and listings
- Performance: indexes, clustering at low zoom, cache commute
- Write README, record a 3 minute demo video, prepare slides
- Deliverable: one-command deploy and a demo

---

## 10. Folder structure

```
webgis/
  docker-compose.yml
  data/
    pune.osm.pbf
    overpass/            # exported GeoJSON per category
    seed_listings.csv
    wards.geojson
  scripts/
    clip_osm.sh
    build_osrm.sh
    load_pois.py
    load_seed_listings.py
    generate_demo_listings.py
    compute_derived.py   # nearest POIs + safety score
  backend/
    app/
      main.py
      db.py
      models.py
      schemas.py
      auth.py
      routers/
        listings.py
        pois.py
        destinations.py
        areas.py
        auth.py
        admin.py
        geocode.py
        route.py
      services/
        osrm.py
        nominatim.py
        safety.py
        nearby.py
    requirements.txt
    Dockerfile
  frontend/
    src/
      pages/   Map, AddListing, OwnerDashboard, Compare, Login, Admin
      components/ MapView, FilterPanel, ListingDrawer, NearbyList, RouteLayer
      api/
      main.jsx
    package.json
  README.md
  PROJECT_PLAN.md
```

---

## 11. Risks and how to handle them

| Risk | Handling |
|---|---|
| Not enough real listings | Seed 150 to 200 manually, add synthetic flagged as demo, show the Add Listing pipeline as the real source |
| Nominatim rate limit | Cache every geocode result, 1 request per second, fall back to manual pin |
| OSRM build takes long or needs RAM | Clip to Pune only, use the `foot` or `car` profile only, build once |
| Street light data missing | Drop that term from safety score, use police distance and reports only |
| Fake listings | Unverified badge, flag threshold, admin page, phone number required for owners |
| Photos too big | Resize to 1200 px on upload, limit 5 per listing |
| Evaluators ask "how is this different from NoBroker" | Commute time per listing, transport and safety analysis, area comparison, owner self-listing on map, Pune-only depth |

---

## 12. What to show in the demo

1. Open map, pick "COEP" as destination, filter rent under 8000, vacancy now.
2. Click a PG, show commute 14 minutes, nearest bus stop 180 m, mess 90 m, safety 72.
3. Draw the route.
4. Switch to phone view, log in as owner, add a new PG with a photo, watch it appear.
5. Toggle it to "full", watch it disappear from the vacancy filter.
6. Compare Kothrud vs Hinjewadi.
7. Show the admin page with one flagged listing.
