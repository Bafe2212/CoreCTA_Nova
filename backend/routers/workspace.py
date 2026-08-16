"""Persistent workspace data for NOVA: Notizen, Memory, Dateien, Schule."""
from typing import List

from fastapi import APIRouter, HTTPException

from lib.db import db
from models.nova import (
    FileCreate,
    FileItem,
    MemoryCreate,
    MemoryItem,
    Note,
    NoteCreate,
    NoteUpdate,
    SchoolTask,
    TaskCreate,
    TaskUpdate,
    now,
)

router = APIRouter()


def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


# ---------- Notizen ----------

@router.get("/notes", response_model=List[Note])
async def list_notes() -> List[Note]:
    docs = await db.notes.find().sort("updated_at", -1).to_list(200)
    return [Note(**_clean(d)) for d in docs]


@router.post("/notes", response_model=Note)
async def create_note(payload: NoteCreate) -> Note:
    note = Note(title=payload.title.strip() or "Ohne Titel", body=payload.body)
    await db.notes.insert_one(note.model_dump())
    return note


@router.put("/notes/{note_id}", response_model=Note)
async def update_note(note_id: str, payload: NoteUpdate) -> Note:
    doc = await db.notes.find_one({"id": note_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Notiz nicht gefunden")
    patch = {"updated_at": now()}
    if payload.title is not None:
        patch["title"] = payload.title.strip() or "Ohne Titel"
    if payload.body is not None:
        patch["body"] = payload.body
    await db.notes.update_one({"id": note_id}, {"$set": patch})
    merged = {**_clean(doc), **patch}
    return Note(**merged)


@router.delete("/notes/{note_id}")
async def delete_note(note_id: str) -> dict:
    result = await db.notes.delete_one({"id": note_id})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Notiz nicht gefunden")
    return {"deleted": note_id}


# ---------- Memory ----------

@router.get("/memory", response_model=List[MemoryItem])
async def list_memory() -> List[MemoryItem]:
    docs = await db.memory.find().sort("created_at", -1).to_list(200)
    return [MemoryItem(**_clean(d)) for d in docs]


@router.post("/memory", response_model=MemoryItem)
async def create_memory(payload: MemoryCreate) -> MemoryItem:
    item = MemoryItem(text=payload.text.strip(), tag=payload.tag.strip() or "allgemein")
    await db.memory.insert_one(item.model_dump())
    return item


@router.delete("/memory/{item_id}")
async def delete_memory(item_id: str) -> dict:
    result = await db.memory.delete_one({"id": item_id})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Eintrag nicht gefunden")
    return {"deleted": item_id}


# ---------- Dateien ----------

@router.get("/files", response_model=List[FileItem])
async def list_files() -> List[FileItem]:
    docs = await db.files.find().sort("created_at", -1).to_list(200)
    return [FileItem(**_clean(d)) for d in docs]


@router.post("/files", response_model=FileItem)
async def create_file(payload: FileCreate) -> FileItem:
    item = FileItem(name=payload.name.strip(), kind=payload.kind, size=payload.size)
    await db.files.insert_one(item.model_dump())
    return item


@router.delete("/files/{file_id}")
async def delete_file(file_id: str) -> dict:
    result = await db.files.delete_one({"id": file_id})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")
    return {"deleted": file_id}


# ---------- Schule ----------

@router.get("/tasks", response_model=List[SchoolTask])
async def list_tasks() -> List[SchoolTask]:
    docs = await db.tasks.find().sort("created_at", -1).to_list(200)
    return [SchoolTask(**_clean(d)) for d in docs]


@router.post("/tasks", response_model=SchoolTask)
async def create_task(payload: TaskCreate) -> SchoolTask:
    task = SchoolTask(
        subject=payload.subject.strip(),
        title=payload.title.strip(),
        due=(payload.due or "").strip() or None,
    )
    await db.tasks.insert_one(task.model_dump())
    return task


@router.patch("/tasks/{task_id}", response_model=SchoolTask)
async def update_task(task_id: str, payload: TaskUpdate) -> SchoolTask:
    doc = await db.tasks.find_one({"id": task_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Aufgabe nicht gefunden")
    patch: dict = {}
    if payload.done is not None:
        patch["done"] = payload.done
    if payload.title is not None:
        patch["title"] = payload.title.strip()
    if payload.due is not None:
        patch["due"] = payload.due.strip() or None
    if patch:
        await db.tasks.update_one({"id": task_id}, {"$set": patch})
    return SchoolTask(**{**_clean(doc), **patch})


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str) -> dict:
    result = await db.tasks.delete_one({"id": task_id})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Aufgabe nicht gefunden")
    return {"deleted": task_id}
