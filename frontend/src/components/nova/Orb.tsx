import { useEffect, useRef } from "react";
import { ORB_THEMES, type OrbState } from "@/lib/nova";

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const v = hex.replace("#", "");
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];
const rgba = (c: Rgb, alpha: number) =>
  `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${alpha})`;

/**
 * NOVA's orb: a canvas-rendered light sphere — thin glowing ring, translucent
 * dark interior, soft glow. Breathes continuously and cross-fades its colour
 * whenever the state changes. Transform-only from the outside, so scaling it
 * between the centre stage and the dock stays on the compositor.
 */
export default function Orb({
  state,
  size = 240,
  label = true,
  getLevel,
}: {
  state: OrbState;
  size?: number;
  label?: boolean;
  /** live microphone amplitude 0..1, read per frame — never triggers a re-render */
  getLevel?: () => number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<OrbState>(state);
  const changedAtRef = useRef<number>(0);
  const levelFnRef = useRef<(() => number) | undefined>(getLevel);
  levelFnRef.current = getLevel;

  useEffect(() => {
    stateRef.current = state;
    changedAtRef.current = performance.now();
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    let primary = hexToRgb(ORB_THEMES[stateRef.current].primary);
    let secondary = hexToRgb(ORB_THEMES[stateRef.current].secondary);
    let speed = ORB_THEMES[stateRef.current].speed;
    let level = 0;
    let raf = 0;
    let mounted = true;
    const start = performance.now();

    const draw = (now: number) => {
      if (!mounted) return;
      const theme = ORB_THEMES[stateRef.current];
      const ease = 0.05;
      primary = lerpRgb(primary, hexToRgb(theme.primary), ease);
      secondary = lerpRgb(secondary, hexToRgb(theme.secondary), ease);
      speed = lerp(speed, theme.speed, ease);

      const t = (now - start) / 1000;
      const rawLevel =
        stateRef.current === "hoeren" ? Math.min(1, levelFnRef.current?.() ?? 0) : 0;
      level = lerp(level, rawLevel, 0.22);
      const breath = Math.sin((t * Math.PI * 2) / speed);
      const cx = size / 2;
      const cy = size / 2;
      const r = size * 0.33 * (1 + breath * 0.022 + level * 0.075);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      // ambient glow
      const glow = ctx.createRadialGradient(cx, cy, r * 0.25, cx, cy, size * 0.5);
      glow.addColorStop(0, rgba(primary, 0.2 + breath * 0.03));
      glow.addColorStop(0.45, rgba(secondary, 0.1));
      glow.addColorStop(1, rgba(secondary, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      // translucent dark interior
      const inner = ctx.createRadialGradient(cx, cy - r * 0.15, r * 0.1, cx, cy, r);
      inner.addColorStop(0, "rgba(6, 14, 24, 0.94)");
      inner.addColorStop(0.72, "rgba(4, 9, 16, 0.86)");
      inner.addColorStop(1, rgba(primary, 0.14));
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = inner;
      ctx.fill();

      // outer halo ring
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.16, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(secondary, 0.14);
      ctx.lineWidth = Math.max(1, size * 0.0035);
      ctx.stroke();

      // primary luminous ring
      ctx.save();
      ctx.shadowBlur = size * 0.11;
      ctx.shadowColor = rgba(primary, 0.85);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(primary, 0.68 + breath * 0.1 + level * 0.22);
      ctx.lineWidth = Math.max(1.1, size * 0.006 + level * size * 0.004);
      ctx.stroke();
      ctx.restore();

      // voice: a second ring that breathes with the microphone level
      if (level > 0.01) {
        ctx.save();
        ctx.shadowBlur = size * 0.14 * level;
        ctx.shadowColor = rgba(primary, 0.7);
        ctx.beginPath();
        ctx.arc(cx, cy, r * (1.2 + level * 0.22), 0, Math.PI * 2);
        ctx.strokeStyle = rgba(primary, 0.1 + level * 0.4);
        ctx.lineWidth = Math.max(1, size * 0.0035);
        ctx.stroke();
        ctx.restore();
      }

      // slowly rotating light structure
      const rot = t * (stateRef.current === "denken" ? 0.85 : 0.28);
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(1, size * 0.0055);
      for (let i = 0; i < 2; i++) {
        const a = rot + i * Math.PI;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.07, a, a + 0.75);
        ctx.strokeStyle = rgba(primary, 0.42 - i * 0.16);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.78, -rot * 0.6, -rot * 0.6 + 1.5);
      ctx.strokeStyle = rgba(secondary, 0.22);
      ctx.stroke();
      ctx.restore();

      // soft impulse right after a state change
      const since = (now - changedAtRef.current) / 1000;
      if (changedAtRef.current > 0 && since < 1.1) {
        const p = since / 1.1;
        ctx.beginPath();
        ctx.arc(cx, cy, r * (1 + p * 0.42), 0, Math.PI * 2);
        ctx.strokeStyle = rgba(primary, 0.34 * (1 - p));
        ctx.lineWidth = Math.max(1, size * 0.004);
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
    };
  }, [size]);

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      data-testid="nova-orb-canvas-wrapper"
      data-orb-state={state}
    >
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
      {label && (
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center font-heading tracking-[0.42em] text-foreground/70"
          style={{ fontSize: Math.max(9, size * 0.058), paddingLeft: "0.42em" }}
          data-testid="nova-orb-label"
        >
          NOVA
        </span>
      )}
    </div>
  );
}
