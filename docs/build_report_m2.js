const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel, BorderStyle,
  WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak, TableOfContents,
  TabStopType, TabStopPosition,
} = require("docx");

const DIAG = path.join(__dirname, "diagrams");
const SHOTS = path.join(__dirname, "screenshots");
const img = (name) => fs.readFileSync(path.join(DIAG, name));
const imgFrom = (dir, name) => fs.readFileSync(path.join(dir, name));

const CONTENT_WIDTH = 9360; // DXA, US Letter, 1" margins
const border = { style: BorderStyle.SINGLE, size: 2, color: "BFBFBF" };
const borders = { top: border, bottom: border, left: border, right: border };
const HEAD_FILL = "2E4B3F";
const ACCENT = "2E4B3F";

function cell(text, opts = {}) {
  const { header = false, width, align = AlignmentType.LEFT, bold = false } = opts;
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: header ? { fill: HEAD_FILL, type: ShadingType.CLEAR } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: align,
      keepNext: header,
      children: [new TextRun({ text, bold: bold || header, color: header ? "FFFFFF" : "1B1B1B", size: 19 })],
    })],
  });
}

function row(cells) {
  return new TableRow({ children: cells });
}

function table(widths, headerRow, bodyRows) {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      row(headerRow.map((t, i) => cell(t, { header: true, width: widths[i] }))),
      ...bodyRows.map((r) => row(r.map((t, i) => cell(t, { width: widths[i] })))),
    ],
  });
}

function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
}
function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });
}
function p(text, opts = {}) {
  return new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text, ...opts })] });
}
function bullet(text, level = 0) {
  return new Paragraph({ numbering: { reference: "bullets", level }, spacing: { after: 60 }, children: [new TextRun(text)] });
}
function numbered(text) {
  return new Paragraph({ numbering: { reference: "numbers", level: 0 }, spacing: { after: 60 }, children: [new TextRun(text)] });
}
function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 260 },
    children: [new TextRun({ text, italics: true, size: 18, color: "555555" })],
  });
}
function figure(filename, width, height, capText) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 40 },
      children: [new ImageRun({
        type: "png",
        data: img(filename),
        transformation: { width, height },
        altText: { title: capText, description: capText, name: filename },
      })],
    }),
    caption(capText),
  ];
}

// Sizes an image from its own PNG header so the aspect ratio is always right.
function figure2(filename, width, capText, dir) {
  const data = imgFrom(dir || DIAG, filename);
  const height = Math.round(width * (data.readUInt32BE(20) / data.readUInt32BE(16)));
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      keepNext: true,
      spacing: { before: 120, after: 40 },
      children: [new ImageRun({
        type: "png",
        data,
        transformation: { width, height },
        altText: { title: capText, description: capText, name: filename },
      })],
    }),
    caption(capText),
  ];
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22, color: "1B1B1B" } } },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: ACCENT },
        paragraph: { keepNext: true, spacing: { before: 420, after: 200 }, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 4 } } },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: "1B1B1B" },
        paragraph: { keepNext: true, spacing: { before: 280, after: 140 }, outlineLevel: 1 },
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, italics: true, font: "Arial", color: "333333" },
        paragraph: { keepNext: true, spacing: { before: 200, after: 100 }, outlineLevel: 2 },
      },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
      ]},
      { reference: "numbers", levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      ]},
    ],
  },
  sections: [
    // ---------- SECTION A: TITLE PAGE ----------
    {
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
      },
      children: [
        new Paragraph({ spacing: { before: 600 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "MGM UNIVERSITY", bold: true, size: 30 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "Institute of Information and Communication Technology (IICT)", bold: true, size: 24 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: "Department of Information Technology", size: 22 })] }),

        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1000, after: 100 }, children: [new TextRun({ text: "DreamOS", bold: true, size: 56, color: ACCENT })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: "An AI-Native Semantic File Management Shell", size: 26, italics: true })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 700 }, children: [new TextRun({ text: "Final Year B.Tech Project", size: 24 })] }),

        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: "PROJECT MONITORING - II REPORT", bold: true, size: 28 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 900 }, children: [new TextRun({ text: "Literature Review, Requirement Analysis, System Design, Implementation and Evaluation", size: 20, color: "555555" })] }),

        table(
          [3600, 2880, 2880],
          ["Team Member", "PRN / Roll No.", "Role"],
          [
            ["Zaid Ali Syed", "2305139", "Team Lead - Backend, AI/LLM Integration, Desktop Shell"],
            ["Om Vyas", "2305170", "Contributor"],
            ["Krushna Kadam", "2305165", "Contributor"],
          ],
        ),

        new Paragraph({ spacing: { before: 900 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Repository: github.com/zaidwhy/dreamos-college-project (private)", size: 19, color: "555555" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "September 2026", size: 19, color: "555555" })] }),
      ],
    },

    // ---------- SECTION B: TOC ----------
    {
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
      },
      children: [
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Table of Contents", bold: true, size: 32, color: ACCENT })] }),
        new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },

    // ---------- SECTION C: BODY ----------
    {
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 4 } },
            children: [
              new TextRun({ text: "DreamOS - Project Monitoring II", size: 16, color: "777777" }),
              new TextRun({ text: "\tSemantic AI-Native File Management", size: 16, color: "777777" }),
            ],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Page ", size: 16, color: "777777" }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "777777" }),
              new TextRun({ text: " of ", size: 16, color: "777777" }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "777777" }),
            ],
          })],
        }),
      },
      children: [

        // 1. INTRODUCTION
        h1("1. Introduction and Problem Statement"),
        p("Current desktop operating systems organize files around a rigid, human-invented structure: folders, subfolders, and filenames chosen at the moment of saving. As the number of files on a personal machine grows into the thousands, this structure breaks down - the name a user chose six months ago rarely matches how they describe the file today (“the resume with the internship section” rather than resume_final_v3.txt). Locating a file becomes an exercise in remembering one's own past naming decisions rather than describing what is actually needed."),
        p("DreamOS is an AI-native desktop shell that replaces this name-and-location model with a meaning-based one. A local FastAPI backend indexes a folder into a vector store and a metadata database; a Tauri and React desktop application then lets the user describe, in plain natural language, what they want - to find a file, open it, see what it is related to, group related files into a workspace, or have files organized - instead of remembering an exact name or path. All inference (embeddings and language generation) runs on a local Ollama runtime, so no file content or query ever leaves the machine."),
        p("This report documents the state of the project at Project Monitoring - II: the literature and background study behind the approach, the requirement analysis, the complete system design, and the implementation. All six modules proposed at the start of the project are now built, tested and packaged, and the report includes the measurements taken while completing them."),

        h2("1.1 Problem Statement"),
        p("Design and implement a locally-run, AI-native file management layer that lets a user retrieve, open, relate, group, and organize files on their machine by describing their meaning or intent in natural language, without depending on exact filenames, folder locations, or a cloud service."),

        h2("1.2 Objectives"),
        numbered("Build a semantic index of a file vault using local embedding models, so files can be retrieved by meaning rather than by exact name."),
        numbered("Provide a single natural-language interface that classifies user intent (search, open, related, workspace, or organize) and routes it to the correct backend module."),
        numbered("Retrieve files by natural-language query, ranked by semantic similarity, and allow the top match to be opened directly in its default application."),
        numbered("Use a local LLM to generate a summary, tags, and a category for each file, and apply that organization to the file system in a reversible way."),
        numbered("Keep the entire pipeline local and offline-capable (no cloud LLM or vector database dependency) to preserve user privacy."),
        numbered("Extend the system with a knowledge graph of file relationships, a context memory engine, and an intelligent workspace manager."),
        p("All six objectives are met at this checkpoint. Objectives 1 to 5 were delivered at Monitoring - I; objective 6, originally scheduled across Monitoring - II and III, was completed for this report."),

        // 2. LITERATURE REVIEW
        h1("2. Literature Review and Background Study"),
        p("The core technical idea behind DreamOS - representing files as vectors in an embedding space and retrieving them by semantic similarity rather than keyword match - builds on two established lines of work: (a) dense text embeddings for semantic similarity, and (b) semantic/AI-native file systems. Both are reviewed below, alongside the consumer file-search tools DreamOS is positioned against."),

        h2("2.1 Foundational Technique: Dense Embeddings for Semantic Similarity"),
        p("Mikolov et al. [2] showed that words (and, by extension, longer text) can be mapped into a continuous vector space in which geometric distance corresponds to semantic relatedness - the basis of every modern embedding model, including the one used in this project. Reimers and Gurevych [3] extended this idea to full sentences and paragraphs with Sentence-BERT, making it practical to embed and compare whole documents efficiently, which is exactly the operation DreamOS performs once per indexed file. DreamOS uses a local model in this same family, nomic-embed-text (served through Ollama), together with the open-source vector database Chroma [4] for nearest-neighbour retrieval."),

        h2("2.2 Directly Related Work: Semantic and AI-Native File Systems"),
        p("The closest published system to DreamOS is Shi et al. [1], “From Commands to Prompts: LLM-based Semantic File System for AIOS” (ICLR 2025), which proposes an LLM-based Semantic File System (LSFS) built on embedding-vector indexes of files, exposed as a set of APIs that let an LLM agent create, retrieve, update, and roll up files using natural-language prompts instead of rigid file-system commands. LSFS demonstrates, at the operating-system-agent level, that embedding-vector indexes plus an LLM front end are a workable substitute for command-based file operations - directly validating the architectural bet DreamOS makes."),
        p("LSFS, however, targets LLM agents as the consumer of the file system through an API, not an end user through a conversational interface. DreamOS instead exposes the same idea - embedding-vector indexing plus LLM-mediated intent - directly to a human user through a single chat surface that both retrieves and acts on files (opens, organizes)."),

        h2("2.3 Existing Consumer Solutions"),
        p("Mainstream desktop search remains overwhelmingly keyword- and metadata-driven rather than meaning-driven:"),
        bullet("Windows Search / Indexing Service [5] indexes filenames, common metadata fields, and text content, but matches queries lexically - a query has to share vocabulary with the target file."),
        bullet("macOS Spotlight [6] layers metadata and some heuristic ranking on top of a similar keyword index; it is fast and system-wide but not built around embedding similarity."),
        bullet("Everything by voidtools [7] indexes the NTFS Master File Table for near-instant filename search, but is explicitly filename-only - it has no notion of file content or meaning."),

        h2("2.4 Comparison Summary"),
        table(
          [1900, 2800, 2860, 1800],
          ["System", "Retrieval basis", "Strength", "Limitation vs. DreamOS"],
          [
            ["Windows Search", "Keyword / metadata index", "Built into OS, fast", "No semantic matching; no act-on-result (open/organize) from a single query"],
            ["macOS Spotlight", "Keyword / metadata + heuristics", "Fast, system-wide UX", "Not embedding-based; not natural-language conversational"],
            ["Everything (voidtools)", "Filename index (MFT)", "Extremely fast filename lookup", "Filename only, no content understanding"],
            ["AIOS LSFS [1] (ICLR 2025)", "LLM + embedding-vector file index", "Proves embedding-based file indexing at OS level", "API for LLM agents, not an end-user chat interface; not shown running fully local/offline"],
            ["DreamOS (this project)", "Local embeddings + local LLM intent routing", "Single NL interface for search, open, and organize; fully local, private", "n/a - this is the baseline being proposed"],
          ],
        ),

        h2("2.5 Research Gap"),
        p("Consumer desktop search tools remain keyword- or metadata-driven. Where embedding-based semantic file indexing does exist in the literature (LSFS [1]), it is positioned as an API layer for LLM agents rather than a direct, single natural-language surface for end users, and is not demonstrated running entirely on local models without a cloud LLM dependency. DreamOS targets this gap: one conversational interface, backed by locally-run embeddings and a locally-run LLM, that both retrieves files by meaning and acts on them (opens, organizes) - with no file content or query leaving the user's machine."),

        // 3. REQUIREMENT ANALYSIS
        h1("3. Requirement Analysis"),
        h2("3.1 Functional Requirements"),
        table(
          [900, 5300, 3160],
          ["ID", "Requirement", "Status"],
          [
            ["FR1", "Accept a single natural-language message from the user through a chat-style interface", "Implemented"],
            ["FR2", "Classify the message's intent as search, open, related, workspace, organize, or other, using a local LLM", "Implemented"],
            ["FR3", "Semantically search the indexed vault and return ranked results with a similarity score and snippet", "Implemented"],
            ["FR4", "Resolve an “open” request to the best-matching file and launch it in its OS-default application", "Implemented"],
            ["FR5", "Generate an AI summary, tag list, and category suggestion for a given file", "Implemented"],
            ["FR6", "Apply an AI-organized move (into a semantic category folder) and reversibly revert it", "Implemented"],
            ["FR7", "Preview all currently unorganized files before applying any suggestion", "Implemented"],
            ["FR8", "Index (and incrementally re-index) a folder of files, skipping unchanged files by content hash", "Implemented"],
            ["FR9", "Build a graph of relationships between files (similar content, direct references, shared tags)", "Implemented (Monitoring II)"],
            ["FR10", "Retain conversational/session context across chat turns and resolve follow-ups against it", "Implemented (Monitoring II)"],
            ["FR11", "Recommend workspace actions based on file relationships and usage patterns", "Implemented (Monitoring II); shown in the Workspaces view and on request"],
          ],
        ),

        h2("3.2 Technical Requirements"),
        h3("Programming Languages and Frameworks"),
        bullet("Backend: Python 3, FastAPI, Pydantic / pydantic-settings, Uvicorn"),
        bullet("Frontend / Desktop shell: TypeScript, React, Vite, d3-force (graph layout), Tauri v2 (Rust)"),
        bullet("AI / ML runtime: Ollama, running nomic-embed-text (embeddings) and llama3.2 (intent classification, summarization, tagging)"),
        h3("Data Storage"),
        bullet("SQLite - file metadata, knowledge-graph edges, conversation turns, usage events, and workspaces"),
        bullet("ChromaDB - persistent local vector store for embeddings"),
        h3("Tools"),
        bullet("Git / GitHub (private repository) with a GitHub Actions workflow that runs the test suite on every push"),
        bullet("pytest for a fully offline, keyless automated test suite (embeddings and LLM calls mocked)"),
        bullet("WiX Toolset and NSIS (via the Tauri bundler) for Windows installer generation"),
        bullet("Mermaid for architecture, DFD, UML, and ER documentation diagrams"),
        h3("Hardware / Runtime Needs"),
        bullet("No GPU strictly required - nomic-embed-text and llama3.2 run locally on CPU through Ollama; a GPU accelerates but is optional"),
        bullet("Runs entirely on a single local machine; no external API keys and no network dependency at runtime"),

        // 4. SYSTEM DESIGN
        h1("4. System Design"),
        p("DreamOS follows a client-server architecture on a single machine: a Tauri/React desktop client calls a local FastAPI service over HTTP (127.0.0.1:8420), which in turn calls a local Ollama LLM runtime and two local data stores (SQLite for relational data, ChromaDB for vectors)."),

        h2("4.1 System Architecture"),
        ...figure2("01_architecture.png", 600, "Fig. 4.1 - System architecture: desktop client, FastAPI backend with six modules and an indexer, local AI runtime, and storage layer"),

        h2("4.2 Module Design"),
        p("The project proposal specifies six modules, all of which are implemented and integration-tested. The Natural Language Interface routes each request; the Semantic Search Engine and AI File Organizer feed the Knowledge Graph; the Knowledge Graph and the Context Memory Engine feed the Intelligent Workspace Manager; and the Context Memory Engine also feeds back into the Natural Language Interface so that follow-up questions can be resolved."),
        ...figure2("02_module_design.png", 600, "Fig. 4.2 - Module design: all six modules implemented"),
        table(
          [2600, 5000, 1760],
          ["Module", "Input / Output", "Status"],
          [
            ["Natural Language Interface", "In: message and session id. Out: classified intent and routed response (search hits, organize suggestions, related files, workspaces, open path)", "Built"],
            ["Semantic Search Engine", "In: query text. Out: files near the best match, ranked by embedding similarity plus a keyword boost", "Built"],
            ["AI File Organizer", "In: file path. Out: summary, tags, category, reasoning; reversible apply/revert move", "Built"],
            ["Knowledge Graph", "In: file embeddings, text, tags. Out: typed, weighted edges between files, and clusters of related files", "Built (Monitoring II)"],
            ["Context Memory Engine", "In: conversation turns and file-open events. Out: resolved follow-ups and per-file usage counts", "Built (Monitoring II)"],
            ["Intelligent Workspace Manager", "In: graph clusters, usage counts, organizer state. Out: explainable recommendations and named workspaces", "Built (Monitoring II)"],
          ],
        ),

        h2("4.3 Data Flow Diagrams"),
        h3("Context Level (DFD 0)"),
        ...figure2("03_dfd_context.png", 560, "Fig. 4.3 - DFD context level: DreamOS as a single process between the user, the local LLM runtime, and the file vault"),
        h3("Level 1"),
        ...figure2("04_dfd_level1.png", 600, "Fig. 4.4 - DFD level 1: intent classification, with session context, fanning out to search, organize, related-files, workspace, and open-file processes"),

        h2("4.4 UML Diagrams"),
        h3("Use Case Diagram"),
        ...figure2("05_use_case.png", 400, "Fig. 4.5 - Use case diagram: the twelve user-facing actions of the system (six existed at Monitoring - I)"),
        h3("Class Diagram"),
        ...figure2("06_class_diagram.png", 520, "Fig. 4.6 - Class diagram: core response and settings data classes (backend/app)"),
        h3("Sequence Diagram - “open” intent"),
        p("The open-intent flow touches every layer of the stack, so it is used here to illustrate the full request path. Since Monitoring - I it also records a usage event for the opened file, and it refuses to launch a match whose similarity is below the confidence threshold."),
        ...figure2("07_sequence_open.png", 600, "Fig. 4.7 - Sequence diagram: “open my resume” from chat input to a launched file"),
        h3("Sequence Diagram - follow-up question"),
        p("The Context Memory Engine lets a message that means nothing on its own be resolved against what was just shown. “find my invoices” returns a list of files; the next message, “open the second one”, is classified together with the remembered conversation and resolved to the second file of that list by a deterministic rule."),
        ...figure2("10_sequence_followup.png", 560, "Fig. 4.8 - Sequence diagram: a follow-up question resolved from remembered results"),

        h2("4.5 Database Design"),
        p("File metadata is relational (SQLite); embeddings are stored in a vector index (ChromaDB) keyed by the file path. The indexer is the only writer to both. The tables added for the new modules - graph edges, conversation turns, usage events, and workspaces - are all keyed on the file's numeric id rather than its path. The organizer renames a file's path when it applies or reverts a move, but the id survives that rename, so none of these tables needs re-synchronizing after a move."),
        ...figure2("08_er_diagram.png", 560, "Fig. 4.9 - Entity-relationship diagram: the files table, its vector store entry, and the tables added for the graph, memory, and workspace modules"),
        h3("files table - fields, keys, constraints"),
        table(
          [2200, 1600, 5560],
          ["Field", "Type", "Notes"],
          [
            ["id", "INTEGER", "Primary key, autoincrement; the stable identity used by every other table"],
            ["path", "TEXT", "Unique - vault-relative path, also used as the Chroma vector ID"],
            ["original_path", "TEXT", "Path at time of first indexing, kept for organize/revert"],
            ["name / extension", "TEXT", "Derived from path"],
            ["size_bytes / mtime", "INTEGER / REAL", "Change-detection inputs"],
            ["content_hash", "TEXT", "Indexed - lets re-indexing skip unchanged files"],
            ["summary / tags / category", "TEXT", "AI-generated by the organizer module"],
            ["organize_reasoning / organized_at", "TEXT", "Audit trail for the applied organization, used by revert"],
          ],
        ),
        h3("Tables added for the graph, memory, and workspace modules"),
        table(
          [2400, 3300, 3660],
          ["Table", "Key fields", "Purpose"],
          [
            ["file_edges", "src_id, dst_id, kind, weight (primary key: all three of the first)", "Typed edges between files: similar, references, shared_tag; cascade-deleted with the file"],
            ["conversation_turns", "session_id, role, message, intent, file_ids (JSON), created_at", "Persisted chat history; file_ids record which files a turn showed"],
            ["usage_events", "file_id, kind, created_at", "One row each time a file is opened; feeds tie-breaking and recommendations"],
            ["workspaces", "id, name (unique), description, created_at", "Named groups of files"],
            ["workspace_files", "workspace_id, file_id", "Membership of files in workspaces"],
          ],
        ),

        h2("4.6 UI / UX Design"),
        p("The desktop shell has three views: Chat, Knowledge graph, and Workspaces. Chat remains a single input, so that intent classification - not screen navigation - decides what happens with a request. Result cards are actionable: a file can be opened directly from any result, related answers show why files are linked, and workspace suggestions can be created and opened in one click. The graph view draws every file as a node coloured by category, with edges styled by kind, and shows a selected file's neighbours and the reason for each link."),
        ...figure2("ui-chat.png", 470, "Fig. 4.10 - Chat view: related files with the reason each is linked, and workspace suggestions", SHOTS),
        ...figure2("ui-knowledge-graph.png", 470, "Fig. 4.11 - Knowledge graph view: nodes by category, edges by kind, and a selected file with its neighbours", SHOTS),
        ...figure2("ui-workspaces.png", 470, "Fig. 4.12 - Workspaces view: a workspace created from a suggestion, and the remaining suggestions", SHOTS),

        h2("4.7 Technology Stack"),
        table(
          [2200, 7160],
          ["Layer", "Technology"],
          [
            ["Frontend", "React + TypeScript, Vite, d3-force, Tauri v2 (Rust) desktop shell, @tauri-apps/plugin-opener"],
            ["Backend", "Python 3, FastAPI, Uvicorn, Pydantic / pydantic-settings"],
            ["AI / LLM", "Ollama (local runtime): nomic-embed-text for embeddings, llama3.2 for intent classification, summarization and tagging"],
            ["Database", "SQLite (relational data), ChromaDB (persistent vector store)"],
            ["Testing", "pytest with embeddings/LLM mocked for fully offline runs; GitHub Actions runs it on every push"],
            ["Packaging", "Tauri bundler - MSI (WiX) and NSIS Windows installers"],
            ["Version control", "Git, GitHub (private repository)"],
          ],
        ),

        // 5. IMPLEMENTATION STATUS
        h1("5. Implementation Status"),
        p("Project Monitoring - II nominally expects roughly 80% of the system to be implemented. DreamOS is ahead of that mark: all six of the proposed modules are fully implemented, integrated with each other and the desktop shell, automated-tested, verified against the real local models, and packaged into an installable build. Counted against the six-module proposal, that is 100% of the system's module scope working end to end. What remains (section 6) is depth - scale testing, the final report, and a research paper - not features."),

        h2("5.1 What Is Working"),
        bullet("Chat-style natural-language interface with intent classification (search, open, related, workspace, organize, other), routed by a local LLM at temperature = 0 for deterministic behaviour"),
        bullet("Semantic search over an embedded vault; files near the best match are returned, a small keyword boost is applied, and weak matches are labelled as low confidence (section 5.5)"),
        bullet("“Open” intent: best-matching file resolved and launched directly in its default OS application via a scoped Tauri opener permission; near-ties and low-confidence matches are shown as choices instead of being launched"),
        bullet("AI file organizer: per-file summary, tags and category generation, with a reversible apply/revert move that also cleans up now-empty category folders on revert"),
        bullet("Knowledge graph of file relationships with an interactive view (section 5.2)"),
        bullet("Persistent conversation memory and follow-up resolution: “open it”, “open the second one”, “what is related to that” (section 5.3)"),
        bullet("Workspace recommendations and one-click workspaces that open all their files together (section 5.4)"),
        bullet("Incremental indexer that hashes file content to skip unchanged files, and rebuilds the graph after any run that changed something"),
        bullet("One-click launcher (PowerShell + .bat) that starts Ollama and the backend only if not already running, indexes the vault, and launches the desktop app"),
        bullet("Windows installers (MSI and NSIS) and a release executable built via the Tauri bundler"),

        h2("5.2 Knowledge Graph"),
        p("The Knowledge Graph derives three kinds of edge between indexed files and stores them in the file_edges table. A similar edge joins two files whose embeddings are close. A references edge is directed: it links a file to another file whose filename it names (for example a resume that says “previous versions: resume_final” links to resume_final.txt). A shared_tag edge joins files that share at least two of the AI-generated tags. Each file nominates at most its three strongest similar neighbours and an edge is kept when either end nominates it, which keeps the graph sparse. On the demo vault of 37 files the graph has 24 links and 12 unlinked files."),
        h3("Finding 1: raw embedding similarity misleads the graph"),
        p("The similarity between whole files, measured with nomic-embed-text, is compressed into a narrow band: across all 666 file pairs of the demo vault the median cosine similarity is 0.52 and the maximum 0.83. Worse, an unrelated pair (notes.txt and spec_v1.txt, 0.72) scored higher than a genuine invoice pair (inv_003.txt and recieved_payment.txt, 0.67), so no threshold on the raw score could separate real neighbours from noise. Subtracting the corpus mean vector from every file vector before comparing them removes the direction all embeddings share. After this mean-centering the real groups rank at the top - the invoice, resume, meeting and code files at 0.25 to 0.4 - while unrelated pairs fall to about zero, and a plain threshold of 0.25 works. Centering needs enough files to estimate a typical vector, so no similarity is reported for a collection of fewer than three files."),
        h3("Finding 2: clusters must not chain"),
        p("Groups of related files are needed by the Workspace Manager. Taking the connected components of the graph merged the four resume files with three unrelated proposal and meeting files through two weak edges, producing a seven-file group. Splitting such groups by density was tried and either failed to split them or destroyed a genuine group. The final method is average-linkage clustering: two groups merge only while the average edge weight between all their member pairs (a missing edge counting as zero) stays above 0.12. A single bridge edge between two tight groups averages out to almost nothing, so chaining cannot occur by construction. On the demo vault this yields Resumes (4 files), Invoices (4), Code (3), and Project Docs (3)."),

        h2("5.3 Context Memory Engine"),
        p("Every chat turn is stored in the conversation_turns table together with the ids of the files it showed, so a follow-up can be resolved even after the app is restarted, and even if the organizer has renamed a file in between. Resolving follow-ups is deliberately rule-based rather than left to the small language model: ordinal references (“the second one”, “the last one”) index into the list of files last shown, and a message made only of filler words and a pronoun (“open it”, “what is related to that”) resolves to the top file of the last results. The model's own “refers to previous” flag is accepted only as a fallback for phrasings the rules do not cover, and a bare “open it” is forced to the open intent even if the model classified it as a search. The previous turns are also placed in the classification prompt, using the same single model call, so no extra latency is added."),
        p("The engine also records every file the user opens. When two candidate files for an “open” request are too close to call (within 0.05 similarity) the system does not guess: it shows both. Once the user has opened one of them, that file wins the tie on the next request, and only if exactly one candidate has been opened more than the others."),

        h2("5.4 Intelligent Workspace Manager"),
        p("The Workspace Manager produces recommendations from data the system already holds. They are rule-based rather than generated by the language model, which makes them reproducible and explainable and costs no extra model calls. A workspace is a named group of files that opens all its files together."),
        table(
          [1700, 4100, 3560],
          ["Recommendation", "Trigger", "Action offered"],
          [
            ["Related group", "An average-linkage cluster of 3 to 12 files not already covered by a workspace; named after its dominant category or tag", "Create the workspace"],
            ["Frequently used", "Files opened at least 3 times", "Create a “Frequently used” workspace"],
            ["Possible duplicate", "A similar edge of at least 0.9 after centering, or identical content hash", "Informational"],
            ["Needs organizing", "Indexed files that have no organizer category", "Ask DreamOS to organize them"],
            ["Stale files", "Not modified for 90 or more days and never opened through DreamOS", "Informational"],
          ],
        ),

        h2("5.5 Retrieval Quality: Measurement and Fix"),
        p("Short queries such as “meeting” returned nothing, because the search kept only files above a fixed similarity of 0.55 and a short query scores low even when its best match is right. Rather than guess a fix, a labelled evaluation set was built from the actual contents of the demo vault: 27 queries with known answers (short keywords and descriptive phrases) and 4 off-topic queries that should match nothing, split into a tuning half and a held-out half. Four approaches were compared on it."),
        table(
          [3000, 3300, 3060],
          ["Approach", "Result", "Decision"],
          [
            ["Fixed cutoff of 0.55 (original)", "A correct file appears for 20 of 27 queries; precision 0.63", "Replaced"],
            ["nomic-embed-text task prefixes (search_query / search_document)", "Top-1 correct 21 to 24 of 27, but a fixed cutoff still cannot separate a weak correct query (0.56) from junk (0.57); needs re-embedding and retuning every threshold", "Not adopted; documented"],
            ["LLM query expansion (a generated description of the wanted file)", "Top-1 correct fell to 13 of 27: the 3B model's descriptions drift", "Rejected"],
            ["Files within a margin of the best hit (floor 0.47, margin 0.06) plus a keyword boost (0.08 per fraction of query words found)", "A correct file appears for 27 of 27 queries (14 of 14 held-out); top-1 correct 24 of 27 (13 of 14 held-out); precision 0.82; no re-embedding", "Adopted"],
          ],
        ),
        p("The adopted method was re-measured through the production search endpoint and reproduced the offline numbers exactly. The keyword boost sits on a plateau: weights from 0.08 to 0.20 all give 24 of 27, so the setting is not a fragile tuning. Because low-confidence results are now returned, they are labelled as such, and the open intent never launches a match below the 0.55 confidence level. The residual weaknesses are honest ones: the query “meeting notes” still ranks workout_log.txt first, because that file literally mentions “the project meeting”, and three of the four off-topic file-shaped queries return low-confidence guesses rather than nothing; non-file requests such as “what is the weather” are turned away earlier, by the intent classifier."),

        h2("5.6 Testing and Evaluation"),
        table(
          [2300, 5260, 1800],
          ["Level", "What was done", "Result"],
          [
            ["Unit and integration", "110 pytest tests covering indexing, search and the keyword boost, the organizer, the graph, memory, workspaces, intent routing, the reset script, and the HTTP API", "110 passed, offline"],
            ["Continuous integration", "A GitHub Actions workflow runs the suite on every push (Linux)", "Passing"],
            ["Test strength", "Key guards were deliberately broken (the short-filename rule for references, the workspace-coverage filter) to confirm a test fails", "Each caught"],
            ["Intent routing, real model", "32-message tuning set and a 26-message held-out set on llama3.2. The prompt was rewritten; it scored 32 of 32 on the tuning set it was tuned against, and the held-out set is the honest figure", "Held-out 21 to 23 of 26 (80% to 88%)"],
            ["End to end, real models", "Multi-turn follow-ups, ambiguity then usage-based resolution, organizing and reverting a newly added file, and graph rebuild on indexing", "As designed"],
            ["Retrieval", "31-query labelled set with tuning and held-out halves (section 5.5)", "27 of 27 found; top-1 24 of 27"],
            ["Real desktop shell", "Workspace “Open all” and click-to-open were driven inside the running Tauri application over WebView2's debug port, surfacing no permission errors. The earlier open feature had shown that a plain browser test cannot reveal shell-permission bugs", "No errors"],
          ],
        ),

        h2("5.7 Version Control and Delivery"),
        bullet("Private repository: github.com/zaidwhy/dreamos-college-project, fetched before every push"),
        bullet("Reproducible demo data: a sandboxed, intentionally messy demo-vault (not real personal files) regenerated by a fixed script, and a reset script that restores a known state between rehearsals"),
        bullet("README.md, HANDOFF.md, and DEMO-SCRIPT.md document the architecture, the decisions behind the measurements above, and a demonstration in which every query was run against the real stack"),

        h2("5.8 Known Limitations"),
        bullet("Very short queries are best-effort: a file that merely contains the query word can outrank the real answer, and off-topic file-shaped queries return low-confidence guesses"),
        bullet("Intent routing uses a 3B-parameter local model; borderline wording (“which files should I archive”) can be classified as organize instead of workspace"),
        bullet("Graph clustering is deliberately conservative: some related files stay unlinked rather than risk grouping unrelated ones"),
        bullet("Similarity is computed pairwise and search scores every chunk: appropriate for tens to a few hundred files, but larger collections would need an approximate nearest-neighbour method"),

        // 6. PLAN
        h1("6. Plan for Monitoring - III"),
        table(
          [2300, 7060],
          ["Area", "Planned work"],
          [
            ["Scale and performance", "Run the system on a larger vault, measure indexing, search and graph-build time, and introduce an approximate neighbour method if the pairwise computations become a bottleneck"],
            ["Retrieval", "Test the embedding-prefix option end to end, with re-embedding and threshold retuning, now that a labelled evaluation set exists to judge it"],
            ["Documentation", "Finalize the project report: results, discussion, conclusion, and future scope"],
            ["Research paper", "Prepare and submit the accompanying research paper, drawing on the measurements in sections 5.2, 5.5 and 5.6"],
            ["Submission", "Final GitHub submission and installer hand-off"],
          ],
        ),

        // 7. REFERENCES
        h1("7. References"),
        p("[1] Z. Shi, K. Mei, M. Jin, Y. Su, C. Zuo, W. Hua, W. Xu, Y. Ren, Z. Liu, M. Du, D. Deng, and Y. Zhang, “From Commands to Prompts: LLM-based Semantic File System for AIOS,” in Proc. 13th Int. Conf. on Learning Representations (ICLR 2025). arXiv:2410.11843."),
        p("[2] T. Mikolov, K. Chen, G. Corrado, and J. Dean, “Efficient Estimation of Word Representations in Vector Space,” arXiv:1301.3781, 2013."),
        p("[3] N. Reimers and I. Gurevych, “Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks,” in Proc. EMNLP-IJCNLP, 2019."),
        p("[4] Chroma, “Chroma: the open-source embedding database,” github.com/chroma-core/chroma."),
        p("[5] Microsoft, “Windows Search overview,” Microsoft Learn documentation."),
        p("[6] Apple Inc., “Spotlight User Guide,” support.apple.com."),
        p("[7] voidtools, “Everything - locate files and folders by name instantly,” voidtools.com."),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  const out = path.join(__dirname, "DreamOS-Project-Monitoring-II.docx");
  fs.writeFileSync(out, buffer);
  console.log("Wrote", out, buffer.length, "bytes");
});
