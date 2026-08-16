import { useCallback, useEffect, useRef, useState } from "react";
import { useTtsStatus } from "@/hooks/useNovaData";

/**
 * NOVA spricht: ElevenLabs, wenn konfiguriert, sonst die Web-Speech-API.
 * Während gesprochen wird, meldet `speaking` true — der Orb bleibt so lange
 * im Sprech-Zustand.
 *
 * Die gewählte Stimme wird in localStorage gehalten (nova.tts.voice).
 */
export interface SpeechApi {
  supported: boolean;
  speaking: boolean;
  /** ElevenLabs konfiguriert? — steuert die UI in den Einstellungen */
  elevenlabs: boolean;
  /** aktuell gewählte ElevenLabs-Stimme (oder null = Default) */
  voiceId: string | null;
  setVoiceId: (id: string | null) => void;
  speak: (text: string) => void;
  stop: () => void;
}

const VOICE_STORAGE = "nova.tts.voice";

export function useSpeech(enabled: boolean): SpeechApi {
  const [speaking, setSpeaking] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  const tts = useTtsStatus();
  const elevenlabs = !!tts.data?.configured;
  const defaultVoiceId = tts.data?.default_voice_id ?? null;

  const [voiceId, setVoiceIdState] = useState<string | null>(
    () => window.localStorage.getItem(VOICE_STORAGE) || null,
  );

  const setVoiceId = useCallback((id: string | null) => {
    setVoiceIdState(id);
    if (id) window.localStorage.setItem(VOICE_STORAGE, id);
    else window.localStorage.removeItem(VOICE_STORAGE);
  }, []);

  // Web-Speech-Stimme für den Fallback vorbereiten
  useEffect(() => {
    if (!supported) return;
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      voiceRef.current =
        voices.find((v) => v.lang.toLowerCase().startsWith("de")) ?? voices[0] ?? null;
    };
    pick();
    window.speechSynthesis.addEventListener("voiceschanged", pick);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", pick);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  // aktiver Audio-Player für ElevenLabs (damit stop() ihn abbrechen kann)
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const speakEleven = useCallback(
    async (text: string, chosenVoice: string | null) => {
      try {
        const resp = await fetch("/api/tts/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            voice_id: chosenVoice ?? undefined,
          }),
        });
        if (!resp.ok) throw new Error("tts failed");
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          setSpeaking(false);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          setSpeaking(false);
        };
        setSpeaking(true);
        await audio.play();
      } catch {
        // Fallback auf Web Speech, falls ElevenLabs streikt
        setSpeaking(false);
        speakWeb(text);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const speakWeb = useCallback(
    (text: string) => {
      if (!supported || !text.trim()) {
        setSpeaking(false);
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = "de-DE";
        utter.rate = 0.97;
        utter.pitch = 1.02;
        utter.volume = 0.9;
        if (voiceRef.current) utter.voice = voiceRef.current;
        utter.onstart = () => setSpeaking(true);
        utter.onend = () => setSpeaking(false);
        utter.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(utter);
        setSpeaking(true);
      } catch {
        setSpeaking(false);
      }
    },
    [supported],
  );

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !text.trim()) return;
      // laufende Wiedergabe abbrechen, bevor neu gestartet wird
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (supported) window.speechSynthesis.cancel();

      if (elevenlabs) {
        void speakEleven(text, voiceId ?? defaultVoiceId);
      } else {
        speakWeb(text);
      }
    },
    [enabled, supported, elevenlabs, voiceId, defaultVoiceId, speakEleven, speakWeb],
  );

  return {
    supported,
    speaking,
    elevenlabs,
    voiceId: voiceId ?? defaultVoiceId,
    setVoiceId,
    speak,
    stop,
  };
}
