import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { APPS, type AppId } from "@/lib/nova";

export default function CommandPalette({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (id: AppId) => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return APPS;
    return APPS.filter(
      (a) => a.title.toLowerCase().includes(q) || a.hint.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[400] flex items-start justify-center bg-black/40 pt-[16vh] backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
          data-testid="command-palette-overlay"
        >
          <motion.div
            className="w-[min(560px,90vw)] overflow-hidden rounded-xl border border-cyan-500/20 bg-[#050b13]/92 backdrop-blur-2xl"
            style={{ boxShadow: "0 0 60px -10px rgba(6,182,212,0.18)" }}
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.985 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) {
                  onSelect(results[0].id);
                  onClose();
                }
              }}
              placeholder="Fenster öffnen oder Befehl suchen …"
              data-testid="command-palette-input"
              className="w-full border-b border-white/[0.06] bg-transparent px-4 py-3.5 text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground/60"
            />
            <ul className="max-h-[46vh] overflow-auto py-1.5">
              {results.map((app) => (
                <li key={app.id}>
                  <button
                    type="button"
                    data-testid={`command-palette-item-${app.id}`}
                    onClick={() => {
                      onSelect(app.id);
                      onClose();
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-cyan-400/[0.06]"
                  >
                    <app.icon className="size-3.5 text-cyan-300/60" />
                    <span className="text-[13px] text-foreground/85">{app.title}</span>
                    <span className="ml-auto font-mono text-[10.5px] text-muted-foreground/60">
                      {app.hint}
                    </span>
                  </button>
                </li>
              ))}
              {results.length === 0 && (
                <li className="px-4 py-3 font-mono text-[11.5px] text-muted-foreground/60">
                  Kein Treffer
                </li>
              )}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
