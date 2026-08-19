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
          <p className="font-mono text-[11.5px] text-cyan-300/60">
            Noch keine Konversation. Frag NOVA etwas — sie antwortet über {chat.provider || "deinen Anbieter"}.
          </p>
        )}
        {list.map((msg) =>
          msg.role === "user" ? (
            <div key={msg.id} className="flex justify-end" data-testid={`chat-user-${msg.id}`}>
              <div
                className="max-w-[85%] rounded-lg rounded-br-sm border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-1.5 text-right text-[13px] text-foreground/90"
                style={{ boxShadow: "0 0 12px -4px rgba(34,211,238,0.3)" }}
              >
                {msg.content}
              </div>
            </div>
          ) : (
            <div key={msg.id} className="flex gap-2.5" data-testid={`chat-assistant-${msg.id}`}>
              <span
                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-cyan-400/80"
                style={{
                  boxShadow: "0 0 10px rgba(34,211,238,0.8)",
                  animation: "hud-status-blink 2s ease-in-out infinite",
                }}
              />
              <div className="max-w-[85%]">
                <p className="whitespace-pre-wrap text-[13px] text-foreground/80" style={{ textShadow: "0 0 6px rgba(34,211,238,0.15)" }}>
                  {msg.content}
                </p>
                {msg.model && (
                  <p className="mt-1 font-mono text-[9.5px] tracking-wider text-cyan-300/40">
                    {msg.model}
                  </p>
                )}
              </div>
            </div>
          ),
        )}
        {chat.pending && (
          <div className="flex justify-end" data-testid="chat-pending-user">
            <div
              className="max-w-[85%] rounded-lg rounded-br-sm border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-1.5 text-right text-[13px] text-foreground/90"
              style={{ boxShadow: "0 0 12px -4px rgba(34,211,238,0.3)" }}
            >
              {chat.pending}
            </div>
          </div>
        )}
        {chat.streaming && (
          <div className="flex gap-2.5" data-testid="chat-streaming">
            <span
              className="mt-1.5 size-1.5 shrink-0 animate-pulse rounded-full bg-violet-400/90"
              style={{ boxShadow: "0 0 10px rgba(167,139,250,0.8)" }}
            />
            <p className="whitespace-pre-wrap text-[13px] text-foreground/80" style={{ textShadow: "0 0 6px rgba(139,92,246,0.15)" }}>
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
        className="flex shrink-0 items-center gap-2 border-t border-cyan-400/15 px-4 py-3"
      >
        <button
          type="button"
          aria-label="Verlauf leeren"
          data-testid="chat-clear-button"
          onClick={() => clear.mutate()}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-cyan-300/50 transition-colors duration-200 hover:bg-cyan-400/10 hover:text-cyan-200"
        >
          <Eraser className="size-3.5" />
        </button>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={chat.streaming ? "NOVA antwortet …" : "Nachricht an NOVA"}
          disabled={chat.streaming}
          data-testid="chat-input"
          className="h-9 border-cyan-400/20 bg-cyan-400/[0.04] font-mono text-[12.5px] text-cyan-50 placeholder:text-cyan-300/40 transition-all duration-300 focus-visible:border-cyan-400/50 focus-visible:bg-cyan-400/[0.08]"
          style={{
            boxShadow: "inset 0 0 8px rgba(34,211,238,0.08)",
          }}
        />
        <button
          type="submit"
          aria-label="Nachricht senden"
          data-testid="chat-send-button"
          disabled={chat.streaming}
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-cyan-400/30 text-cyan-300/80 transition-all duration-200 hover:bg-cyan-400/15 hover:text-cyan-100 disabled:opacity-40"
          style={{ boxShadow: "0 0 12px -4px rgba(34,211,238,0.4)" }}
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}
