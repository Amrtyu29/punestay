"""Connection pool and a FastAPI dependency that hands out a cursor returning dict rows."""
from collections.abc import Iterator

import psycopg
from fastapi import HTTPException
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool, PoolTimeout

from .config import DB_CONNINFO

# open=False so the API still starts when the database is down; it opens on first use.
pool = ConnectionPool(DB_CONNINFO, min_size=1, max_size=10, open=False, timeout=5)


def open_pool() -> None:
    if pool.closed:
        pool.open()


def close_pool() -> None:
    if not pool.closed:
        pool.close()


def get_cursor() -> Iterator[psycopg.Cursor]:
    """FastAPI dependency. Rolls back on error, commits on success."""
    open_pool()
    try:
        with pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                yield cur
    except (PoolTimeout, psycopg.OperationalError) as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc


def db_ok() -> bool:
    """Quick liveness probe for /health and startup: answers within ~3 s so hosting health checks never stall."""
    try:
        open_pool()
        with pool.connection(timeout=3) as conn:
            conn.execute("SELECT 1")
        return True
    except (PoolTimeout, psycopg.OperationalError):
        return False
    except Exception:  # noqa: BLE001 - a health probe must never raise
        return False
