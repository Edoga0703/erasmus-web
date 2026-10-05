export interface StatusResponse {
  ok: boolean;
  app: string;
  status: string;
  gateway_active: boolean;
  brand_model: string;
  workspace_name: string;
  cwd: string;
}
export interface FsItem { name: string; is_dir: boolean; size: number; modified: number }
export interface FsListResponse { ok: boolean; path: string; items: FsItem[]; total: number; showing: number; truncated?: boolean; warning?: string }
export interface FsReadResponse { ok: boolean; name: string; total_lines: number; content: string; truncated?: boolean; warning?: string }
export interface ExecRequest { language: "python" | "bash"; code: string; cwd: string; timeout: number }
export interface ExecResponse { ok: boolean; exit_code: number; stdout: string; stderr: string; duration_ms?: number }
export interface FsWriteResponse { ok: boolean; name: string; mode: "write" | "append"; bytes_written: number }
export interface ChatMeta { id: string; title: string; updated?: number; created?: number; messages_count?: number; size?: number }
export interface ChatListResponse { ok: boolean; workspace_name: string; chats: ChatMeta[] }
export interface WorkspaceFile { name: string; rel_path: string; size: number; modified: number }
export interface FilesResponse { ok: boolean; workspace_name: string; files: WorkspaceFile[] }

/** Stored message shape, same as the desktop reference: user -> text, assistant -> c. */
export interface StoredMessage { role: "user" | "assistant"; text?: string; c?: string; ts?: number; hidden?: boolean | undefined }
export interface ChatData { id: string; title: string; created: number; updated: number; messages: StoredMessage[] }
