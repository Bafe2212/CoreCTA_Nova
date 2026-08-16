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

const NODES = 240;
const NEIGHBOURS = 2;

interface Net {
  pts: Float32Array; // xyz per node on the unit sphere
  phase: Float32Array; // per-node pulse offset
  edges: Uint16Array; // flat pairs
  pulseSpeed: Float32Array; // travelling impulses along the synapses
  pulseOffset: Float32Array;
}

const PULSES = 18;

/** Fibonacci sphere + nearest-neighbour synapses — built once, reused every frame. */
function buildNet(): Net {
  const pts = new Float32Array(NODES * 3);
  const phase = new Float32Array(NODES);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < NODES; i++) {
    const y = 1 - (i / (NODES - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    // slight jitter so the structure reads organic (brain-like) rather than as a spiral grid
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
    for (const b of best) {
      if (b.j > i) edges.push(i, b.j);
    }
    // occasional longer association fibre across the shell
    if (i % 5 === 0) {
      const j = (i + 7 + Math.floor(Math.random() * 11)) % NODES;
      if (j !== i) edges.push(i, j);
    }
  }
  const pulseSpeed = new Float32Array(PULSES);
  const pulseOffset = new Float32Array(PULSES);
  for (let p = 0; p < PULSES; p++) {
    pulseSpeed[p] = 0.28 + Math.random() * 0.5;
    pulseOffset[p] = Math.random() * 10;
  }
  return { pts, phase, edges: new Uint16Array(edges), pulseSpeed, pulseOffset };
}

/**
 * NOVA's orb: a sphere-shaped neural network — glowing nodes and synapses
 * projected in 3D, a very dark translucent core and a thin luminous rim.
 * It breathes slowly, its synapses pulse, and the whole structure cross-fades
 * its colour on every state change. Scaling happens outside (transform only).
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
  const net = useMemo(buildNet, []);

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

    const sx = new Float32Array(NODES);
    const sy = new Float32Array(NODES);
    const sz = new Float32Array(NODES);
    const glowPx = size * 0.004;

    const draw = (now: number) => {
      if (!mounted) return;
      const theme = ORB_THEMES[stateRef.current];
      const ease = 0.05;
      primary = lerpRgb(primary, hexToRgb(theme.primary), ease);
      secondary = lerpRgb(secondary, hexToRgb(theme.secondary), ease);
      speed = lerp(speed, theme.speed, ease);

      const t = (now - start) / 1000;
      const rawLevel =
        stateRef.current === "hoeren"
          ? Math.min(1, levelFnRef.current?.() ?? 0)
          : stateRef.current === "antworten"
            ? // synthetic speech envelope: lively but calm, so the sphere "speaks"
              0.24 +
              0.2 * Math.sin(t * 7.1) * Math.sin(t * 2.6 + 1.1) +
              0.16 * Math.sin(t * 4.3 + 0.6)
            : 0;
      level = lerp(level, Math.max(0, rawLevel), 0.22);
      const breath = Math.sin((t * Math.PI * 2) / speed);
      const cx = size / 2;
      const cy = size / 2;
      const r = size * 0.33 * (1 + breath * 0.024 + level * 0.07);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      // ambient glow
      const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, size * 0.5);
      glow.addColorStop(0, rgba(primary, 0.2 + breath * 0.03 + level * 0.1));
      glow.addColorStop(0.45, rgba(secondary, 0.1));
      glow.addColorStop(1, rgba(secondary, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      // project the network
      const ay = t * (stateRef.current === "denken" ? 0.42 : 0.16);
      const ax = 0.42 + Math.sin(t * 0.11) * 0.06;
      const cay = Math.cos(ay);
      const say = Math.sin(ay);
      const cax = Math.cos(ax);
      const sax = Math.sin(ax);
      for (let i = 0; i < NODES; i++) {
        const px = net.pts[i * 3];
        const py = net.pts[i * 3 + 1];
        const pz = net.pts[i * 3 + 2];
        const x1 = px * cay + pz * say;
        const z1 = -px * say + pz * cay;
        const y2 = py * cax - z1 * sax;
        const z2 = py * sax + z1 * cax;
        sx[i] = cx + x1 * r;
        sy[i] = cy + y2 * r;
        sz[i] = z2;
      }

      // synapses + nodes, back hemisphere first so the core can occlude them
      const drawShell = (front: boolean) => {
        ctx.lineWidth = Math.max(0.6, size * 0.0022);
        for (let e = 0; e < net.edges.length; e += 2) {
          const a = net.edges[e];
          const b = net.edges[e + 1];
          const depth = (sz[a] + sz[b]) / 2;
          if (front ? depth < 0 : depth >= 0) continue;
          const d = (depth + 1) / 2; // 0 back .. 1 front
          const pulse =
            0.5 + 0.5 * Math.sin(t * (1.4 + level * 2.2) + net.phase[a] + net.phase[b]);
          ctx.strokeStyle = rgba(
            pulse > 0.82 ? secondary : primary,
            (front ? 0.07 + d * 0.26 : 0.04 + d * 0.1) * (0.55 + pulse * 0.65),
          );
          ctx.beginPath();
          ctx.moveTo(sx[a], sy[a]);
          ctx.lineTo(sx[b], sy[b]);
          ctx.stroke();
        }
        for (let i = 0; i < NODES; i++) {
          if (front ? sz[i] < 0 : sz[i] >= 0) continue;
          const d = (sz[i] + 1) / 2;
          const pulse = 0.5 + 0.5 * Math.sin(t * (1.7 + level * 2.4) + net.phase[i]);
          const rad = Math.max(0.5, size * (0.0013 + 0.0026 * d) * (0.7 + pulse * 0.8));
          ctx.beginPath();
          ctx.arc(sx[i], sy[i], rad, 0, Math.PI * 2);
          ctx.fillStyle = rgba(
            pulse > 0.9 ? secondary : primary,
            (front ? 0.22 + d * 0.6 : 0.08 + d * 0.16) * (0.55 + pulse * 0.6),
          );
          ctx.fill();
        }
      };

      ctx.save();
      ctx.shadowBlur = glowPx * 3;
      ctx.shadowColor = rgba(primary, 0.55);
      drawShell(false);
      ctx.restore();

      // dark translucent core — keeps the centre calm and occludes the far side
      const core = ctx.createRadialGradient(cx, cy - r * 0.12, r * 0.05, cx, cy, r * 0.96);
      core.addColorStop(0, "rgba(4, 9, 16, 0.96)");
      core.addColorStop(0.62, "rgba(4, 10, 18, 0.9)");
      core.addColorStop(0.9, "rgba(3, 8, 14, 0.55)");
      core.addColorStop(1, "rgba(3, 7, 13, 0)");
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.96, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();

      ctx.save();
      ctx.shadowBlur = glowPx * 4;
      ctx.shadowColor = rgba(primary, 0.7);
      drawShell(true);
      ctx.restore();

      // travelling activity impulses along the synapses — strongest while thinking
      const st = stateRef.current;
      const activity =
        st === "denken" ? 1 : st === "antworten" ? 0.7 : st === "hoeren" ? 0.4 : 0.14;
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
        if ((sz[a] + sz[b]) / 2 < 0) continue; // only on the visible hemisphere
        const fade = Math.sin(prog * Math.PI) * activity;
        if (fade <= 0.02) continue;
        const px = lerp(sx[a], sx[b], prog);
        const py = lerp(sy[a], sy[b], prog);
        const tailProg = Math.max(0, prog - 0.35);
        ctx.strokeStyle = rgba(secondary, 0.32 * fade);
        ctx.lineWidth = Math.max(0.7, size * 0.0028);
        ctx.beginPath();
        ctx.moveTo(lerp(sx[a], sx[b], tailProg), lerp(sy[a], sy[b], tailProg));
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.shadowBlur = size * 0.035;
        ctx.shadowColor = rgba(secondary, 0.9);
        ctx.beginPath();
        ctx.arc(px, py, Math.max(0.7, size * 0.0055 * fade + size * 0.0016), 0, Math.PI * 2);
        ctx.fillStyle = rgba(secondary, 0.5 + 0.45 * fade);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.restore();

      // thin luminous rim
      ctx.save();
      ctx.shadowBlur = size * 0.1;
      ctx.shadowColor = rgba(primary, 0.8);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(primary, 0.42 + breath * 0.08 + level * 0.22);
      ctx.lineWidth = Math.max(1, size * 0.0042 + level * size * 0.003);
      ctx.stroke();
      ctx.restore();

      // outer halo
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.17, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(secondary, 0.1);
      ctx.lineWidth = Math.max(1, size * 0.003);
      ctx.stroke();

      // voice ring reacting to the microphone
      if (level > 0.01) {
        ctx.save();
        ctx.shadowBlur = size * 0.14 * level;
        ctx.shadowColor = rgba(primary, 0.7);
        ctx.beginPath();
        ctx.arc(cx, cy, r * (1.22 + level * 0.2), 0, Math.PI * 2);
        ctx.strokeStyle = rgba(primary, 0.08 + level * 0.38);
        ctx.lineWidth = Math.max(1, size * 0.0035);
        ctx.stroke();
        ctx.restore();
      }

      // soft impulse right after a state change
      const since = (now - changedAtRef.current) / 1000;
      if (changedAtRef.current > 0 && since < 1.1) {
        const p = since / 1.1;
        ctx.beginPath();
        ctx.arc(cx, cy, r * (1 + p * 0.42), 0, Math.PI * 2);
        ctx.strokeStyle = rgba(primary, 0.3 * (1 - p));
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
