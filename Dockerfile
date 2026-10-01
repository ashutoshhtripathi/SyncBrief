# Multi-stage Dockerfile for SyncBrief AI Production
# Stage 1: Build modern React Vite frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Production Python FastAPI server serving API and SPA
FROM python:3.11-slim AS production
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend application
COPY backend ./backend
COPY scripts ./scripts

# Copy built frontend assets from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose HTTP port
EXPOSE 8000

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV DATABASE_URL=sqlite:////app/data/syncbrief.db

VOLUME ["/app/data"]

# Seed database on container start and run uvicorn
CMD ["sh", "-c", "mkdir -p /app/data && python backend/app/seed.py && uvicorn backend.app.main:app --host 0.0.0.0 --port 8000"]
