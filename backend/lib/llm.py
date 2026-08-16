"""Multi-provider LLM layer for NOVA.

Three providers, one normalized shape. Keys come from backend/.env via
os.environ and never leave the server. A provider that has no key simply
reports itself as unconfigured — the app keeps working with the others.
"""
import os
from typing import AsyncIterator, Dict, List, Optional

from fastapi import HTTPException

SYSTEM_PROMPT = (
    "Du bist NOVA, ein ruhiger, präziser persönlicher KI-Assistent in einem minimalistischen "
    "Betriebssystem. Antworte auf Deutsch, freundlich und knapp — meist zwei bis fünf Sätze, "
    "höchstens ein Absatz. Keine Emojis, kein Marketing-Ton. Wenn eine Aufgabe mehrere Schritte "
    "hat, nenne höchstens drei, jeweils in einer kurzen Zeile. Wenn du etwas nicht weißt, sage es."
)

PROVIDERS: Dict[str, Dict[str, object]] = {
    "openai": {
        "label": "GPT (OpenAI)",
        "env": "OPENAI_API_KEY",
        "models": ["gpt-5.2", "gpt-5.2-mini", "gpt-4.1", "gpt-4o"],
    },
    "gemini": {
        "label": "Gemini (Google)",
        "env": "GEMINI_API_KEY",
        "models": ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
    },
    "zhipu": {
        "label": "GLM (Zhipu / Z.AI)",
        "env": "ZHIPUAI_API_KEY",
        "models": ["glm-4.6", "glm-4.5-air", "glm-4-plus"],
    },
}


def api_key(provider: str) -> str:
    meta = PROVIDERS.get(provider)
    if not meta:
        raise HTTPException(status_code=422, detail=f"Unbekannter Anbieter: {provider}")
    key = os.environ.get(str(meta["env"]), "").strip()
    if not key:
        raise HTTPException(
            status_code=503,
            detail=f"{meta['label']} ist nicht konfiguriert — Key in backend/.env eintragen.",
        )
    return key


def is_configured(provider: str) -> bool:
    meta = PROVIDERS.get(provider)
    return bool(meta and os.environ.get(str(meta["env"]), "").strip())


def default_provider() -> str:
    preferred = os.environ.get("NOVA_DEFAULT_PROVIDER", "openai").strip() or "openai"
    if is_configured(preferred):
        return preferred
    for name in PROVIDERS:
        if is_configured(name):
            return name
    return preferred


def default_model(provider: str) -> str:
    models = PROVIDERS[provider]["models"]
    return str(models[0])  # type: ignore[index]


def resolve_model(provider: str, model: Optional[str]) -> str:
    allowed = [str(m) for m in PROVIDERS[provider]["models"]]  # type: ignore[union-attr]
    if model and model in allowed:
        return model
    return allowed[0]


def _friendly(exc: Exception) -> HTTPException:
    """Map provider failures onto stable statuses without leaking key material."""
    name = type(exc).__name__
    text = str(exc)
    status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
    lowered = text.lower()
    if "rate limit" in lowered or status == 429 or name == "RateLimitError":
        return HTTPException(status_code=429, detail="Anbieter-Limit erreicht. Bitte kurz warten.")
    if status in (401, 403) or "api key" in lowered or "unauthorized" in lowered:
        return HTTPException(status_code=401, detail="Der API-Key wurde abgelehnt.")
    if status == 404 or "model" in lowered and "not" in lowered and "found" in lowered:
        return HTTPException(
            status_code=400,
            detail="Dieses Modell ist für deinen Key nicht verfügbar — anderes Modell wählen.",
        )
    return HTTPException(status_code=502, detail="Die Anfrage an den Anbieter ist fehlgeschlagen.")


def _openai_client(provider: str):
    from openai import AsyncOpenAI

    if provider == "zhipu":
        base = os.environ.get("ZHIPU_BASE_URL", "https://api.z.ai/api/paas/v4/").strip()
        return AsyncOpenAI(api_key=api_key("zhipu"), base_url=base, max_retries=1, timeout=90)
    return AsyncOpenAI(api_key=api_key("openai"), max_retries=1, timeout=90)


def _messages(history: List[Dict[str, str]], prompt: str) -> List[Dict[str, str]]:
    msgs: List[Dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for item in history[-12:]:
        role = item.get("role")
        content = (item.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            msgs.append({"role": role, "content": content})
    msgs.append({"role": "user", "content": prompt})
    return msgs


async def stream_reply(
    provider: str,
    model: str,
    prompt: str,
    history: List[Dict[str, str]],
) -> AsyncIterator[str]:
    """Yield text deltas for the given provider."""
    if provider in ("openai", "zhipu"):
        client = _openai_client(provider)
        try:
            kwargs: Dict[str, object] = {
                "model": model,
                "messages": _messages(history, prompt),
                "stream": True,
            }
            if provider == "zhipu":
                kwargs["max_tokens"] = 1200
                kwargs["temperature"] = 0.6
            stream = await client.chat.completions.create(**kwargs)  # type: ignore[arg-type]
            async for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                piece = getattr(delta, "content", None)
                if piece:
                    yield piece
        except Exception as exc:  # noqa: BLE001 — normalized below
            raise _friendly(exc) from exc
        finally:
            await client.close()
        return

    if provider == "gemini":
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key("gemini"))
        contents = []
        for item in history[-12:]:
            role = "user" if item.get("role") == "user" else "model"
            text = (item.get("content") or "").strip()
            if text:
                contents.append({"role": role, "parts": [{"text": text}]})
        contents.append({"role": "user", "parts": [{"text": prompt}]})
        try:
            stream = await client.aio.models.generate_content_stream(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    temperature=0.6,
                    max_output_tokens=1200,
                ),
            )
            async for chunk in stream:
                if chunk.text:
                    yield chunk.text
        except Exception as exc:  # noqa: BLE001
            raise _friendly(exc) from exc
        return

    raise HTTPException(status_code=422, detail=f"Unbekannter Anbieter: {provider}")


async def complete(
    provider: str,
    model: str,
    prompt: str,
    history: List[Dict[str, str]],
) -> str:
    parts: List[str] = []
    async for piece in stream_reply(provider, model, prompt, history):
        parts.append(piece)
    return "".join(parts).strip()
