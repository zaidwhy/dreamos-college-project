import { useCallback, useEffect, useState } from "react";
import { fetchRecommendations, fetchWorkspaces, type Recommendation, type Workspace } from "../api";
import { errorText } from "../openFile";
import { RecommendationCard, WorkspaceCard } from "./WorkspaceCards";

export function WorkspacePanel() {
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [recs, spaces] = await Promise.all([fetchRecommendations(), fetchWorkspaces()]);
      setRecommendations(recs);
      setWorkspaces(spaces);
      setError("");
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (error && !recommendations) return <div className="panel-message bubble-error">{error}</div>;
  if (!recommendations || !workspaces) return <div className="panel-message">Loading workspaces...</div>;

  return (
    <div className="workspace-panel">
      {error && <div className="bubble-error">{error}</div>}

      <div className="section-label">Your workspaces</div>
      {workspaces.length === 0 ? (
        <div className="status-muted">
          None yet. Create one from a suggestion below, and it opens all its files in one click.
        </div>
      ) : (
        <div className="card-grid">
          {workspaces.map((ws) => (
            <WorkspaceCard key={ws.id} workspace={ws} onDeleted={refresh} />
          ))}
        </div>
      )}

      <div className="section-label section-gap">
        Suggestions
        <button className="btn-small btn-ghost btn-inline" onClick={refresh}>
          Refresh
        </button>
      </div>
      {recommendations.length === 0 ? (
        <div className="status-muted">
          Nothing to suggest right now. Suggestions appear as DreamOS learns how your files relate and
          how you use them.
        </div>
      ) : (
        <div className="card-grid">
          {recommendations.map((rec, i) => (
            <RecommendationCard key={`${rec.kind}-${rec.paths.join("|")}-${i}`} rec={rec} onCreated={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
