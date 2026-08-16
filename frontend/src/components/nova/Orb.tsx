import { useEffect, useMemo, useRef } from "react";
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

const NODES = 150;
const NEIGHBOURS = 2;
const PULSES = 14;
/** the inner network is only a faint hint behind the ring */
const MESH = 0.34;

interface Net {
  pts: Float32Array;
  phase: Float32Array;
  edges: Uint16Array;
  pulseSpeed: Float32Array;
  pulseOffset: Float32Array;
  /** rotating arc segments around the ring: [radiusFactor, span, speed, dir] */
  arcs: number[][];
}

function buildNet(): Net {
  const pts = new Float32Array(NODES * 3);
  const phase = new Float32Array(NODES);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < NODES; i++) {
    const y = 1 - (i / (NODES - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    let vx = Math.cos(theta) * radius + (Math.random() - 0.5) * 0.16;
    let vy = y + (Math.random() - 0.5) * 0.16;
    let vz = Math.sin(theta) * radius + (Math.random() - 0.5) * 0.16;
    const len = Math.hypot(vx, vy, vz) || 1;
    vx /= len;
    vy /= len;
    vz /= len;
    pts[i * 3] = vx;
    pts[i * 3 + 1] = vy;
    pts[i * 3 + 2] = vz;
    phase[i] = Math.random() * Math.PI * 2;
  }
  const edges: number[] = [];
  for (let i = 0; i < NODES; i++) {
    const best: { j: number; d: number }[] = [];
    for (let j = 0; j < NODES; j++) {
      if (i === j) continue;
      const dx = pts[i * 3] - pts[j * 3];
      const dy = pts[i * 3 + 1] - pts[j * 3 + 1];
      const dz = pts[i * 3 + 2] - pts[j * 3 + 2];
      const d = dx * dx + dy * dy + dz * dz;
      if (best.length < NEIGHBOURS) {
        best.push({ j, d });
        best.sort((a, b) => a.d - b.d);
      } else if (d < best[best.length - 1].d) {
        best[best.length - 1] = { j, d };
        best.sort((a, b) => a.d - b.d);
      }
    }
    for (const b of best) if (b.j > i) edges.push(i, b.j);
  }
  const pulseSpeed = new Float32Array(PULSES);
  const pulseOffset = new Float32Array(PULSES);
  for (let p = 0; p < PULSES; p++) {
    pulseSpeed[p] = 0.28 + Math.random() * 0.5;
    pulseOffset[p] = Math.random() * 10;
  }
  const arcs = [
    [1.17, 2.5, 0.22, 1],
    [1.17, 0.55, 0.22, 1],
    [1.28, 1.5, -0.15, -1],
    [1.28, 0.35, -0.15, -1],
    [1.4, 0.8, 0.1, 1],
  ];
  return { pts, phase, edges: new Uint16Array(edges), pulseSpeed, pulseOffset, arcs };
}

/**
 * NOVA's orb — a HUD-style light ring: one bright luminous circle with bloom,
 * broken arc segments orbiting around it, a fine dotted corona and a very dark
 * interior with a faint neural hint. Breathes slowly, reacts to the voice level
 * and cross-fades its colour per state. Scaling happens outside (transform only).
 */
export default function Orb({
  state,
  size = 240,
  label = true,
  getLevel,
  variant = "active",
}: {
  state: OrbState;
  size?: number;
  label?: boolean;
  getLevel?: () => number;
  /** standby = dimmed sphere of light dust, active = ignited HUD ring */
  variant?: "standby" | "active";
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<OrbState>(state);
  const changedAtRef = useRef<number>(0);
  const variantRef = useRef(variant);
  const ignitedAtRef = useRef(0);
  const levelFnRef = useRef<(() => number) | undefined>(getLevel);
  levelFnRef.current = getLevel;
  const net = useMemo(buildNet, []);

  useEffect(() => {
    if (variantRef.current !== variant) {
      variantRef.current = variant;
      if (variant === "active") ignitedAtRef.current = performance.now();
    }
  }, [variant]);

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
    let mix = variantRef.current === "active" ? 1 : 0;
    let raf = 0;
    let mounted = true;
    const start = performance.now();

    const sx = new Float32Array(NODES);
    const sy = new Float32Array(NODES);
    const sz = new Float32Array(NODES);

    const draw = (now: number) => {
      if (!mounted) return;
      const theme = ORB_THEMES[stateRef.current];
      const ease = 0.05;
      primary = lerpRgb(primary, hexToRgb(theme.primary), ease);
      secondary = lerpRgb(secondary, hexToRgb(theme.secondary), ease);
      speed = lerp(speed, theme.speed, ease);

      const st = stateRef.current;
      const t = (now - start) / 1000;
      const rawLevel =
        st === "hoeren"
          ? Math.min(1, levelFnRef.current?.() ?? 0)
          : st === "antworten"
            ? 0.24 +
              0.2 * Math.sin(t * 7.1) * Math.sin(t * 2.6 + 1.1) +
              0.16 * Math.sin(t * 4.3 + 0.6)
            : 0;
      level = lerp(level, Math.max(0, rawLevel), 0.22);
      // 0 = dimmed standby sphere, 1 = ignited HUD ring
      mix = lerp(mix, variantRef.current === "active" ? 1 : 0, 0.055);
      const meshFactor = MESH + (1 - MESH) * (1 - mix);
      const breath = Math.sin((t * Math.PI * 2) / speed);
      const cx = size / 2;
      const cy = size / 2;
      const r = size * 0.26 * (1 + breath * 0.022 + level * 0.06 + (1 - mix) * 0.06);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      // ambient glow
      const glow = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, size * 0.5);
      glow.addColorStop(0, rgba(primary, (0.22 + breath * 0.03 + level * 0.12) * (0.35 + mix * 0.65)));
      glow.addColorStop(0.4, rgba(secondary, 0.1 * (0.35 + mix * 0.65)));
      glow.addColorStop(1, rgba(secondary, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      // project the faint inner network
      const ay = t * (st === "denken" ? 0.42 : 0.16);
      const ax = 0.42 + Math.sin(t * 0.11) * 0.06;
      const cay = Math.cos(ay);
      const say = Math.sin(ay);
      const cax = Math.cos(ax);
      const sax = Math.sin(ax);
      const meshR = r * 0.9;
      for (let i = 0; i < NODES; i++) {
        const px = net.pts[i * 3];
        const py = net.pts[i * 3 + 1];
        const pz = net.pts[i * 3 + 2];
        const x1 = px * cay + pz * say;
        const z1 = -px * say + pz * cay;
        const y2 = py * cax - z1 * sax;
        sx[i] = cx + x1 * meshR;
        sy[i] = cy + y2 * meshR;
        sz[i] = py * sax + z1 * cax;
      }

      const drawShell = (front: boolean) => {
        ctx.lineWidth = Math.max(0.5, size * 0.0018);
        for (let e = 0; e < net.edges.length; e += 2) {
          const a = net.edges[e];
          const b = net.edges[e + 1];
          const depth = (sz[a] + sz[b]) / 2;
          if (front ? depth < 0 : depth >= 0) continue;
          const d = (depth + 1) / 2;
          const pulse = 0.5 + 0.5 * Math.sin(t * 1.4 + net.phase[a] + net.phase[b]);
          ctx.strokeStyle = rgba(primary, (front ? 0.06 + d * 0.16 : 0.03 + d * 0.07) * meshFactor * (0.6 + pulse * 0.7));
          ctx.beginPath();
          ctx.moveTo(sx[a], sy[a]);
          ctx.lineTo(sx[b], sy[b]);
          ctx.stroke();
        }
        for (let i = 0; i < NODES; i++) {
          if (front ? sz[i] < 0 : sz[i] >= 0) continue;
          const d = (sz[i] + 1) / 2;
          const pulse = 0.5 + 0.5 * Math.sin(t * 1.7 + net.phase[i]);
          ctx.beginPath();
          ctx.arc(sx[i], sy[i], Math.max(0.4, size * 0.0016 * (0.7 + pulse * 0.8)), 0, Math.PI * 2);
          ctx.fillStyle = rgba(primary, (front ? 0.3 + d * 0.4 : 0.1) * meshFactor * (0.6 + pulse * 0.7));
          ctx.fill();
        }
      };

      drawShell(false);

      // very dark interior
      const core = ctx.createRadialGradient(cx, cy - r * 0.1, r * 0.05, cx, cy, r);
      core.addColorStop(0, "rgba(3, 8, 15, 0.97)");
      core.addColorStop(0.7, "rgba(3, 9, 17, 0.92)");
      core.addColorStop(1, "rgba(4, 12, 22, 0.7)");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();

      drawShell(true);

      // travelling impulses on the inner network
      const activity = st === "denken" ? 1 : st === "antworten" ? 0.7 : st === "hoeren" ? 0.4 : 0.16;
      const edgeCount = net.edges.length / 2;
      ctx.save();
      ctx.lineCap = "round";
      for (let p = 0; p < PULSES; p++) {
        const cyc = t * net.pulseSpeed[p] * (st === "denken" ? 2.1 : 1.2) + net.pulseOffset[p];
        const cycle = Math.floor(cyc);
        const prog = cyc - cycle;
        const eIdx = (cycle * 13 + p * 29) % edgeCount;
        const a = net.edges[eIdx * 2];
        const b = net.edges[eIdx * 2 + 1];
        if ((sz[a] + sz[b]) / 2 < 0) continue;
        const fade = Math.sin(prog * Math.PI) * activity;
        if (fade <= 0.03) continue;
        ctx.beginPath();
        ctx.arc(
          lerp(sx[a], sx[b], prog),
          lerp(sy[a], sy[b], prog),
          Math.max(0.6, size * 0.004 * fade + size * 0.0012),
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = rgba(secondary, 0.35 + 0.5 * fade);
        ctx.fill();
      }
      ctx.restore();

      // THE ring: dim rim in standby, bright core stroke + wide bloom once ignited
      ctx.save();
      ctx.lineCap = "butt";
      ctx.shadowColor = rgba(primary, 0.95);
      ctx.shadowBlur = (size * 0.14 + level * size * 0.06) * mix;
      ctx.lineWidth = Math.max(1.2, size * (0.005 + 0.012 * mix) * (1 + level * 0.35));
      ctx.strokeStyle = rgba(primary, 0.16 + 0.76 * mix);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      if (mix > 0.02) {
        ctx.shadowBlur = size * 0.3 * mix;
        ctx.strokeStyle = rgba(primary, (0.3 + level * 0.2) * mix);
        ctx.lineWidth = Math.max(1, size * 0.006);
        ctx.stroke();
        // white-hot inner edge
        ctx.shadowBlur = size * 0.05;
        ctx.shadowColor = "rgba(255,255,255,0.7)";
        ctx.strokeStyle = `rgba(255,255,255,${(0.16 + breath * 0.05 + level * 0.2) * mix})`;
        ctx.lineWidth = Math.max(0.8, size * 0.004);
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.975, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // ignition shockwave
      const sinceIgnite = (now - ignitedAtRef.current) / 1000;
      if (ignitedAtRef.current > 0 && sinceIgnite < 1.2) {
        const p = sinceIgnite / 1.2;
        ctx.save();
        ctx.shadowBlur = size * 0.08;
        ctx.shadowColor = rgba(primary, 0.8);
        ctx.beginPath();
        ctx.arc(cx, cy, r * (1 + p * 1.1), 0, Math.PI * 2);
        ctx.strokeStyle = rgba(primary, 0.5 * (1 - p));
        ctx.lineWidth = Math.max(1, size * 0.006 * (1 - p) + 0.6);
        ctx.stroke();
        ctx.restore();
      }

      // orbiting broken arc segments
      if (mix > 0.02) {
        ctx.save();
        ctx.lineCap = "round";
        ctx.shadowColor = rgba(primary, 0.8);
        ctx.shadowBlur = size * 0.06;
        net.arcs.forEach(([rf, span, spd, dir], i) => {
          const rot = t * spd * (st === "denken" ? 2.4 : 1) * dir + i * 1.7;
          ctx.beginPath();
          ctx.arc(cx, cy, r * rf * (1 + level * 0.04), rot, rot + span);
          ctx.strokeStyle = rgba(primary, ((i % 2 === 0 ? 0.5 : 0.28) + level * 0.2) * mix);
          ctx.lineWidth = Math.max(1, size * (i % 2 === 0 ? 0.0085 : 0.005));
          ctx.stroke();
        });
        ctx.restore();
      }

      // fine dotted corona
      const dots = 76;
      const dotR = r * 1.52;
      for (let i = 0; i < dots; i++) {
        const a = (i / dots) * Math.PI * 2 + t * 0.05;
        const shimmer = 0.5 + 0.5 * Math.sin(i * 0.7 + t * 1.3);
        ctx.beginPath();
        ctx.arc(
          cx + Math.cos(a) * dotR,
          cy + Math.sin(a) * dotR,
          Math.max(0.4, size * 0.0028),
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = rgba(primary, (0.08 + shimmer * 0.22 + level * 0.1) * mix);
        ctx.fill();
      }

      // four HUD ticks
      if (mix > 0.02) {
        ctx.save();
        ctx.strokeStyle = rgba(primary, 0.3 * mix);
        ctx.lineWidth = Math.max(1, size * 0.004);
        for (let i = 0; i < 4; i++) {
          const a = Math.PI / 4 + (i * Math.PI) / 2 + t * 0.05;
          const r1 = r * 1.66;
          const r2 = r * 1.78;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
          ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // voice ring
      if (level > 0.01) {
        ctx.save();
        ctx.shadowBlur = size * 0.12 * level;
        ctx.shadowColor = rgba(primary, 0.7);
        ctx.beginPath();
        ctx.arc(cx, cy, r * (1.62 + level * 0.16), 0, Math.PI * 2);
        ctx.strokeStyle = rgba(primary, 0.06 + level * 0.3);
        ctx.lineWidth = Math.max(1, size * 0.003);
        ctx.stroke();
        ctx.restore();
      }

      // soft impulse right after a state change
      const since = (now - changedAtRef.current) / 1000;
      if (changedAtRef.current > 0 && since < 1.1) {
        const p = since / 1.1;
        ctx.beginPath();
        ctx.arc(cx, cy, r * (1 + p * 0.75), 0, Math.PI * 2);
        ctx.strokeStyle = rgba(primary, 0.28 * (1 - p));
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
  }, [size, net]);

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      data-testid="nova-orb-canvas-wrapper"
      data-orb-state={state}
    >
      <canvas ref={canvasRef} style={{ width: size, height: size }} aria-hidden="true" />
      {label && (
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center font-heading font-medium tracking-[0.2em] transition-colors duration-700"
          style={{
            fontSize: Math.max(9, size * 0.072),
            paddingLeft: "0.2em",
            color: variant === "active" ? "#ffffff" : "rgba(186, 230, 253, 0.62)",
            textShadow:
              variant === "active"
                ? "0 0 18px rgba(34,211,238,0.55)"
                : "0 0 12px rgba(34,211,238,0.25)",
          }}
          data-testid="nova-orb-label"
        >
          NOVA
        </span>
      )}
    </div>
  );
}
