# NOVA — persönlicher KI-Assistent

Ruhiges, fast schwarzes „KI-Betriebssystem". Kein Login. Echte KI über die eigenen Keys des Nutzers (GPT / Gemini / GLM), Daten persistent in MongoDB.

## Zwei Phasen
- **Standby** (Startzustand): gedimmte Punkt-/Netz-Kugel (340 px), großes Uhrzeit-Display + Datum (`standby-clock`, `standby-date`), kein HUD-Raster, keine Eingabe, keine Statuszeile. Testid `standby-screen`.
- **Aktiv**: Zünd-Animation (Shockwave, Ring/Bögen/Punktekranz blenden über `mix`-Lerp ein), HUD-Gitter aus Linien + Punkten (`hud-grid`, `data-hud-visible`, 58 px), Ecken-Klammern, Statuszeile, Begrüßung + Eingabefeld.
- Wecken: Klick auf den Orb, beliebige Taste, Weckwort „Hey NOVA" oder ein gesendeter Befehl. Schlafen: Eingabe „beenden" (auch beende/standby/aus/schluss/stopp/gute nacht — `SLEEP_RE` in Home.tsx, greift vor dem Backend-Call), Orb-Menü → „Standby" (`orb-menu-standby`) oder 90 s ohne Interaktion bei geschlossenen Fenstern. Wiederhergestellte Sitzung startet direkt aktiv.

## Backend (alle Routen auf api_router, Prefix /api)
`backend/lib/llm.py` — drei Anbieter, ein normalisiertes Format. Keys aus backend/.env via os.environ, nie im Frontend:
- `openai` → AsyncOpenAI, Modelle gpt-5.2 / gpt-5.2-mini / gpt-4.1 / gpt-4o (OPENAI_API_KEY gesetzt)
- `gemini` → google-genai `client.aio`, Modelle gemini-2.5-flash / 2.5-pro / 2.0-flash (GEMINI_API_KEY leer → 503/„nicht konfiguriert")
- `zhipu` → AsyncOpenAI mit `ZHIPU_BASE_URL` (https://api.z.ai/api/paas/v4/), Modelle glm-4.6 / glm-4.5-air / glm-4-plus (ZHIPUAI_API_KEY leer)
- Systemprompt: NOVA antwortet deutsch, ruhig, knapp. Fehler werden auf 401 / 429 / 400 / 502 normalisiert, ohne Keys zu leaken.

`backend/routers/chat.py` (Prefix /chat): GET /providers, GET /messages, DELETE /messages, POST /message (nicht-streamend), GET /stream (SSE: `{user_message}` → `{delta}`… → `{done,message}` oder `{error}`; speichert User- und Assistant-Nachricht).
`backend/routers/workspace.py`: /notes (GET/POST/PUT/DELETE), /memory (GET/POST/DELETE), /files (GET/POST/DELETE), /tasks (GET/POST/PATCH/DELETE).
`backend/routers/nova.py`: POST /nova/command (Keyword-Intent → Fenster-ID; MOCK-Antwort nur für Nicht-Chat-Fenster), GET /nova/history, GET /nova/meta.
Collections: chat_messages, notes, memory, files, tasks, nova_commands.
Modelle in `backend/models/nova.py`, TS-Zwillinge in `frontend/src/lib/types.ts`.

## Frontend
- `src/hooks/useNovaData.ts` — TanStack-Query-Hooks je Ressource (Keys: chat/providers, chat/messages, notes, memory, files, tasks).
- `src/hooks/useChatStream.ts` — EventSource auf `/api/chat/stream`, Deltas → Live-Text, am Ende Invalidierung von chat/messages; Callbacks steuern die Orb-Zustände (denken → antworten → erfolg) und die Sprachausgabe.
- Fenster-Apps in `src/components/nova/apps/`: ChatApp (echte Antworten, Verlauf, leeren), NotesApp (Liste + Editor, Autosave 700 ms), MemoryApp, FilesApp, SchoolApp (Aufgaben abhaken), SettingsApp (Anbieter/Modell, Stimme, Weckwort, Orb-Zustand, Sitzung). BrowserApp bleibt MOCK.
- Anbieter/Modell in Home-State, persistiert in localStorage (`nova.provider`, `nova.model`), Default vom Server.
- Eine Eingabe auf dem Startscreen geht an POST /nova/command: Fenster-Intent öffnet das Fenster; zielt sie auf Chat, wird der Prompt als `pendingPrompt` an ChatApp übergeben und dort echt gestreamt.

## Fenster-Snapping
Magnet (14 px) auf Ränder (24) und Bildschirmmitte mit Hilfslinien (`snap-guide-vertical|horizontal`); Randzonen (≤30 px links/rechts, ≤8 px oben) zeigen `snap-preview-left|right|max` und rasten auf halbe Fläche bzw. Vollbild ein.

## Sprache
`useVoice` (Weckwort + Kommando-Modus, Live-Pegel für den Orb), `useSpeech` (TTS de-DE, Orb im Sprech-Zustand). Beides braucht echte Browser-Engines + Mikrofon.

## Sitzung
Offene Fenster (id, rect, z, minimized) in `localStorage["nova.session.v1"]`; Reset in Einstellungen → Sitzung.
