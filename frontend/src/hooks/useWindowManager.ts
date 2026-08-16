import { useCallback, useEffect, useMemo, useState } from "react";
import { APP_MAP, type AppId } from "@/lib/nova";

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
  const [windows, setWindows] = useState<WinState[]>([]);
  const [, setTopZ] = useState(10);

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
    focus,
    minimize,
    toggleMaximize,
    setRect,
    limits: { MIN_W, MIN_H },
  };
}
