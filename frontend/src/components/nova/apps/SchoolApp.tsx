import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCreateTask, useDeleteTask, useTasks, useUpdateTask } from "@/hooks/useNovaData";

export default function SchoolApp() {
  const tasks = useTasks();
  const create = useCreateTask();
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  const list = tasks.data ?? [];
  const open = list.filter((t) => !t.done);
  const done = list.filter((t) => t.done);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !title.trim()) return;
    create.mutate({ subject: subject.trim(), title: title.trim(), due: due.trim() });
    setTitle("");
    setDue("");
  };

  const row = (t: (typeof list)[number]) => (
    <div
      key={t.id}
      className="group flex items-center gap-3 rounded-lg border border-white/[0.05] px-3 py-2.5 transition-colors duration-200 hover:border-cyan-500/20"
      data-testid={`task-row-${t.id}`}
    >
      <button
        type="button"
        aria-label={t.done ? "Als offen markieren" : "Als erledigt markieren"}
        data-testid={`task-toggle-${t.id}`}
        onClick={() => update.mutate({ id: t.id, done: !t.done })}
        className="grid size-4 shrink-0 place-items-center rounded-[4px] border transition-colors duration-200"
        style={{
          borderColor: t.done ? "rgba(34,197,94,0.6)" : "rgba(148,163,184,0.3)",
          background: t.done ? "rgba(34,197,94,0.16)" : "transparent",
        }}
      >
        {t.done && <Check className="size-2.5 text-green-300" />}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-[13px]"
          style={{
            color: t.done ? "rgba(148,163,184,0.6)" : "rgba(241,245,249,0.9)",
            textDecoration: t.done ? "line-through" : "none",
          }}
        >
          {t.title}
        </p>
        <p className="font-mono text-[10.5px] text-muted-foreground/60">
          {t.subject}
          {t.due ? ` · ${t.due}` : ""}
        </p>
      </div>
      <button
        type="button"
        aria-label="Aufgabe löschen"
        data-testid={`task-delete-${t.id}`}
        onClick={() => remove.mutate(t.id)}
        className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground/40 opacity-0 transition-all duration-200 group-hover:opacity-100 hover:text-red-300"
      >
        <X className="size-3" />
      </button>
    </div>
  );

  return (
    <div className="flex h-full flex-col px-5 py-4">
      <p className="font-heading text-[13px] tracking-[0.16em] text-muted-foreground uppercase">
        Lernmodus
      </p>

      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Fach"
          data-testid="task-subject-input"
          className="h-9 w-32 shrink-0 border-transparent bg-white/[0.03] text-[13px] focus-visible:border-cyan-500/40"
        />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Aufgabe"
          data-testid="task-title-input"
          className="h-9 border-transparent bg-white/[0.03] text-[13px] focus-visible:border-cyan-500/40"
        />
        <Input
          value={due}
          onChange={(e) => setDue(e.target.value)}
          placeholder="bis"
          data-testid="task-due-input"
          className="h-9 w-24 shrink-0 border-transparent bg-white/[0.03] font-mono text-[11px] focus-visible:border-cyan-500/40"
        />
        <button
          type="submit"
          aria-label="Aufgabe anlegen"
          data-testid="task-add-button"
          className="grid size-9 shrink-0 place-items-center rounded-lg text-cyan-300/70 transition-colors duration-200 hover:bg-cyan-400/10 hover:text-cyan-200"
        >
          <Plus className="size-4" />
        </button>
      </form>

      <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-auto" data-testid="task-list">
        {open.map(row)}
        {done.length > 0 && (
          <p className="pt-3 font-mono text-[10px] tracking-[0.22em] text-muted-foreground/45 uppercase">
            erledigt
          </p>
        )}
        {done.map(row)}
        {list.length === 0 && (
          <p className="font-mono text-[11px] text-muted-foreground/60">
            Keine Aufgaben — trag oben etwas ein.
          </p>
        )}
      </div>
    </div>
  );
}
