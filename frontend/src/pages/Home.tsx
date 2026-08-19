import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useMutation } from "@tanstack/react-query";
import { ArrowUp } from "lucide-react";
import Orb from "@/components/nova/Orb";
import AppContent from "@/components/nova/AppContent";
import CommandPalette from "@/components/nova/CommandPalette";
import HudBackground from "@/components/nova/HudBackground";
import BootSequence from "@/components/nova/BootSequence";
import HudDock from "@/components/nova/HudDock";
import ChatPanel from "@/components/nova/ChatPanel";
import MusicWidget from "@/components/nova/MusicWidget";
import DeskView from "@/components/nova/DeskView";
import HudAppPanel from "@/components/nova/HudAppPanel";
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
import { useViewport, useWindowManager } from "@/hooks/useWindowManager";
import { useVoice } from "@/hooks/useVoice";
import { useSpeech } from "@/hooks/useSpeech";
import { useChatStream } from "@/hooks/useChatStream";
import { useProviders } from "@/hooks/useNovaData";

const ORB_SIZE = 420;
/** spoken or typed commands that put NOVA back to sleep */
const SLEEP_RE = /^(beenden|beende|beenden bitte|schlafen|schlaf|standby|aus|ausschalten|schluss|stopp|stop|feierabend|gute nacht)[.!]?$/i;
/** Sprachbefehle für die neuen HUD-Widgets */
const MUSIC_RE = /^(zeige|zeig|öffne|öffne|starte)?\s*(die\s*)?(music|musik)(\s*widget)?(\s*an)?$/i;
const DESK_RE = /^(zeige|zeig|öffne|öffne|starte)?\s*(die\s*)?(desk|tisch|kamera|camera)(\s*view)?(\s*ansicht)?(\s*an)?$/i;
const CHAT_RE = /^(zeige|zeig|öffne|öffne|starte)?\s*(den|die)?\s*(chat)(\s*panel)?(\s*an)?$/i;

export default function Home() {
  const viewport = useViewport();
  const wm = useWindowManager(viewport);

  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [prompt, setPrompt] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [phase, setPhase] = useState<"standby" | "active">("standby");
  const [clock, setClock] = useState(() => new Date());
  const lastActivity = useRef(Date.now());
  const standbyRef = useRef<() => void>(() => undefined);
  const timers = useRef<number[]>([]);

  // JARVIS HUD: schwebende Panels / Widgets
  const [booted, setBooted] = useState(false);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [deskOpen, setDeskOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // generische App-Panels (Files, Memory, Schule, Notizen, Browser)
  const [appPanel, setAppPanel] = useState<AppId | null>(null);

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
        // Das Chat-Panel bleibt zu; der Verlauf wird trotzdem gespeichert
        // und erscheint, sobald man das Panel öffnet.
        chatStream.send(prompt);
        return;
      }
      // JARVIS HUD: App wird als schwebendes Panel geöffnet
      later(() => {
        if (target === "einstellungen") setSettingsOpen(true);
        else setAppPanel(target);
      }, 260);
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
      // JARVIS HUD: Sprachbefehle für Widgets
      if (MUSIC_RE.test(value)) {
        setMusicOpen((v) => !v);
        setOrbState("erfolg");
        later(() => setOrbState("idle"), 1200);
        return;
      }
      if (DESK_RE.test(value)) {
        setDeskOpen((v) => !v);
        setOrbState("erfolg");
        later(() => setOrbState("idle"), 1200);
        return;
      }
      if (CHAT_RE.test(value)) {
        setChatPanelOpen((v) => !v);
        setOrbState("erfolg");
        later(() => setOrbState("idle"), 1200);
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
  const anyPanelOpen =
    chatPanelOpen || musicOpen || deskOpen || settingsOpen || appPanel !== null;
  useEffect(() => {
    const bump = () => {
      lastActivity.current = Date.now();
    };
    window.addEventListener("pointerdown", bump);
    window.addEventListener("keydown", bump);
    const id = window.setInterval(() => {
      if (
        phase === "active" &&
        !anyPanelOpen &&
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
  }, [phase, anyPanelOpen, voice.listening, speech.speaking]);

  const toStandby = useCallback(() => {
    voice.stop();
    speech.stop();
    chatStream.stop();
    wm.closeAll();
    setMenuOpen(false);
    setNotice(null);
    setChatPanelOpen(false);
    setMusicOpen(false);
    setDeskOpen(false);
    setSettingsOpen(false);
    setAppPanel(null);
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

  // ⌘K / Ctrl+K palette, Esc closes palette → menu → panels
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
        // JARVIS HUD: Panels schließen
        else if (deskOpen) setDeskOpen(false);
        else if (musicOpen) setMusicOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        else if (appPanel) setAppPanel(null);
        else if (chatPanelOpen) setChatPanelOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    paletteOpen,
    menuOpen,
    voice,
    speech,
    phase,
    activate,
    deskOpen,
    musicOpen,
    settingsOpen,
    appPanel,
    chatPanelOpen,
  ]);

  const theme = ORB_THEMES[displayState];
  // JARVIS: der zentrale Kreis bleibt IMMER in der Bildschirmmitte sichtbar
  const orbY = viewport.h * 0.5 - ORB_SIZE / 2;

  return (
    <main
      className="relative h-screen w-screen overflow-hidden bg-[#02060c] select-none"
      data-testid="nova-desktop"
    >
      {/* Boot-Sequence einmal beim App-Start */}
      {booted ? null : <BootSequence onDone={() => setBooted(true)} />}

      {/* JARVIS HUD Hintergrund: Grid, Partikel, Scan-Linie, Vignette */}
      <HudBackground active={phase === "active"} />

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
          background: `radial-gradient(60% 45% at 50% 50%, ${theme.glow}, transparent 70%)`,
          opacity: 0.5,
          transition: "background 1200ms ease",
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

      {/* === JARVIS HUD: schwebende Panels === */}

      {/* Chat-Panel links (floating, halbtransparent) */}
      <ChatPanel
        open={chatPanelOpen}
        onClose={() => setChatPanelOpen(false)}
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

      {/* Music-Widget rechts (floating, halbtransparent) */}
      <MusicWidget open={musicOpen} onClose={() => setMusicOpen(false)} />

      {/* Desk-View Overlay (Kamerabild über dem Grid) */}
      <DeskView open={deskOpen} onClose={() => setDeskOpen(false)} />

      {/* Settings-Panel rechts (optional, wie im Video) */}
      <HudAppPanel
        open={settingsOpen}
        title="Einstellungen"
        onClose={() => setSettingsOpen(false)}
      >
        <AppContent
          id="einstellungen"
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
          session={{ openCount: wm.windows.length, reset: wm.resetSession }}
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
      </HudAppPanel>

      {/* Generische App-Panels (Files, Memory, Schule, Notizen, Browser) */}
      <HudAppPanel
        open={appPanel !== null}
        title={appPanel ? APPS.find((a) => a.id === appPanel)?.title ?? "App" : "App"}
        onClose={() => setAppPanel(null)}
      >
        {appPanel && (
          <AppContent
            id={appPanel}
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
            session={{ openCount: wm.windows.length, reset: wm.resetSession }}
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
        )}
      </HudAppPanel>

      {/* standby: just the dimmed sphere, the time and a whisper of a hint */}
      <AnimatePresence>
        {phase === "standby" && (
          <motion.div
            key="standby"
            className="pointer-events-none absolute inset-x-0 z-[120] flex flex-col items-center"
            style={{ top: viewport.h * 0.5 + ORB_SIZE / 2 + 26 }}
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

      {/* centre stage — Befehls-Eingabe unter dem zentralen Kreis */}
      <AnimatePresence>
        {phase === "active" && (
          <motion.div
            key="stage"
            className="absolute inset-x-0 z-[120] flex flex-col items-center"
            style={{ top: viewport.h * 0.5 + ORB_SIZE / 2 + 16 }}
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

      {/* the orb — JARVIS: IMMER zentral in der Bildschirmmitte, bleibt sichtbar */}
      <motion.button
        type="button"
        aria-label={voice.listening ? "Zuhören beenden" : "NOVA zuhören lassen"}
        data-testid="nova-orb"
        data-orb-mode="center"
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
        animate={{
          x: -ORB_SIZE / 2,
          y: orbY,
          // beim Aktivieren (Sprache/Klick) wird der Kreis größer und leuchtet stärker
          scale: voice.listening || speech.speaking ? 1.08 : 1,
        }}
        transition={{ type: "spring", stiffness: 190, damping: 24, mass: 0.9 }}
      >
        <Orb
          state={displayState}
          size={ORB_SIZE}
          label
          getLevel={voice.getLevel}
          variant={phase}
        />
      </motion.button>

      {/* live transcript while NOVA listens */}
      <AnimatePresence>
        {voice.listening && (
          <motion.div
            className="pointer-events-none absolute inset-x-0 z-[210] flex flex-col items-center gap-2 px-6"
            style={{ top: viewport.h * 0.5 + ORB_SIZE / 2 + 24 }}
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
            className="absolute left-1/2 z-[260] w-[min(420px,88vw)] -translate-x-1/2 rounded-xl border border-cyan-400/20 bg-[#050b13]/92 p-4 backdrop-blur-xl"
            style={{ top: viewport.h * 0.5 + ORB_SIZE / 2 + 24 }}
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === JARVIS HUD-Dock: untere Icon-Leiste (immer sichtbar wenn aktiv) === */}
      {phase === "active" && (
        <HudDock
          chatOpen={chatPanelOpen}
          musicOpen={musicOpen}
          deskOpen={deskOpen}
          settingsOpen={settingsOpen}
          listening={voice.listening}
          speaking={speech.speaking}
          voiceSupported={voice.supported}
          speechEnabled={speechEnabled}
          apps={APPS.filter((a) => a.id !== "chat" && a.id !== "einstellungen").map((app) => ({
            id: app.id,
            label: app.title,
            icon: app.icon,
            active: appPanel === app.id,
            onClick: () => setAppPanel((cur) => (cur === app.id ? null : app.id)),
          }))}
          onToggleChat={() => setChatPanelOpen((v) => !v)}
          onToggleMusic={() => setMusicOpen((v) => !v)}
          onToggleDesk={() => setDeskOpen((v) => !v)}
          onToggleSettings={() => setSettingsOpen((v) => !v)}
          onToggleVoice={() => {
            if (voice.supported) voice.toggle();
            else setNotice("Dieser Browser kann nicht zuhören — tippe deinen Befehl ein.");
          }}
          onToggleSpeech={() => {
            setSpeechEnabled((v) => {
              if (!v) speech.stop();
              return !v;
            });
          }}
        />
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={(id) => {
          if (id === "chat") setChatPanelOpen(true);
          else if (id === "einstellungen") setSettingsOpen(true);
          else setAppPanel(id);
        }}
      />
    </main>
  );
}
