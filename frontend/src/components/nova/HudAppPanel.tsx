import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Generisches JARVIS HUD-Panel für Apps ohne eigenes Panel.
 * Schwebend, halbtransparent, auf der rechten Seite.
 * Slide+Fade+Glow Animation beim Öffnen/Schließen.
 */
export default function HudAppPanel({
  open,
  title,
  onClose,
  children,
  side = "right",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  side?: "left" | "right";
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute z-[220] flex flex-col"
          style={{
            [side]: 24,
            top: 80,
            bottom: 110,
            width: "min(440px, 34vw)",
          }}
          initial={{
            opacity: 0,
            x: side === "right" ? 50 : -50,
            scale: 0.95,
            filter: "blur(8px)",
          }}
          animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0)" }}
          exit={{
            opacity: 0,
            x: side === "right" ? 50 : -50,
            scale: 0.95,
            filter: "blur(8px)",
          }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          data-testid="hud-app-panel"
        >
          <div
            className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-cyan-400/25 bg-[#050b13]/75 backdrop-blur-xl"
            style={{
              boxShadow:
                "0 0 40px -10px rgba(34,211,238,0.4), inset 0 0 30px rgba(34,211,238,0.05)",
            }}
          >
            {/* Eck-Klammern */}
            {[
              "top-2 left-2 border-t border-l",
              "top-2 right-2 border-t border-r",
              "bottom-2 left-2 border-b border-l",
              "bottom-2 right-2 border-b border-r",
            ].map((p) => (
              <span
                key={p}
                className={`absolute size-3 border-cyan-300/40 ${p}`}
                aria-hidden="true"
              />
            ))}

            {/* Header */}
            <div className="flex items-center justify-between border-b border-cyan-400/15 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="size-1.5 rounded-full bg-cyan-400"
                  style={{
                    animation: "hud-status-blink 1.6s ease-in-out infinite",
                    boxShadow: "0 0 8px #22d3ee",
                  }}
                />
                <span className="font-mono text-[10px] tracking-[0.26em] text-cyan-200/80 uppercase">
                  {title}
                </span>
              </div>
              <button
                type="button"
                aria-label="Panel schließen"
                data-testid="hud-app-panel-close"
                onClick={onClose}
                className="grid size-6 place-items-center rounded text-cyan-300/60 transition-colors hover:text-cyan-100"
              >
                <X className="size-3.5" />
              </button>
            </div>

            {/* Inhalt */}
            <div className="min-h-0 flex-1 overflow-auto">{children}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
