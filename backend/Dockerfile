FROM python:3.12-slim

WORKDIR /srv
COPY backend/requirements.txt /srv/backend/requirements.txt
RUN pip install --no-cache-dir -r /srv/backend/requirements.txt

COPY backend /srv/backend
COPY .env.example /srv/.env.example

EXPOSE 8000
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
