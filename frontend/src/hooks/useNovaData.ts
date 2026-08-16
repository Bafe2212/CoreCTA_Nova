import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api";
import type {
  ChatMessage,
  FileItem,
  MemoryItem,
  Note,
  ProviderStatus,
  SchoolTask,
} from "@/lib/types";

/** Every NOVA surface reads and writes through TanStack Query. */

export const providersKey = ["chat", "providers"] as const;
export const messagesKey = ["chat", "messages"] as const;
export const notesKey = ["notes"] as const;
export const memoryKey = ["memory"] as const;
export const filesKey = ["files"] as const;
export const tasksKey = ["tasks"] as const;

export const useProviders = () =>
  useQuery({
    queryKey: providersKey,
    queryFn: () => apiGet<ProviderStatus>("/chat/providers"),
    staleTime: 5 * 60 * 1000,
  });

export const useChatMessages = () =>
  useQuery({ queryKey: messagesKey, queryFn: () => apiGet<ChatMessage[]>("/chat/messages") });

export const useClearChat = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiDelete<{ deleted: number }>("/chat/messages"),
    onSuccess: () => qc.invalidateQueries({ queryKey: messagesKey }),
  });
};

// ---------- Notizen ----------

export const useNotes = () =>
  useQuery({ queryKey: notesKey, queryFn: () => apiGet<Note[]>("/notes") });

export const useCreateNote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { title: string; body: string }) => apiPost<Note>("/notes", payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKey }),
  });
};

export const useUpdateNote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; title?: string; body?: string }) =>
      apiPut<Note>(`/notes/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKey }),
  });
};

export const useDeleteNote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ deleted: string }>(`/notes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKey }),
  });
};

// ---------- Memory ----------

export const useMemory = () =>
  useQuery({ queryKey: memoryKey, queryFn: () => apiGet<MemoryItem[]>("/memory") });

export const useCreateMemory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { text: string; tag: string }) =>
      apiPost<MemoryItem>("/memory", payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: memoryKey }),
  });
};

export const useDeleteMemory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ deleted: string }>(`/memory/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: memoryKey }),
  });
};

// ---------- Dateien ----------

export const useFiles = () =>
  useQuery({ queryKey: filesKey, queryFn: () => apiGet<FileItem[]>("/files") });

export const useCreateFile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; kind: string; size: string }) =>
      apiPost<FileItem>("/files", payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: filesKey }),
  });
};

export const useDeleteFile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ deleted: string }>(`/files/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: filesKey }),
  });
};

// ---------- Schule ----------

export const useTasks = () =>
  useQuery({ queryKey: tasksKey, queryFn: () => apiGet<SchoolTask[]>("/tasks") });

export const useCreateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { subject: string; title: string; due?: string }) =>
      apiPost<SchoolTask>("/tasks", payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: tasksKey }),
  });
};

export const useUpdateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; done?: boolean; title?: string; due?: string }) =>
      apiPatch<SchoolTask>(`/tasks/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: tasksKey }),
  });
};

export const useDeleteTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ deleted: string }>(`/tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: tasksKey }),
  });
};
