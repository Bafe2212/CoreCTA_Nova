import { motion } from "motion/react";
import {
  Camera,
  MessageSquare,
  Music,
  Settings,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * JARVIS HUD-Dock:
 *  - untere Icon-Leiste in der Mitte (wie im Video)
 *  - Symbole für Chat, Musik, Kamera/Desk-View, Einstellungen, Mikrofon, Lautsprecher
 *  - leuchtende Linien, eckig-rund, Glow
 *  - aktive Buttons heben sich hervor
 */
export interface DockAction {
  id: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  onClick: () => void;
  testId: string;
}

export default function HudDock({
  chatOpen,
  musicOpen,
  deskOpen,
  settingsOpen,
  listening,
  speaking,
  voiceSupported,
  speechEnabled,
  onToggleChat,
  onToggleMusic,
  onToggleDesk,
  onToggleSettings,
  onToggleVoice,
  onToggleSpeech,
}: {
  chatOpen: boolean;
  musicOpen: boolean;
  deskOpen: boolean;
  settingsOpen: boolean;
  listening: boolean;
  speaking: boolean;
  voiceSupported: boolean;
  speechEnabled: boolean;
  onToggleChat: () => void;
  onToggleMusic: () => void;
  onToggleDesk: () => void;
  onToggleSettings: () => void;
  onToggleVoice: () => void;
  onToggleSpeech: () => void;
}) {
  const actions: DockAction[] = [
    {
      id: "chat",
      label: "Chat",
      icon: MessageSquare,
      active: chatOpen,
      onClick: onToggleChat,
      testId: "hud-dock-chat",
    },
    {
      id: "music",
      label: "Musik",
      icon: Music,
      active: musicOpen,
      onClick: onToggleMusic,
      testId: "hud-dock-music",
    },
    {
      id: "desk",
      label: "Desk-View",
      icon: Camera,
      active: deskOpen,
      onClick: onToggleDesk,
      testId: "hud-dock-desk",
    },
    {
      id: "voice",
      label: listening ? "Zuhören beenden" : "Zuhören",
      icon: voiceSupported ? (listening ? Mic : MicOff) : MicOff,
      active: listening,
      onClick: onToggleVoice,
      testId: "hud-dock-voice",
    },
    {
      id: "speech",
      label: speechEnabled ? "TTS aus" : "TTS an",
      icon: speechEnabled ? Volume2 : VolumeX,
      active: speaking,
      onClick: onToggleSpeech,
      testId: "hud-dock-speech",
    },
    {
      id: "settings",
      label: "Einstellungen",
      icon: Settings,
      active: settingsOpen,
      onClick: onToggleSettings,
      testId: "hud-dock-settings",
    },
  ];

  return (
    <motion.div
      className="absolute inset-x-0 bottom-6 z-[200] flex justify-center"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      data-testid="hud-dock"
    >
      <div
        className="flex items-center gap-1.5 rounded-2xl border border-cyan-400/20 bg-[#050b13]/70 px-2.5 py-2 backdrop-blur-xl"
        style={{
          boxShadow:
            "0 0 30px -8px rgba(34,211,238,0.4), inset 0 0 20px rgba(34,211,238,0.05)",
        }}
      >
        {/* Eck-Klammern */}
        {[
          "top-1 left-1 border-t border-l",
          "top-1 right-1 border-t border-r",
          "bottom-1 left-1 border-b border-l",
          "bottom-1 right-1 border-b border-r",
        ].map((p) => (
          <span
            key={p}
            className={`absolute size-2 border-cyan-300/40 ${p}`}
            aria-hidden="true"
          />
        ))}

        {actions.map((a, i) => (
          <div key={a.id} className="flex items-center">
            <button
              type="button"
              aria-label={a.label}
              data-testid={a.testId}
              onClick={a.onClick}
              className="group relative grid size-10 place-items-center rounded-xl transition-all duration-300"
              style={{
                background: a.active
                  ? "rgba(34,211,238,0.12)"
                  : "transparent",
                boxShadow: a.active ? "0 0 14px rgba(34,211,238,0.35)" : undefined,
              }}
            >
              <a.icon
                className="size-4 transition-colors duration-300"
                style={{
                  color: a.active ? "#67e8f9" : "rgba(148,163,184,0.65)",
                  filter: a.active ? "drop-shadow(0 0 6px rgba(34,211,238,0.7))" : undefined,
                }}
              />
              {/* Tooltip */}
              <span className="pointer-events-none absolute -top-9 whitespace-nowrap rounded-md border border-cyan-400/20 bg-black/80 px-2 py-1 font-mono text-[9.5px] tracking-[0.18em] text-cyan-200/80 uppercase opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {a.label}
              </span>
              {/* aktive Markierung */}
              {a.active && (
                <span
                  className="absolute -bottom-1 size-1 rounded-full bg-cyan-400"
                  style={{ boxShadow: "0 0 6px #22d3ee" }}
                />
              )}
            </button>
            {/* Trennlinie zwischen Gruppen */}
            {(i === 2 || i === 4) && (
              <span className="mx-1 h-6 w-px bg-cyan-400/15" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
