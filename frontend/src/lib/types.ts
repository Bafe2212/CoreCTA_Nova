/**
 * TS twins of the Pydantic models in backend/models/nova.py.
 * Change one, change the other in the same edit.
 */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider: string | null;
  model: string | null;
  created_at: string;
}

export interface ProviderInfo {
  id: string;
  label: string;
  configured: boolean;
  models: string[];
}

export interface ProviderStatus {
  providers: ProviderInfo[];
  default_provider: string;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface MemoryItem {
  id: string;
  text: string;
  tag: string;
  created_at: string;
}

export interface FileItem {
  id: string;
  name: string;
  kind: string;
  size: string;
  created_at: string;
}

export interface SchoolTask {
  id: string;
  subject: string;
  title: string;
  due: string | null;
  done: boolean;
  created_at: string;
}
