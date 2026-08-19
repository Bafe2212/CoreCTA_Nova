import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

/**
 * JARVIS-Boot-Sequence:
 *  - Ringe bauen sich kreisförmig auf (stroke-dashoffset)
 *  - „JARVIS“ / „NOVA“ Schriftzug fadet ein
 *  - kurze Status-Zeilen tippen sich durch
 *  - danach verschwindet sie sanft
 *
 * Wird einmal beim App-Start gezeigt (ca. 2.6s).
 */
const BOOT_LINES = [
  "INITIALISIERE CORE …",
  "NEURAL NET ONLINE",
  "VOICE INTERFACE BEREIT",
  "JARVIS SYSTEM BEREIT",
];

export default function BootSequence({ onDone }: { onDone?: () => void }) {
  const [visible, setVisible] = useState(true);
  const [lineIdx, setLineIdx] = useState(0);

  useEffect(() => {
    const lineTimer = window.setInterval(
      () => setLineIdx((i) => Math.min(i + 1, BOOT_LINES.length)),
      520,
    );
    const hide = window.setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 2600);
    return () => {
      window.clearInterval(lineTimer);
      window.clearTimeout(hide);
    };
  }, [onDone]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute inset-0 z-[500] flex flex-col items-center justify-center bg-[#02060c]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(8px)" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          data-testid="boot-sequence"
        >
          <div className="relative" style={{ width: 280, height: 280 }}>
            <svg viewBox="0 0 280 280" className="absolute inset-0">
              {/* drei konzentrische Ringe, die sich aufbauen */}
              {[120, 96, 72].map((r, i) => (
                <circle
                  key={r}
                  cx="140"
                  cy="140"
                  r={r}
                  fill="none"
                  stroke="rgba(34,211,238,0.85)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: 2 * Math.PI * r,
                    animation: `hud-boot-ring ${0.9 + i * 0.25}s ease-out ${i * 0.18}s both`,
                    filter: "drop-shadow(0 0 6px rgba(34,211,238,0.7))",
                  }}
                />
              ))}
              {/* rotierender Tick-Ring */}
              <g
                style={{
                  transformOrigin: "140px 140px",
                  animation: "hud-ring-rotate 4s linear infinite",
                }}
              >
                {Array.from({ length: 36 }).map((_, i) => (
                  <line
                    key={i}
                    x1="140"
                    y1="18"
                    x2="140"
                    y2={i % 3 === 0 ? 30 : 24}
                    stroke="rgba(103,232,249,0.5)"
                    strokeWidth={1}
                    transform={`rotate(${i * 10} 140 140)`}
                  />
                ))}
              </g>
            </svg>
            <motion.span
              className="absolute inset-0 flex items-center justify-center font-heading text-[26px] font-medium tracking-[0.32em] text-white"
              style={{ textShadow: "0 0 22px rgba(34,211,238,0.75)" }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7, duration: 0.6 }}
            >
              JARVIS
            </motion.span>
          </div>

          {/* Status-Zeilen */}
          <div className="mt-10 h-16 font-mono text-[11px] tracking-[0.22em] text-cyan-200/80">
            {BOOT_LINES.slice(0, lineIdx).map((l, i) => (
              <motion.p
                key={l}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className={i === lineIdx - 1 ? "text-cyan-100" : "text-cyan-300/50"}
              >
                <span className="text-cyan-400/70">›</span> {l}
              </motion.p>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
