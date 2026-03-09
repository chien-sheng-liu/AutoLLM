FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY app /app/app

# Persist data inside container at /app/data; can be mounted via compose
ENV DATA_DIR=/app/data

EXPOSE 8000
# Production WSGI server (configurable via env). Use shell form so env vars expand.
ENV GUNICORN_WORKERS=2
ENV GUNICORN_TIMEOUT=60
CMD ["/bin/sh", "-c", "gunicorn -k uvicorn.workers.UvicornWorker -w ${GUNICORN_WORKERS:-2} --timeout ${GUNICORN_TIMEOUT:-60} --bind 0.0.0.0:8000 app.main:app"]
