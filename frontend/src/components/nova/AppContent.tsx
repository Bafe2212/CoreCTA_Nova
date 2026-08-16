import { useState } from "react";
import { Ear, EarOff, Search, Send, Sparkles, Volume2, VolumeX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ORB_LABELS,
  ORB_STATES,
  ORB_THEMES,
  type AppId,
  type CommandResult,
  type OrbState,
} from "@/lib/nova";

export interface ChatBridge {
  history: CommandResult[];
  pending: boolean;
  send: (prompt: string) => void;
}

export interface SpeechBridge {
  supported: boolean;
  enabled: boolean;
  speaking: boolean;
  setEnabled: (v: boolean) => void;
  test: () => void;
}

export interface VoiceBridge {
  supported: boolean;
  wakeEnabled: boolean;
  wakeActive: boolean;
  setWakeEnabled: (v: boolean) => void;
}

export interface SessionBridge {
  openCount: number;
  reset: () => void;
}

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="h-full px-5 py-4 text-[13.5px] leading-relaxed text-foreground/85">{children}</div>
);

const Line = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between border-b border-white/[0.04] py-2 last:border-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-mono text-[11.5px] text-cyan-200/80">{value}</span>
  </div>
);

function ChatApp({ chat }: { chat: ChatBridge }) {
  const [draft, setDraft] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    chat.send(draft.trim());
    setDraft("");
  };
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-auto px-5 py-4" data-testid="chat-transcript">
        {chat.history.length === 0 && (
          <p className="font-mono text-[11.5px] text-muted-foreground/70">
            Noch keine Konversation. Stelle NOVA eine Frage.
          </p>
        )}
        {chat.history.map((entry) => (
          <div key={entry.id} className="space-y-2" data-testid={`chat-entry-${entry.id}`}>
            <p className="text-right text-[13.5px] text-foreground/90">{entry.prompt}</p>
            <div className="flex gap-2.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-cyan-400/80 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
              <p className="text-[13.5px] text-foreground/70">{entry.reply}</p>
            </div>
          </div>
        ))}
        {chat.pending && (
          <p className="font-mono text-[11px] tracking-widest text-violet-300/70" data-testid="chat-thinking">
            NOVA denkt …
          </p>
        )}
      </div>
      <form
        onSubmit={submit}
        className="flex shrink-0 items-center gap-2 border-t border-white/[0.05] px-4 py-3"
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Nachricht an NOVA"
          data-testid="chat-input"
          className="h-9 border-transparent bg-white/[0.03] text-[13px] transition-colors duration-300 focus-visible:border-cyan-500/40"
        />
        <button
          type="submit"
          aria-label="Nachricht senden"
          data-testid="chat-send-button"
          className="grid size-9 shrink-0 place-items-center rounded-lg text-cyan-300/70 transition-colors duration-200 hover:bg-cyan-400/10 hover:text-cyan-200"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}

function BrowserApp() {
  const [url, setUrl] = useState("nova://synthese/quantenverschraenkung");
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-white/[0.05] px-4 py-2.5">
        <Search className="size-3.5 text-muted-foreground/60" />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          data-testid="browser-url-input"
          className="h-8 border-transparent bg-transparent font-mono text-[11.5px] focus-visible:border-cyan-500/30"
        />
      </div>
      <Shell>
        <p className="font-heading text-[15px] text-foreground/90">Quellensynthese</p>
        <p className="mt-2 text-muted-foreground">
          Ich habe 14 Quellen gelesen und die drei belastbarsten zu einer Antwort verdichtet.
          Widersprüche sind markiert.
        </p>
        <div className="mt-4 space-y-2">
          {["arxiv.org · Übersichtsarbeit 2025", "mpg.de · Experimentelle Bestätigung", "nature.com · Kritische Replik"].map(
            (src) => (
              <div
                key={src}
                className="flex items-center gap-2 rounded-lg border border-white/[0.05] px-3 py-2 transition-colors duration-200 hover:border-cyan-500/20"
              >
                <span className="size-1 rounded-full bg-cyan-400/70" />
                <span className="font-mono text-[11.5px] text-foreground/70">{src}</span>
              </div>
            ),
          )}
        </div>
      </Shell>
    </div>
  );
}

function FilesApp() {
  const files = [
    ["Physik_Zusammenfassung.md", "18 KB", "heute"],
    ["Nova_Systembericht.pdf", "1,2 MB", "gestern"],
    ["Vokabeln_Spanisch.csv", "44 KB", "vor 3 Tagen"],
    ["Projekt_Aurora/", "12 Objekte", "vor 1 Woche"],
  ];
  return (
    <Shell>
      <p className="font-heading text-[13px] tracking-[0.16em] text-muted-foreground uppercase">
        Indexierter Speicher
      </p>
      <div className="mt-3">
        {files.map(([name, size, when]) => (
          <button
            key={name}
            type="button"
            data-testid={`file-row-${name}`}
            className="flex w-full items-center justify-between border-b border-white/[0.04] px-1 py-2.5 text-left transition-colors duration-200 last:border-0 hover:text-cyan-200"
          >
            <span className="text-[13px]">{name}</span>
            <span className="font-mono text-[11px] text-muted-foreground/70">
              {size} · {when}
            </span>
          </button>
        ))}
      </div>
    </Shell>
  );
}

function MemoryApp() {
  return (
    <Shell>
      <p className="font-heading text-[13px] tracking-[0.16em] text-muted-foreground uppercase">
        Langzeitgedächtnis
      </p>
      <div className="mt-4 space-y-3">
        {[
          "Du arbeitest abends konzentrierter — ich halte Benachrichtigungen bis 18 Uhr zurück.",
          "Physik-Klausur am 14. — Lernplan liegt im Schule-Fenster.",
          "Du magst kurze Antworten mit einem konkreten nächsten Schritt.",
        ].map((m, i) => (
          <div
            key={m}
            className="rounded-lg border border-white/[0.05] px-3 py-2.5 text-[13px] text-foreground/80"
            data-testid={`memory-item-${i}`}
          >
            {m}
          </div>
        ))}
      </div>
      <div className="mt-5">
        <Line label="Vektoren" value="18 402" />
        <Line label="Letzte Verdichtung" value="vor 2 h" />
      </div>
    </Shell>
  );
}

function SchuleApp() {
  return (
    <Shell>
      <div className="flex items-center gap-2">
        <Sparkles className="size-3.5 text-cyan-300/70" />
        <p className="font-heading text-[13px] tracking-[0.16em] text-muted-foreground uppercase">
          Lernmodus
        </p>
      </div>
      <div className="mt-4 space-y-3">
        {[
          ["Physik", "Impulserhaltung · 3 Aufgaben offen"],
          ["Mathematik", "Integralrechnung · Übung bereit"],
          ["Spanisch", "40 Vokabeln fällig"],
        ].map(([subject, task]) => (
          <div
            key={subject}
            className="flex items-center justify-between rounded-lg border border-white/[0.05] px-3 py-3"
            data-testid={`schule-subject-${subject}`}
          >
            <div>
              <p className="text-[13.5px] text-foreground/90">{subject}</p>
              <p className="font-mono text-[11px] text-muted-foreground/70">{task}</p>
            </div>
            <Badge variant="outline" className="border-cyan-500/25 text-[10px] text-cyan-200/80">
              starten
            </Badge>
          </div>
        ))}
      </div>
    </Shell>
  );
}

function NotizenApp() {
  const [text, setText] = useState(
    "Idee: NOVA soll morgens einen ruhigen Tagesüberblick geben — drei Zeilen, kein Dashboard.",
  );
  return (
    <div className="flex h-full flex-col px-5 py-4">
      <p className="font-heading text-[13px] tracking-[0.16em] text-muted-foreground uppercase">
        Gedanken
      </p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        data-testid="notizen-editor"
        className="mt-3 min-h-0 flex-1 resize-none border-transparent bg-transparent text-[13.5px] leading-relaxed focus-visible:border-cyan-500/25"
      />
      <p className="mt-2 font-mono text-[10.5px] text-muted-foreground/60">
        {text.trim().split(/\s+/).filter(Boolean).length} Wörter · automatisch gesichert
      </p>
    </div>
  );
}

function SettingsApp({
  orbState,
  setOrbState,
  speech,
  voice,
  session,
}: {
  orbState: OrbState;
  setOrbState: (s: OrbState) => void;
  speech: SpeechBridge;
  voice: VoiceBridge;
  session: SessionBridge;
}) {
  return (
    <Shell>
      <p className="font-heading text-[13px] tracking-[0.16em] text-muted-foreground uppercase">
        Orb-Zustand
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {ORB_STATES.map((s) => (
          <button
            key={s}
            type="button"
            data-testid={`settings-orb-state-${s}`}
            onClick={() => setOrbState(s)}
            className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11.5px] transition-colors duration-300"
            style={{
              borderColor: orbState === s ? ORB_THEMES[s].primary : "rgba(148,163,184,0.14)",
              color: orbState === s ? ORB_THEMES[s].primary : "rgba(148,163,184,0.8)",
            }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ background: ORB_THEMES[s].primary }}
            />
            {ORB_LABELS[s]}
          </button>
        ))}
      </div>
      <p className="mt-7 font-heading text-[13px] tracking-[0.16em] text-muted-foreground uppercase">
        Stimme
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          data-testid="settings-speech-toggle"
          onClick={() => speech.setEnabled(!speech.enabled)}
          disabled={!speech.supported}
          className="flex items-center gap-2.5 rounded-full border px-3 py-1.5 text-[11.5px] transition-colors duration-300 disabled:opacity-40"
          style={{
            borderColor: speech.enabled ? "rgba(34,211,238,0.45)" : "rgba(148,163,184,0.14)",
            color: speech.enabled ? "#67e8f9" : "rgba(148,163,184,0.8)",
          }}
        >
          {speech.enabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
          {speech.enabled ? "Antworten vorlesen" : "Stumm"}
        </button>
        <button
          type="button"
          data-testid="settings-speech-test"
          onClick={speech.test}
          disabled={!speech.supported || !speech.enabled}
          className="font-mono text-[11px] text-muted-foreground/70 transition-colors duration-200 hover:text-cyan-200 disabled:opacity-40"
        >
          Probe hören
        </button>
      </div>
      {!speech.supported && (
        <p className="mt-2 font-mono text-[10.5px] text-muted-foreground/60">
          Dieser Browser kann nicht sprechen.
        </p>
      )}
      <p className="mt-7 font-heading text-[13px] tracking-[0.16em] text-muted-foreground uppercase">
        Weckwort
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          data-testid="settings-wake-toggle"
          onClick={() => voice.setWakeEnabled(!voice.wakeEnabled)}
          disabled={!voice.supported}
          className="flex items-center gap-2.5 rounded-full border px-3 py-1.5 text-[11.5px] transition-colors duration-300 disabled:opacity-40"
          style={{
            borderColor: voice.wakeEnabled ? "rgba(34,211,238,0.45)" : "rgba(148,163,184,0.14)",
            color: voice.wakeEnabled ? "#67e8f9" : "rgba(148,163,184,0.8)",
          }}
        >
          {voice.wakeEnabled ? <Ear className="size-3.5" /> : <EarOff className="size-3.5" />}
          {voice.wakeEnabled ? "„Hey NOVA“ aktiv" : "Weckwort aus"}
        </button>
        <span className="font-mono text-[10.5px] text-muted-foreground/60">
          {voice.wakeEnabled
            ? voice.wakeActive
              ? "wartet im Hintergrund"
              : "kurz unterbrochen"
            : "Orb antippen genügt"}
        </span>
      </div>
      {!voice.supported && (
        <p className="mt-2 font-mono text-[10.5px] text-muted-foreground/60">
          Dieser Browser kann nicht zuhören.
        </p>
      )}

      <p className="mt-7 font-heading text-[13px] tracking-[0.16em] text-muted-foreground uppercase">
        Sitzung
      </p>
      <div className="mt-3 flex items-center gap-3">
        <span className="font-mono text-[11px] text-muted-foreground/70">
          {session.openCount} Fenster werden beim nächsten Start wiederhergestellt
        </span>
        <button
          type="button"
          data-testid="settings-session-reset"
          onClick={session.reset}
          className="font-mono text-[11px] text-muted-foreground/70 transition-colors duration-200 hover:text-cyan-200"
        >
          Layout zurücksetzen
        </button>
      </div>

      <div className="mt-6">
        <Line label="Sprache" value="Deutsch · ruhig" />
        <Line label="Bewegungsintensität" value="dezent" />
        <Line label="Anonymer Modus" value="aktiv" />
        <Line label="Renderpfad" value="Canvas 2D · 60 fps" />
      </div>
    </Shell>
  );
}

export default function AppContent({
  id,
  chat,
  orbState,
  setOrbState,
  speech,
  voice,
  session,
}: {
  id: AppId;
  chat: ChatBridge;
  orbState: OrbState;
  setOrbState: (s: OrbState) => void;
  speech: SpeechBridge;
  voice: VoiceBridge;
  session: SessionBridge;
}) {
  switch (id) {
    case "chat":
      return <ChatApp chat={chat} />;
    case "browser":
      return <BrowserApp />;
    case "files":
      return <FilesApp />;
    case "memory":
      return <MemoryApp />;
    case "schule":
      return <SchuleApp />;
    case "notizen":
      return <NotizenApp />;
    case "einstellungen":
      return (
        <SettingsApp
          orbState={orbState}
          setOrbState={setOrbState}
          speech={speech}
          voice={voice}
          session={session}
        />
      );
    default:
      return null;
  }
}
