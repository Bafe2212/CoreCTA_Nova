import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useMutation } from "@tanstack/react-query";
import { ArrowUp } from "lucide-react";
import Orb from "@/components/nova/Orb";
import NovaWindow from "@/components/nova/NovaWindow";
import type { DragInfo } from "@/components/nova/NovaWindow";
import AppContent from "@/components/nova/AppContent";
import CommandPalette from "@/components/nova/CommandPalette";
import { apiPost } from "@/lib/api";
import {
  APPS,
  ORB_LABELS,
  ORB_STATES,
  ORB_THEMES,
  isAppId,
  type AppId,
  type CommandResult,
  type OrbState,
} from "@/lib/nova";
import { DOCK_HEIGHT, useViewport, useWindowManager } from "@/hooks/useWindowManager";
import { useVoice } from "@/hooks/useVoice";
import { useSpeech } from "@/hooks/useSpeech";
import { useChatStream } from "@/hooks/useChatStream";
import { useProviders } from "@/hooks/useNovaData";

const ORB_SIZE = 340;
const DOCK_SCALE = 0.2;
/** spoken or typed commands that put NOVA back to sleep */
const SLEEP_RE = /^(beenden|beende|beenden bitte|schlafen|schlaf|standby|aus|ausschalten|schluss|stopp|stop|feierabend|gute nacht)[.!]?$/i;

export default function Home() {
  const viewport = useViewport();
  const wm = useWindowManager(viewport);

  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [prompt, setPrompt] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);
  const [phase, setPhase] = useState<"standby" | "active">(
    wm.windows.length > 0 ? "active" : "standby",
  );
  const [clock, setClock] = useState(() => new Date());
  const lastActivity = useRef(Date.now());
  const standbyRef = useRef<() => void>(() => undefined);
  const timers = useRef<number[]>([]);

  const docked = wm.windows.length > 0;

  const later = useCallback((fn: () => void, ms: number) => {
    const t = window.setTimeout(fn, ms);
    timers.current.push(t);
  }, []);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const speech = useSpeech(speechEnabled);

  const activate = useCallback(() => {
    lastActivity.current = Date.now();
    setPhase("active");
  }, []);

  // standby wall clock — only ticking while it is on screen
  useEffect(() => {
    if (phase !== "standby") return;
    setClock(new Date());
    const id = window.setInterval(() => setClock(new Date()), 15000);
    return () => window.clearInterval(id);
  }, [phase]);

  // which of the user's own providers answers — persisted, defaults from the server
  const providers = useProviders();
  const [provider, setProvider] = useState(
    () => window.localStorage.getItem("nova.provider") ?? "",
  );
  const [model, setModel] = useState(() => window.localStorage.getItem("nova.model") ?? "");

  useEffect(() => {
    const status = providers.data;
    if (!status) return;
    const known = status.providers.find((p) => p.id === provider && p.configured);
    if (!known) {
      const fallback =
        status.providers.find((p) => p.id === status.default_provider && p.configured) ??
        status.providers.find((p) => p.configured);
      if (fallback) {
        setProvider(fallback.id);
        setModel(fallback.models[0]);
      }
      return;
    }
    if (!known.models.includes(model)) setModel(known.models[0]);
  }, [providers.data, provider, model]);

  useEffect(() => {
    if (provider) window.localStorage.setItem("nova.provider", provider);
    if (model) window.localStorage.setItem("nova.model", model);
  }, [provider, model]);

  // zentraler Chat-Stream: NOVA kann antworten + vorlesen, ohne dass das
  // Chat-Fenster offen ist. Der Verlauf wird trotzdem in der DB gespeichert
  // und erscheint, sobald man das Fenster öffnet.
  const chatStream = useChatStream({
    provider,
    model,
    onStart: () => {
      setNotice(null);
      setOrbState("denken");
    },
    onFirstDelta: () => setOrbState("antworten"),
    onDone: (text) => {
      setOrbState("erfolg");
      later(() => setOrbState("idle"), 1600);
      speech.speak(text);
    },
    onError: (message) => {
      setOrbState("fehler");
      setNotice(message);
      later(() => setOrbState("idle"), 3200);
    },
  });

  const command = useMutation({
    mutationFn: (text: string) => apiPost<CommandResult>("/nova/command", { prompt: text }),
    onMutate: () => {
      setNotice(null);
      setOrbState("denken");
    },
    onSuccess: (result, prompt) => {
      const target: AppId = isAppId(result.open_window) ? result.open_window : "chat";
      if (target === "chat") {
        // Eine echte Frage — NOVA antwortet im Hintergrund und liest vor.
        // Das Chat-Fenster bleibt zu; der Verlauf wird trotzdem gespeichert
        // und erscheint, sobald man das Fenster öffnet.
        chatStream.send(prompt);
        return;
      }
      later(() => wm.open(target), 260);
      setOrbState("antworten");
      setNotice(result.reply);
      later(() => setOrbState("erfolg"), 1500);
      later(() => setOrbState("idle"), 2900);
      speech.speak(result.reply);
    },
    onError: () => {
      setOrbState("fehler");
      setNotice("Verbindung zu NOVA unterbrochen. Ich versuche es erneut.");
      later(() => setOrbState("idle"), 3200);
    },
  });

  const send = useCallback(
    (text: string) => {
      const value = text.trim();
      if (!value || command.isPending) return;
      // „beenden“ sends NOVA back to the clock instead of to the backend
      if (SLEEP_RE.test(value)) {
        standbyRef.current();
        return;
      }
      setPhase("active");
      command.mutate(value);
    },
    [command],
  );

  const voice = useVoice(send, { wakePaused: speech.speaking });
  const longPress = useRef(false);
  const pressTimer = useRef(0);

  // voice errors surface as NOVA's error state, then settle back to idle
  useEffect(() => {
    if (!voice.error) return;
    setNotice(voice.error);
    setOrbState("fehler");
    const t = window.setTimeout(() => setOrbState("idle"), 3200);
    return () => window.clearTimeout(t);
  }, [voice.error]);

  const displayState: OrbState = voice.listening
    ? "hoeren"
    : speech.speaking
      ? "antworten"
      : orbState;

  // NOVA wakes up whenever she starts listening (wake word included)
  useEffect(() => {
    if (voice.listening) activate();
  }, [voice.listening, activate]);

  // and slips back into standby after a long calm with nothing open
  useEffect(() => {
    const bump = () => {
      lastActivity.current = Date.now();
    };
    window.addEventListener("pointerdown", bump);
    window.addEventListener("keydown", bump);
    const id = window.setInterval(() => {
      if (
        phase === "active" &&
        wm.windows.length === 0 &&
        !voice.listening &&
        !speech.speaking &&
        Date.now() - lastActivity.current > 90000
      ) {
        setPhase("standby");
      }
    }, 5000);
    return () => {
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
      window.clearInterval(id);
    };
  }, [phase, wm.windows.length, voice.listening, speech.speaking]);

  const toStandby = useCallback(() => {
    voice.stop();
    speech.stop();
    chatStream.stop();
    wm.closeAll();
    setMenuOpen(false);
    setNotice(null);
    setPhase("standby");
  }, [speech, voice, chatStream, wm]);

  standbyRef.current = toStandby;

  const openMenu = useCallback(() => {
    longPress.current = true;
    setMenuOpen((v) => !v);
  }, []);

  const onOrbPressStart = useCallback(() => {
    longPress.current = false;
    pressTimer.current = window.setTimeout(openMenu, 450);
  }, [openMenu]);

  const onOrbPressEnd = useCallback(() => {
    window.clearTimeout(pressTimer.current);
  }, []);

  const onOrbClick = useCallback(() => {
    if (longPress.current) {
      longPress.current = false;
      return;
    }
    if (phase === "standby") {
      activate();
      return;
    }
    if (!voice.supported) {
      setNotice("Dieser Browser kann nicht zuhören — tippe deinen Befehl ein.");
      setMenuOpen((v) => !v);
      return;
    }
    setMenuOpen(false);
    setNotice(null);
    speech.stop();
    voice.toggle();
  }, [voice, speech, phase, activate]);

  // ⌘K / Ctrl+K palette, Esc closes palette → menu → topmost window
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === "standby") {
        if (e.key !== "Escape" && !e.metaKey && !e.ctrlKey && !e.altKey) activate();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        if (paletteOpen) setPaletteOpen(false);
        else if (voice.listening) voice.stop();
        else if (speech.speaking) speech.stop();
        else if (menuOpen) setMenuOpen(false);
        else if (wm.activeId) wm.close(wm.activeId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, menuOpen, wm, voice, speech, phase, activate]);

  const theme = ORB_THEMES[displayState];
  const orbY = docked ? viewport.h - 100 - ORB_SIZE / 2 : viewport.h * 0.42 - ORB_SIZE / 2;

  return (
    <main
      className="relative h-screen w-screen overflow-hidden bg-[#03070d] select-none"
      data-testid="nova-desktop"
    >
      {/* faint HUD dot grid — appears when NOVA is awake */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: [
            "linear-gradient(rgba(125,205,225,0.075) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(125,205,225,0.075) 1px, transparent 1px)",
            "radial-gradient(rgba(148,197,214,0.16) 1px, transparent 1px)",
          ].join(","),
          backgroundSize: "58px 58px, 58px 58px, 29px 29px",
          maskImage: "radial-gradient(80% 75% at 50% 50%, black, transparent 100%)",
          WebkitMaskImage: "radial-gradient(80% 75% at 50% 50%, black, transparent 100%)",
        }}
        animate={{ opacity: phase === "active" ? 0.85 : 0 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        data-testid="hud-grid"
        data-hud-visible={phase === "active"}
      />

      {/* corner brackets */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={{ opacity: phase === "active" ? 1 : 0 }}
        transition={{ duration: 1.1, delay: phase === "active" ? 0.25 : 0 }}
      >
        {[
          "top-4 left-4 border-t border-l",
          "top-4 right-4 border-t border-r",
          "bottom-4 left-4 border-b border-l",
          "bottom-4 right-4 border-b border-r",
        ].map((pos) => (
          <span
            key={pos}
            className={`absolute size-7 border-cyan-300/20 ${pos}`}
            aria-hidden="true"
          />
        ))}
      </motion.div>

      {/* ambient light — the only background ornament */}
      <div
        className="pointer-events-none absolute inset-0 animate-[nova-drift_26s_ease-in-out_infinite]"
        style={{
          background: `radial-gradient(60% 45% at 50% ${docked ? "88%" : "42%"}, ${theme.glow}, transparent 70%)`,
          opacity: 0.5,
          transition: "background 1200ms ease",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* system status — deliberately faint */}
      <motion.div
        className="pointer-events-none absolute top-6 left-7 flex items-center gap-2.5"
        animate={{ opacity: phase === "active" ? 1 : 0 }}
        transition={{ duration: 0.8, delay: phase === "active" ? 0.3 : 0 }}
      >
        <span
          className="size-1.5 rounded-full transition-colors duration-700"
          style={{ background: theme.primary, boxShadow: `0 0 10px ${theme.primary}` }}
        />
        <span
          className="font-mono text-[10.5px] tracking-[0.22em] text-muted-foreground/70 uppercase"
          data-testid="nova-state-indicator"
        >
          {ORB_LABELS[displayState]}
        </span>
        {voice.wakeActive && (
          <span
            className="font-mono text-[10px] tracking-[0.22em] text-cyan-300/55 uppercase"
            data-testid="wake-indicator"
          >
            · Hey NOVA
          </span>
        )}
      </motion.div>
      <motion.span
        className="pointer-events-none absolute top-6 right-7 font-mono text-[10.5px] tracking-[0.2em] text-muted-foreground/45 uppercase"
        animate={{ opacity: phase === "active" ? 1 : 0 }}
        transition={{ duration: 0.8, delay: phase === "active" ? 0.3 : 0 }}
      >
        ⌘K
      </motion.span>

      {/* windows */}
      <AnimatePresence>
        {wm.windows
          .filter((w) => !w.minimized)
          .map((w) => (
            <NovaWindow
              key={w.id}
              win={w}
              active={wm.activeId === w.id}
              viewport={viewport}
              onFocus={() => wm.focus(w.id)}
              onClose={() => wm.close(w.id)}
              onMinimize={() => wm.minimize(w.id)}
              onToggleMaximize={() => wm.toggleMaximize(w.id)}
              onRect={(r) => wm.setRect(w.id, r)}
              onDragState={setDragInfo}
            >
              <AppContent
                id={w.id}
                orbState={orbState}
                setOrbState={setOrbState}
                llm={{ provider, model, setProvider, setModel }}
                speech={{
                  supported: speech.supported,
                  enabled: speechEnabled,
                  speaking: speech.speaking,
                  elevenlabs: speech.elevenlabs,
                  voiceId: speech.voiceId,
                  setVoiceId: speech.setVoiceId,
                  setEnabled: (v: boolean) => {
                    setSpeechEnabled(v);
                    if (!v) speech.stop();
                  },
                  test: () =>
                    speech.speak("Ich bin NOVA. Ich lese dir deine Antworten ruhig vor."),
                }}
                voice={{
                  supported: voice.supported,
                  wakeEnabled: voice.wakeEnabled,
                  wakeActive: voice.wakeActive,
                  setWakeEnabled: voice.setWakeEnabled,
                }}
                session={{
                  openCount: wm.windows.length,
                  reset: wm.resetSession,
                }}
                chat={{
                  provider,
                  model,
                  streaming: chatStream.streaming,
                  pending: chatStream.pending,
                  partial: chatStream.partial,
                  error: chatStream.error,
                  send: chatStream.send,
                  stop: chatStream.stop,
                }}
              />
            </NovaWindow>
          ))}
      </AnimatePresence>

      {/* snap guides + half-screen preview while dragging */}
      {dragInfo && (
        <div className="pointer-events-none absolute inset-0 z-[185]" data-testid="snap-overlay">
          {dragInfo.snap && (
            <div
              className="absolute rounded-xl border border-cyan-400/25 bg-cyan-400/[0.04]"
              style={{
                left: dragInfo.x,
                top: dragInfo.y,
                width: dragInfo.w,
                height: dragInfo.h,
                boxShadow: "0 0 40px -12px rgba(34,211,238,0.35)",
                transition: "left 120ms ease, top 120ms ease, width 120ms ease, height 120ms ease",
              }}
              data-testid={`snap-preview-${dragInfo.snap}`}
            />
          )}
          {dragInfo.guideX !== null && (
            <div
              className="absolute top-0 bottom-0 w-px"
              style={{
                left: dragInfo.guideX,
                background:
                  "linear-gradient(to bottom, transparent, rgba(34,211,238,0.28) 18%, rgba(34,211,238,0.28) 82%, transparent)",
              }}
              data-testid="snap-guide-vertical"
            />
          )}
          {dragInfo.guideY !== null && (
            <div
              className="absolute right-0 left-0 h-px"
              style={{
                top: dragInfo.guideY,
                background:
                  "linear-gradient(to right, transparent, rgba(34,211,238,0.28) 18%, rgba(34,211,238,0.28) 82%, transparent)",
              }}
              data-testid="snap-guide-horizontal"
            />
          )}
        </div>
      )}

      {/* standby: just the dimmed sphere, the time and a whisper of a hint */}
      <AnimatePresence>
        {phase === "standby" && (
          <motion.div
            key="standby"
            className="pointer-events-none absolute inset-x-0 z-[120] flex flex-col items-center"
            style={{ top: viewport.h * 0.42 + ORB_SIZE / 2 + 26 }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14, filter: "blur(6px)", transition: { duration: 0.5 } }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            data-testid="standby-screen"
          >
            <p
              className="font-heading text-[64px] leading-none font-light tracking-[0.02em] text-white/85"
              style={{ textShadow: "0 0 40px rgba(34,211,238,0.18)" }}
              data-testid="standby-clock"
            >
              {clock.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p
              className="mt-3 font-mono text-[11px] tracking-[0.3em] text-muted-foreground/55 uppercase"
              data-testid="standby-date"
            >
              {clock.toLocaleDateString("de-DE", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            <p
              className="mt-12 font-mono text-[10px] tracking-[0.26em] text-muted-foreground/35 uppercase"
              data-testid="standby-hint"
            >
              {voice.wakeEnabled ? "Sag „Hey NOVA“" : "Orb antippen, um NOVA zu wecken"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* centre stage — only while nothing is open */}
      <AnimatePresence>
        {!docked && phase === "active" && (
          <motion.div
            key="stage"
            className="absolute inset-x-0 z-[120] flex flex-col items-center"
            style={{ top: viewport.h * 0.42 + ORB_SIZE / 2 + 16 }}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10, transition: { duration: 0.22 } }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          >
            <p
              className="font-heading text-[15px] font-light tracking-[0.06em] text-foreground/45"
              data-testid="nova-greeting"
            >
              Wie kann ich dir helfen?
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(prompt);
                setPrompt("");
              }}
              className="group mt-9 w-[min(520px,84vw)]"
            >
              <div className="relative flex items-center border-b border-white/[0.06] pb-2.5 transition-colors duration-500 group-hover:border-white/[0.14] focus-within:border-cyan-400/40">
                <input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Sag NOVA, was du brauchst"
                  data-testid="nova-command-input"
                  className="w-full bg-transparent px-9 text-center text-[14px] text-foreground/90 opacity-60 outline-none transition-opacity duration-500 group-hover:opacity-100 placeholder:text-muted-foreground/45 focus:opacity-100"
                />
                <button
                  type="submit"
                  aria-label="Befehl senden"
                  data-testid="nova-command-submit"
                  className="absolute right-0 bottom-2.5 grid size-7 place-items-center rounded-full text-muted-foreground/50 opacity-0 transition-all duration-300 group-hover:opacity-100 hover:text-cyan-200 focus:opacity-100"
                >
                  <ArrowUp className="size-3.5" />
                </button>
              </div>
            </form>
            <AnimatePresence>
              {!voice.listening && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-7 font-mono text-[10px] tracking-[0.24em] text-muted-foreground/40 uppercase"
                  data-testid="nova-voice-hint"
                >
                  {voice.wakeEnabled ? "Sag „Hey NOVA“ oder tippe den Orb an" : "Orb antippen, um zu sprechen"}
                </motion.p>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {notice && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-6 max-w-[440px] text-center font-mono text-[11px] leading-relaxed text-muted-foreground/70"
                  data-testid="nova-notice"
                >
                  {notice}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* the orb — permanent anchor, transform-only between centre and dock */}
      <motion.button
        type="button"
        aria-label={voice.listening ? "Zuhören beenden" : "NOVA zuhören lassen"}
        data-testid="nova-orb"
        data-orb-mode={docked ? "dock" : "center"}
        data-orb-phase={phase}
        data-listening={voice.listening}
        onClick={onOrbClick}
        onPointerDown={onOrbPressStart}
        onPointerUp={onOrbPressEnd}
        onPointerCancel={onOrbPressEnd}
        onContextMenu={(e) => {
          e.preventDefault();
          openMenu();
        }}
        className="absolute top-0 left-1/2 z-[200] cursor-pointer rounded-full outline-none"
        style={{ width: ORB_SIZE, height: ORB_SIZE }}
        animate={{ x: -ORB_SIZE / 2, y: orbY, scale: docked ? DOCK_SCALE : 1 }}
        transition={{ type: "spring", stiffness: 190, damping: 24, mass: 0.9 }}
      >
        <Orb
          state={displayState}
          size={ORB_SIZE}
          label={!docked}
          getLevel={voice.getLevel}
          variant={phase}
        />
      </motion.button>

      {/* live transcript while NOVA listens */}
      <AnimatePresence>
        {voice.listening && (
          <motion.div
            className="pointer-events-none absolute inset-x-0 z-[210] flex flex-col items-center gap-2 px-6"
            style={{
              top: docked ? undefined : viewport.h * 0.42 + ORB_SIZE / 2 + 178,
              bottom: docked ? DOCK_HEIGHT + 18 : undefined,
            }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.25 }}
            data-testid="voice-listening-panel"
          >
            <span className="font-mono text-[10.5px] tracking-[0.28em] text-cyan-200/70 uppercase">
              Ich höre zu …
            </span>
            {voice.transcript && (
              <p
                className="max-w-[520px] text-center text-[14px] text-foreground/85"
                data-testid="voice-transcript"
              >
                {voice.transcript}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* orb menu: manual state control + quick actions */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="absolute left-1/2 z-[260] w-[min(420px,88vw)] -translate-x-1/2 rounded-xl border border-white/[0.07] bg-[#050b13]/92 p-4 backdrop-blur-xl"
            style={{ bottom: docked ? DOCK_HEIGHT + 24 : undefined, top: docked ? undefined : viewport.h * 0.42 + ORB_SIZE / 2 + 175 }}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            data-testid="orb-menu"
          >
            <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground/60 uppercase">
              Zustand
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ORB_STATES.map((s) => (
                <button
                  key={s}
                  type="button"
                  data-testid={`orb-state-${s}`}
                  onClick={() => setOrbState(s)}
                  className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11.5px] transition-colors duration-300"
                  style={{
                    borderColor:
                      orbState === s ? ORB_THEMES[s].primary : "rgba(148,163,184,0.14)",
                    color: orbState === s ? ORB_THEMES[s].primary : "rgba(148,163,184,0.75)",
                  }}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ background: ORB_THEMES[s].primary }}
                  />
                  {ORB_LABELS[s]}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-4 border-t border-white/[0.05] pt-3">
              {speech.speaking && (
                <button
                  type="button"
                  data-testid="orb-menu-stop-speech"
                  onClick={() => {
                    speech.stop();
                    setMenuOpen(false);
                  }}
                  className="font-mono text-[11px] text-muted-foreground/70 transition-colors duration-200 hover:text-foreground"
                >
                  Vorlesen beenden
                </button>
              )}
              <button
                type="button"
                data-testid="orb-menu-standby"
                onClick={toStandby}
                className="font-mono text-[11px] text-muted-foreground/70 transition-colors duration-200 hover:text-foreground"
              >
                Standby
              </button>
              <button
                type="button"
                data-testid="orb-menu-wake"
                onClick={() => voice.setWakeEnabled(!voice.wakeEnabled)}
                className="font-mono text-[11px] transition-colors duration-200"
                style={{ color: voice.wakeEnabled ? "#67e8f9" : "rgba(148,163,184,0.7)" }}
              >
                {voice.wakeEnabled ? "Weckwort aus" : "„Hey NOVA“ aktivieren"}
              </button>
              <button
                type="button"
                data-testid="orb-menu-listen"                onClick={() => {
                  setMenuOpen(false);
                  if (voice.supported) voice.toggle();
                  else setNotice("Dieser Browser kann nicht zuhören — tippe deinen Befehl ein.");
                }}
                className="font-mono text-[11px] text-cyan-200/75 transition-colors duration-200 hover:text-cyan-100"
              >
                {voice.listening ? "Zuhören beenden" : "Zuhören starten"}
              </button>
              <button
                type="button"
                data-testid="orb-menu-palette"
                onClick={() => {
                  setMenuOpen(false);
                  setPaletteOpen(true);
                }}
                className="font-mono text-[11px] text-cyan-200/75 transition-colors duration-200 hover:text-cyan-100"
              >
                Neuer Befehl (⌘K)
              </button>
              {docked && (
                <button
                  type="button"
                  data-testid="orb-menu-focus-nova"
                  onClick={() => {
                    wm.closeAll();
                    setMenuOpen(false);
                  }}
                  className="font-mono text-[11px] text-muted-foreground/70 transition-colors duration-200 hover:text-foreground"
                >
                  NOVA in den Vordergrund
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* dock — only once NOVA has opened something */}
      <AnimatePresence>
        {docked && (
          <motion.div
            className="absolute inset-x-0 bottom-0 z-[180] flex h-[46px] items-center justify-center gap-1.5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            data-testid="nova-dock"
          >
            {APPS.map((app) => {
              const win = wm.windows.find((w) => w.id === app.id);
              return (
                <button
                  key={app.id}
                  type="button"
                  aria-label={`${app.title} öffnen`}
                  data-testid={`dock-app-${app.id}`}
                  onClick={() => wm.open(app.id)}
                  className="group relative grid size-8 place-items-center rounded-lg transition-colors duration-200 hover:bg-white/[0.05]"
                >
                  <app.icon
                    className="size-3.5 transition-colors duration-200"
                    style={{ color: win ? "rgba(103,232,249,0.85)" : "rgba(148,163,184,0.5)" }}
                  />
                  {win && (
                    <span
                      className="absolute -bottom-0.5 size-[3px] rounded-full"
                      style={{ background: win.minimized ? "rgba(148,163,184,0.6)" : "#22d3ee" }}
                    />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={(id) => wm.open(id)}
      />
    </main>
  );
}
