import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCreateMemory, useDeleteMemory, useMemory } from "@/hooks/useNovaData";

export default function MemoryApp() {
  const memory = useMemory();
  const create = useCreateMemory();
  const remove = useDeleteMemory();
  const [text, setText] = useState("");
  const [tag, setTag] = useState("allgemein");

  const list = memory.data ?? [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    create.mutate({ text: text.trim(), tag: tag.trim() || "allgemein" });
    setText("");
  };

  return (
    <div className="flex h-full flex-col px-5 py-4">
      <p className="font-heading text-[13px] tracking-[0.16em] text-muted-foreground uppercase">
        Langzeitgedächtnis
      </p>
      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Was soll NOVA sich merken?"
          data-testid="memory-text-input"
          className="h-9 border-transparent bg-white/[0.03] text-[13px] focus-visible:border-cyan-500/40"
        />
        <Input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          data-testid="memory-tag-input"
          className="h-9 w-28 shrink-0 border-transparent bg-white/[0.03] font-mono text-[11px] focus-visible:border-cyan-500/40"
        />
        <button
          type="submit"
          aria-label="Merken"
          data-testid="memory-add-button"
          className="grid size-9 shrink-0 place-items-center rounded-lg text-cyan-300/70 transition-colors duration-200 hover:bg-cyan-400/10 hover:text-cyan-200"
        >
          <Plus className="size-4" />
        </button>
      </form>

      <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-auto" data-testid="memory-list">
        {list.map((item) => (
          <div
            key={item.id}
            className="group flex items-start gap-3 rounded-lg border border-white/[0.05] px-3 py-2.5 transition-colors duration-200 hover:border-cyan-500/20"
            data-testid={`memory-item-${item.id}`}
          >
            <span className="mt-0.5 rounded-full border border-cyan-500/20 px-2 py-0.5 font-mono text-[9.5px] tracking-widest text-cyan-200/70 uppercase">
              {item.tag}
            </span>
            <p className="flex-1 text-[13px] text-foreground/80">{item.text}</p>
            <button
              type="button"
              aria-label="Eintrag löschen"
              data-testid={`memory-delete-${item.id}`}
              onClick={() => remove.mutate(item.id)}
              className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground/40 opacity-0 transition-all duration-200 group-hover:opacity-100 hover:text-red-300"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        {list.length === 0 && (
          <p className="font-mono text-[11px] text-muted-foreground/60">
            NOVA merkt sich noch nichts.
          </p>
        )}
      </div>
    </div>
  );
}
