import {
  Brain,
  FileText,
  Folder,
  Globe,
  GraduationCap,
  MessageSquare,
  SlidersHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Mirrors backend/routers/nova.py — CommandResult */
export interface CommandResult {
  id: string;
  prompt: string;
  reply: string;
  orb_state: string;
  open_window: string | null;
  created_at: string;
}

/** Mirrors backend/routers/nova.py — OrbStates */
export interface NovaMeta {
  states: string[];
  apps: string[];
}

export type OrbState =
  | "idle"
  | "denken"
  | "antworten"
  | "erfolg"
  | "warnung"
  | "fehler";

export const ORB_STATES: OrbState[] = [
  "idle",
  "denken",
  "antworten",
  "erfolg",
  "warnung",
  "fehler",
];

export const ORB_LABELS: Record<OrbState, string> = {
  idle: "Bereit",
  denken: "Denken",
  antworten: "Antworten",
  erfolg: "Erfolg",
  warnung: "Warnung",
  fehler: "Fehler",
};

export interface OrbTheme {
  primary: string;
  secondary: string;
  glow: string;
  /** breathing cycle in seconds */
  speed: number;
}

export const ORB_THEMES: Record<OrbState, OrbTheme> = {
  idle: { primary: "#06b6d4", secondary: "#3b82f6", glow: "rgba(6,182,212,0.40)", speed: 5.5 },
  denken: { primary: "#8b5cf6", secondary: "#3b82f6", glow: "rgba(139,92,246,0.50)", speed: 2.6 },
  antworten: { primary: "#f8fafc", secondary: "#06b6d4", glow: "rgba(226,240,252,0.55)", speed: 1.9 },
  erfolg: { primary: "#22c55e", secondary: "#10b981", glow: "rgba(34,197,94,0.45)", speed: 3.4 },
  warnung: { primary: "#f59e0b", secondary: "#eab308", glow: "rgba(245,158,11,0.45)", speed: 3.0 },
  fehler: { primary: "#ef4444", secondary: "#dc2626", glow: "rgba(239,68,68,0.45)", speed: 3.8 },
};

export type AppId =
  | "chat"
  | "browser"
  | "files"
  | "memory"
  | "schule"
  | "notizen"
  | "einstellungen";

export interface AppDef {
  id: AppId;
  title: string;
  hint: string;
  icon: LucideIcon;
  size: { w: number; h: number };
  offset: { x: number; y: number };
}

export const APPS: AppDef[] = [
  {
    id: "chat",
    title: "Chat",
    hint: "Dialog mit NOVA",
    icon: MessageSquare,
    size: { w: 660, h: 500 },
    offset: { x: 0, y: 0 },
  },
  {
    id: "browser",
    title: "Browser",
    hint: "Web mit Quellensynthese",
    icon: Globe,
    size: { w: 760, h: 540 },
    offset: { x: 64, y: 26 },
  },
  {
    id: "files",
    title: "Dateien",
    hint: "Indexierter Speicher",
    icon: Folder,
    size: { w: 680, h: 460 },
    offset: { x: 128, y: 52 },
  },
  {
    id: "memory",
    title: "Memory",
    hint: "Langzeitgedächtnis",
    icon: Brain,
    size: { w: 620, h: 480 },
    offset: { x: 192, y: 78 },
  },
  {
    id: "schule",
    title: "Schule",
    hint: "Lernen & Aufgaben",
    icon: GraduationCap,
    size: { w: 700, h: 520 },
    offset: { x: 96, y: 104 },
  },
  {
    id: "notizen",
    title: "Notizen",
    hint: "Gedanken festhalten",
    icon: FileText,
    size: { w: 580, h: 440 },
    offset: { x: 160, y: 130 },
  },
  {
    id: "einstellungen",
    title: "Einstellungen",
    hint: "System & Orb",
    icon: SlidersHorizontal,
    size: { w: 560, h: 460 },
    offset: { x: 224, y: 60 },
  },
];

export const APP_MAP: Record<AppId, AppDef> = APPS.reduce(
  (acc, app) => ({ ...acc, [app.id]: app }),
  {} as Record<AppId, AppDef>,
);

export const isAppId = (value: string | null | undefined): value is AppId =>
  !!value && APPS.some((a) => a.id === value);
