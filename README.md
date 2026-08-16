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

## Schnellstart (lokal auf Windows — ohne Docker)

Drei Komponenten: MongoDB (Windows-Service), FastAPI-Backend, Vite-Frontend.

### 1. MongoDB installieren

```powershell
winget install MongoDB.Server
# Der MongoDB-Service startet automatisch (StartType: Automatic).
```

Verifizieren: `Test-NetConnection -ComputerName localhost -Port 27017` →
`TcpTestSucceeded: True`. Verwaltung: `Services.msc` → Dienst „MongoDB".

### 2. Backend-Env einrichten

`backend/.env` enthält bereits Defaults für lokales MongoDB. Trage deine
API-Keys ein (mindestens einen Provider):

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

### 3. Backend starten

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # Venv aktivieren
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload   # http://localhost:8001
```

> PowerShell blockiert ggf. das Skript `Activate.ps1`. Einmalig freischalten:
> `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.

### 4. Frontend starten (zweites Terminal)

```powershell
cd frontend
npm install
npm run dev                           # http://localhost:3000
```

### 5. Öffnen

<http://localhost:3000> — NOVA startet im Standby. Orb antippen (oder Taste
drücken) zum Wecken.

### Stoppen

In beiden Terminals `Strg+C`. MongoDB-Service stoppen:
`Stop-Service MongoDB` (als Administrator).

---

## Alternative: Docker Compose

Wenn Docker installiert ist, bringt ein Befehl alles hoch (MongoDB, Backend,
nginx-Frontend):

```bash
docker compose up -d --build
```

- `nova-mongo` — MongoDB (Daten im Volume `mongo-data`)
- `nova-backend` — FastAPI auf Port `8001`
- `nova-frontend` — nginx, liefert den Vite-Production-Build aus und proxyt
  `/api/*` ans Backend, auf Port `3000` (Container-Port `80`)

Logs / Stop:

```bash
docker compose logs -f backend
docker compose down            # stoppen, Daten bleiben erhalten
docker compose down -v         # stoppen + MongoDB-Daten löschen
```

> **Hinweis zur Produktion:** Stelle NOVA hinter einen Reverse Proxy
> (nginx/Traefik/Caddy) mit TLS. Setze `CORS_ORIGINS` in `backend/.env` auf
> deine echte Domain statt `*`, und `APP_URL` auf die öffentliche URL.

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
