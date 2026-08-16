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
  children: React.ReactNode;
}

const MIN_W = 320;
const MIN_H = 220;
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export default function NovaWindow({
  win,
  active,
  viewport,
  onFocus,
  onClose,
  onMinimize,
  onToggleMaximize,
  onRect,
  children,
}: Props) {
  const def = APP_MAP[win.id];
  const Icon = def.icon;
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [grow, setGrow] = useState<{ dw: number; dh: number } | null>(null);
  const startRef = useRef({ px: 0, py: 0 });

  const beginDrag = (e: React.PointerEvent) => {
    if (win.maximized) return;
    onFocus();
    startRef.current = { px: e.clientX, py: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ dx: 0, dy: 0 });
  };

  const moveDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    setDrag({ dx: e.clientX - startRef.current.px, dy: e.clientY - startRef.current.py });
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    onRect({
      ...win.rect,
      x: clamp(win.rect.x + drag.dx, -win.rect.w + 120, viewport.w - 120),
      y: clamp(win.rect.y + drag.dy, 8, viewport.h - DOCK_HEIGHT + 40),
    });
    setDrag(null);
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
  const x = win.rect.x + (drag?.dx ?? 0);
  const y = win.rect.y + (drag?.dy ?? 0);
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
