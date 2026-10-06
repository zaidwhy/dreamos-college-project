// Builds docs/blackbook/DreamOS-Final-Year-Project-Report.docx in the MGM IICT format
// (Project Report Index 2026-2027): Times New Roman, 12pt body at 1.5 spacing, 14pt bold headings.
// Benchmark numbers are read from backend/data/bench/results.json, so the report and the
// measurements cannot drift apart. Run from the repo root with:
//   NODE_PATH="$(npm root -g)" node docs/blackbook/build_blackbook.js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, Footer, Header,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType, ShadingType, PageNumber,
  PageBreak, TableOfContents, NumberFormat, TabStopType, TabStopPosition, VerticalAlign,
} = require("docx");

const REPO = path.resolve(__dirname, "..", "..");
const DIAG = path.join(REPO, "docs", "diagrams");
const SHOTS = path.join(REPO, "docs", "screenshots");
const BENCH = JSON.parse(fs.readFileSync(path.join(REPO, "docs", "benchmarks", "scale_results.json"), "utf8"));
const BEFORE = JSON.parse(fs.readFileSync(path.join(REPO, "docs", "benchmarks", "scale_results_before.json"), "utf8"));

const FONT = "Times New Roman";
const BODY = 24; // half-points: 12pt
const HEAD = 28; // 14pt
const LINE_15 = { line: 360, lineRule: "auto" };
const TEXT_WIDTH = 9026; // A4 with 1-inch margins, DXA
const A4 = { width: 11906, height: 16838 };
const MARGINS = { top: 1440, right: 1440, bottom: 1440, left: 1440 };

// ---------------------------------------------------------------- helpers
const run = (text, opts = {}) => new TextRun({ text, font: FONT, size: BODY, ...opts });

function para(text, opts = {}) {
  const { align = AlignmentType.JUSTIFIED, after = 160, bold = false, italics = false, size } = opts;
  return new Paragraph({
    alignment: align,
    spacing: { ...LINE_15, after },
    children: [new TextRun({ text, font: FONT, size: size || BODY, bold, italics })],
  });
}

const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 200 }, children: [new TextRun({ text, font: FONT, size: HEAD, bold: true })] });
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 120 }, children: [new TextRun({ text, font: FONT, size: HEAD, bold: true })] });
const h3 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 100 }, children: [new TextRun({ text, font: FONT, size: HEAD })] });

function bullet(text) {
  return new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { ...LINE_15, after: 80 }, children: [run(text)] });
}

function code(text) {
  return text.split("\n").map((line) => new Paragraph({
    spacing: { line: 240, after: 0 },
    shading: { type: ShadingType.CLEAR, fill: "F2F2F2" },
    children: [new TextRun({ text: line || " ", font: "Courier New", size: 18 })],
  }));
}

function caption(text) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 240 }, children: [new TextRun({ text, font: FONT, size: 22, italics: true })] });
}

function figure(file, width, capText, dir = DIAG) {
  const data = fs.readFileSync(path.join(dir, file));
  const height = Math.round(width * (data.readUInt32BE(20) / data.readUInt32BE(16)));
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 160, after: 60 },
      children: [new ImageRun({ type: "png", data, transformation: { width, height }, altText: { title: capText, description: capText, name: file } })] }),
    caption(capText),
  ];
}

const border = { style: BorderStyle.SINGLE, size: 4, color: "808080" };
const borders = { top: border, bottom: border, left: border, right: border };

function table(widths, header, rows) {
  const total = widths.reduce((a, b) => a + b, 0);
  const cell = (text, w, isHead) => new TableCell({
    borders, width: { size: w, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    shading: isHead ? { fill: "D9D9D9", type: ShadingType.CLEAR } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ spacing: { line: 276, after: 0 }, children: [new TextRun({ text: String(text), font: FONT, size: 21, bold: isHead })] })],
  });
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: header.map((t, i) => cell(t, widths[i], true)) }),
      ...rows.map((r) => new TableRow({ children: r.map((t, i) => cell(t, widths[i], false)) })),
    ],
  });
}

const tableCaption = (text) => new Paragraph({ keepNext: true, spacing: { before: 200, after: 100 }, children: [new TextRun({ text, font: FONT, size: 22, bold: true })] });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

// ---------------------------------------------------------------- numbers
const b5 = BENCH["500"], b2 = BENCH["2000"], b5k = BENCH["5000"];
const f5 = BEFORE["500"], f2 = BEFORE["2000"];
const r1 = (x) => (Math.round(x * 10) / 10).toFixed(1);

// ---------------------------------------------------------------- front matter
const cover = [
  para("A", { align: AlignmentType.CENTER, after: 0, bold: true, size: 28 }),
  para("B. Tech (Information Technology)", { align: AlignmentType.CENTER, after: 200, bold: true, size: 28 }),
  para("PROJECT REPORT ON", { align: AlignmentType.CENTER, after: 300, bold: true, size: 28 }),
  para("“DreamOS: An AI-Native Semantic File Management System with Knowledge Graph, Context Memory and Intelligent Workspace Management”", { align: AlignmentType.CENTER, after: 400, bold: true, size: 28 }),
  para("Submitted by", { align: AlignmentType.CENTER, after: 120, bold: true }),
  para("Zaid Ali Syed\t\t2305139", { align: AlignmentType.CENTER, after: 60 }),
  para("Om Vyas\t\t2305170", { align: AlignmentType.CENTER, after: 60 }),
  para("Krushna Kadam\t\t2305165", { align: AlignmentType.CENTER, after: 300 }),
  para("Under Guidance of", { align: AlignmentType.CENTER, after: 120, bold: true }),
  para("<Name of Guide>", { align: AlignmentType.CENTER, after: 400, bold: true }),
  para("Institute of Information and Communication Technology (IICT)", { align: AlignmentType.CENTER, after: 0, bold: true }),
  para("MGM University, Chh. Sambhajinagar", { align: AlignmentType.CENTER, after: 0, bold: true }),
  para("Academic Year 2026-2027", { align: AlignmentType.CENTER, after: 0, bold: true }),
];

const certificate = [
  para("Institute of Information and Communication Technology", { align: AlignmentType.CENTER, after: 0, bold: true }),
  para("MGM University, Chh. Sambhajinagar", { align: AlignmentType.CENTER, after: 400, bold: true }),
  para("CERTIFICATE", { align: AlignmentType.CENTER, after: 400, bold: true, size: 28 }),
  para("This is to certify that Zaid Ali Syed (Roll No. 2305139), Om Vyas (Roll No. 2305170) and Krushna Kadam (Roll No. 2305165) of B.Tech (IT), have successfully completed project work on “DreamOS: An AI-Native Semantic File Management System” under the guidance of <Name of Guide>, and submitted the same during the academic year 2026-2027 towards the partial fulfillment of the degree of B.Tech (IT) from Institute of Information and Communication Technology, MGM University, Chh. Sambhajinagar.", { after: 600 }),
  para("<Guide's Name>\t\t\t\t\t\tDr. S. C. Tamane", { align: AlignmentType.LEFT, after: 0 }),
  para("Guide\t\t\t\t\t\t\tDirector, IICT", { align: AlignmentType.LEFT, after: 600 }),
  para("Date: ____________________", { align: AlignmentType.LEFT }),
];

const acknowledgement = [
  h1("Acknowledgement"),
  para("We thank our guide, <Name of Guide>, for guidance on the project. We thank Dr. S. C. Tamane, Director, IICT, and the faculty of the Institute of Information and Communication Technology for the environment and the Project Monitoring structure in which this work was reviewed."),
  para("We are grateful to the open-source communities behind Ollama, ChromaDB, FastAPI, Tauri, React and pytest, on whose work DreamOS is built, and to our families for their patience during the long build."),
  para("\n(Zaid Ali Syed, Roll No. 2305139)\t\t(Om Vyas, Roll No. 2305170)\t\t(Krushna Kadam, Roll No. 2305165)", { align: AlignmentType.LEFT }),
];

// ---------------------------------------------------------------- abstract, abbreviations
const abstract = [
  h1("Abstract"),
  para("Personal computers hold thousands of files whose names were chosen once and rarely describe what the file is about now. Finding a file means remembering how it was named. DreamOS is an AI-native desktop file manager that lets a user describe a file in plain language, and it finds, opens, relates and organises files by meaning rather than by name. All processing runs on the user's computer: embeddings and language understanding come from a local model runtime, and the index is stored in local databases, so no file content or question is sent to a server."),
  para("The system has six modules: a natural-language interface that classifies intent, a semantic search engine, an AI file organiser with reversible moves, a knowledge graph of relationships between files, a context memory engine that resolves follow-up questions, and an intelligent workspace manager that recommends and creates groups of related files. A privacy audit reports every network destination the software uses, so the claim that data stays local can be checked rather than trusted."),
  para(`The work was evaluated on synthetic vaults of 500, 2,000 and 5,000 files. Indexing ran at ${r1(b5.index_files_per_second)} files per second at 500 files, search answered in a median of ${r1(b5.search_p50_ms)} ms, and the knowledge graph rebuilt in ${r1(b5k.graph_rebuild_seconds)} seconds at 5,000 files after vectorisation. The original method took ${r1(f2.graph_rebuild_seconds)} seconds at only 2,000 files. Search slowed to ${r1(b5k.search_p50_ms)} ms at 5,000 files, and the graph remains the main limit at that size. Two defects found during measurement, a name-resolution delay on the test machine and a quadratic graph computation, were fixed and re-measured. The report states what the measurements do and do not show, including the limits of the synthetic evaluation.`),
  para("Keywords: semantic search, sentence embeddings, knowledge graph, local large language models, personal information management, privacy by design."),
];

const abbreviations = [
  h1("Abbreviations"),
  table([1800, 7226], ["Abbreviation", "Expansion"], [
    ["API", "Application Programming Interface"],
    ["CSS / HTML", "Cascading Style Sheets / HyperText Markup Language"],
    ["DFD", "Data Flow Diagram"],
    ["ER", "Entity-Relationship"],
    ["HNSW", "Hierarchical Navigable Small World (approximate nearest-neighbour index)"],
    ["IICT", "Institute of Information and Communication Technology"],
    ["LLM", "Large Language Model"],
    ["MFT", "Master File Table (NTFS file index)"],
    ["NLI", "Natural Language Interface"],
    ["SQLite", "Structured Query Language database engine (file-based)"],
    ["UI / UX", "User Interface / User Experience"],
    ["UML", "Unified Modeling Language"],
  ]),
];

const listOfFigures = [
  h1("List of Figures"),
  table([1200, 7626], ["Figure", "Title"], [
    ["4.1", "System architecture"],
    ["4.2", "Module design"],
    ["4.3", "Data flow diagram - context level"],
    ["4.4", "Data flow diagram - level 1"],
    ["4.5", "Use case diagram"],
    ["4.6", "Class diagram of the response and settings data classes"],
    ["4.7", "Sequence diagram: open request"],
    ["4.8", "Sequence diagram: follow-up question"],
    ["4.9", "Entity-relationship diagram"],
    ["5.1", "Chat view"],
    ["5.2", "Knowledge graph view"],
    ["5.3", "Workspaces view"],
  ]),
  h2("List of Tables"),
  table([1200, 7626], ["Table", "Title"], [
    ["3.1", "Functional requirements"],
    ["3.2", "Non-functional requirements"],
    ["3.3", "Hardware and software specification"],
    ["4.1", "Files table fields"],
    ["4.2", "Tables added for the graph, memory and workspace modules"],
    ["6.1", "Test levels and what each covered"],
    ["6.2", "Selected test cases and results"],
    ["7.1", "Scale benchmark: indexing and graph build"],
    ["7.2", "Scale benchmark: search latency and retrieval quality"],
    ["7.3", "Qualitative comparison with existing systems"],
    ["7.4", "Effect of the defect fixes on the measured pipeline"],
  ]),
];

// ---------------------------------------------------------------- TOC
const contents = [
  new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: "Contents", font: FONT, size: HEAD, bold: true })] }),
  new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-3" }),
];

// ---------------------------------------------------------------- chapter 1
const ch1 = [
  h1("Chapter 1: Introduction"),
  h2("1.1 Introduction"),
  para("Digital work leaves a trail of documents: invoices, résumés, meeting notes, code, photographs of receipts and downloads with names such as final_final_v3.txt or Untitled document.txt. Operating systems organise these by folder and filename, both chosen at the moment of saving. As the number of files grows, the names stop matching the way people remember them. A person looks for “the résumé with the internship section” and must recall an arbitrary name instead."),
  para("DreamOS addresses this by making meaning the access key. The user types a request such as “find my invoices”, “open my resume”, “what is related to my resume” or “suggest some workspaces”, and the system responds by searching, opening, relating or grouping files. The application is a desktop shell built with Tauri and React that talks to a local Python service. The service stores its index in two local databases and uses a local language-model runtime for understanding. Nothing is sent to a remote server."),
  h2("1.2 Problem Statement"),
  para("Design and implement a locally run file-management layer that lets a person retrieve, open, relate and organise files by describing what they are about, without depending on exact filenames, folder locations or a cloud service, and that makes its privacy behaviour verifiable."),
  h2("1.3 Objectives"),
  bullet("Build a semantic index of a file collection using local embedding models, so that files are found by meaning."),
  bullet("Provide one natural-language interface that classifies what the user wants and routes the request to the right module."),
  bullet("Return ranked results with honest confidence, and open a file only when the match is confident."),
  bullet("Use a local language model to summarise, tag and categorise files, and apply that organisation reversibly."),
  bullet("Model relationships between files, remember conversation so that follow-up questions work, and recommend workspaces."),
  bullet("Keep all processing local, and provide an audit that reports where data could leave the machine."),
  bullet("Measure the system at a scale beyond the demonstration vault, and report the results including the defects found."),
  h2("1.4 Scope of the Project"),
  para("The project covers a single-user desktop application for Windows, indexing a folder of text, Markdown, source code, PDF and Word documents. It includes the six modules listed in Chapter 4, a privacy audit, and a scale evaluation on synthetic collections. It does not cover mobile devices, multi-user access, synchronisation across machines, cloud models, or indexing of images and audio. The demonstration uses a sandboxed vault of 37 generated files so that no real personal data is handled during evaluation."),
];

// ---------------------------------------------------------------- chapter 2
const ch2 = [
  h1("Chapter 2: Literature Review"),
  h2("2.1 Review of Existing Systems and Related Work"),
  para("Two lines of research bear on this project: dense text embeddings, which place text in a vector space where distance reflects meaning, and semantic or AI-native file systems, which use such embeddings to organise files. Mikolov et al. showed that words can be embedded so that geometric distance tracks relatedness [2]. Reimers and Gurevych extended the idea to sentences and paragraphs with Sentence-BERT, which makes comparing whole documents efficient [3]. DreamOS uses nomic-embed-text, a model in this family, served locally through Ollama, with the Chroma vector database for nearest-neighbour search [4]."),
  para("The closest system is LSFS, a semantic file system for an LLM operating-system agent presented at ICLR 2025 [1]. LSFS shows that embedding indexes plus a language-model front end can replace command-based file operations. It is designed for software agents that call an API, not for a person typing requests, and its evaluation does not establish that it runs entirely on local models. DreamOS takes the same architectural idea and exposes it to a human through one conversational surface that both finds and acts on files."),
  para("Mainstream desktop search is still driven by names and metadata. Windows Search indexes filenames, metadata and text but matches a query only where it shares vocabulary with the file [5]. Spotlight adds metadata and heuristics over a similar keyword index [6]. Everything indexes the NTFS master file table for instant filename lookup and does not read content [7]."),
  tableCaption("Table 2.1: Comparison with existing systems"),
  table([2000, 2300, 2300, 2426], ["System", "Retrieval basis", "Strength", "Limitation relative to DreamOS"], [
    ["Windows Search", "Keyword and metadata index", "Built in, fast", "No meaning-based matching; cannot act on a result from one query"],
    ["macOS Spotlight", "Keyword, metadata, heuristics", "Fast, system-wide", "Not embedding-based; not conversational"],
    ["Everything", "Filename index (MFT)", "Very fast name lookup", "Names only; no content understanding"],
    ["LSFS (ICLR 2025)", "LLM plus embedding index", "Shows embedding file indexing at OS level", "Built for agents via API; local operation not demonstrated"],
    ["DreamOS", "Local embeddings plus local intent routing", "One interface to find, open, relate and organise; private", "Single-user desktop only; small-model limits on short queries"],
  ]),
  h2("2.2 Research Gap"),
  para("The literature establishes embedding-based file indexing as workable [1] and establishes that consumer tools match on words [5-7]. Three gaps remain. First, embedding search is presented as an agent API rather than as a single conversational surface that both retrieves and acts on files for a person. Second, published systems do not show that the full pipeline, from embedding to answer, runs on local models with the data-leaving question answered by measurement rather than assertion. Third, the behaviour of such systems on short, everyday queries, and on collections of thousands of files, is rarely reported with the defects that testing exposes."),
  h2("2.3 Summary of Findings"),
  bullet("Embedding similarity is compressed for sentence models, so fixed similarity cut-offs drop correct answers to short queries; a relative cut-off with a small keyword boost recovers them without re-embedding."),
  bullet("A language model's own judgement about whether a message refers back to earlier conversation is unreliable; deterministic rules and direct evidence should decide first."),
  bullet("Pairwise similarity over a whole collection grows with the square of the number of files, and must be vectorised before it can scale."),
  bullet("Averaging edge weights, rather than merging connected components, prevents unrelated groups from being joined by a single weak link."),
];

// ---------------------------------------------------------------- chapter 3
const ch3 = [
  h1("Chapter 3: System Analysis"),
  h2("3.1 Requirement Analysis"),
  h3("3.1.1 Functional requirements"),
  tableCaption("Table 3.1: Functional requirements"),
  table([900, 5600, 2526], ["ID", "Requirement", "Status"], [
    ["FR1", "Accept one natural-language message through a chat interface", "Implemented"],
    ["FR2", "Classify intent as search, open, related, workspace, organise or other", "Implemented"],
    ["FR3", "Semantic search returning ranked files with score and snippet", "Implemented"],
    ["FR4", "Open the best match in its default application only when confident", "Implemented"],
    ["FR5", "Generate a summary, tags and category for each file", "Implemented"],
    ["FR6", "Apply and reverse an organisation move", "Implemented"],
    ["FR7", "Preview unorganised files before any change", "Implemented"],
    ["FR8", "Index and re-index incrementally by content hash", "Implemented"],
    ["FR9", "Model relationships between files and show related files", "Implemented"],
    ["FR10", "Resolve follow-up questions against the earlier conversation", "Implemented"],
    ["FR11", "Recommend and create workspaces from relationships and usage", "Implemented"],
    ["FR12", "Report where data could leave the machine, from live configuration", "Implemented"],
  ]),
  h3("3.1.2 Non-functional requirements"),
  tableCaption("Table 3.2: Non-functional requirements"),
  table([2200, 4026, 2800], ["Attribute", "Requirement", "How it is evaluated"], [
    ["Privacy", "No file content or question leaves the machine", "Privacy audit; loopback check; test"],
    ["Performance", "Search answers in well under a second", "Scale benchmark, Section 7"],
    ["Scalability", "Graph and indexing remain practical at several thousand files", "Scale benchmark at 500, 2,000 and 5,000 files"],
    ["Reliability", "Organisation moves are reversible", "Automated apply-and-revert test"],
    ["Usability", "One input box; results are cards with actions", "Screenshots, Section 5.4"],
    ["Maintainability", "Each module has its own tests; offline test run", "116 automated tests, CI on every push"],
  ]),
  h2("3.2 Feasibility Study"),
  para("Technical feasibility was confirmed early by building the indexing and search path with a local embedding model and measuring it on the demonstration vault. Economic feasibility holds because every component is open source and the models run on an ordinary laptop without a graphics card, so the running cost is zero. Operational feasibility depends on the user accepting that the first request after a cold start is slow while a model loads, which is documented in the demonstration guide. Schedule feasibility was managed by building the three core modules first and then adding the graph, memory and workspace modules as separate, tested increments."),
  h2("3.3 System Specifications"),
  tableCaption("Table 3.3: Hardware and software specification"),
  table([2600, 6426], ["Item", "Specification used for development and evaluation"], [
    ["Processor", "AMD Ryzen 7 6800H, 8 cores, 16 logical processors"],
    ["Memory", "16 GB installed (about 15 GB reported as usable)"],
    ["Storage", "Local solid-state storage; index size is reported per run in the benchmark output"],
    ["Graphics", "Not required; models run on the CPU"],
    ["Operating system", "Windows 11"],
    ["Language and frameworks", "Python 3.12, FastAPI, Pydantic, ChromaDB 1.5, SQLite 3, NumPy 2.5"],
    ["Models", "nomic-embed-text (137M parameters, embeddings); llama3.2 3B (intent, summaries, tags)"],
    ["Desktop shell", "Tauri 2 with React 19, TypeScript and Vite"],
    ["Testing", "pytest 9, FastAPI test client, GitHub Actions on Linux"],
    ["Packaging", "Windows MSI and NSIS installers built by the Tauri bundler"],
  ]),
];

// ---------------------------------------------------------------- chapter 4
const ch4 = [
  h1("Chapter 4: System Design"),
  h2("4.1 System Architecture"),
  para("DreamOS is a client-server application on one machine. The desktop client calls a local service over HTTP on 127.0.0.1:8420. The service classifies requests, searches, organises and computes relationships, and calls the local model runtime for language tasks. Two stores hold the data: a relational database for metadata, relationships, conversation and usage, and a vector database for the embeddings of text chunks."),
  ...figure("01_architecture.png", 440, "Figure 4.1 - System architecture: desktop client, local service, local model runtime, and storage"),
  h2("4.2 Module Design"),
  para("The system is organised in six modules. The Natural Language Interface decides what a request means and routes it. The Semantic Search Engine returns files near the best match. The AI File Organiser proposes categories and reversible moves. The Knowledge Graph links files by similar content, by direct reference and by shared tags. The Context Memory Engine keeps the conversation so that a follow-up can be resolved, and records which files the user opens. The Workspace Manager turns the graph and usage into explainable recommendations and creates workspaces that open together."),
  ...figure("02_module_design.png", 430, "Figure 4.2 - Module design and the data each module passes to the next"),
  h2("4.3 Data Flow Diagrams"),
  ...figure("03_dfd_context.png", 400, "Figure 4.3 - Data flow diagram, context level"),
  ...figure("04_dfd_level1.png", 440, "Figure 4.4 - Data flow diagram, level 1"),
  h2("4.4 UML Diagrams"),
  ...figure("05_use_case.png", 360, "Figure 4.5 - Use case diagram of user actions"),
  ...figure("06_class_diagram.png", 420, "Figure 4.6 - Class diagram of response and settings classes"),
  ...figure("07_sequence_open.png", 440, "Figure 4.7 - Sequence diagram of an open request"),
  ...figure("10_sequence_followup.png", 440, "Figure 4.8 - Sequence diagram of a follow-up question resolved from memory"),
  h2("4.5 Database Design"),
  para("File metadata is stored in SQLite and each file's text chunks are stored as vectors in ChromaDB, linked by the file path. All relationship, memory, usage and workspace tables refer to the file's numeric identifier rather than its path. The organiser renames a file when it moves it, but the identifier does not change, so no table needs rewriting after a move."),
  ...figure("08_er_diagram.png", 400, "Figure 4.9 - Entity-relationship diagram"),
  tableCaption("Table 4.1: Fields of the files table"),
  table([2400, 1600, 5026], ["Field", "Type", "Purpose"], [
    ["id", "INTEGER", "Stable identifier used by every other table"],
    ["path", "TEXT, unique", "Path relative to the vault; also the vector identifier"],
    ["original_path", "TEXT", "Path at first indexing, kept so a move can be reversed"],
    ["content_hash", "TEXT", "Lets re-indexing skip unchanged files"],
    ["summary, tags, category", "TEXT", "Produced by the organiser"],
    ["organize_reasoning, organized_at", "TEXT", "Explanation and time of the applied organisation"],
  ]),
  tableCaption("Table 4.2: Tables added for the graph, memory and workspace modules"),
  table([2400, 3400, 3226], ["Table", "Key fields", "Purpose"], [
    ["file_edges", "source, target, kind, weight", "Typed relationships between files"],
    ["conversation_turns", "session, role, message, file identifiers", "Conversation kept across restarts"],
    ["usage_events", "file identifier, kind, time", "Records each open; used for tie-breaking and recommendations"],
    ["workspaces, workspace_files", "name; workspace and file identifiers", "Named groups of files"],
  ]),
  h2("4.6 UI / UX Design"),
  para("The interface has four views: a chat view for requests, a knowledge-graph view, a workspace view and a privacy view. Results appear as cards with the action the user can take, so a file is opened from the card that shows it. Related-file answers show why each file is linked, such as similar content, a direct reference or shared tags."),
  ...figure("ui-chat.png", 430, "Figure 4.10 - Chat view: related files with the reason each is linked", SHOTS),
  h2("4.7 Technology Stack"),
  tableCaption("Table 4.3: Technology stack by layer"),
  table([2200, 6826], ["Layer", "Technology"], [
    ["Interface", "React 19, TypeScript, Vite, d3-force for the graph layout, Tauri 2 shell"],
    ["Service", "Python 3.12, FastAPI, Uvicorn, Pydantic"],
    ["Understanding", "Ollama runtime with nomic-embed-text and llama3.2"],
    ["Storage", "SQLite for relational data; ChromaDB for vectors"],
    ["Numerics", "NumPy for vectorised similarity"],
    ["Quality", "pytest, GitHub Actions, Playwright and the WebView2 debug protocol for end-to-end checks"],
  ]),
];

// ---------------------------------------------------------------- chapter 5
const ch5 = [
  h1("Chapter 5: Implementation"),
  h2("5.1 Module-wise Description"),
  h3("5.1.1 Natural Language Interface"),
  para("Each message is sent to the local model with a short description of the four levels of intent, and the model returns JSON with the intent, the topic to search for, and a flag for whether the message refers back to earlier conversation. Requests are routed deterministically after that. The interface reports a low-confidence result as a guess and never launches a file on a weak match."),
  h3("5.1.2 Semantic Search Engine"),
  para("A query is embedded and compared with every chunk. Results are grouped by file. A file is kept if it lies within a margin of the best hit and above a floor, and a small boost is added where the query's words appear in the file's text or name. This replaced a fixed cut-off, which had returned nothing for short queries such as “meeting”."),
  h3("5.1.3 AI File Organiser"),
  para("For each file the model proposes a summary, tags, a category and the reason for the category. The user applies or refuses each proposal. Applying moves the file into a folder named after the category and records the original path. Reverting moves it back and removes the folder if it is empty."),
  h3("5.1.4 Knowledge Graph"),
  para("Three kinds of edge are computed: similar content, from the cosine similarity of the centred mean embedding of each file; direct reference, when one file's text names another file; and shared tags, when two files share at least two tags. Each file keeps its three strongest neighbours. Clusters are built by average-linkage merging, which joins two groups only while the average weight between their members stays above a threshold."),
  h3("5.1.5 Context Memory Engine"),
  para("Every turn is stored with the identifiers of the files it showed. A follow-up such as “open the second one” or “open it” resolves to a file by rule. Only when no rule applies, and no confident search matches the request, is the model's own judgement used. This ordering was introduced after a live failure described in Section 7.3."),
  h3("5.1.6 Intelligent Workspace Manager"),
  para("Recommendations come from rules, not from the language model, so they are reproducible and explainable. They include related groups, frequently opened files, possible duplicates, files without a category and stale files. A workspace is a named group whose files open together."),
  h3("5.1.7 Privacy audit"),
  para("The audit reads the live configuration and lists each network endpoint the service uses, whether it is on this computer, what it is used for, and what is stored locally. It says plainly that it checks configuration, not network traffic, and shows how to confirm the listening address with netstat."),
  h2("5.2 Technologies Used"),
  para("The service is written in Python with FastAPI, which provides typed request models and an automatic test client. ChromaDB stores vectors on disk, and SQLite stores everything relational. NumPy performs the pairwise similarity computation as a single matrix product. The desktop shell is Tauri, which hosts a React interface and runs the operating-system file opener under an explicit permission scope. The language model runtime is Ollama, which serves both models over a local HTTP interface."),
  h2("5.3 Code Snippets"),
  para("The following excerpt is the vectorised similarity computation. One matrix product gives every pairwise cosine similarity, and the strongest neighbours of each file are selected in one pass. The original version compared each pair in a Python loop."),
  ...code(`unit = matrix / norms[:, None]
sims = unit @ unit.T
np.fill_diagonal(sims, -np.inf)
k = min(settings.graph_top_k, len(paths) - 1)
neighbours = np.argpartition(-sims, k - 1, axis=1)[:, :k]`),
  para("The excerpt below is the rule that decides whether a follow-up refers to earlier results. Deterministic evidence is checked first, and the model's flag is only a last resort."),
  ...code(`def _open(query, referenced, weak_referenced=None):
    if referenced:                       # rule-based: ordinal or bare "it"
        return _open_response(search.hit_for_path(referenced))
    hits = search.semantic_search(query, top_k=3)
    best = hits[0] if hits else None
    if not best or best.similarity < settings.search_similarity_threshold:
        if weak_referenced:              # model's guess, last resort only
            return _open_response(search.hit_for_path(weak_referenced))`),
  h2("5.4 Screenshots of Outputs"),
  ...figure("ui-knowledge-graph.png", 430, "Figure 5.1 - Knowledge-graph view with a selected file and its neighbours", SHOTS),
  ...figure("ui-workspaces.png", 430, "Figure 5.2 - Workspace view with a created workspace and suggestions", SHOTS),
];

// ---------------------------------------------------------------- chapter 6
const ch6 = [
  h1("Chapter 6: Testing and Validation"),
  h2("6.1 Testing Types"),
  tableCaption("Table 6.1: Test levels and what each covered"),
  table([2000, 4600, 2426], ["Level", "What was tested", "Where"], [
    ["Unit", "Cosine and centring, cut-off and boost, reference detection, cluster merging, ordinals, memory rules", "tests/test_*.py"],
    ["Integration", "Indexing to search, organise and revert across the database and vector store; intent routing with the memory", "tests/test_nl_interface.py, test_indexer.py"],
    ["API", "Every HTTP route through the FastAPI test client, including error codes", "tests/test_api.py"],
    ["Equivalence", "The vectorised similarity against the original pairwise loop on random data", "tests/test_knowledge_graph.py"],
    ["System", "Live runs against the real model runtime and vault; desktop shell driven over the WebView2 debug protocol", "Sections 6.2 and 7.1"],
  ]),
  h2("6.2 Test Cases and Results"),
  para("The automated suite runs offline: model calls are replaced by fixtures that return fixed vectors, so the suite needs no model runtime and runs in well under a minute. It runs on every push in continuous integration. The table shows selected cases; each one was also run against the live models."),
  tableCaption("Table 6.2: Selected test cases and results"),
  table([3200, 3426, 2400], ["Test case", "Expected", "Result"], [
    ["Find a file by meaning, not name", "Relevant file ranked first", "Passed; “invoice from the hosting vendor” returns the vendor invoice"],
    ["Short query with a weak but correct best hit", "Returned, labelled as low confidence", "Passed"],
    ["Open a weak match", "Not launched; candidates shown", "Passed"],
    ["Open “the second one” after a search", "Second result opened", "Passed"],
    ["Follow-up on a new topic after an old one", "New topic wins over stale context", "Passed after fix (Section 7.3)"],
    ["Apply then revert an organisation", "File returns to original place; empty folder removed", "Passed"],
    ["Relationships survive a file move", "Edges still attached to the moved file", "Passed"],
    ["Vectorised similarity equals original loop", "Identical edges on random data", "Passed"],
    ["Remote model endpoint reported", "Marked as leaving the machine", "Passed"],
    ["Workspace create then open all", "Every file opened", "Passed in the desktop shell"],
  ]),
];

// ---------------------------------------------------------------- chapter 7
const ch7 = [
  h1("Chapter 7: Results and Discussion"),
  h2("7.1 Performance Evaluation"),
  para("Scale was measured on synthetic collections of 500, 2,000 and 5,000 files. The collections were generated across twelve topics, such as invoices, recipes and research notes, and about half of the documents include one sentence from an unrelated topic, so that the collection is not trivially separable. Each run used a fresh database and measured the real pipeline with the real models: embedding through Ollama, storage in ChromaDB and SQLite, graph construction, and 36 search queries with their latency. The benchmark script is part of the repository (backend/scripts/bench_scale.py) so that the measurements can be reproduced."),
  tableCaption("Table 7.1: Scale benchmark - indexing and knowledge-graph build (after the fixes)"),
  table([1500, 1900, 1900, 1900, 1926], ["Files", "Index time (s)", "Index rate (files/s)", "Graph rebuild (s)", "Graph links"], [
    ["500", r1(b5.index_seconds), r1(b5.index_files_per_second), r1(b5.graph_rebuild_seconds), String(b5.graph_edges)],
    ["2,000", r1(b2.index_seconds), r1(b2.index_files_per_second), r1(b2.graph_rebuild_seconds), String(b2.graph_edges)],
    ["5,000", r1(b5k.index_seconds), r1(b5k.index_files_per_second), r1(b5k.graph_rebuild_seconds), String(b5k.graph_edges)],
  ]),
  para("Index time includes the knowledge-graph rebuild, which runs after each indexing pass that changed something. Before the vectorisation the same measurement at 2,000 files was " + r1(f2.index_seconds) + " seconds for indexing, including a graph rebuild of " + r1(f2.graph_rebuild_seconds) + " seconds. The 5,000-file graph rebuild of " + r1(b5k.graph_rebuild_seconds) + " seconds shows that the pairwise reference check and the clustering step still grow faster than linearly; the report treats this as a limitation rather than a solved problem."),
  tableCaption("Table 7.2: Search latency and retrieval quality"),
  table([1500, 2100, 2100, 1700, 1626], ["Files", "p50 latency (ms)", "p95 latency (ms)", "Precision@5", "Queries with no result"], [
    ["500", r1(b5.search_p50_ms), r1(b5.search_p95_ms), b5.precision_at_5.toFixed(2), String(b5.precision_queries_with_no_result)],
    ["2,000", r1(b2.search_p50_ms), r1(b2.search_p95_ms), b2.precision_at_5.toFixed(2), String(b2.precision_queries_with_no_result)],
    ["5,000", r1(b5k.search_p50_ms), r1(b5k.search_p95_ms), b5k.precision_at_5.toFixed(2), String(b5k.precision_queries_with_no_result)],
  ]),
  para("Precision@5 is the share of the five best results that come from the topic the query describes. On this synthetic data it stays at the maximum, so it shows that the topics separate, but it does not measure retrieval on real documents. A harder evaluation on real files is listed as future work."),
  h2("7.2 Comparison with Existing Systems"),
  para("Table 7.3 compares the design with the systems reviewed in Chapter 2. The comparison is qualitative: the other systems were not run in this evaluation, so no numerical comparison is claimed."),
  tableCaption("Table 7.3: Qualitative comparison with existing systems"),
  table([2300, 2300, 2300, 2126], ["Capability", "Windows Search / Spotlight", "LSFS", "DreamOS"], [
    ["Matches by meaning", "No", "Yes", "Yes"],
    ["Single conversational interface for a person", "Search box only", "No (agent API)", "Yes"],
    ["Acts on results (open, organise, reverse)", "Open only", "Yes, for agents", "Yes, with confirmation"],
    ["Runs entirely on local models", "Not applicable", "Not shown", "Yes; checked by audit"],
    ["Verifiable privacy report", "No", "No", "Yes (configuration level)"],
  ]),
  h2("7.3 Observations"),
  tableCaption("Table 7.4: Effect of the defect fixes on the measured pipeline"),
  table([3000, 2000, 2000, 2026], ["Measure", "Before fix", "After fix", "Change"], [
    ["Embedding call latency on the test machine", "about 1,000 ms (name resolution)", "about 15 ms", "about 65 times faster"],
    ["Indexing, 100-file test (files/s)", "0.41", "19.6", "about 48 times faster"],
    ["Indexing, 500 files (files/s, includes graph)", r1(f5.index_files_per_second), r1(b5.index_files_per_second), "about " + r1(b5.index_files_per_second / f5.index_files_per_second) + " times faster"],
    ["Graph rebuild at 2,000 files (s)", r1(f2.graph_rebuild_seconds), r1(b2.graph_rebuild_seconds), "about " + Math.round(f2.graph_rebuild_seconds / b2.graph_rebuild_seconds) + " times faster"],
    ["Graph rebuild at 5,000 files (s)", "not measured (projected to be hours)", r1(b5k.graph_rebuild_seconds), "now measurable; still the main limit"],
  ]),
  para("Three findings from the work matter beyond the code itself. First, a delay of about one second on every model call was caused by the way the machine resolved the name localhost, which tries an IPv6 address first. The fix was to use the IPv4 loopback address directly. Without measurement this would have been blamed on the model. Second, the graph computation was quadratic in the number of files: at 2,000 files it took about fourteen times as long as at 500 files for four times the files, and it would have been unusable at the scale required. Vectorisation, with an equivalence test against the original loop, resolved it. Third, a live rehearsal exposed a failure that the automated tests had not covered: a follow-up question about a new topic was answered with an old result, because the model judged the sentence to refer back to the conversation. The fix gives direct evidence precedence over the model's judgement, and a regression test was written that fails on the old behaviour."),
  para("Retrieval on short queries remains the weakest part. A one-word query can rank a file that merely contains the word above the file the user meant. The system reports such results with a confidence label instead of acting on them, which keeps the user in control."),
];

// ---------------------------------------------------------------- chapter 8
const ch8 = [
  h1("Chapter 8: Conclusion and Future Scope"),
  h2("8.1 Summary of Work"),
  para("DreamOS was built as a local, meaning-based file manager with six modules, a desktop interface and a privacy audit. It indexes a folder with local embeddings, answers natural-language requests, opens files only on confident matches, organises files reversibly, relates files through a knowledge graph, remembers conversation so that follow-ups work, and recommends workspaces. It was measured on collections of up to 5,000 files, and the measurements led to two defect fixes and one behavioural fix, each covered by a test."),
  h2("8.2 Limitations"),
  bullet("The scale evaluation uses synthetic documents. Retrieval quality on real personal files has not been measured."),
  bullet("Short, generic queries can rank a file that contains the word above the intended file."),
  bullet("The 3-billion-parameter model misclassifies some borderline wording, for example routing “which files should I archive” to organise rather than workspace."),
  bullet("The graph rebuild still grows faster than linearly: 143 seconds at 5,000 files. Very large collections would need an approximate nearest-neighbour index and a cheaper reference check."),
  bullet("The privacy audit checks configuration; it does not capture network traffic. The report describes the netstat check that does."),
  bullet("The system runs on Windows only and handles text, Markdown, source, PDF and Word files."),
  h2("8.3 Future Enhancement"),
  bullet("Evaluate retrieval on a labelled set of real documents, with the participants' consent and without storing their content."),
  bullet("Replace the pairwise graph with an approximate nearest-neighbour index for collections above 10,000 files."),
  bullet("Test the embedding task prefixes end to end, now that a labelled evaluation exists to judge them."),
  bullet("Add an image and scanned-document pipeline with local optical character recognition."),
  bullet("Package the model runtime with the installer so that first use does not require a separate download."),
];

// ---------------------------------------------------------------- references
const refs = [
  h1("References"),
  para("[1] Z. Shi et al., “From Commands to Prompts: LLM-based Semantic File System for AIOS,” in Proc. ICLR 2025, arXiv:2410.11843.", { align: AlignmentType.LEFT }),
  para("[2] T. Mikolov, K. Chen, G. Corrado and J. Dean, “Efficient Estimation of Word Representations in Vector Space,” arXiv:1301.3781, 2013.", { align: AlignmentType.LEFT }),
  para("[3] N. Reimers and I. Gurevych, “Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks,” in Proc. EMNLP-IJCNLP, 2019.", { align: AlignmentType.LEFT }),
  para("[4] Chroma, “Chroma: the open-source embedding database,” github.com/chroma-core/chroma.", { align: AlignmentType.LEFT }),
  para("[5] Microsoft, “Windows Search overview,” Microsoft Learn documentation.", { align: AlignmentType.LEFT }),
  para("[6] Apple Inc., “Spotlight User Guide,” support.apple.com.", { align: AlignmentType.LEFT }),
  para("[7] voidtools, “Everything - locate files and folders by name instantly,” voidtools.com.", { align: AlignmentType.LEFT }),
  para("[8] Ollama, “Ollama: run large language models locally,” ollama.com.", { align: AlignmentType.LEFT }),
];

const appendices = [
  h1("Appendices"),
  h2("Appendix A: Source code"),
  para("The complete source code is in the private repository github.com/zaidwhy/dreamos-college-project, which is available to the examiners on request. The main files are backend/app (service), frontend/src (interface), backend/tests (automated tests) and backend/scripts/bench_scale.py (scale benchmark)."),
  h2("Appendix B: Scale benchmark raw results"),
  tableCaption("Table B.1: Raw benchmark output at 500, 2,000 and 5,000 files"),
  table([3000, 2000, 2000, 2026], ["Measure", "500 files", "2,000 files", "5,000 files"], [
    ["Files indexed", String(b5.indexed), String(b2.indexed), String(b5k.indexed)],
    ["Index time (s)", r1(b5.index_seconds), r1(b2.index_seconds), r1(b5k.index_seconds)],
    ["Graph rebuild (s)", r1(b5.graph_rebuild_seconds), r1(b2.graph_rebuild_seconds), r1(b5k.graph_rebuild_seconds)],
    ["Graph links", String(b5.graph_edges), String(b2.graph_edges), String(b5k.graph_edges)],
    ["Search p50 / p95 (ms)", `${r1(b5.search_p50_ms)} / ${r1(b5.search_p95_ms)}`, `${r1(b2.search_p50_ms)} / ${r1(b2.search_p95_ms)}`, `${r1(b5k.search_p50_ms)} / ${r1(b5k.search_p95_ms)}`],
  ]),
  h2("Appendix C: Papers and certificates"),
  para("No research paper has been accepted or presented as part of this project at the time of writing. Acceptance letters and presentation certificates, if any are issued, will be attached here."),
];

// ---------------------------------------------------------------- document
const footer = (fmt) => new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
  new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 }),
] })] });

const sectionProps = (fmt, start) => ({
  page: { size: A4, margin: MARGINS, pageNumbers: { start, formatType: fmt } },
});

const doc = new Document({
  creator: "Zaid Ali Syed, Om Vyas, Krushna Kadam",
  title: "DreamOS - Final Year Project Report",
  styles: {
    default: { document: { run: { font: FONT, size: BODY } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: HEAD, bold: true }, paragraph: { keepNext: true, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: HEAD, bold: true }, paragraph: { keepNext: true, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: HEAD }, paragraph: { keepNext: true, outlineLevel: 2 } },
    ],
  },
  numbering: { config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
  sections: [
    { properties: { page: { size: A4, margin: MARGINS } }, children: [...cover] },
    { properties: sectionProps(NumberFormat.LOWER_ROMAN, 1), footers: { default: footer() }, children: [
      ...certificate, pageBreak(),
      ...acknowledgement, pageBreak(),
      ...contents, pageBreak(),
      ...abstract, pageBreak(),
      ...abbreviations, pageBreak(),
      ...listOfFigures, pageBreak(),
    ] },
    { properties: sectionProps(NumberFormat.DECIMAL, 1), headers: { default: new Header({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }], children: [new TextRun({ text: "DreamOS - Final Year Project Report", font: FONT, size: 18, italics: true }), new TextRun({ text: "\tIICT, MGM University 2026-2027", font: FONT, size: 18, italics: true })] })] }) }, footers: { default: footer() }, children: [
      ...ch1, pageBreak(), ...ch2, pageBreak(), ...ch3, pageBreak(), ...ch4, pageBreak(),
      ...ch5, pageBreak(), ...ch6, pageBreak(), ...ch7, pageBreak(), ...ch8, pageBreak(),
      ...refs, pageBreak(), ...appendices,
    ] },
  ],
});

const out = path.join(__dirname, "DreamOS-Final-Year-Project-Report.docx");
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(out, buf); console.log("wrote", out, buf.length, "bytes"); });
