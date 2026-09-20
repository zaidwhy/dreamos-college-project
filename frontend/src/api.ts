const BASE_URL = "http://localhost:8420";

export interface SearchHit {
  path: string;
  name: string;
  category: string | null;
  summary: string | null;
  snippet: string;
  similarity: number;
  abs_path: string;
}

export interface OrganizeSuggestion {
  path: string;
  name: string;
  summary: string;
  tags: string[];
  category: string;
  reasoning: string;
}

export interface RelatedFile {
  path: string;
  name: string;
  kinds: string[];
  weight: number;
  abs_path: string;
}

export interface WorkspaceFile {
  path: string;
  name: string;
  abs_path: string;
}

export interface Workspace {
  id: number;
  name: string;
  description: string | null;
  files: WorkspaceFile[];
}

export interface Recommendation {
  kind: "cluster" | "frequent" | "duplicate" | "unorganized" | "stale";
  title: string;
  detail: string;
  paths: string[];
  action: "create_workspace" | "organize" | null;
  workspace_name: string | null;
}

export interface ChatResponse {
  intent: "search" | "open" | "related" | "workspace" | "organize" | "other";
  message: string;
  search_results: SearchHit[];
  organize_suggestions: OrganizeSuggestion[];
  open_path: string | null;
  related: RelatedFile[];
  recommendations: Recommendation[];
  workspaces: Workspace[];
  open_paths: string[];
}

export interface IndexResult {
  indexed: string[];
  skipped_unchanged: string[];
  errors: Record<string, string>;
  graph_edges: number | null;
}

export interface GraphNode {
  id: number;
  path: string;
  name: string;
  category: string | null;
  degree: number;
  abs_path: string;
}

export interface GraphEdge {
  source: number;
  target: number;
  kind: "similar" | "references" | "shared_tag";
  weight: number;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const resp = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}));
    const message = typeof detail.detail === "string" ? detail.detail : undefined;
    throw new Error(message || `Request to ${path} failed (${resp.status})`);
  }
  return resp.json() as Promise<T>;
}

const postJson = <T>(path: string, body?: unknown) => request<T>("POST", path, body);
const getJson = <T>(path: string) => request<T>("GET", path);
const deleteJson = <T>(path: string) => request<T>("DELETE", path);

// One id per install: the backend keys conversation memory on it, so follow-ups such as
// "open it" still resolve after the app is restarted.
const SESSION_KEY = "dreamos-session-id";

export function getSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
  } catch {
    // storage unavailable: fall through to a per-load id
  }
  return newSessionId();
}

function newSessionId(): string {
  const id = crypto.randomUUID();
  try {
    localStorage.setItem(SESSION_KEY, id);
  } catch {
    // ignore: memory just won't survive a restart
  }
  return id;
}

/** Forgets the server-side conversation and starts a fresh session. */
export async function startNewSession(): Promise<void> {
  const old = getSessionId();
  await deleteJson(`/sessions/${encodeURIComponent(old)}`).catch(() => undefined);
  newSessionId();
}

export function sendChatMessage(message: string): Promise<ChatResponse> {
  return postJson<ChatResponse>("/chat", { message, session_id: getSessionId() });
}

export function runIndex(): Promise<IndexResult> {
  return postJson<IndexResult>("/index");
}

export function applyOrganization(path: string): Promise<{ new_path: string }> {
  return postJson("/organize/apply", { path });
}

export function revertOrganization(path: string): Promise<{ original_path: string }> {
  return postJson("/organize/revert", { path });
}

export function reportOpened(path: string): Promise<{ recorded: string }> {
  return postJson("/usage/open", { path });
}

export function fetchGraph(): Promise<Graph> {
  return getJson<Graph>("/graph");
}

export function rebuildGraph(): Promise<{ nodes: number; edges: number }> {
  return postJson("/graph/rebuild");
}

export async function fetchWorkspaces(): Promise<Workspace[]> {
  return (await getJson<{ workspaces: Workspace[] }>("/workspace")).workspaces;
}

export async function fetchRecommendations(): Promise<Recommendation[]> {
  return (await getJson<{ recommendations: Recommendation[] }>("/workspace/recommendations"))
    .recommendations;
}

export function createWorkspace(name: string, paths: string[]): Promise<Workspace> {
  return postJson<Workspace>("/workspace", { name, paths });
}

export function deleteWorkspace(id: number): Promise<{ deleted: number }> {
  return deleteJson(`/workspace/${id}`);
}

export async function openWorkspaceFiles(id: number): Promise<string[]> {
  return (await postJson<{ open_paths: string[] }>(`/workspace/${id}/open`)).open_paths;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const resp = await fetch(`${BASE_URL}/health`);
    return resp.ok;
  } catch {
    return false;
  }
}
