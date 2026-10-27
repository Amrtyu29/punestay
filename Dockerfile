# PuneStay: one container that builds the front end and runs the FastAPI server, which also serves the pages.
# Used by Render (see render.yaml) and by any Docker host:
#   docker build -t punestay . && docker run -p 8000:8000 -e DATABASE_URL=postgresql://... punestay

# ---- stage 1: build the home page and the React app ----
FROM node:20-alpine AS web
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- stage 2: the API, serving /frontend/dist as well ----
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8000
WORKDIR /srv
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY .env.example ./.env.example
COPY --from=web /src/frontend/dist frontend/dist
RUN mkdir -p uploads
EXPOSE 8000
# Render sets $PORT; everything else reads the environment (DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ...).
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT}"]
