import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { AppId } from "@/lib/nova";
import ChatApp, { type ChatBridge } from "@/components/nova/apps/ChatApp";
import NotesApp from "@/components/nova/apps/NotesApp";
import MemoryApp from "@/components/nova/apps/MemoryApp";
import FilesApp from "@/components/nova/apps/FilesApp";
import SchoolApp from "@/components/nova/apps/SchoolApp";
import SettingsApp, {
  type LlmBridge,
  type SessionBridge,
  type SpeechBridge,
  type VoiceBridge,
} from "@/components/nova/apps/SettingsApp";
import type { OrbState } from "@/lib/nova";

export type { ChatBridge, LlmBridge, SessionBridge, SpeechBridge, VoiceBridge };

/** The browser surface stays a MOCK — it only sketches how NOVA would present sources. */
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
      <div className="px-5 py-4 text-[13.5px] text-foreground/85">
        <p className="font-heading text-[15px] text-foreground/90">Quellensynthese</p>
        <p className="mt-2 text-muted-foreground">
          Diese Oberfläche ist noch eine Skizze — sie zeigt, wie NOVA Quellen verdichten würde.
        </p>
        <div className="mt-4 space-y-2">
          {[
            "arxiv.org · Übersichtsarbeit 2025",
            "mpg.de · Experimentelle Bestätigung",
            "nature.com · Kritische Replik",
          ].map((src) => (
            <div
              key={src}
              className="flex items-center gap-2 rounded-lg border border-white/[0.05] px-3 py-2 transition-colors duration-200 hover:border-cyan-500/20"
            >
              <span className="size-1 rounded-full bg-cyan-400/70" />
              <span className="font-mono text-[11.5px] text-foreground/70">{src}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
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
  llm,
}: {
  id: AppId;
  chat: ChatBridge;
  orbState: OrbState;
  setOrbState: (s: OrbState) => void;
  speech: SpeechBridge;
  voice: VoiceBridge;
  session: SessionBridge;
  llm: LlmBridge;
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
      return <SchoolApp />;
    case "notizen":
      return <NotesApp />;
    case "einstellungen":
      return (
        <SettingsApp
          orbState={orbState}
          setOrbState={setOrbState}
          speech={speech}
          voice={voice}
          session={session}
          llm={llm}
        />
      );
    default:
      return null;
  }
}
