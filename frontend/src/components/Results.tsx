import { useState } from "react";
import {
  applyOrganization,
  revertOrganization,
  type ChatResponse,
  type OrganizeSuggestion,
  type SearchHit,
} from "../api";
import { errorText, openFile } from "../openFile";
import { RecommendationCard, WorkspaceCard } from "./WorkspaceCards";

const EDGE_LABEL: Record<string, string> = {
  similar: "similar content",
  references: "referenced",
  shared_tag: "shared tags",
};

export function SearchResults({ response }: { response: ChatResponse }) {
  const [error, setError] = useState("");
  if (response.search_results.length === 0) return null;

  // For "related" answers the number that matters is *why* files are linked, not a match score.
  const kindsByPath = new Map(response.related.map((r) => [r.path, r.kinds]));

  async function handleOpen(hit: SearchHit) {
    setError("");
    try {
      await openFile(hit.abs_path, hit.path);
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <>
      <div className="card-grid">
        {response.search_results.map((hit) => {
          const kinds = kindsByPath.get(hit.path);
          return (
            <div className="card" key={hit.path}>
              <div className="card-title">{hit.name}</div>
              <div className="card-meta">
                {kinds ? (
                  kinds.map((k) => (
                    <span className="pill" key={k}>
                      {EDGE_LABEL[k] ?? k}
                    </span>
                  ))
                ) : (
                  <span className="pill">{Math.round(hit.similarity * 100)}% match</span>
                )}
                {hit.category && <span className="pill pill-muted">{hit.category}</span>}
              </div>
              <div className="card-snippet">{hit.snippet}</div>
              <div className="card-path">{hit.path}</div>
              <div className="card-actions">
                <button className="btn-small" onClick={() => handleOpen(hit)}>
                  Open
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {error && <div className="bubble-error">{error}</div>}
    </>
  );
}

export function OrganizeResults({ response }: { response: ChatResponse }) {
  const [statuses, setStatuses] = useState<Record<string, "pending" | "applied" | "reverted">>({});

  if (response.organize_suggestions.length === 0) return null;

  async function handleApply(s: OrganizeSuggestion) {
    await applyOrganization(s.path);
    setStatuses((prev) => ({ ...prev, [s.path]: "applied" }));
  }

  async function handleRevert(s: OrganizeSuggestion) {
    await revertOrganization(`${s.category}/${s.name}`);
    setStatuses((prev) => ({ ...prev, [s.path]: "reverted" }));
  }

  return (
    <div className="card-grid">
      {response.organize_suggestions.map((s) => {
        const status = statuses[s.path] ?? "pending";
        return (
          <div className="card" key={s.path}>
            <div className="card-title">{s.name}</div>
            <div className="card-meta">
              <span className="pill">{s.category}</span>
              {s.tags.map((t) => (
                <span className="pill pill-muted" key={t}>
                  {t}
                </span>
              ))}
            </div>
            <div className="card-snippet">{s.summary}</div>
            <div className="card-reasoning">{s.reasoning}</div>
            <div className="card-actions">
              {status === "pending" && (
                <button className="btn-small" onClick={() => handleApply(s)}>
                  Apply
                </button>
              )}
              {status === "applied" && (
                <>
                  <span className="status-ok">Moved to {s.category}/</span>
                  <button className="btn-small btn-ghost" onClick={() => handleRevert(s)}>
                    Undo
                  </button>
                </>
              )}
              {status === "reverted" && <span className="status-muted">Reverted</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function WorkspaceResults({ response }: { response: ChatResponse }) {
  const { recommendations, workspaces } = response;
  if (recommendations.length === 0 && workspaces.length === 0) return null;

  return (
    <>
      {recommendations.length > 0 && (
        <>
          <div className="section-label">Suggestions</div>
          <div className="card-grid">
            {recommendations.map((rec, i) => (
              <RecommendationCard key={`${rec.kind}-${i}`} rec={rec} />
            ))}
          </div>
        </>
      )}
      {workspaces.length > 0 && (
        <>
          <div className="section-label">Workspaces</div>
          <div className="card-grid">
            {workspaces.map((ws) => (
              <WorkspaceCard key={ws.id} workspace={ws} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
