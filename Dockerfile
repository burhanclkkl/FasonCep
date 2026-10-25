# Frontend assets are compiled once; Vite is not a production web server.
FROM node:24-bookworm-slim AS frontend
WORKDIR /build
COPY apps/fasoncep/frontend/package*.json ./
RUN npm ci
COPY apps/fasoncep/frontend/ ./
RUN npm run build

FROM python:3.12-slim-bookworm AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FASONCEP_ENV=production \
    FASONCEP_DATA_DIR=/data \
    FASONCEP_FRONTEND_DIR=/app/frontend-dist
WORKDIR /app
COPY apps/fasoncep/backend/requirements.lock ./requirements.lock
RUN pip install --no-cache-dir -r requirements.lock \
    && groupadd --gid 10001 fasoncep \
    && useradd --uid 10001 --gid fasoncep --no-create-home fasoncep \
    && mkdir /data && chown fasoncep:fasoncep /data
COPY apps/fasoncep/backend/app/ ./app/
COPY --from=frontend /build/dist/ ./frontend-dist/
USER 10001:10001
EXPOSE 8765
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8765/api/health', timeout=3)"
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8765", "--proxy-headers"]
