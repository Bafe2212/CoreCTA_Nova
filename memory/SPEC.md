# NOVA — persönlicher KI-Assistent (UI-Prototyp)

Ruhiges, fast schwarzes „KI-Betriebssystem“. Kein Login, keine echte KI (Mock-Intents im Backend).

## Kernflüsse
1. Startscreen: zentraler Canvas-Orb (240px) + „Wie kann ich dir helfen?“ + minimalistisches Eingabefeld.
2. Befehl senden → Orb-Zustand `denken` → POST /api/nova/command → `antworten` → passendes Fenster öffnet sich → `erfolg` → `idle`. Orb skaliert dabei auf 0.28 und wandert ins Dock (unten mittig).
3. Fenster: drag (Header), resize (Ecke unten rechts), minimieren, maximieren/restore (Doppelklick auf Header oder Button), schließen, Z-Order per Klick, mehrere gleichzeitig.
4. Dock (nur wenn Fenster offen): 7 App-Icons, Punkt = offen (cyan) / minimiert (grau).
5. Orb-Klick → Menü mit 6 Zuständen (Bereit, Denken, Antworten, Erfolg, Warnung, Fehler) + „Neuer Befehl (⌘K)“ + „NOVA in den Vordergrund“ (schließt alle Fenster).
6. ⌘K / Ctrl+K → Command Palette, Enter öffnet ersten Treffer. Esc: Palette → Orb-Menü → oberstes Fenster.

## Apps (Mock-Inhalte)
chat (nutzt /api/nova/history + /api/nova/command), browser, files, memory, schule, notizen, einstellungen (Orb-Zustandsumschalter).

## Backend
`backend/routers/nova.py` auf api_router:
- POST /api/nova/command {prompt} → {id, prompt, reply, orb_state, open_window, created_at}; Intent-Keywords mappen auf Fenster-ID, Fallback `chat`. Leerer/fehlender prompt → 422.
- GET /api/nova/history?limit= → Liste (chronologisch)
- GET /api/nova/meta → {states, apps}
Collection: `nova_commands`.

## Frontend
`src/lib/nova.ts` (Typen/Themes/Apps), `src/hooks/useWindowManager.ts`, `src/components/nova/{Orb,NovaWindow,AppContent,CommandPalette}.tsx`, `src/pages/Home.tsx`.
Fonts: Sora (Headings), Geist, Geist Mono. Kein Auth, keine Credentials.
