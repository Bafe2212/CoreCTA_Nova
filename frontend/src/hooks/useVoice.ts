import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Mikrofon-Zuhören für NOVA.
 *
 * Zwei Modi:
 *  - `wake`: Hintergrund-Erkennung, die nur auf „Hey NOVA“ wartet.
 *  - `command`: aktives Zuhören mit Live-Transkript und Amplitude (AnalyserNode),
 *    das finale Transkript wird als Befehl weitergegeben.
 *
 * Der Pegel liegt in einem Ref (`getLevel`) — der Orb liest ihn pro Frame,
 * ohne dass React neu rendert.
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

/** „hey nova“, „hallo nova“, „hey, nova!“ … */
const WAKE_RE = /\b(hey|hallo|ok|okay)[\s,!.]*nova\b/i;

export type VoiceMode = "off" | "wake" | "command";

export interface VoiceApi {
  supported: boolean;
  /** true when the browser/iframe refuses microphone access — listening is impossible */
  blocked: boolean;
  /** true while actively listening for a command */
  listening: boolean;
  /** true while the wake word listener is armed */
  wakeEnabled: boolean;
  wakeActive: boolean;
  transcript: string;
  error: string | null;
  toggle: () => void;
  stop: () => void;
  setWakeEnabled: (v: boolean) => void;
  getLevel: () => number;
}

export function useVoice(
  onFinal: (text: string) => void,
  opts: { wakePaused?: boolean } = {},
): VoiceApi {
  const [listening, setListening] = useState(false);
  const [wakeEnabled, setWakeEnabledState] = useState(false);
  const [wakeActive, setWakeActive] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const levelRef = useRef(0);
  const recRef = useRef<Recognition | null>(null);
  const modeRef = useRef<VoiceMode>("off");
  const wakeRef = useRef(false);
  const pausedRef = useRef(!!opts.wakePaused);
  const restartRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef(0);
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;

  const supported =
    typeof window !== "undefined" &&
    !!getRecognitionCtor() &&
    !!navigator.mediaDevices?.getUserMedia;

  const stopAudio = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    levelRef.current = 0;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close().catch(() => undefined);
    ctxRef.current = null;
  }, []);

  const killRecognition = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    if (!rec) return;
    rec.onend = null;
    rec.onresult = null;
    rec.onerror = null;
    try {
      rec.stop();
    } catch {
      /* engine already stopped */
    }
  }, []);

  const startAudioMeter = useCallback(async () => {
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
      const next = Math.min(1, Math.sqrt(sum / data.length) * 4.2);
      levelRef.current = levelRef.current + (next - levelRef.current) * 0.28;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // forward declarations so wake → command and command → wake can call each other
  const startWakeRef = useRef<() => void>(() => undefined);
  const startCommandRef = useRef<() => void>(() => undefined);

  const goIdle = useCallback(() => {
    killRecognition();
    stopAudio();
    modeRef.current = "off";
    setListening(false);
    setWakeActive(false);
    // fall back to wake listening when it stays armed
    if (wakeRef.current && !pausedRef.current) {
      window.clearTimeout(restartRef.current);
      restartRef.current = window.setTimeout(() => startWakeRef.current(), 700);
    }
  }, [killRecognition, stopAudio]);

  const startCommand = useCallback(async () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("Dein Browser unterstützt keine Spracherkennung.");
      return;
    }
    window.clearTimeout(restartRef.current);
    killRecognition();
    setError(null);
    setTranscript("");
    modeRef.current = "command";
    setWakeActive(false);

    try {
      await startAudioMeter();
    } catch {
      setError("Mikrofonzugriff wurde abgelehnt.");
      wakeRef.current = false;
      setWakeEnabledState(false);
      goIdle();
      return;
    }

    const rec = new Ctor();
    rec.lang = "de-DE";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let text = "";
      let done = false;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) done = true;
      }
      // a wake word spoken in the same breath is not part of the command
      const cleaned = text.replace(WAKE_RE, "").trimStart();
      setTranscript(cleaned);
      if (done && cleaned.trim()) {
        finalRef.current(cleaned.trim());
        goIdle();
      }
    };
    rec.onerror = (e) => {
      setError(
        e.error === "not-allowed"
          ? "Mikrofonzugriff wurde abgelehnt."
          : "Ich habe nichts verstanden.",
      );
      goIdle();
    };
    rec.onend = () => goIdle();
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("Zuhören konnte nicht gestartet werden.");
      goIdle();
    }
  }, [goIdle, killRecognition, startAudioMeter]);

  const startWake = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || !wakeRef.current || pausedRef.current) return;
    if (modeRef.current === "command") return;
    killRecognition();
    modeRef.current = "wake";
    setListening(false);
    setTranscript("");
    const rec = new Ctor();
    rec.lang = "de-DE";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript;
      if (WAKE_RE.test(text)) {
        killRecognition();
        void startCommandRef.current();
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") {
        wakeRef.current = false;
        setWakeEnabledState(false);
        setError("Mikrofonzugriff wurde abgelehnt.");
      }
    };
    rec.onend = () => {
      recRef.current = null;
      setWakeActive(false);
      if (wakeRef.current && !pausedRef.current && modeRef.current === "wake") {
        window.clearTimeout(restartRef.current);
        restartRef.current = window.setTimeout(() => startWakeRef.current(), 500);
      }
    };
    recRef.current = rec;
    try {
      rec.start();
      setWakeActive(true);
    } catch {
      /* a restart raced the previous session — the onend handler retries */
    }
  }, [killRecognition]);

  startWakeRef.current = startWake;
  startCommandRef.current = () => void startCommand();

  const setWakeEnabled = useCallback(
    (v: boolean) => {
      wakeRef.current = v;
      setWakeEnabledState(v);
      setError(null);
      if (v) {
        if (modeRef.current !== "command") startWake();
      } else {
        window.clearTimeout(restartRef.current);
        if (modeRef.current === "wake") {
          killRecognition();
          modeRef.current = "off";
          setWakeActive(false);
        }
      }
    },
    [killRecognition, startWake],
  );

  // NOVA must not hear herself: pause the wake listener while she speaks
  useEffect(() => {
    const paused = !!opts.wakePaused;
    pausedRef.current = paused;
    if (paused) {
      window.clearTimeout(restartRef.current);
      if (modeRef.current === "wake") {
        killRecognition();
        modeRef.current = "off";
        setWakeActive(false);
      }
    } else if (wakeRef.current && modeRef.current === "off") {
      window.clearTimeout(restartRef.current);
      restartRef.current = window.setTimeout(() => startWakeRef.current(), 400);
    }
  }, [opts.wakePaused, killRecognition]);

  useEffect(
    () => () => {
      wakeRef.current = false;
      window.clearTimeout(restartRef.current);
      killRecognition();
      stopAudio();
    },
    [killRecognition, stopAudio],
  );

  const toggle = useCallback(() => {
    if (modeRef.current === "command") goIdle();
    else void startCommand();
  }, [goIdle, startCommand]);

  return {
    supported,
    listening,
    wakeEnabled,
    wakeActive,
    transcript,
    error,
    toggle,
    stop: goIdle,
    setWakeEnabled,
    getLevel: () => levelRef.current,
  };
}
