# NOVA Backend — FastAPI + motor (async MongoDB)
FROM python:3.12-slim AS builder

# Build-Dependencies (falls mal was kompiliert werden muss, z. B. cryptography/bcrypt)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Erst requirements installieren (besserer Layer-Cache als Code-Änderungen)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --user -r requirements.txt

# --- Runtime-Stage ---
FROM python:3.12-slim

# Nur die installierten Packages aus der Builder-Stage übernehmen
COPY --from=builder /root/.local /root/.local

WORKDIR /app

# App-Code kopieren
COPY . .

# /root/.local/bin muss im PATH sein (für uvicorn aus --user-Install)
ENV PATH=/root/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8001

# uvicorn direkt; --host 0.0.0.0 damit der Container von außen erreichbar ist.
# Kein --reload in Produktion.
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
