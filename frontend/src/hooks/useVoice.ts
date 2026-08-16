import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Mikrofon-Zuhören für NOVA: Web Speech API für den Text und ein AnalyserNode
 * für die Live-Amplitude. Der Pegel liegt in einem Ref (getLevel) — der Orb
 * liest ihn in seiner Zeichenschleife, ohne dass React neu rendert.
 */

interface SpeechAlt {
  transcript: string;
}
interface SpeechRes {
  isFinal: boolean;
  0: SpeechAlt;
}
interface SpeechEvent {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRes };
}
interface SpeechErrEvent {
  error: string;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: SpeechErrEvent) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

const getRecognitionCtor = (): RecognitionCtor | null => {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export interface VoiceApi {
  supported: boolean;
  listening: boolean;
  transcript: string;
  error: string | null;
  toggle: () => void;
  stop: () => void;
  getLevel: () => number;
}

export function useVoice(onFinal: (text: string) => void): VoiceApi {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const levelRef = useRef(0);
  const recognitionRef = useRef<Recognition | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef(0);
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;

  const supported =
    typeof window !== "undefined" &&
    !!getRecognitionCtor() &&
    !!navigator.mediaDevices?.getUserMedia;

  const teardown = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    levelRef.current = 0;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close().catch(() => undefined);
    ctxRef.current = null;
    setListening(false);
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const start = useCallback(async () => {
    setError(null);
    setTranscript("");
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("Dein Browser unterstützt keine Spracherkennung.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      ctxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        const next = Math.min(1, rms * 4.2);
        levelRef.current = levelRef.current + (next - levelRef.current) * 0.28;
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setError("Mikrofonzugriff wurde abgelehnt.");
      teardown();
      return;
    }

    const recognition = new Ctor();
    recognition.lang = "de-DE";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (e) => {
      let text = "";
      let done = false;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) done = true;
      }
      setTranscript(text);
      if (done && text.trim()) {
        finalRef.current(text.trim());
        teardown();
      }
    };
    recognition.onerror = (e) => {
      setError(
        e.error === "not-allowed"
          ? "Mikrofonzugriff wurde abgelehnt."
          : "Ich habe nichts verstanden.",
      );
      teardown();
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      teardown();
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setError("Zuhören konnte nicht gestartet werden.");
      teardown();
    }
  }, [teardown]);

  const toggle = useCallback(() => {
    if (listening) teardown();
    else void start();
  }, [listening, start, teardown]);

  return {
    supported,
    listening,
    transcript,
    error,
    toggle,
    stop: teardown,
    getLevel: () => levelRef.current,
  };
}
