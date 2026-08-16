import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { messagesKey } from "@/hooks/useNovaData";

/**
 * Streams NOVA's answer token by token from GET /api/chat/stream (SSE).
 * The relative URL goes through Vite's /api proxy like every other call.
 */
export interface ChatStream {
  streaming: boolean;
  /** the prompt currently being answered (optimistic bubble) */
  pending: string | null;
  /** text accumulated so far */
  partial: string;
  error: string | null;
  send: (prompt: string) => void;
  stop: () => void;
}

export function useChatStream(opts: {
  provider: string;
  model: string;
  onStart?: () => void;
  onFirstDelta?: () => void;
  onDone?: (text: string) => void;
  onError?: (message: string) => void;
}): ChatStream {
  const [streaming, setStreaming] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const textRef = useRef("");
  const firstRef = useRef(true);
  const qc = useQueryClient();
  const cb = useRef(opts);
  cb.current = opts;

  const close = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  useEffect(() => () => close(), [close]);

  const stop = useCallback(() => {
    close();
    setStreaming(false);
    setPending(null);
    setPartial("");
  }, [close]);

  const send = useCallback(
    (prompt: string) => {
      const value = prompt.trim();
      if (!value || sourceRef.current) return;
      setError(null);
      setPending(value);
      setPartial("");
      setStreaming(true);
      textRef.current = "";
      firstRef.current = true;
      cb.current.onStart?.();

      const params = new URLSearchParams({ prompt: value });
      if (cb.current.provider) params.set("provider", cb.current.provider);
      if (cb.current.model) params.set("model", cb.current.model);
      const es = new EventSource(`/api/chat/stream?${params.toString()}`);
      sourceRef.current = es;

      es.onmessage = (event) => {
        let data: {
          delta?: string;
          done?: boolean;
          error?: string;
        };
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        if (data.error) {
          setError(data.error);
          cb.current.onError?.(data.error);
          close();
          setStreaming(false);
          setPending(null);
          setPartial("");
          void qc.invalidateQueries({ queryKey: messagesKey });
          return;
        }
        if (typeof data.delta === "string") {
          if (firstRef.current) {
            firstRef.current = false;
            cb.current.onFirstDelta?.();
          }
          textRef.current += data.delta;
          setPartial(textRef.current);
          return;
        }
        if (data.done) {
          const text = textRef.current;
          close();
          setStreaming(false);
          setPending(null);
          setPartial("");
          void qc.invalidateQueries({ queryKey: messagesKey });
          cb.current.onDone?.(text);
        }
      };

      es.onerror = () => {
        // the server closes the stream after 'done'; only report real failures
        if (!sourceRef.current) return;
        close();
        setStreaming(false);
        setPending(null);
        setPartial("");
        const message = "Verbindung zum Anbieter unterbrochen.";
        setError(message);
        cb.current.onError?.(message);
        void qc.invalidateQueries({ queryKey: messagesKey });
      };
    },
    [close, qc],
  );

  return { streaming, pending, partial, error, send, stop };
}
