import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateNote, useDeleteNote, useNotes, useUpdateNote } from "@/hooks/useNovaData";

export default function NotesApp() {
  const notes = useNotes();
  const create = useCreateNote();
  const update = useUpdateNote();
  const remove = useDeleteNote();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const saveTimer = useRef(0);

  const list = notes.data ?? [];
  const active = list.find((n) => n.id === activeId) ?? list[0] ?? null;

  useEffect(() => {
    if (active && active.id !== activeId) setActiveId(active.id);
    if (active) {
      setTitle(active.title);
      setBody(active.body);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  const queueSave = (patch: { title?: string; body?: string }) => {
    if (!active) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      update.mutate({ id: active.id, ...patch });
    }, 700);
  };

  return (
    <div className="flex h-full">
      <aside className="flex w-44 shrink-0 flex-col border-r border-white/[0.05]">
        <button
          type="button"
          data-testid="note-create-button"
          onClick={() => create.mutate({ title: "Neue Notiz", body: "" })}
          className="flex items-center gap-2 border-b border-white/[0.05] px-3 py-2.5 text-left font-mono text-[10.5px] tracking-[0.16em] text-cyan-200/70 uppercase transition-colors duration-200 hover:text-cyan-100"
        >
          <Plus className="size-3" /> Notiz
        </button>
        <div className="min-h-0 flex-1 overflow-auto">
          {list.map((note) => (
            <button
              key={note.id}
              type="button"
              data-testid={`note-item-${note.id}`}
              onClick={() => setActiveId(note.id)}
              className="block w-full border-b border-white/[0.03] px-3 py-2.5 text-left transition-colors duration-200 hover:bg-white/[0.03]"
              style={{ color: active?.id === note.id ? "#a5f3fc" : "rgba(226,232,240,0.7)" }}
            >
              <span className="block truncate text-[12.5px]">{note.title}</span>
              <span className="block truncate font-mono text-[10px] text-muted-foreground/50">
                {new Date(note.updated_at).toLocaleDateString("de-DE")}
              </span>
            </button>
          ))}
          {list.length === 0 && (
            <p className="px-3 py-3 font-mono text-[10.5px] text-muted-foreground/60">
              Noch keine Notizen
            </p>
          )}
        </div>
      </aside>

      {active ? (
        <div className="flex min-w-0 flex-1 flex-col px-4 py-3">
          <div className="flex items-center gap-2">
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                queueSave({ title: e.target.value });
              }}
              data-testid="note-title-input"
              className="h-8 border-transparent bg-transparent px-0 font-heading text-[14px] tracking-[0.04em] focus-visible:border-cyan-500/25"
            />
            <button
              type="button"
              aria-label="Notiz löschen"
              data-testid="note-delete-button"
              onClick={() => {
                remove.mutate(active.id);
                setActiveId(null);
              }}
              className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground/50 transition-colors duration-200 hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
          <Textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              queueSave({ body: e.target.value });
            }}
            placeholder="Schreib los — NOVA sichert automatisch."
            data-testid="note-body-input"
            className="mt-2 min-h-0 flex-1 resize-none border-transparent bg-transparent px-0 text-[13.5px] leading-relaxed focus-visible:border-cyan-500/25"
          />
          <p className="mt-1 font-mono text-[10px] text-muted-foreground/50">
            {update.isPending ? "sichere …" : "automatisch gesichert"}
          </p>
        </div>
      ) : (
        <div className="grid flex-1 place-items-center">
          <p className="font-mono text-[11px] text-muted-foreground/60">
            Lege links eine Notiz an.
          </p>
        </div>
      )}
    </div>
  );
}
