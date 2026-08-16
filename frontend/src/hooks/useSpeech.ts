import { useCallback, useEffect, useRef, useState } from "react";

/**
 * NOVA spricht: Web-Speech-Synthese auf Deutsch. Während gesprochen wird,
 * meldet `speaking` true — der Orb bleibt so lange im Sprech-Zustand.
 */
export interface SpeechApi {
  supported: boolean;
  speaking: boolean;
  speak: (text: string) => void;
  stop: () => void;
}

export function useSpeech(enabled: boolean): SpeechApi {
  const [speaking, setSpeaking] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

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

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!supported || !enabled || !text.trim()) return;
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
        // Safety net: some engines never fire onstart
        setSpeaking(true);
      } catch {
        // a missing or unhappy TTS engine must never break the command flow
        setSpeaking(false);
      }
    },
    [enabled, supported],
  );

  return { supported, speaking, speak, stop };
}
