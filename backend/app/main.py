"""PuneStay API. Run from the project root:

    uvicorn backend.app.main:app --reload --port 8000

Docs at http://localhost:8000/docs
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import CORS_ORIGINS, OSRM_URL, PUNE_BBOX, UPLOAD_DIR
from .db import close_pool, db_ok
from .routers import admin, areas, auth, destinations, listings, listings_write, nearby, pois, rents, route, safety

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
# The pool retries in the background while the DB is down; one warning from us is enough.
logging.getLogger("psycopg.pool").setLevel(logging.ERROR)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not db_ok():
        logging.getLogger("punestay").warning(
            "Database not reachable at startup. Endpoints return 503 until it is. "
            "Start it with: docker compose up -d db"
        )
    yield
    close_pool()


app = FastAPI(
    title="PuneStay API",
    version="0.7.0",
    description="WebGIS rental map for students and IT workers in Pune.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(listings_write.router)   # before the read router so /listings/near is not taken as an id
app.include_router(listings.router)
app.include_router(pois.router)
app.include_router(destinations.router)
app.include_router(route.router)
app.include_router(safety.router)
app.include_router(nearby.router)
app.include_router(rents.router)
app.include_router(areas.router)
app.include_router(admin.router)

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.get("/health", tags=["meta"])
def health():
    return {"ok": True, "database": db_ok(), "osrm_url": OSRM_URL, "bbox": PUNE_BBOX}
