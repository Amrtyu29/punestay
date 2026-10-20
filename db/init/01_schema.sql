-- PuneStay schema. Runs automatically on first `docker compose up db`.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- fuzzy name matching for the duplicate-listing check

-- ---------------------------------------------------------------- users
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  phone         TEXT,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('student', 'owner', 'admin')),
  trusted       BOOLEAN NOT NULL DEFAULT false,   -- set when an admin approves the account's first listing or claim
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- pois
-- All OpenStreetMap point data in one table, separated by category.
CREATE TABLE pois (
  id       SERIAL PRIMARY KEY,
  osm_id   BIGINT,
  category TEXT NOT NULL,   -- bus_stop, metro, mess, hospital, pharmacy, atm, grocery,
                            -- police, street_lamp, college, office, locality
  name     TEXT,
  geom     GEOMETRY(Point, 4326) NOT NULL,
  tags     JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (category, osm_id)
);
CREATE INDEX pois_geom_idx     ON pois USING GIST (geom);
CREATE INDEX pois_category_idx ON pois (category);

-- ---------------------------------------------------------------- destinations
-- Colleges and offices a user can pick as "my destination".
CREATE TABLE destinations (
  id     SERIAL PRIMARY KEY,
  osm_id BIGINT,
  name   TEXT NOT NULL,
  kind   TEXT NOT NULL CHECK (kind IN ('college', 'office')),
  geom   GEOMETRY(Point, 4326) NOT NULL,
  UNIQUE (kind, osm_id)
);
CREATE INDEX destinations_geom_idx ON destinations USING GIST (geom);
CREATE INDEX destinations_name_idx ON destinations (lower(name));

-- ---------------------------------------------------------------- wards
CREATE TABLE wards (
  id   SERIAL PRIMARY KEY,
  name TEXT,
  geom GEOMETRY(MultiPolygon, 4326) NOT NULL
);
CREATE INDEX wards_geom_idx ON wards USING GIST (geom);

-- ---------------------------------------------------------------- listings
CREATE TABLE listings (
  id                  SERIAL PRIMARY KEY,
  owner_id            INT REFERENCES users(id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  address             TEXT NOT NULL,
  geom                GEOMETRY(Point, 4326) NOT NULL,
  listing_type        TEXT NOT NULL CHECK (listing_type IN ('pg', 'flat', 'hostel')),
  gender              TEXT NOT NULL CHECK (gender IN ('male', 'female', 'any')),
  rent_min            INT CHECK (rent_min >= 0),       -- NULL = rent not published (imported places)
  rent_max            INT CHECK (rent_max IS NULL OR rent_max >= rent_min),
  deposit             INT,
  food_included       BOOLEAN NOT NULL DEFAULT false,
  amenities           JSONB NOT NULL DEFAULT '[]'::jsonb,   -- ["wifi","ac","laundry","parking"]
  contact_phone       TEXT,
  vacancy             BOOLEAN,                   -- NULL = not known (imported, not yet claimed by the owner)
  status              TEXT NOT NULL DEFAULT 'unverified'
                        CHECK (status IN ('pending', 'unverified', 'verified', 'hidden')),  -- pending = awaiting admin approval (new accounts)
  verify_count        INT NOT NULL DEFAULT 0,
  flag_count          INT NOT NULL DEFAULT 0,
  is_demo             BOOLEAN NOT NULL DEFAULT false,
  -- Provenance: where the row came from and whether the rent is a locality estimate.
  source              TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'seed', 'osm', 'overture', 'demo', 'import')),
  source_ref          TEXT,                       -- e.g. OSM 'node/123456' or 'overture:<gers id>'
  also_in             TEXT[] NOT NULL DEFAULT '{}',  -- other sources that list the same place (dedup merges)
  rent_estimated      BOOLEAN NOT NULL DEFAULT false,
  website             TEXT,
  safety_score        INT CHECK (safety_score BETWEEN 0 AND 100),
  nearest_bus_stop_id INT REFERENCES pois(id) ON DELETE SET NULL,
  nearest_bus_stop_m  INT,
  nearest_metro_id    INT REFERENCES pois(id) ON DELETE SET NULL,
  nearest_metro_m     INT,
  nearest_mess_id     INT REFERENCES pois(id) ON DELETE SET NULL,
  nearest_mess_m      INT,
  nearest_hospital_id INT REFERENCES pois(id) ON DELETE SET NULL,
  nearest_hospital_m  INT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX listings_geom_idx   ON listings USING GIST (geom);
CREATE INDEX listings_status_idx ON listings (status);
CREATE INDEX listings_rent_idx   ON listings (rent_min);
CREATE UNIQUE INDEX listings_source_ref_idx ON listings (source, source_ref) WHERE source_ref IS NOT NULL;

-- Keep updated_at current on every change.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listings_set_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------- listing_photos
CREATE TABLE listing_photos (
  id         SERIAL PRIMARY KEY,
  listing_id INT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX listing_photos_listing_idx ON listing_photos (listing_id);

-- ---------------------------------------------------------------- commute_cache
CREATE TABLE commute_cache (
  listing_id     INT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  destination_id INT NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  mode           TEXT NOT NULL CHECK (mode IN ('car', 'bike', 'foot')),
  duration_s     INT NOT NULL,
  distance_m     INT NOT NULL,
  computed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, destination_id, mode)
);

-- ---------------------------------------------------------------- listing_actions
-- One verify / flag per user per listing.
CREATE TABLE listing_actions (
  id         SERIAL PRIMARY KEY,
  listing_id INT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action     TEXT NOT NULL CHECK (action IN ('verify', 'flag', 'rent_update')),
  value      TEXT,
  distance_m INT,                                   -- how far the user's device was from the listing (verify)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (listing_id, user_id, action)
);

-- ---------------------------------------------------------------- listing_claims
-- An owner asking to take over an imported (OSM / Overture) place. Admin confirms by calling the listed number.
CREATE TABLE listing_claims (
  id         SERIAL PRIMARY KEY,
  listing_id INT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone      TEXT NOT NULL,
  note       TEXT,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  UNIQUE (listing_id, user_id)
);

-- ---------------------------------------------------------------- safety_reports
CREATE TABLE safety_reports (
  id         SERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(id) ON DELETE SET NULL,
  geom       GEOMETRY(Point, 4326) NOT NULL,
  category   TEXT NOT NULL CHECK (category IN
               ('dark_street', 'harassment', 'theft', 'stray_dogs', 'other')),
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX safety_reports_geom_idx ON safety_reports USING GIST (geom);

-- ---------------------------------------------------------------- rent_observations
-- Real past rents (not live listings): one row per observed flat rent, from open datasets.
-- precision = 'building' when the housing society was matched to a named OpenStreetMap feature,
-- 'locality' when only the locality is known (then geom is the locality centre and is not drawn as a point).
CREATE TABLE rent_observations (
  id            SERIAL PRIMARY KEY,
  source        TEXT NOT NULL,              -- e.g. 'kaggle-pune-2021'
  source_ref    TEXT NOT NULL,
  year          INT NOT NULL,
  bhk           INT CHECK (bhk BETWEEN 1 AND 6),
  area_sqft     INT,
  rent          INT NOT NULL CHECK (rent > 0),
  deposit       INT,
  furnishing    TEXT,
  available_for TEXT,
  society       TEXT,
  locality      TEXT,
  precision     TEXT NOT NULL CHECK (precision IN ('building', 'locality')),
  osm_ref       TEXT,
  geom          GEOMETRY(Point, 4326) NOT NULL,
  UNIQUE (source, source_ref)
);
CREATE INDEX rent_observations_geom_idx ON rent_observations USING GIST (geom);

-- ---------------------------------------------------------------- geocode_cache
-- Nominatim allows 1 request per second, so never geocode the same text twice.
CREATE TABLE geocode_cache (
  query      TEXT PRIMARY KEY,
  lat        DOUBLE PRECISION,
  lng        DOUBLE PRECISION,
  display    TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- helper view
-- Listings as GeoJSON-ready rows for the API.
CREATE VIEW listings_public AS
SELECT l.id, l.owner_id, l.name, l.address, l.listing_type, l.gender,
       l.rent_min, l.rent_max, l.deposit, l.food_included, l.amenities,
       l.vacancy, l.status, l.is_demo, l.source, l.rent_estimated, l.website, l.safety_score,
       l.nearest_bus_stop_m, l.nearest_metro_m, l.nearest_mess_m, l.nearest_hospital_m,
       (l.updated_at < now() - interval '90 days') AS stale,
       ST_Y(l.geom) AS lat, ST_X(l.geom) AS lng, l.geom,
       l.created_at, l.updated_at
FROM listings l
WHERE l.status NOT IN ('hidden', 'pending');
