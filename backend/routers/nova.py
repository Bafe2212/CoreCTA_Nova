"""NOVA command intent router — the prototype's mock 'AI' brain.

No real model: a keyword intent map produces a reply, an orb state and the
window NOVA wants to open. Every route hangs off this APIRouter, which
server.py folds into api_router (prefix /api).
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from lib.db import db

router = APIRouter()

ORB_STATES = ["idle", "hoeren", "denken", "antworten", "erfolg", "warnung", "fehler"]

APP_IDS = ["chat", "browser", "files", "memory", "schule", "notizen", "einstellungen"]

# keyword -> (window id, reply)
INTENTS: List[tuple] = [
    (("browser", "web", "suche", "internet", "google"), "browser",
     "Ich öffne den Quanten-Browser und synthetisiere die Quellen für dich."),
    (("datei", "dateien", "ordner", "dokument", "download"), "files",
     "Dein Dateisystem ist indexiert. Ich zeige dir die relevanten Dokumente."),
    (("erinner", "memory", "gedächtnis", "merk"), "memory",
     "Ich lege das in meinem Langzeitgedächtnis ab und zeige dir den Kontext."),
    (("schule", "lernen", "mathe", "hausaufgabe", "prüfung", "vokabel"), "schule",
     "Lernmodus aktiv. Ich habe deine Aufgaben und Formeln vorbereitet."),
    (("notiz", "notizen", "schreib", "idee", "gedanke"), "notizen",
     "Notizfläche geöffnet. Ich schreibe mit, während du denkst."),
    (("einstellung", "settings", "konfig", "stimme", "orb"), "einstellungen",
     "Systemeinstellungen geöffnet. Du kannst meine Frequenzen anpassen."),
]

FALLBACK_REPLIES = [
    "Verstanden. Ich habe den Kontext aufgenommen und antworte im Chatfenster.",
    "Ich habe darüber nachgedacht — hier ist meine Einschätzung im Chat.",
    "Notiert. Ich halte das Ergebnis für dich im Chatfenster fest.",
]


class CommandCreate(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)


class CommandResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    prompt: str
    reply: str
    orb_state: str = "antworten"
    open_window: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def _resolve(prompt: str) -> tuple:
    low = prompt.lower()
    for keywords, window, reply in INTENTS:
        if any(k in low for k in keywords):
            return window, reply
    idx = len(prompt) % len(FALLBACK_REPLIES)
    return "chat", FALLBACK_REPLIES[idx]


@router.post("/nova/command", response_model=CommandResult)
async def create_command(payload: CommandCreate) -> CommandResult:
    prompt = payload.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=422, detail="prompt darf nicht leer sein")
    window, reply = _resolve(prompt)
    result = CommandResult(prompt=prompt, reply=reply, open_window=window)
    await db.nova_commands.insert_one(result.model_dump())
    return result


@router.get("/nova/history", response_model=List[CommandResult])
async def list_history(limit: int = 30) -> List[CommandResult]:
    docs = await db.nova_commands.find().sort("created_at", -1).to_list(max(1, min(limit, 100)))
    out: List[CommandResult] = []
    for doc in reversed(docs):
        created = doc.get("created_at")
        if isinstance(created, datetime) and created.tzinfo is None:
            doc["created_at"] = created.replace(tzinfo=timezone.utc)
        doc.pop("_id", None)
        out.append(CommandResult(**doc))
    return out


class OrbStates(BaseModel):
    states: List[str]
    apps: List[str]


@router.get("/nova/meta", response_model=OrbStates)
async def meta() -> OrbStates:
    return OrbStates(states=ORB_STATES, apps=APP_IDS)
