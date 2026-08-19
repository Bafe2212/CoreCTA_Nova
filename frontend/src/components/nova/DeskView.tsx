import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Camera, CameraOff, X } from "lucide-react";

/**
 * JARVIS Desk-View:
 *  - großes Overlay über dem Grid (Live-Kamera oder Standbild)
 *  - leicht transparent mit HUD-Rahmen
 *  - wird über Sprachbefehl oder Button ein-/ausgeblendet
 *
 * Versucht `getUserMedia` für die Live-Kamera; fällt auf ein
 * Standbild-Platzhalter zurück, wenn der Zugriff verweigert wird.
 */
export default function DeskView({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      // beim Schließen Stream freigeben
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      setLive(false);
      setError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setLive(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Kamera nicht verfügbar");
        setLive(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-[240] flex items-center justify-center p-8"
          initial={{ opacity: 0, scale: 1.04, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0)" }}
          exit={{ opacity: 0, scale: 1.04, filter: "blur(10px)" }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          data-testid="desk-view"
        >
          {/* HUD-Rahmen */}
          <div
            className="relative h-full w-full max-w-[1100px] overflow-hidden rounded-2xl border border-cyan-400/30 bg-black/55 backdrop-blur-md"
            style={{
              boxShadow:
                "0 0 50px -10px rgba(34,211,238,0.4), inset 0 0 40px rgba(34,211,238,0.05)",
            }}
          >
            {/* Eck-Klammern */}
            {[
              "top-3 left-3 border-t border-l",
              "top-3 right-3 border-t border-r",
              "bottom-3 left-3 border-b border-l",
              "bottom-3 right-3 border-b border-r",
            ].map((p) => (
              <span
                key={p}
                className={`absolute size-6 border-cyan-300/50 ${p}`}
                aria-hidden="true"
              />
            ))}

            {/* Video / Standbild */}
            {live ? (
              <video
                ref={videoRef}
                className="size-full object-cover opacity-90"
                playsInline
                muted
                data-testid="desk-video"
              />
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-3 text-cyan-200/70">
                {error ? <CameraOff className="size-10" /> : <Camera className="size-10" />}
                <p className="font-mono text-[11px] tracking-[0.22em] uppercase">
                  {error ? "KAMERA GESPERRT" : "KAMERA WIRD GELADEN …"}
                </p>
                {error && (
                  <p className="max-w-md text-center text-[11px] text-muted-foreground/70">
                    {error}
                  </p>
                )}
              </div>
            )}

            {/* Scan-Linien-Overlay über dem Bild */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "repeating-linear-gradient(to bottom, transparent 0, transparent 3px, rgba(34,211,238,0.04) 3px, rgba(34,211,238,0.04) 4px)",
              }}
            />

            {/* Header */}
            <div className="absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-cyan-400/25 bg-black/50 px-3 py-1 backdrop-blur">
              <span
                className={`size-1.5 rounded-full ${live ? "bg-cyan-400" : "bg-red-400"}`}
                style={{
                  animation: live ? "hud-status-blink 1.4s ease-in-out infinite" : undefined,
                  boxShadow: live ? "0 0 8px #22d3ee" : "0 0 8px #ef4444",
                }}
              />
              <span className="font-mono text-[9.5px] tracking-[0.28em] text-cyan-200/80 uppercase">
                {live ? "DESK VIEW · LIVE" : "DESK VIEW · OFFLINE"}
              </span>
            </div>

            {/* Schließen-Button */}
            <button
              type="button"
              aria-label="Desk-View schließen"
              data-testid="desk-close"
              onClick={onClose}
              className="absolute top-4 right-4 grid size-8 place-items-center rounded-lg border border-cyan-400/30 bg-black/50 text-cyan-200 backdrop-blur transition-colors hover:bg-cyan-400/15"
            >
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
