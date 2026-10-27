"""PuneStay API. Run from the project root:

    uvicorn backend.app.main:app --reload --port 8000

Docs at http://localhost:8000/docs
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import CORS_ORIGINS, FRONTEND_DIST, OSRM_URL, PUNE_BBOX, UPLOAD_DIR
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


class StripApiPrefix:
    """Lets the front end call /api/... on the same origin: /api/listings -> /listings.

    In development Vite proxies /api to this server and strips the prefix itself; in the Docker image the API
    serves the pages too, so the prefix arrives here and is removed before routing.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope["path"].startswith("/api/"):
            scope["path"] = scope["path"][4:]
            scope["raw_path"] = scope["path"].encode()
        await self.app(scope, receive, send)


app = FastAPI(
    title="PuneStay API",
    version="0.8.0",
    description="WebGIS rental map for students and IT workers in Pune.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)
app.add_middleware(StripApiPrefix)

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


# The built pages, mounted last so every API route above wins: / is the home page, /app/ the React app.
if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="site")
    logging.getLogger("punestay").info("Serving the built front end from %s", FRONTEND_DIST)
