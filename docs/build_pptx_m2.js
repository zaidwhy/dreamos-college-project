// Builds docs/DreamOS-Project-Monitoring-II.pptx
// Run from the repo root:  NODE_PATH="$(npm root -g)" node docs/build_pptx_m2.js
// Needs global installs: pptxgenjs react-icons react react-dom sharp
const pptxgen = require("pptxgenjs");
const path = require("path");
const fs = require("fs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const { FaBrain, FaCheckCircle } = require("react-icons/fa");

const DOCS = __dirname;
const DIAGRAMS = path.join(DOCS, "diagrams");
const SHOTS = path.join(DOCS, "screenshots");

const NAVY = "1E2761";
const NAVY_DARK = "141A45";
const ICE = "F4F6FB";
const WHITE = "FFFFFF";
const TEAL = "00C2A8";
const SLATE = "5B6478";
const TEXT_DARK = "1C2333";
const GREEN = "2E7D32";
const HEAD = "Trebuchet MS";
const BODY = "Calibri";
const W = 13.333;
const H = 7.5;

async function iconPng(Icon, color) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Icon, { color, size: "256" }));
  return "image/png;base64," + (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
}

function dims(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const shadow = () => ({ type: "outer", color: "000000", blur: 6, offset: 2, angle: 135, opacity: 0.1 });

/** Places an image inside a box, preserving aspect ratio, centred. */
function fit(slide, file, x, y, maxW, maxH) {
  const d = dims(file);
  let w = maxW;
  let h = w * (d.h / d.w);
  if (h > maxH) {
    h = maxH;
    w = h * (d.w / d.h);
  }
  slide.addImage({ path: file, x: x + (maxW - w) / 2, y: y + (maxH - h) / 2, w, h });
}

let slideNo = 0;
function contentSlide(pres, title, subtitle) {
  const s = pres.addSlide();
  slideNo += 1;
  s.background = { color: ICE };
  s.addText(title, { x: 0.6, y: 0.35, w: 12.1, h: 0.7, fontFace: HEAD, fontSize: 28, bold: true, color: TEXT_DARK, margin: 0 });
  if (subtitle) {
    s.addText(subtitle, { x: 0.6, y: 1.0, w: 12.1, h: 0.4, fontFace: BODY, fontSize: 14, color: SLATE, margin: 0 });
  }
  s.addText("DreamOS - Project Monitoring II", { x: 0.6, y: 7.08, w: 6, h: 0.3, fontFace: BODY, fontSize: 10, color: "8A93AA", margin: 0 });
  s.addText(String(slideNo + 1), { x: 12.1, y: 7.08, w: 0.65, h: 0.3, fontFace: BODY, fontSize: 10, color: "8A93AA", align: "right", margin: 0 });
  return s;
}

function card(s, x, y, w, h, accent) {
  s.addShape("rect", { x, y, w, h, fill: { color: WHITE }, line: { type: "none" }, shadow: shadow() });
  if (accent) s.addShape("rect", { x, y, w: 0.07, h, fill: { color: accent }, line: { type: "none" } });
}

function cardText(s, x, y, w, h, head, bullets, opts = {}) {
  card(s, x, y, w, h, opts.accent || TEAL);
  s.addText(head, { x: x + 0.3, y: y + 0.15, w: w - 0.5, h: 0.4, fontFace: HEAD, fontSize: opts.headSize || 17, bold: true, color: TEXT_DARK, margin: 0 });
  s.addText(
    bullets.map((b, i) => ({ text: b, options: { bullet: true, breakLine: i < bullets.length - 1 } })),
    { x: x + 0.3, y: y + 0.65, w: w - 0.55, h: h - 0.8, fontFace: BODY, fontSize: opts.size || 15, color: TEXT_DARK, margin: 0, paraSpaceAfter: 5, valign: "top" }
  );
}

function tableStyle(rows, extra) {
  return { fontFace: BODY, fontSize: 12.5, color: TEXT_DARK, border: { type: "solid", pt: 0.5, color: "D6DCEA" }, valign: "middle", ...extra };
}
const th = (t) => ({ text: t, options: { bold: true, color: WHITE, fill: { color: NAVY }, fontFace: HEAD, fontSize: 12.5 } });

async function main() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.author = "Zaid Ali Syed, Om Vyas, Krushna Kadam";
  pres.title = "DreamOS - Project Monitoring II";
  const brainFaint = await iconPng(FaBrain, "#232C63");
  const brainWhite = await iconPng(FaBrain, "#FFFFFF");
  const check = await iconPng(FaCheckCircle, "#2E7D32");

  // ------------------------------------------------------------ 1. title
  {
    const s = pres.addSlide();
    s.background = { color: NAVY };
    s.addImage({ data: brainFaint, x: 9.6, y: -1.0, w: 5.2, h: 5.2 });
    s.addShape("ellipse", { x: 0.9, y: 0.9, w: 0.9, h: 0.9, fill: { color: TEAL }, line: { type: "none" } });
    s.addImage({ data: brainWhite, x: 1.11, y: 1.11, w: 0.48, h: 0.48 });
    s.addText("DreamOS", { x: 0.85, y: 2.05, w: 10, h: 1.2, fontFace: HEAD, fontSize: 54, bold: true, color: WHITE, margin: 0 });
    s.addText("An AI-Native Semantic File Management Shell", { x: 0.9, y: 3.15, w: 10, h: 0.55, fontFace: BODY, fontSize: 20, color: "CADCFC", margin: 0 });
    s.addShape("rect", { x: 0.9, y: 3.95, w: 2.6, h: 0.42, fill: { color: TEAL }, line: { type: "none" } });
    s.addText("PROJECT MONITORING - II", { x: 0.9, y: 3.95, w: 2.6, h: 0.42, fontFace: HEAD, fontSize: 13, bold: true, color: NAVY_DARK, align: "center", valign: "middle", margin: 0 });
    s.addText("All six proposed modules are implemented, tested and packaged", { x: 0.9, y: 4.65, w: 10, h: 0.4, fontFace: BODY, fontSize: 16, italic: true, color: "AEB9E0", margin: 0 });
    s.addText(
      [
        { text: "Zaid Ali Syed (2305139)  |  Om Vyas (2305170)  |  Krushna Kadam (2305165)", options: { breakLine: true } },
        { text: "B.Tech Information Technology - IICT, MGM University  |  September 2026", options: { color: "8FA0D6" } },
      ],
      { x: 0.9, y: 6.05, w: 11.5, h: 0.85, fontFace: BODY, fontSize: 13.5, color: "CADCFC", margin: 0 }
    );
  }

  // ------------------------------------------------------------ 2. problem + objectives
  {
    const s = contentSlide(pres, "Problem statement and objectives");
    card(s, 0.6, 1.4, 5.4, 5.35, "C0475B");
    s.addText("THE PROBLEM", { x: 0.9, y: 1.55, w: 4.8, h: 0.35, fontFace: HEAD, fontSize: 12.5, bold: true, color: "C0475B", margin: 0 });
    s.addText(
      "Desktop operating systems organize files around folders and filenames chosen at the moment of saving. As a machine grows to thousands of files, this breaks down: the name chosen months ago rarely matches how the file is described today.",
      { x: 0.9, y: 1.95, w: 4.8, h: 2.0, fontFace: BODY, fontSize: 14, color: TEXT_DARK, margin: 0, valign: "top" }
    );
    s.addText(
      "Design and implement a locally-run, AI-native file management layer that retrieves, opens and organizes files by describing their meaning in natural language - without exact names, folder locations or a cloud service.",
      { x: 0.9, y: 4.05, w: 4.8, h: 2.5, fontFace: BODY, fontSize: 13.5, italic: true, color: SLATE, margin: 0, valign: "top" }
    );

    const objectives = [
      "Semantic index of a file vault using local embedding models",
      "One natural-language interface that classifies intent and routes it",
      "Retrieve by meaning, ranked by similarity; open the top match directly",
      "Local LLM summary, tags and category, applied reversibly",
      "Entirely local and offline-capable, preserving privacy",
      "Knowledge graph, context memory and intelligent workspace manager",
    ];
    s.addText("OBJECTIVES - ALL DELIVERED", { x: 6.4, y: 1.4, w: 6, h: 0.35, fontFace: HEAD, fontSize: 12.5, bold: true, color: GREEN, margin: 0 });
    objectives.forEach((o, i) => {
      const y = 1.9 + i * 0.8;
      card(s, 6.4, y, 6.35, 0.68, GREEN);
      s.addText(String(i + 1), { x: 6.6, y, w: 0.4, h: 0.68, fontFace: HEAD, fontSize: 16, bold: true, color: GREEN, valign: "middle", margin: 0 });
      s.addText(o, { x: 7.05, y, w: 5.3, h: 0.68, fontFace: BODY, fontSize: 12.5, color: TEXT_DARK, valign: "middle", margin: 0 });
      s.addImage({ data: check, x: 12.3, y: y + 0.2, w: 0.28, h: 0.28 });
    });
  }

  // ------------------------------------------------------------ 3. literature review
  {
    const s = contentSlide(pres, "Literature review", "Two lines of work: dense embeddings, and semantic / AI-native file systems");
    cardText(s, 0.6, 1.6, 5.95, 3.6, "Foundation: dense embeddings", [
      "Mikolov et al. [2]: text mapped into a vector space where distance tracks semantic relatedness - the basis of every modern embedding model.",
      "Reimers and Gurevych, Sentence-BERT [3]: efficient embeddings of whole sentences and paragraphs - exactly what DreamOS does once per indexed file.",
      "DreamOS uses nomic-embed-text through Ollama, with the Chroma vector database [4] for nearest-neighbour retrieval.",
    ], { size: 13.5 });
    cardText(s, 6.8, 1.6, 5.95, 3.6, "Closest related work: LSFS", [
      "Shi et al. [1], \"From Commands to Prompts: LLM-based Semantic File System for AIOS\", ICLR 2025: embedding-vector file indexes with an LLM front end as a substitute for command-based file operations.",
      "Validates the architectural bet DreamOS makes.",
      "But it serves LLM agents through an API - not an end user through a conversational interface, and it is not shown running fully local.",
    ], { size: 13.5 });
    card(s, 0.6, 5.4, 12.15, 1.4, "8A93AA");
    s.addText("Existing consumer tools are keyword- or metadata-driven", { x: 0.9, y: 5.5, w: 11.5, h: 0.35, fontFace: HEAD, fontSize: 14, bold: true, color: TEXT_DARK, margin: 0 });
    s.addText(
      "Windows Search [5] matches lexically  |  macOS Spotlight [6] adds metadata and heuristics  |  Everything [7] indexes filenames only. A query must share vocabulary with the target file.",
      { x: 0.9, y: 5.9, w: 11.5, h: 0.8, fontFace: BODY, fontSize: 12.5, color: SLATE, margin: 0, valign: "top" }
    );
  }

  // ------------------------------------------------------------ 4. comparison + gap
  {
    const s = contentSlide(pres, "Comparison and research gap");
    const rows = [
      [th("System"), th("Retrieval basis"), th("Strength"), th("Limitation vs. DreamOS")],
      ["Windows Search", "Keyword / metadata index", "Built into the OS, fast", "No semantic matching; cannot act on the result from one query"],
      ["macOS Spotlight", "Keyword / metadata + heuristics", "Fast, system-wide", "Not embedding-based; not conversational"],
      ["Everything (voidtools)", "Filename index (NTFS MFT)", "Extremely fast filename lookup", "Filename only, no content understanding"],
      ["AIOS LSFS [1] (ICLR 2025)", "LLM + embedding-vector file index", "Proves embedding file indexing at OS level", "API for LLM agents, not an end-user chat; not shown fully local"],
      [
        { text: "DreamOS (this project)", options: { bold: true, fill: { color: "E7F8F4" } } },
        { text: "Local embeddings + local LLM intent routing", options: { fill: { color: "E7F8F4" } } },
        { text: "One interface to search, open, relate, organize; fully local and private", options: { fill: { color: "E7F8F4" } } },
        { text: "Baseline being proposed", options: { fill: { color: "E7F8F4" } } },
      ],
    ];
    s.addTable(rows, tableStyle(rows, { x: 0.6, y: 1.35, w: 12.15, colW: [2.4, 2.9, 3.4, 3.45], rowH: 0.58, fontSize: 12 }));
    card(s, 0.6, 5.0, 12.15, 1.8, TEAL);
    s.addText("Research gap", { x: 0.9, y: 5.1, w: 6, h: 0.35, fontFace: HEAD, fontSize: 14, bold: true, color: TEAL, margin: 0 });
    s.addText(
      "Where semantic file indexing exists in the literature it is an API layer for LLM agents, not one natural-language surface for end users, and it is not demonstrated running entirely on local models. DreamOS targets that gap: one conversational interface, backed by a locally-run embedding model and a locally-run LLM, that retrieves files by meaning and acts on them - with no file content or query leaving the machine.",
      { x: 0.9, y: 5.5, w: 11.55, h: 1.25, fontFace: BODY, fontSize: 12.5, color: TEXT_DARK, margin: 0, valign: "top" }
    );
  }

  // ------------------------------------------------------------ 5. functional requirements
  {
    const s = contentSlide(pres, "Functional requirements", "11 of 11 implemented");
    const done = (t) => ({ text: t, options: { color: GREEN, bold: true } });
    const rows = [
      [th("ID"), th("Requirement"), th("Status")],
      ["FR1", "Accept one natural-language message through a chat-style interface", done("Implemented")],
      ["FR2", "Classify intent (search, open, related, workspace, organize, other) with a local LLM", done("Implemented")],
      ["FR3", "Semantic search returning ranked results with similarity score and snippet", done("Implemented")],
      ["FR4", "Resolve an \"open\" request to the best match and launch it in its default app", done("Implemented")],
      ["FR5", "Generate an AI summary, tag list and category for a file", done("Implemented")],
      ["FR6", "Apply an AI-organized move and reversibly revert it", done("Implemented")],
      ["FR7", "Preview all unorganized files before applying any suggestion", done("Implemented")],
      ["FR8", "Index and incrementally re-index a folder, skipping unchanged files by hash", done("Implemented")],
      ["FR9", "Build a graph of relationships between files (similar, referenced, shared tags)", done("Implemented (new)")],
      ["FR10", "Retain conversational context across turns and resolve follow-ups", done("Implemented (new)")],
      ["FR11", "Recommend workspace actions from usage patterns and file relationships", done("Implemented (new)")],
    ];
    s.addTable(rows, tableStyle(rows, { x: 0.6, y: 1.5, w: 12.15, colW: [0.9, 8.75, 2.5], rowH: 0.42 }));
    s.addText("FR9-FR11 were planned for Monitoring II and III; recommendations are surfaced in the Workspaces tab and on request.", {
      x: 0.6, y: 6.75, w: 12.15, h: 0.3, fontFace: BODY, fontSize: 11, italic: true, color: SLATE, margin: 0,
    });
  }

  // ------------------------------------------------------------ 6. technical requirements
  {
    const s = contentSlide(pres, "Technical requirements and technology stack");
    cardText(s, 0.6, 1.4, 5.95, 2.55, "Languages and frameworks", [
      "Backend: Python 3, FastAPI, Uvicorn, Pydantic",
      "Frontend: TypeScript, React, Vite, d3-force (graph layout)",
      "Desktop shell: Tauri v2 (Rust) with the opener plugin",
      "AI runtime: Ollama - nomic-embed-text (embeddings), llama3.2 (intent, summaries, tags)",
    ], { size: 14.5 });
    cardText(s, 6.8, 1.4, 5.95, 2.55, "Data storage", [
      "SQLite: file metadata, graph edges, conversation turns, usage events, workspaces",
      "ChromaDB: persistent local vector store, one entry per file chunk",
      "All derived tables keyed on file id, so they survive organizer moves",
    ], { size: 14.5 });
    cardText(s, 0.6, 4.15, 5.95, 2.65, "Tools", [
      "Git and GitHub (private repository) with CI on every push",
      "pytest: 107 tests, fully offline (embeddings and LLM mocked)",
      "Mermaid diagrams; pptxgenjs and docx-js for deliverables",
      "WiX and NSIS (Tauri bundler) for Windows installers",
    ], { size: 14.5 });
    cardText(s, 6.8, 4.15, 5.95, 2.65, "Hardware and runtime", [
      "No GPU required: both models run on CPU through Ollama",
      "Runs on a single machine; no API keys, no network at runtime",
      "Sandboxed demo vault - never a real personal folder",
    ], { size: 14.5 });
  }

  // ------------------------------------------------------------ 7. architecture
  {
    const s = contentSlide(pres, "System architecture", "Client-server on one machine: Tauri/React client, local FastAPI service, Ollama, two local stores");
    const layer = (y, h, label) => {
      s.addShape("rect", { x: 0.6, y, w: 12.15, h, fill: { color: "E6EBF7" }, line: { color: "C9D1E6", width: 1 } });
      s.addText(label, { x: 0.8, y: y + 0.06, w: 9, h: 0.3, fontFace: HEAD, fontSize: 11.5, bold: true, color: NAVY, margin: 0 });
    };
    const box = (x, y, w, h, title, sub, fill) => {
      s.addShape("rect", { x, y, w, h, fill: { color: fill || WHITE }, line: { color: "AAB6D6", width: 1 } });
      s.addText(
        [
          { text: title, options: { bold: true, fontSize: 13.5, breakLine: !!sub } },
          ...(sub ? [{ text: sub, options: { fontSize: 11, color: SLATE } }] : []),
        ],
        { x, y, w, h, fontFace: BODY, color: TEXT_DARK, align: "center", valign: "middle", margin: 3 }
      );
    };
    const arrow = (x, y, h, label) => {
      s.addShape("line", { x, y, w: 0, h, line: { color: SLATE, width: 2, endArrowType: "triangle" } });
      if (label) s.addText(label, { x: x + 0.12, y, w: 4, h, fontFace: BODY, fontSize: 11, italic: true, color: SLATE, valign: "middle", margin: 0 });
    };
    const NEW = "DFF1DF";

    layer(1.45, 1.2, "DESKTOP APPLICATION  -  Tauri (Rust) + React");
    [["Chat view", "search, open, related, organize"], ["Knowledge graph view", "d3-force SVG"], ["Workspaces view", "suggestions and workspaces"], ["Tauri opener", "launches files in default apps"]]
      .forEach(([t, sub], i) => box(0.8 + i * 2.98, 1.85, 2.78, 0.68, t, sub));

    arrow(6.67, 2.68, 0.42, "HTTP / JSON, session id");

    layer(3.12, 2.1, "BACKEND SERVICE  -  FastAPI, 127.0.0.1:8420");
    box(0.8, 3.5, 11.75, 0.42, "REST routes (main.py)", null, "F4F6FB");
    const mods = [
      ["NL Interface", "intent routing", WHITE], ["Semantic Search", "vector similarity", WHITE], ["AI Organizer", "categorize, revert", WHITE],
      ["Knowledge Graph", "file relationships", NEW], ["Context Memory", "sessions, usage", NEW], ["Workspace Manager", "recommendations", NEW], ["Indexer", "embed + upsert", WHITE],
    ];
    mods.forEach(([t, sub, fill], i) => box(0.8 + i * 1.7, 4.05, 1.58, 0.95, t, sub, fill));

    arrow(6.67, 5.25, 0.4);

    layer(5.7, 1.2, "LOCAL AI RUNTIME AND STORAGE  (nothing leaves the machine)");
    [["Ollama", "nomic-embed-text + llama3.2"], ["SQLite", "files, edges, turns, usage, workspaces"], ["ChromaDB", "persistent vector store"], ["demo-vault", "sandboxed files"]]
      .forEach(([t, sub], i) => box(0.8 + i * 2.98, 6.08, 2.78, 0.68, t, sub));

    s.addShape("rect", { x: 9.75, y: 1.02, w: 0.2, h: 0.2, fill: { color: NEW }, line: { color: "AAB6D6", width: 1 } });
    s.addText("added since Monitoring I", { x: 10.02, y: 0.97, w: 2.7, h: 0.3, fontFace: BODY, fontSize: 11.5, color: SLATE, margin: 0 });
  }

  // ------------------------------------------------------------ 8. module design
  {
    const s = contentSlide(pres, "Module design", "The proposal specifies six modules - all six are now built (solid = implemented)");
    card(s, 0.6, 1.5, 12.15, 1.85, null);
    fit(s, path.join(DIAGRAMS, "02_module_design.png"), 0.75, 1.55, 11.85, 1.75);
    const rows = [
      [th("Module"), th("Input / output"), th("Status")],
      ["Natural Language Interface", "In: message + session. Out: intent and routed response (hits, suggestions, related files, workspaces, open path)", "Built"],
      ["Semantic Search Engine", "In: query. Out: ranked hits above the similarity threshold", "Built"],
      ["AI File Organizer", "In: file. Out: summary, tags, category, reasoning; reversible apply / revert", "Built"],
      ["Knowledge Graph", "In: embeddings, text, tags. Out: typed weighted edges and clusters", "Built (new)"],
      ["Context Memory Engine", "In: turns and open events. Out: resolved follow-ups, usage counts", "Built (new)"],
      ["Intelligent Workspace Manager", "In: clusters, usage, organizer state. Out: recommendations and workspaces", "Built (new)"],
    ];
    s.addTable(rows, tableStyle(rows, { x: 0.6, y: 3.55, w: 12.15, colW: [3.0, 7.75, 1.4], rowH: 0.46, fontSize: 12.5 }));
  }

  // ------------------------------------------------------------ 9. DFD context
  {
    const s = contentSlide(pres, "Data flow diagram - context level (DFD 0)", "DreamOS is one process between the user, the local LLM runtime and the file vault");
    card(s, 0.6, 1.6, 12.15, 4.9, null);
    fit(s, path.join(DIAGRAMS, "03_dfd_context.png"), 0.75, 1.7, 11.85, 4.7);
  }

  // ------------------------------------------------------------ 10. DFD level 1
  {
    const s = contentSlide(pres, "Data flow diagram - level 1", "Intent classification fans out to search, organize, related-files, workspace and open-file processes; memory feeds classification");
    card(s, 0.6, 1.6, 12.15, 4.9, null);
    fit(s, path.join(DIAGRAMS, "04_dfd_level1.png"), 0.75, 1.7, 11.85, 4.7);
  }

  // ------------------------------------------------------------ 11. use case
  {
    const s = contentSlide(pres, "UML - use case diagram", "Twelve user-facing actions (six existed at Monitoring I)");
    card(s, 0.6, 1.5, 7.1, 5.4, null);
    fit(s, path.join(DIAGRAMS, "05_use_case.png"), 0.7, 1.6, 6.9, 5.2);
    cardText(s, 7.95, 1.5, 4.8, 5.4, "Added since Monitoring I", [
      "Ask a follow-up question (\"open it\", \"the second one\")",
      "Find related files",
      "Explore the knowledge graph",
      "Create a workspace from a suggestion",
      "Open all files of a workspace",
      "Start a new conversation (clears memory)",
    ], { size: 15, accent: GREEN });
  }

  // ------------------------------------------------------------ 12. class diagram
  {
    const s = contentSlide(pres, "UML - class diagram", "Response and settings data classes in backend/app");
    card(s, 0.6, 1.5, 12.15, 5.4, null);
    fit(s, path.join(DIAGRAMS, "06_class_diagram.png"), 0.75, 1.6, 11.85, 5.2);
  }

  // ------------------------------------------------------------ 13. sequence
  {
    const s = contentSlide(pres, "UML - sequence diagram: a follow-up question", "\"find my invoices\", then \"open the second one\" - resolved from remembered results");
    card(s, 0.6, 1.5, 12.15, 5.4, null);
    fit(s, path.join(DIAGRAMS, "10_sequence_followup.png"), 0.75, 1.6, 11.85, 5.2);
  }

  // ------------------------------------------------------------ 14. database
  {
    const s = contentSlide(pres, "Database design", "SQLite for relational data, ChromaDB for vectors, linked by file path");
    card(s, 0.6, 1.5, 7.9, 5.4, null);
    fit(s, path.join(DIAGRAMS, "08_er_diagram.png"), 0.7, 1.6, 7.7, 5.2);
    cardText(s, 8.75, 1.5, 4.0, 5.4, "Design decisions", [
      "Every derived table (edges, turns, usage, workspaces) is keyed on files.id, not the path.",
      "The organizer renames paths on apply and revert; an id survives that, so nothing needs re-syncing after a move.",
      "content_hash lets re-indexing skip unchanged files.",
      "Edges are rebuilt after each index run that changed something - idempotent, so safe to repeat.",
      "Conversation turns store file ids, so a remembered result still resolves after a move.",
    ], { size: 14.5 });
  }

  // ------------------------------------------------------------ 15. UI
  {
    const s = contentSlide(pres, "User interface", "Three views in one desktop shell - screenshots of the running application");
    const shots = [
      ["ui-chat.png", "Chat: related files with the reason they are linked, and workspace suggestions"],
      ["ui-knowledge-graph.png", "Knowledge graph: nodes by category, edges by kind; a selected file and its neighbours"],
      ["ui-workspaces.png", "Workspaces: a workspace created from a suggestion, and the remaining suggestions"],
    ];
    shots.forEach(([file, caption], i) => {
      const x = 0.6 + i * 4.1;
      card(s, x, 1.55, 3.95, 4.55, null);
      fit(s, path.join(SHOTS, file), x + 0.08, 1.63, 3.79, 3.0);
      s.addText(caption, { x: x + 0.15, y: 4.75, w: 3.65, h: 1.2, fontFace: BODY, fontSize: 13.5, color: TEXT_DARK, margin: 0, valign: "top" });
    });
    s.addText("Verified inside the real Tauri desktop shell (WebView2 debug port): workspace \"Open all\" and click-to-open launch files with no permission errors.", {
      x: 0.6, y: 6.3, w: 12.15, h: 0.6, fontFace: BODY, fontSize: 12.5, italic: true, color: SLATE, margin: 0,
    });
  }

  // ------------------------------------------------------------ 16. implementation status
  {
    const s = contentSlide(pres, "Implementation status");
    [
      ["6 / 6", "proposed modules built, integrated, tested and packaged", NAVY],
      ["107", "automated tests, all offline; CI on every push", TEAL],
      ["88%", "intent routing on phrasings the prompt was never tuned on (23 of 26)", "8A93AA"],
    ].forEach(([big, small, col], i) => {
      const x = 0.6 + i * 4.1;
      card(s, x, 1.4, 3.95, 1.75, null);
      s.addText(big, { x: x + 0.3, y: 1.5, w: 3.4, h: 0.85, fontFace: HEAD, fontSize: 44, bold: true, color: col, margin: 0 });
      s.addText(small, { x: x + 0.3, y: 2.35, w: 3.4, h: 0.7, fontFace: BODY, fontSize: 12, color: SLATE, margin: 0, valign: "top" });
    });
    cardText(s, 0.6, 3.4, 5.95, 3.4, "Built at Monitoring I", [
      "Chat interface routing search, open and organize",
      "Semantic search with a tuned similarity threshold",
      "AI organizer with reversible apply / revert",
      "Incremental indexer, one-click launcher, Windows installers",
    ], { size: 15 });
    cardText(s, 6.8, 3.4, 5.95, 3.4, "Built since", [
      "Knowledge Graph: similar, references and shared-tag edges; interactive graph view",
      "Context Memory Engine: persisted sessions, follow-ups (\"open it\", \"the second one\"), usage tracking",
      "Workspace Manager: explainable recommendations and one-click workspaces",
      "Related-files and workspace intents; clickable results",
    ], { size: 15, accent: GREEN });
  }

  // ------------------------------------------------------------ 17a. knowledge graph
  {
    const s = contentSlide(pres, "Knowledge graph: three edge kinds, two measured fixes", "Report section 5.2 - measured on the real models and the 37-file demo vault");
    cardText(s, 0.6, 1.5, 3.9, 5.3, "Edge kinds", [
      "similar: files whose embeddings are close; each file nominates its 3 strongest neighbours",
      "references: directed - a file names another file (final_final_v3 -> resume_final)",
      "shared_tag: at least two AI-generated tags in common",
      "37 files, 24 links, 12 unlinked",
    ], { size: 14 });
    cardText(s, 4.65, 1.5, 3.95, 5.3, "Fix 1: raw similarity misleads", [
      "Across 666 file pairs: median cosine 0.52, max 0.83",
      "An unrelated pair (notes / spec_v1, 0.72) outscored a real invoice pair (0.67)",
      "Fix: subtract the corpus mean before comparing; real groups then rank at the top and a 0.25 threshold works",
    ], { size: 14 });
    cardText(s, 8.75, 1.5, 4.0, 5.3, "Fix 2: clusters must not chain", [
      "Connected components merged 4 resumes with 3 unrelated files through two weak edges (a 7-file group)",
      "Fix: average-linkage - merge only while the average pair weight stays above 0.12",
      "Result: Resumes 4, Invoices 4, Code 3, Project Docs 3",
    ], { size: 14 });
  }

  // ------------------------------------------------------------ 17b. memory + workspace
  {
    const s = contentSlide(pres, "Context memory and workspace manager", "Report sections 5.3 and 5.4");
    cardText(s, 0.6, 1.5, 5.6, 5.3, "Context Memory Engine", [
      "Every turn is stored with the ids of the files it showed, so follow-ups survive a restart and a file move",
      "\"the second one\" and \"open it\" are resolved by rules; the 3B model's own flag is only a fallback",
      "Two candidates within 0.05 similarity: show both instead of guessing",
      "Once the user opens one, it wins the next tie",
    ], { size: 14 });
    const rows = [
      [th("Recommendation"), th("Trigger")],
      ["Related group", "Cluster of 3 to 12 files not already in a workspace"],
      ["Frequently used", "Files opened at least 3 times"],
      ["Possible duplicate", "Similarity of 0.9 or more, or identical content hash"],
      ["Needs organizing", "Indexed files with no category"],
      ["Stale files", "Untouched for 90+ days and never opened"],
    ];
    s.addText("Workspace recommendations (rule-based, explainable)", { x: 6.5, y: 1.5, w: 6.25, h: 0.4, fontFace: HEAD, fontSize: 15, bold: true, color: TEXT_DARK, margin: 0 });
    s.addTable(rows, tableStyle(rows, { x: 6.5, y: 2.05, w: 6.25, colW: [2.2, 4.05], rowH: 0.62, fontSize: 12.5 }));
    s.addText("Rules, not the language model: reproducible, explainable, and no extra model calls. A workspace opens all its files in one click.", {
      x: 6.5, y: 5.95, w: 6.25, h: 0.8, fontFace: BODY, fontSize: 12.5, italic: true, color: SLATE, margin: 0, valign: "top",
    });
  }

  // ------------------------------------------------------------ 17c. retrieval
  {
    const s = contentSlide(pres, "Retrieval quality: measurement and fix", "Report section 5.5 - 27 labelled queries plus 4 off-topic ones, split into tuning and held-out halves");
    const rows = [
      [th("Approach"), th("Result"), th("Decision")],
      ["Fixed cutoff of 0.55 (original)", "Correct file found for 20 of 27 queries; precision 0.63 (\"meeting\" returned nothing)", "Replaced"],
      ["nomic task prefixes", "Top-1 21 to 24 of 27, but no cutoff separates a weak right answer (0.56) from junk (0.57); needs re-embedding", "Not adopted"],
      ["LLM query expansion", "Top-1 fell to 13 of 27: the 3B model's descriptions drift", "Rejected"],
      ["Near-best cutoff + keyword boost", "27 of 27 found (14 of 14 held-out); top-1 24 of 27 (13 of 14 held-out); precision 0.82; no re-embedding", "Adopted"],
    ];
    s.addTable(rows, tableStyle(rows, { x: 0.6, y: 1.55, w: 12.15, colW: [3.3, 6.85, 2.0], rowH: 0.7, fontSize: 13 }));
    card(s, 0.6, 5.3, 12.15, 1.5, TEAL);
    s.addText(
      "Re-measured through the production endpoint: identical numbers. Weak matches are labelled low confidence and open never launches below 0.55. Residual: \"meeting notes\" still ranks workout_log first (it mentions \"the project meeting\"), and 3 of 4 off-topic file-shaped queries return labelled guesses.",
      { x: 0.95, y: 5.4, w: 11.55, h: 1.3, fontFace: BODY, fontSize: 13.5, color: TEXT_DARK, margin: 0, valign: "middle" }
    );
  }

  // ------------------------------------------------------------ 18. testing
  {
    const s = contentSlide(pres, "Testing and verification", "Report section 5.6");
    const rows = [
      [th("Level"), th("What was done"), th("Result")],
      ["Unit and integration", "107 pytest tests: indexing, search and keyword boost, organizer, graph, memory, workspaces, intent routing, reset script, HTTP API", "107 passed, offline"],
      ["Continuous integration", "GitHub Actions runs the suite on every push (Linux)", "Passing"],
      ["Test strength", "Key guards deliberately broken to confirm a test fails", "Each caught"],
      ["Intent routing, real model", "32-message tuning set and a 26-message held-out set on llama3.2; prompt rewritten and compared", "Held-out 80% to 88%"],
      ["End to end, real models", "Follow-ups, ambiguity then usage resolution, organize and revert, graph rebuild on indexing", "As designed"],
      ["Retrieval", "31-query labelled set with tuning and held-out halves", "27/27 found; top-1 24/27"],
      ["Real desktop shell", "Workspace Open all and click-to-open driven over WebView2's debug port", "No permission errors"],
    ];
    s.addTable(rows, tableStyle(rows, { x: 0.6, y: 1.5, w: 12.15, colW: [2.7, 6.85, 2.6], rowH: 0.58, fontSize: 12.5 }));
    s.addText("The intent prompt scored 32/32 on the tuning set it was tuned against - the held-out figure is the honest one.", {
      x: 0.6, y: 6.55, w: 12.15, h: 0.4, fontFace: BODY, fontSize: 12, italic: true, color: SLATE, margin: 0,
    });
  }

  // ------------------------------------------------------------ 19. limitations + next
  {
    const s = contentSlide(pres, "Known limitations and remaining work", "Report sections 5.8 and 6");
    cardText(s, 0.6, 1.5, 5.95, 5.3, "Known limitations (documented, not hidden)", [
      "Very short queries are best-effort: a file that merely contains the word can outrank the answer (\"meeting notes\" ranks workout_log first)",
      "Off-topic file-shaped queries return labelled low-confidence guesses; non-file requests are turned away by the intent router",
      "The 3B intent router misses borderline wording (\"which files should I archive\")",
      "Clustering is conservative: some related files stay unlinked",
      "Similarity is pairwise and search scores every chunk: fine for hundreds of files, not thousands",
    ], { size: 14, accent: "C0475B" });
    cardText(s, 6.8, 1.5, 5.95, 5.3, "Remaining work (Monitoring III)", [
      "Scale and performance: a larger vault, timing, an approximate neighbour method if needed",
      "Retrieval: test the embedding-prefix option end to end, judged by the labelled evaluation set",
      "Final project report: results, discussion, conclusion, future scope",
      "Research paper, drawing on the measurements in this report",
      "Final GitHub submission and installer hand-off",
    ], { size: 14.5 });
  }

  // ------------------------------------------------------------ 20. references
  {
    const s = contentSlide(pres, "References");
    const refs = [
      "[1] Z. Shi, K. Mei, M. Jin, Y. Su, C. Zuo, W. Hua, W. Xu, Y. Ren, Z. Liu, M. Du, D. Deng, and Y. Zhang, \"From Commands to Prompts: LLM-based Semantic File System for AIOS,\" in Proc. 13th Int. Conf. on Learning Representations (ICLR 2025). arXiv:2410.11843.",
      "[2] T. Mikolov, K. Chen, G. Corrado, and J. Dean, \"Efficient Estimation of Word Representations in Vector Space,\" arXiv:1301.3781, 2013.",
      "[3] N. Reimers and I. Gurevych, \"Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks,\" in Proc. EMNLP-IJCNLP, 2019.",
      "[4] Chroma, \"Chroma: the open-source embedding database,\" github.com/chroma-core/chroma.",
      "[5] Microsoft, \"Windows Search overview,\" Microsoft Learn documentation.",
      "[6] Apple Inc., \"Spotlight User Guide,\" support.apple.com.",
      "[7] voidtools, \"Everything - locate files and folders by name instantly,\" voidtools.com.",
    ];
    s.addText(
      refs.map((r, i) => ({ text: r, options: { breakLine: i < refs.length - 1 } })),
      { x: 0.6, y: 1.4, w: 12.15, h: 5.4, fontFace: BODY, fontSize: 15, color: TEXT_DARK, margin: 0, valign: "top", paraSpaceAfter: 12 }
    );
  }

  const out = path.join(DOCS, "DreamOS-Project-Monitoring-II.pptx");
  await pres.writeFile({ fileName: out });
  console.log("WROTE", out, "slides:", slideNo + 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
