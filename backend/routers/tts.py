"""Text-to-Speech für NOVA — ElevenLabs mit Browser-Fallback.

Wenn ELEVENLABS_API_KEY gesetzt ist, erzeugt dieser Router hochwertige
Sprachausgabe über die ElevenLabs-API. Ohne Key meldet sich der Endpoint
als nicht konfiguriert und das Frontend fällt auf die Web Speech API
zurück. Die Stimme wird über ELEVENLABS_VOICE_ID (Default) oder pro
Anfrage als voice_id gewählt.
"""
import os
import time
from typing import List, Optional

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

router = APIRouter(prefix="/tts")

ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1"
# Modell für mehrsprachige Ausgabe — gut für Deutsch
ELEVENLABS_MODEL = "eleven_multilingual_v2"

# einfacher In-Memory-Cache für die Stimmliste (10 min)
_voices_cache: dict = {"data": [], "expires": 0.0}


class TtsVoice(BaseModel):
    id: str
    name: str
    preview_url: Optional[str] = None


class TtsStatus(BaseModel):
    configured: bool
    provider: str  # "elevenlabs" | "browser"
    default_voice_id: Optional[str] = None
    voices: List[TtsVoice] = []


class TtsRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    voice_id: Optional[str] = None


def is_configured() -> bool:
    return bool(os.environ.get("ELEVENLABS_API_KEY", "").strip())


def default_voice_id() -> Optional[str]:
    return os.environ.get("ELEVENLABS_VOICE_ID", "").strip() or None


def _api_key() -> str:
    key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not key:
        raise HTTPException(status_code=503, detail="ElevenLabs ist nicht konfiguriert.")
    return key


async def _load_voices() -> List[TtsVoice]:
    """Lädt die verfügbaren Stimmen — gecacht für 10 Minuten."""
    now = time.time()
    if _voices_cache["data"] and _voices_cache["expires"] > now:
        return _voices_cache["data"]

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{ELEVENLABS_API_URL}/voices",
                headers={"xi-api-key": _api_key()},
            )
        if resp.status_code != 200:
            return []
        voices: List[TtsVoice] = []
        for v in resp.json().get("voices", []):
            voices.append(
                TtsVoice(
                    id=v.get("voice_id", ""),
                    name=v.get("name", "Unbenannt"),
                    preview_url=v.get("preview_url"),
                )
            )
        _voices_cache["data"] = voices
        _voices_cache["expires"] = now + 600
        return voices
    except HTTPException:
        raise
    except Exception:  # noqa: BLE001
        return []


@router.get("/status", response_model=TtsStatus)
async def status() -> TtsStatus:
    configured = is_configured()
    voices: List[TtsVoice] = []
    if configured:
        voices = await _load_voices()
    return TtsStatus(
        configured=configured,
        provider="elevenlabs" if configured else "browser",
        default_voice_id=default_voice_id(),
        voices=voices,
    )


@router.post("/speak")
async def speak(payload: TtsRequest) -> Response:
    """Erzeugt MP3-Audio für den Text — vom Frontend als Blob abgespielt."""
    if not is_configured():
        raise HTTPException(status_code=503, detail="ElevenLabs ist nicht konfiguriert.")
    voice = payload.voice_id or default_voice_id()
    if not voice:
        raise HTTPException(
            status_code=400,
            detail="Keine voice_id angegeben und kein Default konfiguriert.",
        )
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{ELEVENLABS_API_URL}/text-to-speech/{voice}",
                headers={
                    "xi-api-key": _api_key(),
                    "Content-Type": "application/json",
                    "Accept": "audio/mpeg",
                },
                json={
                    "text": payload.text,
                    "model_id": ELEVENLABS_MODEL,
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.75,
                        "style": 0.0,
                        "use_speaker_boost": True,
                    },
                },
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"ElevenLabs nicht erreichbar: {exc}") from exc

    if resp.status_code != 200:
        detail = "ElevenLabs-Anfrage fehlgeschlagen."
        try:
            body = resp.json()
            if isinstance(body, dict) and body.get("detail", {}).get("message"):
                detail = str(body["detail"]["message"])
        except Exception:  # noqa: BLE001
            pass
        raise HTTPException(status_code=resp.status_code, detail=detail)

    return Response(content=resp.content, media_type="audio/mpeg")
