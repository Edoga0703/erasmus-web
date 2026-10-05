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
/** Tool card state persisted with the assistant message so reopened chats render identical cards. */
export interface StoredToolState { status: string; detail?: string | undefined; output?: string | undefined; diff?: { kind: string; text: string }[] | undefined; exitCode?: number | undefined; durationMs?: number | undefined; stdout?: string | undefined; stderr?: string | undefined }
export interface StoredMessage { role: "user" | "assistant"; text?: string | undefined; c?: string | undefined; content?: string | undefined; ts?: number | undefined; hidden?: boolean | undefined; tools?: Record<number, StoredToolState> | undefined; reasoning?: string | undefined; thinkMs?: number | undefined; finish?: string | undefined; usage?: { prompt: number; completion: number; reasoning: number; total: number } | undefined }
export interface ChatData { id: string; title: string; created: number; updated: number; messages: StoredMessage[]; allMessages?: StoredMessage[] | undefined }
