import { useEffect, useRef, useState } from "react";
import { openPath } from "@tauri-apps/plugin-opener";
import "./App.css";
import { checkHealth, runIndex, sendChatMessage, startNewSession, type ChatResponse } from "./api";
import { GraphView } from "./components/GraphView";
import { OrganizeResults, SearchResults, WorkspaceResults } from "./components/Results";
import { WorkspacePanel } from "./components/WorkspacePanel";
import { errorText, openAll } from "./openFile";

type View = "chat" | "graph" | "workspaces";

const TABS: { id: View; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "graph", label: "Knowledge graph" },
  { id: "workspaces", label: "Workspaces" },
];

interface HistoryEntry {
  role: "user" | "assistant";
  response?: ChatResponse;
  text?: string;
}

function App() {
  const [view, setView] = useState<View>("chat");
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [backendUp, setBackendUp] = useState<boolean | null>(null);
  const [indexStatus, setIndexStatus] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkHealth().then(setBackendUp);
    const interval = setInterval(() => checkHealth().then(setBackendUp), 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history, view]);

  function addAssistantError(err: unknown, prefix = "") {
    setHistory((prev) => [...prev, { role: "assistant", text: `${prefix}${errorText(err)}` }]);
  }

  async function handleSend() {
    const trimmed = message.trim();
    if (!trimmed || loading) return;
    setMessage("");
    setHistory((prev) => [...prev, { role: "user", text: trimmed }]);
    setLoading(true);
    try {
      const response = await sendChatMessage(trimmed);
      setHistory((prev) => [...prev, { role: "assistant", response }]);
      try {
        if (response.intent === "open" && response.open_path) {
          await openPath(response.open_path);
        }
        if (response.open_paths.length > 0) {
          await openAll(response.open_paths);
        }
      } catch (err) {
        addAssistantError(err, "Couldn't open the file: ");
      }
    } catch (err) {
      addAssistantError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleNewChat() {
    await startNewSession();
    setHistory([]);
  }

  async function handleReindex() {
    setIndexStatus("Indexing...");
    try {
      const result = await runIndex();
      const graph = result.graph_edges === null ? "" : `, ${result.graph_edges} graph links`;
      setIndexStatus(
        `Indexed ${result.indexed.length}, skipped ${result.skipped_unchanged.length}, errors ${
          Object.keys(result.errors).length
        }${graph}`
      );
    } catch (err) {
      setIndexStatus(errorText(err));
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">◆</span> DreamOS
        </div>
        <nav className="tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tab ${view === tab.id ? "tab-active" : ""}`}
              onClick={() => setView(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="topbar-actions">
          <span className={`health-dot ${backendUp ? "health-up" : "health-down"}`} />
          <span className="health-label">{backendUp === null ? "checking..." : backendUp ? "backend online" : "backend offline"}</span>
          <button className="btn-small" onClick={handleReindex}>
            Reindex vault
          </button>
          {indexStatus && <span className="index-status">{indexStatus}</span>}
        </div>
      </header>

      {view === "graph" && (
        <div className="view-scroll">
          <GraphView />
        </div>
      )}

      {view === "workspaces" && (
        <div className="view-scroll">
          <WorkspacePanel />
        </div>
      )}

      {view === "chat" && (
        <>
          <div className="chat-scroll" ref={scrollRef}>
            {history.length === 0 && (
              <div className="empty-state">
                <p>Describe what you're looking for, or ask DreamOS to organize your files.</p>
                <p className="empty-hint">
                  Try: "find my invoices", then "open the second one" - or "what's related to my
                  resume", "suggest some workspaces"
                </p>
              </div>
            )}
            {history.map((entry, i) => (
              <div className={`bubble bubble-${entry.role}`} key={i}>
                {entry.role === "user" ? (
                  <div className="bubble-text">{entry.text}</div>
                ) : entry.response ? (
                  <>
                    <div className="bubble-text">{entry.response.message}</div>
                    <SearchResults response={entry.response} />
                    <OrganizeResults response={entry.response} />
                    <WorkspaceResults response={entry.response} />
                  </>
                ) : (
                  <div className="bubble-text bubble-error">{entry.text}</div>
                )}
              </div>
            ))}
            {loading && <div className="bubble bubble-assistant bubble-loading">thinking...</div>}
          </div>

          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
          >
            <input
              value={message}
              onChange={(e) => setMessage(e.currentTarget.value)}
              placeholder="Ask DreamOS to find, open, relate, or organize something..."
              disabled={loading}
            />
            <button type="submit" disabled={loading || !message.trim()}>
              Send
            </button>
            <button type="button" className="composer-secondary" onClick={handleNewChat} disabled={loading}>
              New chat
            </button>
          </form>
        </>
      )}
    </main>
  );
}

export default App;
