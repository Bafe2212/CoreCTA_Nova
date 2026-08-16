import { useEffect, useRef, useState } from "react";
import { Eraser, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useChatMessages, useClearChat } from "@/hooks/useNovaData";
import { useChatStream } from "@/hooks/useChatStream";

export interface ChatBridge {
  provider: string;
  model: string;
  /** prompt handed over from the centre-stage command line */
  pendingPrompt: string | null;
  consumePending: () => void;
  onStart: () => void;
  onFirstDelta: () => void;
  onDone: (text: string) => void;
  onError: (message: string) => void;
}

export default function ChatApp({ chat }: { chat: ChatBridge }) {
  const [draft, setDraft] = useState("");
  const messages = useChatMessages();
  const clear = useClearChat();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const stream = useChatStream({
    provider: chat.provider,
    model: chat.model,
    onStart: chat.onStart,
    onFirstDelta: chat.onFirstDelta,
    onDone: chat.onDone,
    onError: chat.onError,
  });

  // a spoken or typed command from the centre stage lands here
  useEffect(() => {
    if (chat.pendingPrompt && !stream.streaming) {
      stream.send(chat.pendingPrompt);
      chat.consumePending();
    }
  }, [chat, stream]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.data, stream.partial, stream.pending]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || stream.streaming) return;
    stream.send(draft.trim());
    setDraft("");
  };

  const list = messages.data ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-5 py-4" data-testid="chat-transcript">
        {list.length === 0 && !stream.pending && (
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
        {stream.pending && (
          <p className="text-right text-[13.5px] text-foreground/90" data-testid="chat-pending-user">
            {stream.pending}
          </p>
        )}
        {stream.streaming && (
          <div className="flex gap-2.5" data-testid="chat-streaming">
            <span className="mt-1.5 size-1.5 shrink-0 animate-pulse rounded-full bg-violet-400/90 shadow-[0_0_10px_rgba(167,139,250,0.8)]" />
            <p className="text-[13.5px] whitespace-pre-wrap text-foreground/75">
              {stream.partial || (
                <span className="font-mono text-[11px] tracking-widest text-violet-300/70">
                  NOVA denkt …
                </span>
              )}
            </p>
          </div>
        )}
        {stream.error && (
          <p className="font-mono text-[11px] text-red-300/80" data-testid="chat-error">
            {stream.error}
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
          placeholder={stream.streaming ? "NOVA antwortet …" : "Nachricht an NOVA"}
          disabled={stream.streaming}
          data-testid="chat-input"
          className="h-9 border-transparent bg-white/[0.03] text-[13px] transition-colors duration-300 focus-visible:border-cyan-500/40"
        />
        <button
          type="submit"
          aria-label="Nachricht senden"
          data-testid="chat-send-button"
          disabled={stream.streaming}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-cyan-300/70 transition-colors duration-200 hover:bg-cyan-400/10 hover:text-cyan-200 disabled:opacity-40"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}
