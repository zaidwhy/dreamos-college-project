import { useState } from "react";
import {
  createWorkspace,
  deleteWorkspace,
  openWorkspaceFiles,
  type Recommendation,
  type Workspace,
} from "../api";
import { errorText, openAll } from "../openFile";

const KIND_TITLE: Record<Recommendation["kind"], string> = {
  cluster: "Related group",
  frequent: "Frequently used",
  duplicate: "Possible duplicate",
  unorganized: "Needs organizing",
  stale: "Stale files",
};

function fileNames(paths: string[], limit = 6): string {
  const names = paths.map((p) => p.split("/").pop() ?? p);
  const shown = names.slice(0, limit).join(", ");
  return names.length > limit ? `${shown} +${names.length - limit} more` : shown;
}

export function RecommendationCard({
  rec,
  onCreated,
}: {
  rec: Recommendation;
  onCreated?: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "creating" | "created">("idle");
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!rec.workspace_name) return;
    setStatus("creating");
    setError("");
    try {
      await createWorkspace(rec.workspace_name, rec.paths);
      setStatus("created");
      onCreated?.();
    } catch (err) {
      setStatus("idle");
      setError(errorText(err));
    }
  }

  return (
    <div className="card">
      <div className="card-meta">
        <span className={`pill pill-kind-${rec.kind}`}>{KIND_TITLE[rec.kind]}</span>
      </div>
      <div className="card-title">{rec.title}</div>
      <div className="card-snippet">{rec.detail}</div>
      <div className="card-path">{fileNames(rec.paths)}</div>
      {rec.action === "create_workspace" && (
        <div className="card-actions">
          {status === "created" ? (
            <span className="status-ok">Workspace '{rec.workspace_name}' created</span>
          ) : (
            <button className="btn-small" disabled={status === "creating"} onClick={handleCreate}>
              {status === "creating" ? "Creating..." : `Create '${rec.workspace_name}' workspace`}
            </button>
          )}
        </div>
      )}
      {rec.action === "organize" && (
        <div className="card-reasoning">
          Say "organize my files" to review each suggestion before anything moves.
        </div>
      )}
      {error && <div className="bubble-error">{error}</div>}
    </div>
  );
}

export function WorkspaceCard({
  workspace,
  onDeleted,
}: {
  workspace: Workspace;
  onDeleted?: () => void;
}) {
  const [status, setStatus] = useState("");
  const [gone, setGone] = useState(false);
  if (gone) return null;

  async function handleOpen() {
    setStatus("Opening...");
    try {
      const paths = await openWorkspaceFiles(workspace.id);
      await openAll(paths);
      setStatus(`Opened ${paths.length} file${paths.length === 1 ? "" : "s"}`);
    } catch (err) {
      setStatus(errorText(err));
    }
  }

  async function handleDelete() {
    try {
      await deleteWorkspace(workspace.id);
      setGone(true);
      onDeleted?.();
    } catch (err) {
      setStatus(errorText(err));
    }
  }

  return (
    <div className="card">
      <div className="card-title">{workspace.name}</div>
      <div className="card-meta">
        <span className="pill pill-muted">
          {workspace.files.length} file{workspace.files.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="card-path">{fileNames(workspace.files.map((f) => f.path))}</div>
      <div className="card-actions">
        <button className="btn-small" onClick={handleOpen}>
          Open all
        </button>
        <button className="btn-small btn-ghost" onClick={handleDelete}>
          Delete
        </button>
        {status && <span className="status-muted">{status}</span>}
      </div>
    </div>
  );
}
