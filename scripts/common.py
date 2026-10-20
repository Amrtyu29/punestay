"""Shared helpers for the data scripts: paths, .env loading, DB connection."""
import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OVERPASS_DIR = DATA / "overpass"

load_dotenv(ROOT / ".env")
load_dotenv(ROOT / ".env.example")  # fallback defaults, does not override .env


def env(name: str, default: str | None = None) -> str:
    value = os.getenv(name, default)
    if value is None:
        raise SystemExit(f"Missing environment variable {name}. Copy .env.example to .env.")
    return value


def bbox() -> tuple[float, float, float, float]:
    """Returns (south, west, north, east)."""
    s, w, n, e = (float(x) for x in env("PUNE_BBOX", "18.40,73.62,18.75,74.05").split(","))
    return s, w, n, e


def connect() -> psycopg.Connection:
    return psycopg.connect(
        host=env("POSTGRES_HOST", "localhost"),
        port=int(env("POSTGRES_PORT", "5432")),
        user=env("POSTGRES_USER", "punestay"),
        password=env("POSTGRES_PASSWORD", "punestay"),
        dbname=env("POSTGRES_DB", "punestay"),
    )
