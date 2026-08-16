"""Chat against the user's own GPT / Gemini / GLM keys, with SSE streaming."""
import json
from typing import AsyncIterator, Dict, List

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from lib import llm
from lib.db import db
from models.nova import (
    ChatMessage,
    ChatRequest,
    ProviderInfo,
    ProviderStatus,
)

router = APIRouter(prefix="/chat")

HISTORY_LIMIT = 60


def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


async def _history() -> List[Dict[str, str]]:
    docs = await db.chat_messages.find().sort("created_at", -1).to_list(24)
    return [
        {"role": d.get("role", "user"), "content": d.get("content", "")}
        for d in reversed(docs)
    ]


@router.get("/providers", response_model=ProviderStatus)
async def providers() -> ProviderStatus:
    return ProviderStatus(
        providers=[
            ProviderInfo(
                id=pid,
                label=str(meta["label"]),
                configured=llm.is_configured(pid),
                models=[str(m) for m in meta["models"]],  # type: ignore[union-attr]
            )
            for pid, meta in llm.PROVIDERS.items()
        ],
        default_provider=llm.default_provider(),
    )


@router.get("/messages", response_model=List[ChatMessage])
async def list_messages(limit: int = Query(default=HISTORY_LIMIT, ge=1, le=200)) -> List[ChatMessage]:
    docs = await db.chat_messages.find().sort("created_at", -1).to_list(limit)
    return [ChatMessage(**_clean(d)) for d in reversed(docs)]


@router.delete("/messages")
async def clear_messages() -> dict:
    result = await db.chat_messages.delete_many({})
    return {"deleted": result.deleted_count}


@router.post("/message", response_model=ChatMessage)
async def send_message(payload: ChatRequest) -> ChatMessage:
    """Non-streaming variant — used as a fallback and by tests."""
    provider = payload.provider or llm.default_provider()
    if provider not in llm.PROVIDERS:
        raise HTTPException(status_code=422, detail=f"Unbekannter Anbieter: {provider}")
    model = llm.resolve_model(provider, payload.model)
    history = await _history()
    user_msg = ChatMessage(role="user", content=payload.prompt.strip())
    await db.chat_messages.insert_one(user_msg.model_dump())
    text = await llm.complete(provider, model, user_msg.content, history)
    reply = ChatMessage(
        role="assistant",
        content=text or "(keine Antwort)",
        provider=provider,
        model=model,
    )
    await db.chat_messages.insert_one(reply.model_dump())
    return reply


@router.get("/stream")
async def stream(
    prompt: str = Query(min_length=1, max_length=8000),
    provider: str = Query(default=""),
    model: str = Query(default=""),
) -> StreamingResponse:
    """SSE stream. Events: {delta} … then {done, message} or {error}."""
    chosen = provider or llm.default_provider()
    if chosen not in llm.PROVIDERS:
        raise HTTPException(status_code=422, detail=f"Unbekannter Anbieter: {chosen}")
    chosen_model = llm.resolve_model(chosen, model or None)
    history = await _history()
    user_msg = ChatMessage(role="user", content=prompt.strip())
    await db.chat_messages.insert_one(user_msg.model_dump())

    async def events() -> AsyncIterator[str]:
        yield f"data: {json.dumps({'user_message': user_msg.model_dump(mode='json')})}\n\n"
        chunks: List[str] = []
        try:
            async for piece in llm.stream_reply(chosen, chosen_model, user_msg.content, history):
                chunks.append(piece)
                yield f"data: {json.dumps({'delta': piece})}\n\n"
        except HTTPException as exc:
            yield f"data: {json.dumps({'error': exc.detail})}\n\n"
            return
        except Exception:  # noqa: BLE001
            yield f"data: {json.dumps({'error': 'Die Anfrage an den Anbieter ist fehlgeschlagen.'})}\n\n"
            return
        reply = ChatMessage(
            role="assistant",
            content="".join(chunks).strip() or "(keine Antwort)",
            provider=chosen,
            model=chosen_model,
        )
        await db.chat_messages.insert_one(reply.model_dump())
        yield f"data: {json.dumps({'done': True, 'message': reply.model_dump(mode='json')})}\n\n"

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
