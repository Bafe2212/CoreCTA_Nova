import { useMemo } from "react";
import { motion } from "motion/react";

/**
 * JARVIS-HUD Hintergrund:
 *  - dunkler Grid mit leichter Perspektive / Tiefenwirkung
 *  - schwebende Partikel / Lichtpunkte
 *  - periodische Scan-Linie
 *  - Vignette am Rand
 *
 * rein dekorativ (pointer-events-none)
 */
export default function HudBackground({ active }: { active: boolean }) {
  // Partikel nur einmal generieren — Position & Bewegung bleiben stabil
  const particles = useMemo(
    () =>
      Array.from({ length: 28 }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 1 + Math.random() * 2.2,
        delay: Math.random() * 14,
        duration: 14 + Math.random() * 18,
        px: `${(Math.random() - 0.5) * 60}px`,
        py: `${-80 - Math.random() * 120}px`,
        opacity: 0.25 + Math.random() * 0.45,
      })),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* dunkler Basis-Hintergrund */}
      <div className="absolute inset-0 bg-[#02060c]" />

      {/* feines Grid mit leichter Perspektive */}
      <motion.div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            "linear-gradient(rgba(125,205,225,0.08) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(125,205,225,0.08) 1px, transparent 1px)",
            "radial-gradient(rgba(148,197,214,0.18) 1px, transparent 1px)",
          ].join(","),
          backgroundSize: "62px 62px, 62px 62px, 31px 31px",
          maskImage:
            "radial-gradient(85% 80% at 50% 50%, black 30%, rgba(0,0,0,0.4) 75%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(85% 80% at 50% 50%, black 30%, rgba(0,0,0,0.4) 75%, transparent 100%)",
          transform: "perspective(900px) rotateX(8deg) scale(1.15)",
          transformOrigin: "center 30%",
        }}
        animate={{ opacity: active ? 0.9 : 0.25 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* perspektivischer Boden-Grid (wie ein HUD-Boden) */}
      <motion.div
        className="absolute inset-x-0 bottom-0 h-[45vh]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.12) 1px, transparent 1px)",
          backgroundSize: "80px 80px, 80px 80px",
          maskImage: "linear-gradient(to top, black 0%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to top, black 0%, transparent 100%)",
          transform: "perspective(420px) rotateX(70deg)",
          transformOrigin: "center bottom",
        }}
        animate={{ opacity: active ? 0.55 : 0.12 }}
        transition={{ duration: 1.2 }}
      />

      {/* schwebende Partikel */}
      <motion.div
        className="absolute inset-0"
        animate={{ opacity: active ? 1 : 0.2 }}
        transition={{ duration: 1.4 }}
      >
        {particles.map((p, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-cyan-200"
            style={
              {
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                opacity: p.opacity,
                boxShadow: "0 0 6px rgba(103,232,249,0.8)",
                animation: `hud-particle ${p.duration}s ease-in-out ${p.delay}s infinite`,
                "--px": p.px,
                "--py": p.py,
              } as React.CSSProperties
            }
          />
        ))}
      </motion.div>

      {/* periodische Scan-Linie */}
      {active && (
        <div
          className="absolute inset-x-0 h-px"
          style={{
            background:
              "linear-gradient(to right, transparent, rgba(103,232,249,0.55) 20%, rgba(103,232,249,0.85) 50%, rgba(103,232,249,0.55) 80%, transparent)",
            boxShadow: "0 0 18px rgba(34,211,238,0.65)",
            animation: "hud-scanline 9s linear infinite",
          }}
        />
      )}

      {/* Vignette — Fokus auf die Mitte */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 50%, transparent 35%, rgba(0,0,0,0.55) 85%, rgba(0,0,0,0.85) 100%)",
        }}
      />
    </div>
  );
}
