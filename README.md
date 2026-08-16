# NOVA — persönlicher KI-Assistent

Ruhiges, fast schwarzes „KI-Betriebssystem": zentraler Licht-Orb, minimalistische
Fenster, sehr viel Stille. Kein Login. Echte KI über die eigenen Keys des Nutzers
(GPT / Gemini / GLM), Daten persistent in MongoDB.

**Stack:** FastAPI + MongoDB (motor) · Vite + React 19 + TypeScript strict ·
Tailwind v4 + shadcn/ui (auf `@base-ui/react`).

## Layout

```
CoreCTA_Nova/
  backend/   FastAPI + motor (async MongoDB) + Pydantic v2 — Python, /api
  frontend/  Vite + React 19 + Tailwind v4 + shadcn/ui (TypeScript strict)
  tests/     Playwright e2e
  memory/    Spezifikation & Notizen
```

## Schnellstart (Docker Compose — empfohlen für Self-Host)

Voraussetzung: Docker + Docker Compose v2.

1. **Backend-Env einrichten** — `backend/.env` enthält bereits Defaults für
   lokales MongoDB. Trage deine API-Keys ein (mindestens einen Provider):

   ```bash
   # backend/.env
   OPENAI_API_KEY=sk-...
   # GEMINI_API_KEY=...
   # ZHIPUAI_API_KEY=...
   NOVA_DEFAULT_PROVIDER=openai
   # Optional: ElevenLabs für natürliche Sprachausgabe
   # ELEVENLABS_API_KEY=...
   # ELEVENLABS_VOICE_ID=...
   ```

2. **Starten:**

   ```bash
   docker compose up -d --build
   ```

   Das bringt drei Container hoch:
   - `nova-mongo` — MongoDB (Daten in einem Volume)
   - `nova-backend` — FastAPI auf Port `8001`
   - `nova-frontend` — nginx, der den Vite-Production-Build ausliefert und
     `/api/*` an das Backend proxyt, auf Port `3000` (bzw. `80` im Container)

3. **Öffnen:** <http://localhost:3000>

4. **Logs / Stop:**

   ```bash
   docker compose logs -f backend
   docker compose down            # stoppen, Daten bleiben erhalten
   docker compose down -v         # stoppen + MongoDB-Daten löschen
   ```

> **Hinweis zur Produktion:** Stelle NOVA hinter einen Reverse Proxy
> (nginx/Traefik/Caddy) mit TLS. Setze `CORS_ORIGINS` in `backend/.env` auf
> deine echte Domain statt `*`, und `APP_URL` auf die öffentliche URL.

## Lokale Entwicklung (ohne Docker)

Drei Prozesse in separaten Terminals:

```bash
# 1. MongoDB (lokal installiert oder z. B. via Docker)
docker run -d --name nova-mongo -p 27017:27017 mongo:8

# 2. Backend
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows PowerShell
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload   # http://localhost:8001

# 3. Frontend
cd frontend
npm install
npm run dev                                                    # http://localhost:3000
```

## Die `/api`-Proxy-Konvention

Jede Backend-Route liegt unter `/api` (ein `APIRouter(prefix="/api")`), und der
Vite-Dev-Server (`frontend/vite.config.ts`) proxyt `/api/*` nach
`http://localhost:8001`. Im Frontend also immer **relative** Pfade aufrufen —
`apiGet("/status")` → `/api/status`. In Produktion übernimmt der nginx-Container
dieselbe Proxy-Rolle, sodass der Frontend-Code unverändert bleibt.

## Konfiguration (`backend/.env`)

| Variable | Bedeutung |
|---|---|
| `MONGO_URL` | MongoDB-Connection-String (Default: `mongodb://localhost:27017`) |
| `DB_NAME` | MongoDB-Datenbankname (Default: `nova`) |
| `CORS_ORIGINS` | Kommaseparierte Origins oder `*` (Default: `*`) |
| `APP_URL` | Öffentliche URL der App |
| `OPENAI_API_KEY` / `GEMINI_API_KEY` / `ZHIPUAI_API_KEY` | LLM-Provider-Keys (mindestens einer) |
| `NOVA_DEFAULT_PROVIDER` | `openai` \| `gemini` \| `zhipu` (Default: `openai`) |
| `ZHIPU_BASE_URL` | Z.AI-Endpoint (Default: `https://api.z.ai/api/paas/v4/`) |
| `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` | Optional, für natürliche TTS (sonst Browser-Fallback) |

## Tests

**Backend (pytest)** — `backend/tests/`:

```bash
cd backend
pytest            # parallel (-n 2, siehe pytest.ini); serial: pytest -n 0
```

Tests treffen den laufenden uvicorn-Prozess (`BACKEND_URL`, Default
`http://localhost:8001`) — also erst Backend starten, dann testen.

**Frontend (Playwright)** — `tests/`:

```bash
cd tests
npm install
npx playwright install chromium
npx playwright test
```

## Architektur

Siehe `memory/SPEC.md` für die vollständige Spezifikation (Phasen, Fenster,
Snapping, Sprache, Sitzung) und `backend/lib/llm.py` für das Multi-Provider-LLM-
Layer. Kurz:

- **Backend-Routen** (alle unter `/api`): `/chat` (SSE-Streaming + Verlauf),
  `/nova/command` (Intent-Routing), `/workspace` (Notes/Memory/Files/Tasks),
  `/tts` (ElevenLabs).
- **Frontend**: `useChatStream` läuft zentral in `Home.tsx`, damit NOVA auch
  antworten + vorlesen kann, ohne dass das Chat-Fenster offen ist.
- **Daten**: MongoDB-Collections `chat_messages`, `notes`, `memory`, `files`,
  `tasks`, `nova_commands`. IDs sind String-`uuid4`, nie Mongo-`ObjectId`.
