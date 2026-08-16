import { useEffect, useRef, useState } from "react";
import { Eraser, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useChatMessages, useClearChat } from "@/hooks/useNovaData";

export interface ChatBridge {
  provider: string;
  model: string;
  /** zentraler Stream-Zustand (in Home geführt, damit NOVA auch ohne offenes
   *  Fenster antworten + vorlesen kann) */
  streaming: boolean;
  pending: string | null;
  partial: string;
  error: string | null;
  send: (prompt: string) => void;
  stop: () => void;
}

export default function ChatApp({ chat }: { chat: ChatBridge }) {
  const [draft, setDraft] = useState("");
  const messages = useChatMessages();
  const clear = useClearChat();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // a spoken or typed command from the centre stage lands here — der Stream
  // selbst läuft zentral in Home, hier wird nur gescrollt.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.data, chat.partial, chat.pending]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || chat.streaming) return;
    chat.send(draft.trim());
    setDraft("");
  };

  const list = messages.data ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-5 py-4" data-testid="chat-transcript">
        {list.length === 0 && !chat.pending && (
          <p className="font-mono text-[11.5px] text-muted-foreground/70">
            Noch keine Konversation. Frag NOVA etwas — sie antwortet über {chat.provider || "deinen Anbieter"}.
          </p>
        )}
        {list.map((msg) =>
          msg.role === "user" ? (
            <p
              key={msg.id}
              className="text-right text-[13.5px] text-foreground/90"
              data-testid={`chat-user-${msg.id}`}
            >
              {msg.content}
            </p>
          ) : (
            <div key={msg.id} className="flex gap-2.5" data-testid={`chat-assistant-${msg.id}`}>
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-cyan-400/80 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
              <div>
                <p className="text-[13.5px] whitespace-pre-wrap text-foreground/75">{msg.content}</p>
                {msg.model && (
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground/45">{msg.model}</p>
                )}
              </div>
            </div>
          ),
        )}
        {chat.pending && (
          <p className="text-right text-[13.5px] text-foreground/90" data-testid="chat-pending-user">
            {chat.pending}
          </p>
        )}
        {chat.streaming && (
          <div className="flex gap-2.5" data-testid="chat-streaming">
            <span className="mt-1.5 size-1.5 shrink-0 animate-pulse rounded-full bg-violet-400/90 shadow-[0_0_10px_rgba(167,139,250,0.8)]" />
            <p className="text-[13.5px] whitespace-pre-wrap text-foreground/75">
              {chat.partial || (
                <span className="font-mono text-[11px] tracking-widest text-violet-300/70">
                  NOVA denkt …
                </span>
              )}
            </p>
          </div>
        )}
        {chat.error && (
          <p className="font-mono text-[11px] text-red-300/80" data-testid="chat-error">
            {chat.error}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={submit}
        className="flex shrink-0 items-center gap-2 border-t border-white/[0.05] px-4 py-3"
      >
        <button
          type="button"
          aria-label="Verlauf leeren"
          data-testid="chat-clear-button"
          onClick={() => clear.mutate()}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground/50 transition-colors duration-200 hover:bg-white/5 hover:text-foreground"
        >
          <Eraser className="size-3.5" />
        </button>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={chat.streaming ? "NOVA antwortet …" : "Nachricht an NOVA"}
          disabled={chat.streaming}
          data-testid="chat-input"
          className="h-9 border-transparent bg-white/[0.03] text-[13px] transition-colors duration-300 focus-visible:border-cyan-500/40"
        />
        <button
          type="submit"
          aria-label="Nachricht senden"
          data-testid="chat-send-button"
          disabled={chat.streaming}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-cyan-300/70 transition-colors duration-200 hover:bg-cyan-400/10 hover:text-cyan-200 disabled:opacity-40"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}
