"""Pydantic v2 models for NOVA's persistent surfaces.

Each model has a hand-written TS twin in frontend/src/lib/types.ts — keep the
pair in sync in the same edit.
"""
import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


def new_id() -> str:
    return str(uuid.uuid4())


def now() -> datetime:
    return datetime.now(timezone.utc)


# ---------- chat ----------

class ChatMessage(BaseModel):
    id: str = Field(default_factory=new_id)
    role: Literal["user", "assistant"]
    content: str
    provider: Optional[str] = None
    model: Optional[str] = None
    created_at: datetime = Field(default_factory=now)


class ChatRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=8000)
    provider: Optional[str] = None
    model: Optional[str] = None


class ProviderInfo(BaseModel):
    id: str
    label: str
    configured: bool
    models: List[str]


class ProviderStatus(BaseModel):
    providers: List[ProviderInfo]
    default_provider: str


# ---------- notes ----------

class NoteCreate(BaseModel):
    title: str = Field(default="Ohne Titel", max_length=200)
    body: str = Field(default="", max_length=20000)


class NoteUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    body: Optional[str] = Field(default=None, max_length=20000)


class Note(BaseModel):
    id: str = Field(default_factory=new_id)
    title: str = "Ohne Titel"
    body: str = ""
    created_at: datetime = Field(default_factory=now)
    updated_at: datetime = Field(default_factory=now)


# ---------- memory ----------

class MemoryCreate(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    tag: str = Field(default="allgemein", max_length=40)


class MemoryItem(BaseModel):
    id: str = Field(default_factory=new_id)
    text: str
    tag: str = "allgemein"
    created_at: datetime = Field(default_factory=now)


# ---------- files ----------

class FileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    kind: Literal["dokument", "notiz", "tabelle", "ordner", "medien"] = "dokument"
    size: str = Field(default="—", max_length=40)


class FileItem(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    kind: str = "dokument"
    size: str = "—"
    created_at: datetime = Field(default_factory=now)


# ---------- school ----------

class TaskCreate(BaseModel):
    subject: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=200)
    due: Optional[str] = Field(default=None, max_length=40)


class TaskUpdate(BaseModel):
    done: Optional[bool] = None
    title: Optional[str] = Field(default=None, max_length=200)
    due: Optional[str] = Field(default=None, max_length=40)


class SchoolTask(BaseModel):
    id: str = Field(default_factory=new_id)
    subject: str
    title: str
    due: Optional[str] = None
    done: bool = False
    created_at: datetime = Field(default_factory=now)
