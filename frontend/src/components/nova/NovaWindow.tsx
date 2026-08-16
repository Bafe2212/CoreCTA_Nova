import { useRef, useState } from "react";
import { motion } from "motion/react";
import { Maximize2, Minus, Minimize2, X } from "lucide-react";
import { APP_MAP } from "@/lib/nova";
import type { Rect, WinState } from "@/hooks/useWindowManager";
import { DOCK_HEIGHT } from "@/hooks/useWindowManager";

interface Props {
  win: WinState;
  active: boolean;
  viewport: { w: number; h: number };
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onRect: (rect: Rect) => void;
  onDragState: (info: DragInfo | null) => void;
  children: React.ReactNode;
}

const MIN_W = 320;
const MIN_H = 220;
const EDGE = 24;
const MAGNET = 14;
const SNAP_ZONE = 30;
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export type SnapKind = "left" | "right" | "max";

export interface DragInfo {
  /** live rect of the dragged window */
  x: number;
  y: number;
  w: number;
  h: number;
  /** screen positions of the alignment guides, if any */
  guideX: number | null;
  guideY: number | null;
  snap: SnapKind | null;
}

/** Half-screen / full-screen target rects for the snap zones. */
export function snapRect(kind: SnapKind, viewport: { w: number; h: number }): Rect {
  const h = viewport.h - DOCK_HEIGHT - EDGE;
  if (kind === "max") return { x: EDGE, y: EDGE, w: viewport.w - EDGE * 2, h };
  const w = (viewport.w - EDGE * 3) / 2;
  return { x: kind === "left" ? EDGE : EDGE * 2 + w, y: EDGE, w, h };
}

function magnet(raw: number, targets: number[]): { value: number; hit: number | null } {
  for (let i = 0; i < targets.length; i++) {
    if (Math.abs(raw - targets[i]) < MAGNET) return { value: targets[i], hit: i };
  }
  return { value: raw, hit: null };
}

export default function NovaWindow({
  win,
  active,
  viewport,
  onFocus,
  onClose,
  onMinimize,
  onToggleMaximize,
  onRect,
  onDragState,
  children,
}: Props) {
  const def = APP_MAP[win.id];
  const Icon = def.icon;
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [grow, setGrow] = useState<{ dw: number; dh: number } | null>(null);
  const [snap, setSnap] = useState<SnapKind | null>(null);
  const startRef = useRef({ px: 0, py: 0 });

  /** magnetised position + which guides it aligned to */
  const resolveDrag = (dx: number, dy: number) => {
    const { w, h } = win.rect;
    const xs = [EDGE, (viewport.w - w) / 2, viewport.w - w - EDGE];
    const ys = [EDGE, (viewport.h - DOCK_HEIGHT - h) / 2, viewport.h - DOCK_HEIGHT - h - EDGE];
    const mx = magnet(win.rect.x + dx, xs);
    const my = magnet(win.rect.y + dy, ys);
    const guideX =
      mx.hit === null ? null : mx.hit === 0 ? EDGE : mx.hit === 1 ? viewport.w / 2 : viewport.w - EDGE;
    const guideY =
      my.hit === null
        ? null
        : my.hit === 0
          ? EDGE
          : my.hit === 1
            ? (viewport.h - DOCK_HEIGHT) / 2
            : viewport.h - DOCK_HEIGHT - EDGE;
    return { x: mx.value, y: my.value, guideX, guideY };
  };

  const zoneFor = (px: number, py: number): SnapKind | null => {
    if (py <= 8) return "max";
    if (px <= SNAP_ZONE) return "left";
    if (px >= viewport.w - SNAP_ZONE) return "right";
    return null;
  };

  const beginDrag = (e: React.PointerEvent) => {
    if (win.maximized) return;
    onFocus();
    startRef.current = { px: e.clientX, py: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ dx: 0, dy: 0 });
  };

  const moveDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - startRef.current.px;
    const dy = e.clientY - startRef.current.py;
    setDrag({ dx, dy });
    const zone = zoneFor(e.clientX, e.clientY);
    setSnap(zone);
    const r = resolveDrag(dx, dy);
    if (zone) {
      const target = snapRect(zone, viewport);
      onDragState({ ...target, guideX: null, guideY: null, snap: zone });
    } else {
      onDragState({
        x: r.x,
        y: r.y,
        w: win.rect.w,
        h: win.rect.h,
        guideX: r.guideX,
        guideY: r.guideY,
        snap: null,
      });
    }
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    const zone = snap;
    setDrag(null);
    setSnap(null);
    onDragState(null);
    if (zone === "max") {
      if (!win.maximized) onToggleMaximize();
      return;
    }
    if (zone) {
      onRect(snapRect(zone, viewport));
      return;
    }
    const r = resolveDrag(drag.dx, drag.dy);
    onRect({
      ...win.rect,
      x: clamp(r.x, -win.rect.w + 120, viewport.w - 120),
      y: clamp(r.y, 8, viewport.h - DOCK_HEIGHT + 40),
    });
  };

  const beginResize = (e: React.PointerEvent) => {
    if (win.maximized) return;
    e.stopPropagation();
    onFocus();
    startRef.current = { px: e.clientX, py: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setGrow({ dw: 0, dh: 0 });
  };

  const moveResize = (e: React.PointerEvent) => {
    if (!grow) return;
    setGrow({ dw: e.clientX - startRef.current.px, dh: e.clientY - startRef.current.py });
  };

  const endResize = (e: React.PointerEvent) => {
    if (!grow) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    onRect({
      ...win.rect,
      w: clamp(win.rect.w + grow.dw, MIN_W, viewport.w - 24),
      h: clamp(win.rect.h + grow.dh, MIN_H, viewport.h - 24),
    });
    setGrow(null);
  };

  const interacting = drag !== null || grow !== null;
  const resolved = drag ? resolveDrag(drag.dx, drag.dy) : null;
  const x = resolved ? resolved.x : win.rect.x;
  const y = resolved ? resolved.y : win.rect.y;
  const w = Math.max(MIN_W, win.rect.w + (grow?.dw ?? 0));
  const h = Math.max(MIN_H, win.rect.h + (grow?.dh ?? 0));

  return (
    <motion.section
      data-testid={`window-${win.id}`}
      data-active={active}
      className="absolute left-0 top-0 flex flex-col overflow-hidden rounded-xl border bg-[#060c15]/85 backdrop-blur-xl"
      style={{
        zIndex: win.z,
        borderColor: active ? "rgba(34,211,238,0.22)" : "rgba(148,163,184,0.12)",
        boxShadow: active
          ? "0 30px 80px -30px rgba(0,0,0,0.9), 0 0 0 1px rgba(34,211,238,0.05)"
          : "0 24px 60px -30px rgba(0,0,0,0.85)",
      }}
      initial={{ opacity: 0, scale: 0.94, x, y, width: w, height: h }}
      animate={{ opacity: 1, scale: 1, x, y, width: w, height: h }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.18 } }}
      transition={
        interacting
          ? { duration: 0 }
          : { type: "spring", stiffness: 260, damping: 30, mass: 0.7 }
      }
      onPointerDown={onFocus}
    >
      <header
        data-testid={`window-header-${win.id}`}
        className="flex h-10 shrink-0 cursor-grab items-center gap-2 border-b border-white/[0.05] px-3 active:cursor-grabbing"
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={onToggleMaximize}
      >
        <Icon className="size-3.5 text-cyan-300/60" aria-hidden="true" />
        <span className="font-heading text-[12px] tracking-[0.16em] text-foreground/70 uppercase">
          {def.title}
        </span>
        <span className="ml-2 truncate font-mono text-[10px] text-muted-foreground/60">
          {def.hint}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="Fenster minimieren"
            data-testid={`window-minimize-${win.id}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onMinimize}
            className="grid size-6 place-items-center rounded-md text-muted-foreground/60 transition-colors duration-200 hover:bg-white/5 hover:text-foreground"
          >
            <Minus className="size-3" />
          </button>
          <button
            type="button"
            aria-label={win.maximized ? "Fenster verkleinern" : "Fenster maximieren"}
            data-testid={`window-maximize-${win.id}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onToggleMaximize}
            className="grid size-6 place-items-center rounded-md text-muted-foreground/60 transition-colors duration-200 hover:bg-white/5 hover:text-foreground"
          >
            {win.maximized ? <Minimize2 className="size-3" /> : <Maximize2 className="size-3" />}
          </button>
          <button
            type="button"
            aria-label="Fenster schließen"
            data-testid={`window-close-${win.id}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
            className="grid size-6 place-items-center rounded-md text-muted-foreground/60 transition-colors duration-200 hover:bg-red-500/10 hover:text-red-300"
          >
            <X className="size-3" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto" data-testid={`window-body-${win.id}`}>
        {children}
      </div>

      {!win.maximized && (
        <div
          data-testid={`window-resize-${win.id}`}
          role="presentation"
          onPointerDown={beginResize}
          onPointerMove={moveResize}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          className="absolute right-0 bottom-0 size-4 cursor-se-resize"
          style={{
            background:
              "linear-gradient(135deg, transparent 55%, rgba(148,163,184,0.35) 55%, rgba(148,163,184,0.35) 62%, transparent 62%)",
          }}
        />
      )}
    </motion.section>
  );
}
