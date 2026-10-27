"""Settings read from the project .env (or .env.example as fallback)."""
import os
from pathlib import Path

import logging

from dotenv import dotenv_values, load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")
# .env.example only supplies harmless defaults (ports, URLs). Secrets never come from it.
_EXAMPLE = dotenv_values(ROOT / ".env.example")
_SECRETS = {"JWT_SECRET", "ADMIN_EMAIL", "ADMIN_SETUP_TOKEN", "POSTGRES_PASSWORD"}


def _env(name: str, default: str) -> str:
    value = os.getenv(name)
    if value is None and name not in _SECRETS:
        value = _EXAMPLE.get(name)
    return value if value is not None else default


# Hosted databases (Neon, Supabase, Render) hand out one URL; locally the POSTGRES_* parts are used.
# The URL is often pasted from a .env line, quotes included, so surrounding quotes are dropped.
DB_CONNINFO = os.getenv("DATABASE_URL", "").strip().strip("\"'") or (
    f"host={_env('POSTGRES_HOST', 'localhost')} "
    f"port={_env('POSTGRES_PORT', '5432')} "
    f"user={_env('POSTGRES_USER', 'punestay')} "
    f"password={_env('POSTGRES_PASSWORD', 'punestay')} "
    f"dbname={_env('POSTGRES_DB', 'punestay')}"
)

# Built front end (home page at /, React app at /app/) served by the API when the folder exists,
# which is how the Docker image and the Render deployment work. Vite serves it in development instead.
FRONTEND_DIST = Path(_env("FRONTEND_DIST", str(ROOT / "frontend" / "dist")))

OSRM_URL = _env("OSRM_URL", "http://localhost:5000").rstrip("/")
# Public demo router used when the local one is not running. Demo/testing use only.
OSRM_FALLBACK_URL = _env("OSRM_FALLBACK_URL", "https://router.project-osrm.org").rstrip("/")

NOMINATIM_URL = _env("NOMINATIM_URL", "https://nominatim.openstreetmap.org").rstrip("/")
NOMINATIM_EMAIL = _env("NOMINATIM_EMAIL", "")

JWT_SECRET = _env("JWT_SECRET", "")
if len(JWT_SECRET) < 16 or JWT_SECRET.startswith("change-me"):
    # Development convenience: a random per-process secret (tokens die on restart). Set JWT_SECRET in .env.
    import secrets as _secrets
    JWT_SECRET = _secrets.token_urlsafe(32)
    logging.getLogger("punestay").warning("JWT_SECRET missing or default in .env; using a random secret for this run")

# Registering with ADMIN_EMAIL gives the admin role, but only if ADMIN_SETUP_TOKEN is also supplied
# in the registration body (admin_token). Both must be set in .env; .env.example is ignored for them.
ADMIN_EMAIL = _env("ADMIN_EMAIL", "").strip().lower()
ADMIN_SETUP_TOKEN = _env("ADMIN_SETUP_TOKEN", "")
JWT_EXPIRE_HOURS = int(_env("JWT_EXPIRE_HOURS", "72"))
UPLOAD_DIR = ROOT / _env("UPLOAD_DIR", "uploads")
MAX_PHOTO_MB = int(_env("MAX_PHOTO_MB", "8"))

# south, west, north, east
_s, _w, _n, _e = (float(x) for x in _env("PUNE_BBOX", "18.40,73.62,18.75,74.05").split(","))
PUNE_BBOX = {"south": _s, "west": _w, "north": _n, "east": _e}

# 2021 -> 2025 rent uplift, calibrated against ANAROCK Q1 2025 (see scripts/build_locality_rents.py).
RENT_UPLIFT = float(_env("RENT_UPLIFT_2021_2025", "1.63"))

CORS_ORIGINS =[o.strip() for o in _env("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")]

MAX_LISTINGS_PER_REQUEST = 2000
