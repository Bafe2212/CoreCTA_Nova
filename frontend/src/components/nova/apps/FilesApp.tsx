import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCreateFile, useDeleteFile, useFiles } from "@/hooks/useNovaData";

const KINDS = ["dokument", "notiz", "tabelle", "ordner", "medien"] as const;

export default function FilesApp() {
  const files = useFiles();
  const create = useCreateFile();
  const remove = useDeleteFile();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>("dokument");

  const list = files.data ?? [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate({ name: name.trim(), kind, size: "—" });
    setName("");
  };

  return (
    <div className="flex h-full flex-col px-5 py-4">
      <p className="font-heading text-[13px] tracking-[0.16em] text-muted-foreground uppercase">
        Indexierter Speicher
      </p>

      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Neuer Eintrag, z. B. Physik_Zusammenfassung.md"
          data-testid="file-name-input"
          className="h-9 border-transparent bg-white/[0.03] text-[13px] focus-visible:border-cyan-500/40"
        />
        <div className="flex shrink-0 gap-1">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              data-testid={`file-kind-${k}`}
              onClick={() => setKind(k)}
              className="rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-wide transition-colors duration-200"
              style={{
                borderColor: kind === k ? "rgba(34,211,238,0.45)" : "rgba(148,163,184,0.14)",
                color: kind === k ? "#67e8f9" : "rgba(148,163,184,0.75)",
              }}
            >
              {k}
            </button>
          ))}
        </div>
        <button
          type="submit"
          aria-label="Eintrag anlegen"
          data-testid="file-add-button"
          className="grid size-9 shrink-0 place-items-center rounded-lg text-cyan-300/70 transition-colors duration-200 hover:bg-cyan-400/10 hover:text-cyan-200"
        >
          <Plus className="size-4" />
        </button>
      </form>

      <div className="mt-3 min-h-0 flex-1 overflow-auto" data-testid="file-list">
        {list.map((file) => (
          <div
            key={file.id}
            className="group flex items-center justify-between border-b border-white/[0.04] px-1 py-2.5 last:border-0"
            data-testid={`file-row-${file.id}`}
          >
            <span className="truncate text-[13px] text-foreground/85">{file.name}</span>
            <span className="ml-3 flex shrink-0 items-center gap-3">
              <span className="font-mono text-[10.5px] text-muted-foreground/60">
                {file.kind} · {new Date(file.created_at).toLocaleDateString("de-DE")}
              </span>
              <button
                type="button"
                aria-label="Eintrag löschen"
                data-testid={`file-delete-${file.id}`}
                onClick={() => remove.mutate(file.id)}
                className="grid size-6 place-items-center rounded-md text-muted-foreground/40 opacity-0 transition-all duration-200 group-hover:opacity-100 hover:text-red-300"
              >
                <X className="size-3" />
              </button>
            </span>
          </div>
        ))}
        {list.length === 0 && (
          <p className="py-3 font-mono text-[11px] text-muted-foreground/60">
            Der Speicher ist leer.
          </p>
        )}
      </div>
    </div>
  );
}
