import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp } from "lucide-react";
import Orb from "@/components/nova/Orb";
import NovaWindow from "@/components/nova/NovaWindow";
import AppContent from "@/components/nova/AppContent";
import CommandPalette from "@/components/nova/CommandPalette";
import { apiGet, apiPost } from "@/lib/api";
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

const ORB_SIZE = 240;
const DOCK_SCALE = 0.28;

export default function Home() {
  const viewport = useViewport();
  const wm = useWindowManager(viewport);
  const queryClient = useQueryClient();

  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [prompt, setPrompt] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  const docked = wm.windows.length > 0;

  const later = useCallback((fn: () => void, ms: number) => {
    const t = window.setTimeout(fn, ms);
    timers.current.push(t);
  }, []);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const history = useQuery({
    queryKey: ["nova", "history"],
    queryFn: () => apiGet<CommandResult[]>("/nova/history"),
  });

  const command = useMutation({
    mutationFn: (text: string) => apiPost<CommandResult>("/nova/command", { prompt: text }),
    onMutate: () => {
      setNotice(null);
      setOrbState("denken");
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["nova", "history"] });
      setOrbState("antworten");
      setNotice(result.reply);
      const target: AppId = isAppId(result.open_window) ? result.open_window : "chat";
      later(() => wm.open(target), 260);
      later(() => setOrbState("erfolg"), 1500);
      later(() => setOrbState("idle"), 2900);
    },
    onError: () => {
      setOrbState("fehler");
      setNotice("Verbindung zu NOVA unterbrochen. Ich versuche es erneut.");
      later(() => setOrbState("idle"), 3200);
    },
  });

  const send = useCallback(
    (text: string) => {
      if (!text.trim() || command.isPending) return;
      command.mutate(text.trim());
    },
    [command],
  );

  // ⌘K / Ctrl+K palette, Esc closes palette → menu → topmost window
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        if (paletteOpen) setPaletteOpen(false);
        else if (menuOpen) setMenuOpen(false);
        else if (wm.activeId) wm.close(wm.activeId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, menuOpen, wm]);

  const theme = ORB_THEMES[orbState];
  const orbY = docked ? viewport.h - 100 - ORB_SIZE / 2 : viewport.h * 0.42 - ORB_SIZE / 2;

  return (
    <main
      className="relative h-screen w-screen overflow-hidden bg-[#03070d] select-none"
      data-testid="nova-desktop"
    >
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
      <div className="pointer-events-none absolute top-6 left-7 flex items-center gap-2.5">
        <span
          className="size-1.5 rounded-full transition-colors duration-700"
          style={{ background: theme.primary, boxShadow: `0 0 10px ${theme.primary}` }}
        />
        <span
          className="font-mono text-[10.5px] tracking-[0.22em] text-muted-foreground/70 uppercase"
          data-testid="nova-state-indicator"
        >
          {ORB_LABELS[orbState]}
        </span>
      </div>
      <span className="pointer-events-none absolute top-6 right-7 font-mono text-[10.5px] tracking-[0.2em] text-muted-foreground/45 uppercase">
        ⌘K
      </span>

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
            >
              <AppContent
                id={w.id}
                orbState={orbState}
                setOrbState={setOrbState}
                chat={{
                  history: history.data ?? [],
                  pending: command.isPending,
                  send,
                }}
              />
            </NovaWindow>
          ))}
      </AnimatePresence>

      {/* centre stage — only while nothing is open */}
      <AnimatePresence>
        {!docked && (
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
              <div className="flex items-center gap-3 border-b border-white/[0.06] pb-2.5 transition-colors duration-500 group-hover:border-white/[0.14] focus-within:border-cyan-400/40">
                <input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Sag NOVA, was du brauchst"
                  data-testid="nova-command-input"
                  className="w-full bg-transparent text-center text-[14px] text-foreground/90 opacity-60 outline-none transition-opacity duration-500 group-hover:opacity-100 placeholder:text-muted-foreground/45 focus:opacity-100"
                />
                <button
                  type="submit"
                  aria-label="Befehl senden"
                  data-testid="nova-command-submit"
                  className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground/50 opacity-0 transition-all duration-300 group-hover:opacity-100 hover:text-cyan-200 focus:opacity-100"
                >
                  <ArrowUp className="size-3.5" />
                </button>
              </div>
            </form>
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
        aria-label="NOVA-Orb"
        data-testid="nova-orb"
        data-orb-mode={docked ? "dock" : "center"}
        onClick={() => setMenuOpen((v) => !v)}
        className="absolute top-0 left-1/2 z-[200] cursor-pointer rounded-full outline-none"
        style={{ width: ORB_SIZE, height: ORB_SIZE }}
        animate={{ x: -ORB_SIZE / 2, y: orbY, scale: docked ? DOCK_SCALE : 1 }}
        transition={{ type: "spring", stiffness: 190, damping: 24, mass: 0.9 }}
      >
        <Orb state={orbState} size={ORB_SIZE} label={!docked} />
      </motion.button>

      {/* orb menu: manual state control + quick actions */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="absolute left-1/2 z-[260] w-[min(420px,88vw)] -translate-x-1/2 rounded-xl border border-white/[0.07] bg-[#050b13]/92 p-4 backdrop-blur-xl"
            style={{ bottom: docked ? DOCK_HEIGHT + 24 : undefined, top: docked ? undefined : viewport.h * 0.42 + ORB_SIZE / 2 + 130 }}
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
