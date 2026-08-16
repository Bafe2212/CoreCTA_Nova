import { useCallback, useEffect, useMemo, useState } from "react";
import { APP_MAP, isAppId, type AppId } from "@/lib/nova";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WinState {
  id: AppId;
  rect: Rect;
  /** rect to return to when un-maximizing */
  restore: Rect | null;
  z: number;
  minimized: boolean;
  maximized: boolean;
}

export const DOCK_HEIGHT = 150;
const MIN_W = 320;
const MIN_H = 220;
const STORAGE_KEY = "nova.session.v1";

const num = (v: unknown, fallback: number) => (typeof v === "number" && isFinite(v) ? v : fallback);

/** Restore the last session's windows, clamped into the current viewport. */
function loadSession(): WinState[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return parsed.flatMap((entry): WinState[] => {
      const e = entry as Partial<WinState> & { rect?: Partial<Rect> };
      if (!isAppId(e.id ?? null)) return [];
      const w = Math.min(Math.max(num(e.rect?.w, 600), MIN_W), Math.max(MIN_W, vw - 24));
      const h = Math.min(Math.max(num(e.rect?.h, 460), MIN_H), Math.max(MIN_H, vh - 24));
      return [
        {
          id: e.id as AppId,
          rect: {
            x: Math.min(Math.max(num(e.rect?.x, 40), 0), Math.max(0, vw - 120)),
            y: Math.min(Math.max(num(e.rect?.y, 40), 8), Math.max(8, vh - 80)),
            w,
            h,
          },
          restore: null,
          z: num(e.z, 10),
          minimized: !!e.minimized,
          maximized: false,
        },
      ];
    });
  } catch {
    return [];
  }
}

export function useViewport() {
  const [size, setSize] = useState({
    w: typeof window === "undefined" ? 1280 : window.innerWidth,
    h: typeof window === "undefined" ? 720 : window.innerHeight,
  });
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}

export function useWindowManager(viewport: { w: number; h: number }) {
  const [windows, setWindows] = useState<WinState[]>(loadSession);
  const [, setTopZ] = useState(() =>
    Math.max(10, ...loadSession().map((w) => w.z), 10) + 1,
  );

  // the session layout follows every change, so a reload brings NOVA back as it was
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          windows.map((w) => ({
            id: w.id,
            rect: w.maximized && w.restore ? w.restore : w.rect,
            z: w.z,
            minimized: w.minimized,
          })),
        ),
      );
    } catch {
      /* storage unavailable (private mode) — the session is simply not kept */
    }
  }, [windows]);

  const maxRect = useCallback(
    (): Rect => ({ x: 24, y: 24, w: viewport.w - 48, h: viewport.h - DOCK_HEIGHT - 24 }),
    [viewport.w, viewport.h],
  );

  const focus = useCallback((id: AppId) => {
    setTopZ((z) => {
      const next = z + 1;
      setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, z: next, minimized: false } : w)));
      return next;
    });
  }, []);

  const open = useCallback(
    (id: AppId) => {
      const def = APP_MAP[id];
      setTopZ((z) => {
        const next = z + 1;
        setWindows((ws) => {
          const existing = ws.find((w) => w.id === id);
          if (existing) {
            return ws.map((w) => (w.id === id ? { ...w, z: next, minimized: false } : w));
          }
          const w = Math.min(def.size.w, Math.max(MIN_W, viewport.w - 80));
          const h = Math.min(def.size.h, Math.max(MIN_H, viewport.h - DOCK_HEIGHT - 60));
          const openCount = ws.length;
          const x = Math.max(
            16,
            Math.min(viewport.w - w - 16, (viewport.w - w) / 2 - 120 + def.offset.x + openCount * 6),
          );
          const y = Math.max(
            16,
            Math.min(
              viewport.h - DOCK_HEIGHT - h - 16,
              (viewport.h - DOCK_HEIGHT - h) / 2 - 20 + def.offset.y * 0.4 + openCount * 6,
            ),
          );
          return [
            ...ws,
            { id, rect: { x, y, w, h }, restore: null, z: next, minimized: false, maximized: false },
          ];
        });
        return next;
      });
    },
    [viewport.w, viewport.h],
  );

  const close = useCallback((id: AppId) => {
    setWindows((ws) => ws.filter((w) => w.id !== id));
  }, []);

  const minimize = useCallback((id: AppId) => {
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
  }, []);

  const toggleMaximize = useCallback(
    (id: AppId) => {
      setWindows((ws) =>
        ws.map((w) => {
          if (w.id !== id) return w;
          if (w.maximized) {
            return { ...w, maximized: false, rect: w.restore ?? w.rect, restore: null };
          }
          return { ...w, maximized: true, restore: w.rect, rect: maxRect() };
        }),
      );
      focus(id);
    },
    [focus, maxRect],
  );

  const setRect = useCallback((id: AppId, rect: Rect) => {
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, rect } : w)));
  }, []);

  const closeAll = useCallback(() => setWindows([]), []);

  const resetSession = useCallback(() => {
    setWindows([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing to clear */
    }
  }, []);

  const activeId = useMemo(() => {
    const visible = windows.filter((w) => !w.minimized);
    if (!visible.length) return null;
    return visible.reduce((a, b) => (a.z > b.z ? a : b)).id;
  }, [windows]);

  return {
    windows,
    activeId,
    open,
    close,
    closeAll,
    resetSession,
    focus,
    minimize,
    toggleMaximize,
    setRect,
    limits: { MIN_W, MIN_H },
  };
}
