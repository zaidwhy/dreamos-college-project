import { useCallback, useEffect, useMemo, useState } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { fetchGraph, rebuildGraph, type Graph, type GraphEdge, type GraphNode } from "../api";
import { errorText, openFile } from "../openFile";

const WIDTH = 1000;
const HEIGHT = 780;
const MARGIN = 70;
const LABEL_ROOM = 200; // nodes at the right edge still need space for their file-name label

type LayoutNode = GraphNode & SimulationNodeDatum;
type LayoutLink = SimulationLinkDatum<LayoutNode> & Pick<GraphEdge, "kind" | "weight">;

const PALETTE = ["#7c9eff", "#6fd08c", "#f0b86e", "#d97ad0", "#5fd0d0", "#e08585", "#b0a0ff"];
const UNCATEGORIZED = "#5a6274";

const EDGE_STYLE: Record<GraphEdge["kind"], { color: string; label: string; dash?: string }> = {
  similar: { color: "#7c9eff", label: "similar content" },
  references: { color: "#f0b86e", label: "names another file" },
  shared_tag: { color: "#6fd08c", label: "shared tags", dash: "4 3" },
};

function nodeRadius(node: GraphNode): number {
  return 6 + Math.min(node.degree, 5) * 1.6;
}

function computeLayout(graph: Graph): { nodes: LayoutNode[]; links: LayoutLink[] } {
  const nodes: LayoutNode[] = graph.nodes.map((n) => ({ ...n }));
  const links: LayoutLink[] = graph.edges.map((e) => ({
    source: e.source,
    target: e.target,
    kind: e.kind,
    weight: e.weight,
  }));

  // Run the physics to rest up front and draw the result: a stable picture with no jitter,
  // and the same graph always lays out the same way.
  const simulation = forceSimulation<LayoutNode>(nodes)
    .force("link", forceLink<LayoutNode, LayoutLink>(links).id((d) => d.id).distance(95).strength(0.8))
    .force("charge", forceManyBody().strength(-230))
    .force("center", forceCenter(WIDTH / 2, HEIGHT / 2))
    .force("x", forceX(WIDTH / 2).strength(0.05))
    .force("y", forceY(HEIGHT / 2).strength(0.05))
    .force("collide", forceCollide<LayoutNode>().radius((d) => nodeRadius(d) + 26))
    .stop();
  for (let i = 0; i < 320; i++) simulation.tick();

  for (const n of nodes) {
    n.x = Math.max(MARGIN, Math.min(WIDTH - LABEL_ROOM, n.x ?? WIDTH / 2));
    n.y = Math.max(MARGIN, Math.min(HEIGHT - MARGIN, n.y ?? HEIGHT / 2));
  }
  return { nodes, links };
}

/** Shortens a directed edge so its arrowhead stops at the target node's rim, not its centre. */
function arrowEnd(from: LayoutNode, to: LayoutNode): { x: number; y: number } {
  const dx = (to.x ?? 0) - (from.x ?? 0);
  const dy = (to.y ?? 0) - (from.y ?? 0);
  const length = Math.hypot(dx, dy) || 1;
  const inset = nodeRadius(to) + 3;
  return { x: (to.x ?? 0) - (dx / length) * inset, y: (to.y ?? 0) - (dy / length) * inset };
}

export function GraphView() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rebuilding, setRebuilding] = useState(false);

  const load = useCallback(async () => {
    try {
      setGraph(await fetchGraph());
      setError("");
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRebuild() {
    setRebuilding(true);
    try {
      await rebuildGraph();
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setRebuilding(false);
    }
  }

  const layout = useMemo(() => (graph ? computeLayout(graph) : null), [graph]);

  const colors = useMemo(() => {
    const categories = [...new Set((graph?.nodes ?? []).map((n) => n.category).filter((c): c is string => !!c))].sort();
    return new Map(categories.map((c, i) => [c, PALETTE[i % PALETTE.length]]));
  }, [graph]);

  const colorOf = (node: GraphNode) => (node.category ? colors.get(node.category) ?? UNCATEGORIZED : UNCATEGORIZED);

  const nodeById = useMemo(() => new Map((layout?.nodes ?? []).map((n) => [n.id, n])), [layout]);

  const neighbours = useMemo(() => {
    if (!graph || selectedId === null) return [];
    const found = new Map<number, Set<GraphEdge["kind"]>>();
    for (const e of graph.edges) {
      const other = e.source === selectedId ? e.target : e.target === selectedId ? e.source : null;
      if (other === null) continue;
      if (!found.has(other)) found.set(other, new Set());
      found.get(other)!.add(e.kind);
    }
    return [...found.entries()].map(([id, kinds]) => ({ node: nodeById.get(id)!, kinds: [...kinds] }));
  }, [graph, selectedId, nodeById]);

  if (error && !graph) return <div className="panel-message bubble-error">{error}</div>;
  if (!graph || !layout) return <div className="panel-message">Loading graph...</div>;

  const selected = selectedId === null ? null : nodeById.get(selectedId) ?? null;
  const active = new Set<number>(selected ? [selected.id, ...neighbours.map((n) => n.node.id)] : []);
  const dimmed = (id: number) => selected !== null && !active.has(id);
  const unlinked = graph.nodes.filter((n) => n.degree === 0).length;

  return (
    <div className="graph-view">
      <div className="graph-toolbar">
        <span>
          {graph.nodes.length} files · {graph.edges.length} links · {unlinked} unlinked
        </span>
        <div className="graph-legend">
          {(Object.keys(EDGE_STYLE) as GraphEdge["kind"][]).map((kind) => (
            <span className="legend-item" key={kind}>
              <svg width="26" height="8" aria-hidden="true">
                <line x1="0" y1="4" x2="26" y2="4" stroke={EDGE_STYLE[kind].color} strokeWidth="2" strokeDasharray={EDGE_STYLE[kind].dash} />
              </svg>
              {EDGE_STYLE[kind].label}
            </span>
          ))}
        </div>
        <button className="btn-small" onClick={handleRebuild} disabled={rebuilding}>
          {rebuilding ? "Rebuilding..." : "Rebuild graph"}
        </button>
      </div>
      {error && <div className="bubble-error">{error}</div>}

      <div className="graph-body">
        <svg
          className="graph-canvas"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label="Knowledge graph of related files"
          onClick={() => setSelectedId(null)}
        >
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_STYLE.references.color} />
            </marker>
          </defs>

          {layout.links.map((l, i) => {
            const s = l.source as LayoutNode;
            const t = l.target as LayoutNode;
            const style = EDGE_STYLE[l.kind];
            const end = l.kind === "references" ? arrowEnd(s, t) : { x: t.x ?? 0, y: t.y ?? 0 };
            const faded = dimmed(s.id) || dimmed(t.id);
            return (
              <line
                key={i}
                x1={s.x}
                y1={s.y}
                x2={end.x}
                y2={end.y}
                stroke={style.color}
                strokeWidth={l.kind === "references" ? 2 : 1 + l.weight * 3}
                strokeDasharray={style.dash}
                opacity={faded ? 0.08 : 0.75}
                markerEnd={l.kind === "references" ? "url(#arrow)" : undefined}
              />
            );
          })}

          {layout.nodes.map((n) => (
            <g
              key={n.id}
              className="graph-node"
              transform={`translate(${n.x},${n.y})`}
              opacity={dimmed(n.id) ? 0.25 : 1}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(n.id);
              }}
            >
              <title>{`${n.name}${n.category ? ` (${n.category})` : ""}`}</title>
              <circle
                r={nodeRadius(n)}
                fill={colorOf(n)}
                stroke={selectedId === n.id ? "#ffffff" : "#0f1115"}
                strokeWidth={selectedId === n.id ? 2.5 : 1.5}
              />
              <text x={nodeRadius(n) + 5} y={4} className={selectedId === n.id ? "graph-label graph-label-active" : "graph-label"}>
                {n.name}
              </text>
            </g>
          ))}
        </svg>

        <aside className="graph-side">
          {selected ? (
            <>
              <div className="card-title">{selected.name}</div>
              <div className="card-meta">
                {selected.category && <span className="pill">{selected.category}</span>}
                <span className="pill pill-muted">
                  {neighbours.length} related
                </span>
              </div>
              <div className="card-actions">
                <button className="btn-small" onClick={() => openFile(selected.abs_path, selected.path).catch((e) => setError(errorText(e)))}>
                  Open
                </button>
              </div>
              <div className="section-label">Related files</div>
              {neighbours.length === 0 && <div className="status-muted">No links to other files.</div>}
              <ul className="neighbour-list">
                {neighbours.map(({ node, kinds }) => (
                  <li key={node.id}>
                    <button className="link-button" onClick={() => setSelectedId(node.id)}>
                      {node.name}
                    </button>
                    <span className="neighbour-kinds">{kinds.map((k) => EDGE_STYLE[k].label).join(", ")}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <div className="section-label">Categories</div>
              <ul className="category-list">
                {[...colors.entries()].map(([category, color]) => (
                  <li key={category}>
                    <span className="swatch" style={{ background: color }} />
                    {category}
                  </li>
                ))}
                <li>
                  <span className="swatch" style={{ background: UNCATEGORIZED }} />
                  not organized yet
                </li>
              </ul>
              <div className="status-muted">Click a file to see what it is connected to.</div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
