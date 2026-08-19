import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Pause, Play, SkipBack, SkipForward, X } from "lucide-react";

/**
 * JARVIS Music-Widget:
 *  - schwebend, halbtransparent, futuristisch
 *  - Albumcover, Songtitel, Künstler, Fortschrittsbalken
 *  - Abspielen/Pausieren/Skip im HUD-Stil
 *
 * Wird über Sprachbefehl oder Button eingeblendet.
 * Da kein echter Musik-Player angebunden ist, läuft ein Mock-Track
 * mit simuliertem Fortschritt — kann später an Spotify/MP3 angebunden werden.
 */
export interface Track {
  title: string;
  artist: string;
  cover: string;
  duration: number; // Sekunden
}

const MOCK_TRACKS: Track[] = [
  {
    title: "Neon Horizon",
    artist: "Synthwave Collective",
    cover: "https://placehold.co/120x120/0a0f1a/22d3ee?text=NH",
    duration: 214,
  },
  {
    title: "Arcade Dreams",
    artist: "Retro Pulse",
    cover: "https://placehold.co/120x120/0a0f1a/8b5cf6?text=AD",
    duration: 188,
  },
  {
    title: "Holographic Sky",
    artist: "Cyber Orchestra",
    cover: "https://placehold.co/120x120/0a0f1a/67e8f9?text=HS",
    duration: 246,
  },
];

export default function MusicWidget({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [trackIdx, setTrackIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef(0);
  const lastRef = useRef(0);

  const track = MOCK_TRACKS[trackIdx];

  // Fortschritt simulieren, wenn play
  useEffect(() => {
    if (!playing) return;
    lastRef.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      setProgress((p) => {
        const next = p + dt;
        if (next >= track.duration) {
          // auto-skip
          setTrackIdx((i) => (i + 1) % MOCK_TRACKS.length);
          return 0;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, track.duration]);

  const skip = (dir: number) => {
    setTrackIdx((i) => (i + dir + MOCK_TRACKS.length) % MOCK_TRACKS.length);
    setProgress(0);
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  const pct = (progress / track.duration) * 100;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute z-[230] w-[300px]"
          style={{ right: 32, top: "22%" }}
          initial={{ opacity: 0, x: 40, scale: 0.92, filter: "blur(8px)" }}
          animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0)" }}
          exit={{ opacity: 0, x: 40, scale: 0.92, filter: "blur(8px)" }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          data-testid="music-widget"
        >
          <div
            className="relative overflow-hidden rounded-2xl border border-cyan-400/25 bg-[#050b13]/70 p-4 backdrop-blur-xl"
            style={{
              boxShadow:
                "0 0 30px -8px rgba(34,211,238,0.35), inset 0 0 24px rgba(34,211,238,0.06)",
            }}
          >
            {/* Eck-Klammern */}
            {[
              "top-1.5 left-1.5 border-t border-l",
              "top-1.5 right-1.5 border-t border-r",
              "bottom-1.5 left-1.5 border-b border-l",
              "bottom-1.5 right-1.5 border-b border-r",
            ].map((p) => (
              <span
                key={p}
                className={`absolute size-2.5 border-cyan-300/40 ${p}`}
                aria-hidden="true"
              />
            ))}

            {/* Header */}
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[9.5px] tracking-[0.28em] text-cyan-300/70 uppercase">
                ♪ Now Playing
              </span>
              <button
                type="button"
                aria-label="Music widget schließen"
                data-testid="music-close"
                onClick={onClose}
                className="grid size-6 place-items-center rounded text-cyan-300/60 transition-colors hover:text-cyan-100"
              >
                <X className="size-3.5" />
              </button>
            </div>

            {/* Cover + Info */}
            <div className="flex items-center gap-3">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-cyan-400/20">
                <img
                  src={track.cover}
                  alt={track.title}
                  className="size-full object-cover"
                  style={{ filter: "saturate(1.1) contrast(1.05)" }}
                />
                {playing && (
                  <div className="absolute inset-0 flex items-end justify-center gap-0.5 bg-black/30 pb-1.5">
                    {[0.3, 0.6, 0.9, 0.5, 0.7].map((h, i) => (
                      <span
                        key={i}
                        className="w-1 rounded-full bg-cyan-300"
                        style={{
                          height: `${h * 100}%`,
                          animation: `hud-status-blink ${0.5 + i * 0.12}s ease-in-out infinite`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-[13px] font-medium text-white"
                  style={{ textShadow: "0 0 8px rgba(34,211,238,0.4)" }}
                >
                  {track.title}
                </p>
                <p className="mt-0.5 truncate font-mono text-[10.5px] text-cyan-200/70">
                  {track.artist}
                </p>
              </div>
            </div>

            {/* Fortschrittsbalken */}
            <div className="mt-3">
              <div className="relative h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: "linear-gradient(to right, #22d3ee, #67e8f9)",
                    boxShadow: "0 0 8px rgba(34,211,238,0.7)",
                  }}
                  data-testid="music-progress"
                />
              </div>
              <div className="mt-1.5 flex justify-between font-mono text-[9.5px] text-cyan-200/60">
                <span>{fmt(progress)}</span>
                <span>{fmt(track.duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="mt-3 flex items-center justify-center gap-4">
              <button
                type="button"
                aria-label="Vorheriger Track"
                data-testid="music-prev"
                onClick={() => skip(-1)}
                className="grid size-8 place-items-center rounded-lg text-cyan-300/70 transition-all hover:bg-cyan-400/10 hover:text-cyan-100"
              >
                <SkipBack className="size-4" />
              </button>
              <button
                type="button"
                aria-label={playing ? "Pause" : "Abspielen"}
                data-testid="music-play"
                onClick={() => setPlaying((p) => !p)}
                className="grid size-10 place-items-center rounded-full border border-cyan-400/40 text-cyan-200 transition-all hover:bg-cyan-400/15"
                style={{ boxShadow: "0 0 14px rgba(34,211,238,0.4)" }}
              >
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </button>
              <button
                type="button"
                aria-label="Nächster Track"
                data-testid="music-next"
                onClick={() => skip(1)}
                className="grid size-8 place-items-center rounded-lg text-cyan-300/70 transition-all hover:bg-cyan-400/10 hover:text-cyan-100"
              >
                <SkipForward className="size-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
