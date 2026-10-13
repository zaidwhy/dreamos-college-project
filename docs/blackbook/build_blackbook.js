// Builds docs/blackbook/DreamOS-Final-Year-Project-Report.docx in the MGM IICT format
// (Project Report Index 2026-2027): Times New Roman, 12 pt body at 1.5 spacing.
// Format rules applied (faculty feedback, 2026-10-10): chapter headings centred, upper case,
// 14 pt bold, no "Chapter N:" tag; sub-headings 12 pt bold; descriptions 12 pt; every chapter on
// its own page; table headings centred; every table and figure listed with its page number and
// referred to by page in the text; every diagram followed by a description.
//
// Page numbers come from pages.json, written by make_pages.py from the exported PDF, so run:
//   NODE_PATH="$(npm root -g)" node docs/blackbook/build_blackbook.js
//   (export to PDF in Word, then)  py -3.14 docs/blackbook/make_pages.py
//   rebuild until pages.json stops changing (two passes in practice).
// Benchmark numbers are read from docs/benchmarks/, so report and measurements cannot drift.
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
const FIGS = path.join(REPO, "docs", "paper", "figs");
const BENCH = JSON.parse(fs.readFileSync(path.join(REPO, "docs", "benchmarks", "scale_results.json"), "utf8"));
const BEFORE = JSON.parse(fs.readFileSync(path.join(REPO, "docs", "benchmarks", "scale_results_before.json"), "utf8"));
const RETR = JSON.parse(fs.readFileSync(path.join(REPO, "docs", "benchmarks", "retrieval_comparison.json"), "utf8"));
const PAGES_FILE = path.join(__dirname, "pages.json");
const PAGES = fs.existsSync(PAGES_FILE) ? JSON.parse(fs.readFileSync(PAGES_FILE, "utf8")) : {};
const LOGO = fs.readFileSync(path.join(REPO, "docs", "assets", "mgm-logo.png"));

const FONT = "Times New Roman";
const BODY = 24; // half-points: 12 pt, used for body, tables, captions and descriptions
const HEAD = 28; // 14 pt, chapter headings only
const LINE_15 = { line: 360, lineRule: "auto" };
const A4 = { width: 11906, height: 16838 };
const MARGINS = { top: 1440, right: 1440, bottom: 1440, left: 1440 };

// ---------------------------------------------------------------- registry (lists of tables / figures)
const REG = { tables: [], figures: [] };
const pageOf = (label) => (PAGES[label] !== undefined ? String(PAGES[label]) : "--");
const tref = (label) => `${label} (page ${pageOf(label)})`;

// ---------------------------------------------------------------- helpers
const run = (text, opts = {}) => new TextRun({ text, font: FONT, size: BODY, ...opts });

function para(text, opts = {}) {
  const { align = AlignmentType.JUSTIFIED, after = 160, bold = false, italics = false, size, keepNext = false } = opts;
  return new Paragraph({
    alignment: align, keepNext,
    spacing: { ...LINE_15, after },
    children: [new TextRun({ text, font: FONT, size: size || BODY, bold, italics })],
  });
}

// Chapter heading: centred, upper case, 14 pt bold. "Chapter N:" tags are stripped.
const h1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { before: 240, after: 280 },
  children: [new TextRun({ text: text.replace(/^Chapter \d+:\s*/, "").toUpperCase(), font: FONT, size: HEAD, bold: true })],
});
const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 },
  children: [new TextRun({ text: text.replace(/^(Appendix [A-Z]): /, "$1 "), font: FONT, size: BODY, bold: true })],
});
const h3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 },
  children: [new TextRun({ text, font: FONT, size: BODY, bold: true })],
});

function bullet(text) {
  return new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { ...LINE_15, after: 80 }, children: [run(text)] });
}

function code(text) {
  return text.split("\n").map((line) => new Paragraph({
    spacing: { line: 240, after: 0 },
    shading: { type: ShadingType.CLEAR, fill: "F2F2F2" },
    children: [new TextRun({ text: line || " ", font: "Courier New", size: 20 })],
  }));
}

const caption = (text) => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { before: 60, after: 160 },
  children: [new TextRun({ text, font: FONT, size: BODY, italics: true })],
});

// A figure: image, centred caption, then a description paragraph. The label ("Figure 4.1") is
// recorded for the List of Figures.
function figure(file, width, label, title, description, dir = DIAG) {
  REG.figures.push({ label, title });
  const data = fs.readFileSync(path.join(dir, file));
  const height = Math.round(width * (data.readUInt32BE(20) / data.readUInt32BE(16)));
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 160, after: 60 },
      children: [new ImageRun({ type: "png", data, transformation: { width, height }, altText: { title: `${label} ${title}`, description: title, name: file } })] }),
    caption(`${label} - ${title}`),
    para(description, { after: 200 }),
  ];
}

const border = { style: BorderStyle.SINGLE, size: 4, color: "808080" };
const borders = { top: border, bottom: border, left: border, right: border };

function table(widths, header, rows, opts = {}) {
  const { leftCols = [] } = opts;
  const total = widths.reduce((a, b) => a + b, 0);
  const cell = (text, w, isHead, ci) => new TableCell({
    borders, width: { size: w, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    shading: isHead ? { fill: "D9D9D9", type: ShadingType.CLEAR } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: isHead ? AlignmentType.CENTER : (leftCols.includes(ci) ? AlignmentType.LEFT : AlignmentType.LEFT),
      spacing: { line: 276, after: 0 },
      children: [new TextRun({ text: String(text), font: FONT, size: BODY, bold: isHead })],
    })],
  });
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: header.map((t, i) => cell(t, widths[i], true, i)) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((t, i) => cell(t, widths[i], false, i)) })),
    ],
  });
}

// Table caption, centred and bold; "Table 2.1: x" is written "Table 2.1 - x" (no colon).
function tableCaption(label, title) {
  REG.tables.push({ label, title });
  return new Paragraph({ keepNext: true, alignment: AlignmentType.CENTER, spacing: { before: 200, after: 100 },
    children: [new TextRun({ text: `${label} - ${title}`, font: FONT, size: BODY, bold: true })] });
}
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });
const spacer = (after = 120) => new Paragraph({ spacing: { after }, children: [] });

// ---------------------------------------------------------------- numbers
const b5 = BENCH["500"], b2 = BENCH["2000"], b5k = BENCH["5000"];
const f5 = BEFORE["500"], f2 = BEFORE["2000"];
// Intermediate stage: similarity vectorised, reference check and clustering still all-pairs.
const MID = JSON.parse(fs.readFileSync(path.join(REPO, "docs", "benchmarks", "scale_results_vectorised_only.json"), "utf8"));
const m5 = MID["500"], m2 = MID["2000"], m5k = MID["5000"];
const r1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const d2 = (x) => x.toFixed(2);
const ALL = RETR.all, SH = RETR.sharing_words, NS = RETR.no_shared_words;
const pct = (x) => `${Math.round(x * 100)}%`;

// ---------------------------------------------------------------- front matter
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: none, bottom: none, left: none, right: none };
const coverRow = (children, span = 4) => new TableRow({ children: [new TableCell({
  borders: noBorders, columnSpan: span, width: { size: 9026, type: WidthType.DXA }, children })] });
const cp = (text, o = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: o.before || 0, after: o.after === undefined ? 120 : o.after },
  children: [new TextRun({ text, font: FONT, size: o.size || BODY, bold: o.bold !== false })] });
const nameRow = (name, no, bold = false) => new TableRow({ children: [
  new TableCell({ borders: noBorders, width: { size: 1500, type: WidthType.DXA }, children: [new Paragraph({ children: [] })] }),
  new TableCell({ borders: noBorders, width: { size: 3700, type: WidthType.DXA }, margins: { top: 40, bottom: 40 },
    children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: name, font: FONT, size: BODY, bold })] })] }),
  new TableCell({ borders: noBorders, width: { size: 2300, type: WidthType.DXA }, margins: { top: 40, bottom: 40 },
    children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: no, font: FONT, size: BODY, bold })] })] }),
  new TableCell({ borders: noBorders, width: { size: 1526, type: WidthType.DXA }, children: [new Paragraph({ children: [] })] }),
] });

const cover = [
  new Table({
    width: { size: 9026, type: WidthType.DXA }, columnWidths: [1500, 3700, 2300, 1526],
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: [
      coverRow([new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
        children: [new ImageRun({ type: "png", data: LOGO, transformation: { width: 260, height: Math.round(260 * 1093 / 1913) }, altText: { title: "MGM University logo", description: "MGM University logo", name: "mgm-logo.png" } })] })]),
      coverRow([cp("A", { after: 0 }), cp("B. Tech (Information Technology)", { size: 28, after: 240 })]),
      coverRow([cp("PROJECT REPORT ON", { size: 28, after: 240 })]),
      coverRow([cp("“DreamOS: An AI-Native Semantic File Management System with Knowledge Graph, Context Memory and Intelligent Workspace Management”", { size: 28, after: 360 })]),
      coverRow([cp("Submitted by", { after: 160 })]),
      nameRow("Name of student", "University Exam No", true),
      nameRow("Zaid Ali Syed", "2305139"),
      nameRow("Om Vyas", "2305170"),
      nameRow("Krushna Kadam", "2305165"),
      coverRow([cp("Under Guidance of", { before: 280, after: 120 }), cp("Dr. Minakshi R. Rajput", { after: 360 })]),
      coverRow([cp("Institute of Information and Communication Technology (IICT)", { after: 40 }),
        cp("MGM University, Chh. Sambhajinagar", { after: 40 }), cp("Academic Year 2026-2027", { after: 0 })]),
    ],
  }),
];

const certificate = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new ImageRun({ type: "png", data: LOGO, transformation: { width: 150, height: Math.round(150 * 1093 / 1913) }, altText: { title: "MGM University logo", description: "MGM University logo", name: "mgm-logo.png" } })] }),
  para("Institute of Information and Communication Technology", { align: AlignmentType.CENTER, after: 0, bold: true }),
  para("MGM University, Chh. Sambhajinagar", { align: AlignmentType.CENTER, after: 400, bold: true }),
  para("CERTIFICATE", { align: AlignmentType.CENTER, after: 400, bold: true, size: 28 }),
  para("This is to certify that Zaid Ali Syed (Roll No. 2305139), Om Vyas (Roll No. 2305170) and Krushna Kadam (Roll No. 2305165) of B.Tech (IT), have successfully completed project work on “DreamOS: An AI-Native Semantic File Management System” under the guidance of Dr. Minakshi R. Rajput, and submitted the same during the academic year 2026-2027 towards the partial fulfillment of the degree of B.Tech (IT) from Institute of Information and Communication Technology, MGM University, Chh. Sambhajinagar.", { after: 600 }),
  new Table({
    width: { size: 9026, type: WidthType.DXA }, columnWidths: [4513, 4513],
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: [
      new TableRow({ children: [
        new TableCell({ borders: noBorders, width: { size: 4513, type: WidthType.DXA }, children: [para("Dr. Minakshi R. Rajput", { align: AlignmentType.LEFT, after: 0, bold: true }), para("Guide", { align: AlignmentType.LEFT, after: 0, bold: true })] }),
        new TableCell({ borders: noBorders, width: { size: 4513, type: WidthType.DXA }, children: [para("Dr. S. C. Tamane", { align: AlignmentType.RIGHT, after: 0, bold: true }), para("Director, IICT", { align: AlignmentType.RIGHT, after: 0, bold: true })] }),
      ] }),
    ],
  }),
  para("Date: ____________________", { align: AlignmentType.LEFT, after: 0, keepNext: false }),
];

const sigCell = (name, roll) => new TableCell({ borders: noBorders, width: { size: 3008, type: WidthType.DXA },
  margins: { top: 600, bottom: 0, left: 60, right: 60 },
  children: [
    para("____________________", { align: AlignmentType.CENTER, after: 0 }),
    para(name, { align: AlignmentType.CENTER, after: 0, bold: true }),
    para(`Roll No. ${roll}`, { align: AlignmentType.CENTER, after: 0 }),
  ] });

const acknowledgement = [
  h1("Acknowledgement"),
  para("We take this opportunity to express our sincere gratitude to everyone who supported us in completing this project, DreamOS: An AI-Native Semantic File Management System."),
  para("We thank our project guide, Dr. Minakshi R. Rajput, for guidance, timely reviews and encouragement throughout the work. The reviews at each Project Monitoring checkpoint pushed us to test our claims, to report what the measurements did not show, and to keep the explanation of the system simple enough for any examiner to follow."),
  para("We thank Dr. S. C. Tamane, Director, IICT, and the faculty of the Institute of Information and Communication Technology, MGM University, for the academic environment, the laboratory facilities and the Project Monitoring structure in which this work was planned, reviewed and refined. We also thank the Research Methodology faculty for the requirement to prepare a research paper, which led us to design a controlled retrieval comparison and to record the defects we found along the way."),
  para("We are grateful to the open-source communities behind Ollama, ChromaDB, FastAPI, Tauri, React, NumPy and pytest, on whose work DreamOS is built, and to the researchers whose papers on semantic file systems and dense retrieval gave the project its direction."),
  para("Finally, we thank our families and friends for their patience and support during the long build, and each other for the shared work of design, implementation, testing and writing that this report records.", { after: 240 }),
  new Table({
    width: { size: 9026, type: WidthType.DXA }, columnWidths: [3008, 3010, 3008],
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: [new TableRow({ children: [sigCell("Zaid Ali Syed", "2305139"), sigCell("Om Vyas", "2305170"), sigCell("Krushna Kadam", "2305165")] })],
  }),
];

// ---------------------------------------------------------------- abstract, abbreviations
const abstract = [
  h1("Abstract"),
  para("Personal computers hold thousands of files whose names were chosen once and rarely describe what the file is about now. Finding a file means remembering how it was named. DreamOS is an AI-native desktop file manager that lets a user describe a file in plain language, and it finds, opens, relates and organises files by meaning rather than by name. All processing runs on the user's computer: embeddings and language understanding come from a local model runtime, and the index is stored in local databases, so no file content or question is sent to a server."),
  para("The system has six modules: a natural-language interface that classifies intent, a semantic search engine, an AI file organiser with reversible moves, a knowledge graph of relationships between files, a context memory engine that resolves follow-up questions, and an intelligent workspace manager that recommends and creates groups of related files. A privacy audit reports every network destination the software uses, so the claim that data stays local can be checked rather than trusted."),
  para(`Two evaluations were run. In a controlled retrieval comparison on ${RETR.queries} labelled queries, DreamOS placed the intended file first for ${pct(ALL.dreamos.hit_at_1)} of queries, against ${pct(ALL.keyword.hit_at_1)} for a BM25 content index and ${pct(ALL.filename.hit_at_1)} for filename matching; on the ${RETR.queries_no_shared_words} queries that share no word with their target, both lexical baselines scored 0.00 and DreamOS scored ${d2(NS.dreamos.hit_at_1)}. In a scale evaluation on synthetic vaults of 500, 2,000 and 5,000 files, indexing ran at ${r1(b5.index_files_per_second)} files per second at 500 files, search answered in a median of ${r1(b5.search_p50_ms)} ms, and the knowledge graph rebuilt in ${r1(b5k.graph_rebuild_seconds)} seconds at 5,000 files; the original method took ${r1(f2.graph_rebuild_seconds)} seconds at only 2,000 files, and an intermediate version ${r1(m5k.graph_rebuild_seconds)} seconds at 5,000. Defects found during measurement, a name-resolution delay on the test machine and three all-pairs computations in graph construction, were fixed and re-measured. The report states what the measurements do and do not show, including the small size of the labelled set and the synthetic nature of the scale data.`),
  para("Keywords: semantic search, sentence embeddings, knowledge graph, local large language models, personal information management, privacy by design."),
];

const abbreviations = [
  h1("Abbreviations"),
  table([2200, 6826], ["Abbreviation", "Expansion"], [
    ["API", "Application Programming Interface"],
    ["BM25", "Best Matching 25 (lexical ranking function)"],
    ["CSS / HTML", "Cascading Style Sheets / HyperText Markup Language"],
    ["DFD", "Data Flow Diagram"],
    ["ER", "Entity-Relationship"],
    ["HNSW", "Hierarchical Navigable Small World (approximate nearest-neighbour index)"],
    ["IICT", "Institute of Information and Communication Technology"],
    ["LLM", "Large Language Model"],
    ["MFT", "Master File Table (NTFS file index)"],
    ["MRR", "Mean Reciprocal Rank"],
    ["NLI", "Natural Language Interface"],
    ["SQLite", "Structured Query Language database engine (file-based)"],
    ["UI / UX", "User Interface / User Experience"],
    ["UML", "Unified Modeling Language"],
  ]),
];

// Lists are built after the body so that every registered caption appears, with its page number.
const listRows = (items) => items.map((it) => [it.label.replace(/^(Table|Figure) /, ""), it.title, pageOf(it.label)]);
const listWidths = [1400, 6226, 1400];
const makeListOfFigures = () => [h1("List of Figures"),
  table(listWidths, ["Figure", "Title", "Page"], listRows(REG.figures))];
const makeListOfTables = () => [h1("List of Tables"),
  table(listWidths, ["Table", "Title", "Page"], listRows(REG.tables))];

// ---------------------------------------------------------------- TOC
const contents = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240, after: 280 },
    children: [new TextRun({ text: "CONTENTS", font: FONT, size: HEAD, bold: true })] }),
  new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-3" }),
];

// ---------------------------------------------------------------- chapter 1
const ch1 = [
  h1("Introduction"),
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
  bullet("Measure the system against lexical baselines and at a scale beyond the demonstration vault, and report the results including the defects found."),
  h2("1.4 Scope of the Project"),
  para("The project covers a single-user desktop application for Windows, indexing a folder of text, Markdown, source code, PDF and Word documents. It includes the six modules described in the System Design chapter, a privacy audit, a controlled retrieval comparison and a scale evaluation on synthetic collections. It does not cover mobile devices, multi-user access, synchronisation across machines, cloud models, or indexing of images and audio. The demonstration uses a sandboxed vault of 37 generated files so that no real personal data is handled during evaluation."),
];

// ---------------------------------------------------------------- chapter 2
const ch2 = [
  h1("Literature Review"),
  h2("2.1 Review of Existing Systems and Related Work"),
  para("Two lines of research bear on this project: dense text embeddings, which place text in a vector space where distance reflects meaning, and semantic or AI-native file systems, which use such embeddings to organise files. Mikolov et al. showed that words can be embedded so that geometric distance tracks relatedness [2]. Reimers and Gurevych extended the idea to sentences and paragraphs with Sentence-BERT, which makes comparing whole documents efficient [3]. DreamOS uses nomic-embed-text, a model in this family, served locally through Ollama, with the Chroma vector database for nearest-neighbour search [4]."),
  para("The closest system is LSFS, a semantic file system for an LLM operating-system agent presented at ICLR 2025 [1]. LSFS shows that embedding indexes plus a language-model front end can replace command-based file operations. It is designed for software agents that call an API, not for a person typing requests, and its evaluation does not establish that it runs entirely on local models. DreamOS takes the same architectural idea and exposes it to a human through one conversational surface that both finds and acts on files."),
  para("Mainstream desktop search is still driven by names and metadata. Windows Search indexes filenames, metadata and text but matches a query only where it shares vocabulary with the file [5]. Spotlight adds metadata and heuristics over a similar keyword index [6]. Everything indexes the NTFS master file table for instant filename lookup and does not read content [7]."),
  para(`${tref("Table 2.1")} compares the systems on their retrieval basis, whether content is indexed, the interface they offer, and whether they work locally.`, { keepNext: true }),
  tableCaption("Table 2.1", "Comparison with existing systems"),
  table([1500, 1650, 1150, 1500, 1250, 1976], ["System", "Retrieval basis", "Content indexed", "Interface", "Local operation", "Limitation relative to DreamOS"], [
    ["Windows Search", "Keyword and metadata index", "Yes", "Search box", "Yes, local index", "No meaning-based matching; cannot act on a result from one query"],
    ["macOS Spotlight", "Keyword, metadata, ranking heuristics", "Yes", "Search bar", "Yes, local index", "Not embedding-based; not conversational"],
    ["Everything", "NTFS file-name index (MFT)", "No, names only", "Search box", "Yes, local index", "Names only; no content understanding"],
    ["LSFS (ICLR 2025)", "LLM plus embedding index", "Yes", "Agent API", "Not demonstrated", "Built for agents via API; local operation not shown"],
    ["DreamOS", "Local embeddings plus local intent routing", "Yes", "One conversational interface", "Yes, audited", "Single-user desktop only; small-model limits on short queries"],
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
  h1("System Analysis"),
  h2("3.1 Requirement Analysis"),
  para("Requirements were derived from the problem statement and refined at each Project Monitoring review. Each requirement below has an identifier, a description of what it means in practice, and its status at submission. Functional requirements say what the system does; non-functional requirements say how well it must do it and how that is checked."),
  h3("3.1.1 Functional requirements"),
  para(`${tref("Table 3.1")} lists the twelve functional requirements with a description of each.`, { keepNext: true }),
  tableCaption("Table 3.1", "Functional requirements"),
  table([800, 2300, 4326, 1600], ["ID", "Requirement", "Description", "Status"], [
    ["FR1", "Accept one natural-language message through a chat interface", "The user types a request in an ordinary sentence in one input box; no query syntax or file path is needed.", "Implemented"],
    ["FR2", "Classify intent as search, open, related, workspace, organise or other", "A local language model decides what the user wants so that the request reaches the right module instead of always searching.", "Implemented"],
    ["FR3", "Semantic search returning ranked files with score and snippet", "Files are ranked by meaning, each result shows a similarity score and a text snippet so that the match can be judged.", "Implemented"],
    ["FR4", "Open the best match in its default application only when confident", "A file is launched only above the confidence bar; otherwise candidates are shown, so a wrong file is never opened silently.", "Implemented"],
    ["FR5", "Generate a summary, tags and category for each file", "The model describes each file in one sentence and assigns tags and a category with the reason for it.", "Implemented"],
    ["FR6", "Apply and reverse an organisation move", "A file is moved into its category folder only on confirmation, and the original path is stored so the move can be undone.", "Implemented"],
    ["FR7", "Preview unorganised files before any change", "The user sees every proposed move before it is applied; nothing changes on disk during the preview.", "Implemented"],
    ["FR8", "Index and re-index incrementally by content hash", "Unchanged files are skipped on later runs, so re-indexing a large folder only costs time for what changed.", "Implemented"],
    ["FR9", "Model relationships between files and show related files", "Files are linked by similar content, direct reference and shared tags, and each link is shown with its reason.", "Implemented"],
    ["FR10", "Resolve follow-up questions against the earlier conversation", "Messages such as “open the second one” or “open it” are resolved using the files shown in earlier turns.", "Implemented"],
    ["FR11", "Recommend and create workspaces from relationships and usage", "Groups of related or frequently opened files are suggested, and a workspace opens all its files together.", "Implemented"],
    ["FR12", "Report where data could leave the machine, from live configuration", "A privacy view lists each network endpoint in use and whether it is on this computer.", "Implemented"],
  ], { leftCols: [0, 1, 2, 3] }),
  h3("3.1.2 Non-functional requirements"),
  para(`${tref("Table 3.2")} lists the non-functional requirements, what each means for this system, and how it was evaluated.`, { keepNext: true }),
  tableCaption("Table 3.2", "Non-functional requirements"),
  table([1500, 2100, 3126, 2300], ["Attribute", "Requirement", "Description", "How it is evaluated"], [
    ["Privacy", "No file content or question leaves the machine", "All models and stores run locally and the service listens on the loopback address only; remote endpoints would be flagged.", "Privacy audit; netstat check; automated test"],
    ["Performance", "Search answers in well under a second", "A user should not wait noticeably for a result once models are loaded.", "Scale benchmark, Section 7.1"],
    ["Scalability", "Graph and indexing remain practical at several thousand files", "Time to index and to rebuild relationships should grow gently with collection size.", "Scale benchmark at 500, 2,000 and 5,000 files"],
    ["Reliability", "Organisation moves are reversible", "No action may lose or overwrite an original file; every move can be undone.", "Automated apply-and-revert test"],
    ["Usability", "One input box; results are cards with actions", "A new user can ask in plain language and act on a result with one click.", "Screenshots, Section 4.5"],
    ["Maintainability", "Each module has its own tests; offline test run", "Changes can be checked quickly without a model runtime.", "123 automated tests, CI on every push"],
  ], { leftCols: [0, 1, 2, 3] }),
  h2("3.2 Feasibility Study"),
  para("Technical feasibility was confirmed early by building the indexing and search path with a local embedding model and measuring it on the demonstration vault. Economic feasibility holds because every component is open source and the models run on an ordinary laptop without a graphics card, so the running cost is zero. Operational feasibility depends on the user accepting that the first request after a cold start is slow while a model loads, which is documented in the demonstration guide. Schedule feasibility was managed by building the three core modules first and then adding the graph, memory and workspace modules as separate, tested increments."),
  h2("3.3 System Specifications"),
  para(`${tref("Table 3.3")} gives the hardware and software used for development and for every measurement in this report.`, { keepNext: true }),
  tableCaption("Table 3.3", "Hardware and software specification"),
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
  h1("System Design"),
  h2("4.1 System Architecture"),
  para("DreamOS is a client-server application on one machine. The desktop client calls a local service over HTTP on 127.0.0.1:8420. The service classifies requests, searches, organises and computes relationships, and calls the local model runtime for language tasks. Two stores hold the data: a relational database for metadata, relationships, conversation and usage, and a vector database for the embeddings of text chunks."),
  ...figure("01_architecture.png", 440, "Figure 4.1", "System architecture: desktop client, local service, local model runtime and storage",
    "Figure 4.1 shows the four zones of the system. The desktop application (top right) holds the React views, a typed fetch client that keeps the session identifier, and the Tauri opener plugin that launches files. The backend service (centre) receives every request at its REST routes and hands chat messages to the Natural Language Interface, which calls the search engine, organiser, workspace manager, knowledge graph or context memory as the intent requires; the indexer is started from its own route. The local AI runtime (left) is called for embeddings and completions. Storage (bottom) holds vectors in ChromaDB, relational data in SQLite and the sandboxed vault files. The dotted line shows that a file is launched by the Tauri opener on the client, not by the service."),
  h2("4.2 Module Design"),
  para("The system is organised in six modules. The Natural Language Interface decides what a request means and routes it. The Semantic Search Engine returns files near the best match. The AI File Organiser proposes categories and reversible moves. The Knowledge Graph links files by similar content, by direct reference and by shared tags. The Context Memory Engine keeps the conversation so that a follow-up can be resolved, and records which files the user opens. The Workspace Manager turns the graph and usage into explainable recommendations and creates workspaces that open together."),
  ...figure("02_module_design.png", 430, "Figure 4.2", "Module design and the data each module passes to the next",
    "Figure 4.2 shows how control and data pass between the six modules. The Natural Language Interface is at the centre of control: it exchanges turns with the Context Memory Engine and dispatches requests to the Semantic Search Engine, the AI File Organizer, the Knowledge Graph and the Intelligent Workspace Manager. Search results and organiser output feed the Knowledge Graph, the Knowledge Graph feeds the Workspace Manager, and the Context Memory Engine supplies usage data to the Workspace Manager as well."),
  h2("4.3 Data Flow Diagrams and UML Diagrams"),
  h3("4.3.1 Data flow diagrams"),
  ...figure("03_dfd_context.png", 400, "Figure 4.3", "Data flow diagram, context level",
    "The context-level diagram treats DreamOS as a single process. The user sends natural-language requests, clicks and workspace actions, and receives search results, related files, workspace suggestions, opened files and organisation summaries. The process exchanges embedding and generation requests with the local Ollama runtime and reads from, and moves files in, the file vault. No other external entity appears, which is the visual form of the claim that the system is self-contained."),
  ...figure("04_dfd_level1.png", 440, "Figure 4.4", "Data flow diagram, level 1",
    "Level 1 splits the system into processes: 0.0 indexes the vault and builds the graph; 1.0 classifies intent with session context; 2.0 runs semantic search; 3.0 organises files; 4.0 routes the response; 5.0 opens a file through the Tauri opener; 6.0 finds related files; 7.0 manages workspaces and recommendations; and 8.0 resolves follow-ups and records usage. Four data stores are shown: the Chroma vector store (D1), SQLite metadata and graph edges (D2), the vault files (D3), and SQLite turns, usage and workspaces (D4)."),
  h3("4.3.2 UML diagrams"),
  ...figure("05_use_case.png", 360, "Figure 4.5", "Use case diagram of user actions",
    "The use case diagram shows what the single actor, the user, can do: search files by meaning; open a file by description (which includes a search); preview unorganised files and apply or revert AI organisation (applying includes the preview); index the vault; ask a follow-up question (which extends opening a file and finding related files); find related files; explore the knowledge graph; create a workspace from a suggestion (which includes exploring the graph); open all files of a workspace; and start a new conversation."),
  ...figure("06_class_diagram.png", 420, "Figure 4.6", "Class diagram of response and settings classes",
    "The class diagram shows the data classes exchanged between modules. NLResponse is the single object returned for every message; it carries the intent, a message and, depending on the intent, search results, organisation suggestions, an open path, related files, recommendations and workspaces. SearchHit, OrganizeSuggestion, RelatedFile and Recommendation are its elements, Turn is how a message is saved, OllamaClient offers embed and generate_json, and Settings holds the thresholds that scoring and the recommendation rules read."),
  ...figure("07_sequence_open.png", 440, "Figure 4.7", "Sequence diagram of an open request",
    "The sequence follows the request “open my resume”. The React interface posts the message to /chat; the interface module asks llama3.2 to classify it at temperature 0, which returns intent open and query resume. Semantic search then asks ChromaDB for the nearest embeddings and returns the best match with its cosine score. The response carries the open path back to the interface, which asks the Tauri opener plugin to launch the file in its default application."),
  ...figure("10_sequence_followup.png", 440, "Figure 4.8", "Sequence diagram of a follow-up question resolved from memory",
    "Two turns are shown. In the first, “find my invoices” is classified as a search, three files are returned and the turn is saved with their identifiers. In the second, “open the second one” is classified with the recent turns as context; the model returns intent open with a refers-to-previous flag, the ordinal rule resolves the second file of the last results from the Context Memory Engine, the open is recorded as a usage event, and the path is returned to the client for launching."),
  h2("4.4 Database Design"),
  para("File metadata is stored in SQLite and each file's text chunks are stored as vectors in ChromaDB, linked by the file path. All relationship, memory, usage and workspace tables refer to the file's numeric identifier rather than its path. The organiser renames a file when it moves it, but the identifier does not change, so no table needs rewriting after a move."),
  ...figure("08_er_diagram.png", 400, "Figure 4.9", "Entity-relationship diagram",
    "The entity-relationship diagram centres on the FILES table, whose integer id is referenced by every other table. VECTOR_ENTRIES holds the chunk vectors, linked to a file through its path. FILE_EDGES links two files by src_id and dst_id with a kind and a weight. USAGE_EVENTS records each open. WORKSPACES and WORKSPACE_FILES give named groups of files, and CONVERSATION_TURNS stores each turn with the identifiers of the files it showed, kept as a JSON list."),
  para(`${tref("Table 4.1")} gives the fields of the central files table.`, { keepNext: true }),
  tableCaption("Table 4.1", "Fields of the files table"),
  table([2600, 1600, 4826], ["Field", "Type", "Purpose"], [
    ["id", "INTEGER", "Stable identifier used by every other table"],
    ["path", "TEXT, unique", "Path relative to the vault; also the vector identifier"],
    ["original_path", "TEXT", "Path at first indexing, kept so a move can be reversed"],
    ["content_hash", "TEXT", "Lets re-indexing skip unchanged files"],
    ["summary, tags, category", "TEXT", "Produced by the organiser"],
    ["organize_reasoning, organized_at", "TEXT", "Explanation and time of the applied organisation"],
  ]),
  para(`${tref("Table 4.2")} lists the tables added for the graph, memory and workspace modules.`, { keepNext: true }),
  tableCaption("Table 4.2", "Tables added for the graph, memory and workspace modules"),
  table([2600, 3200, 3226], ["Table", "Key fields", "Purpose"], [
    ["file_edges", "source, target, kind, weight", "Typed relationships between files"],
    ["conversation_turns", "session, role, message, file identifiers", "Conversation kept across restarts"],
    ["usage_events", "file identifier, kind, time", "Records each open; used for tie-breaking and recommendations"],
    ["workspaces, workspace_files", "name; workspace and file identifiers", "Named groups of files"],
  ]),
  h2("4.5 UI / UX Design"),
  para("The interface has four views: a chat view for requests, a knowledge-graph view, a workspace view and a privacy view. Results appear as cards with the action the user can take, so a file is opened from the card that shows it. Related-file answers show why each file is linked, such as similar content, a direct reference or shared tags."),
  ...figure("ui-chat.png", 430, "Figure 4.10", "Chat view: related files with the reason each is linked",
    "The chat view shows the answer to “what's related to my resume”, with a reason chip on each result card (referenced, similar content), followed by the answer to “suggest some workspaces”, which offers three suggested groups and lists the existing workspace. Every card carries the action available for it, such as Open or Create workspace.", SHOTS),
  h2("4.6 Technology Stack"),
  para(`${tref("Table 4.3")} lists the technology used in each layer.`, { keepNext: true }),
  tableCaption("Table 4.3", "Technology stack by layer"),
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
  h1("Implementation"),
  h2("5.1 Module-wise Description"),
  h3("5.1.1 Natural Language Interface"),
  para("Each message is sent to the local model with a short description of the intents, and the model returns JSON with the intent, the topic to search for, and a flag for whether the message refers back to earlier conversation. Requests are routed deterministically after that. The interface reports a low-confidence result as a guess and never launches a file on a weak match."),
  h3("5.1.2 Semantic Search Engine"),
  para("A query is embedded and compared with every chunk. Results are grouped by file. A file is kept if it lies within a margin of the best hit and above a floor, and a small boost is added where the query's words appear in the file's text or name. This replaced a fixed cut-off, which had returned nothing for short queries such as “meeting”."),
  h3("5.1.3 AI File Organiser"),
  para("For each file the model proposes a summary, tags, a category and the reason for the category. The user applies or refuses each proposal. Applying moves the file into a folder named after the category and records the original path. Reverting moves it back and removes the folder if it is empty."),
  h3("5.1.4 Knowledge Graph"),
  para("Three kinds of edge are computed: similar content, from the cosine similarity of the centred mean embedding of each file; direct reference, when one file's text names another file; and shared tags, when two files share at least two tags. Each file keeps its three strongest neighbours. Clusters are built by average-linkage merging, which joins two groups only while the average weight between their members stays above a threshold. Two steps were made fast enough for thousands of files: the reference check files each file name under its rarest alphanumeric token so that a text is searched only for the names whose token it contains, and the clustering keeps its candidate merges in a heap over per-group adjacency instead of rescanning every link after each merge."),
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
  para("The excerpt below is the rule that decides whether a follow-up refers to earlier results. Deterministic evidence is checked first, and the model's flag is only a last resort.", { }),
  ...code(`def _open(query, referenced, weak_referenced=None):
    if referenced:                       # rule-based: ordinal or bare "it"
        return _open_response(search.hit_for_path(referenced))
    hits = search.semantic_search(query, top_k=3)
    best = hits[0] if hits else None
    if not best or best.similarity < settings.search_similarity_threshold:
        if weak_referenced:              # model's guess, last resort only
            return _open_response(search.hit_for_path(weak_referenced))`),
  h2("5.4 Screenshots of Outputs"),
  ...figure("ui-knowledge-graph.png", 430, "Figure 5.1", "Knowledge-graph view with a selected file and its neighbours",
    "The graph view lays out the 37 files with 24 links; 12 files have no link. Edge colour shows the kind of relationship (similar content, names another file, shared tags). Selecting final_final_v3.txt highlights its neighbours and lists them in the side panel with the reason for each link, here similar content with proposal_draft.txt and similar content plus a direct reference to resume_final.txt.", SHOTS),
  ...figure("ui-workspaces.png", 430, "Figure 5.2", "Workspace view with a created workspace and suggestions",
    "The workspace view lists the workspaces already created, each with Open all and Delete actions, above the rule-based suggestions. Each suggestion names the group, explains why the files belong together and lists them, with a single button that creates the workspace.", SHOTS),
];

// ---------------------------------------------------------------- chapter 6
const ch6 = [
  h1("Testing and Validation"),
  h2("6.1 Testing Types"),
  para(`${tref("Table 6.1")} summarises the test levels and what each covered.`, { keepNext: true }),
  tableCaption("Table 6.1", "Test levels and what each covered"),
  table([1700, 4400, 2926], ["Level", "What was tested", "Where"], [
    ["Unit", "Cosine and centring, cut-off and boost, reference detection, cluster merging, ordinals, memory rules", "tests/test_*.py"],
    ["Integration", "Indexing to search, organise and revert across the database and vector store; intent routing with the memory", "tests/test_nl_interface.py, test_indexer.py"],
    ["API", "Every HTTP route through the FastAPI test client, including error codes", "tests/test_api.py"],
    ["Equivalence", "The vectorised similarity, the token-indexed reference check and the heap clustering against their original all-pairs definitions on random data", "tests/test_knowledge_graph.py"],
    ["System", "Live runs against the real model runtime and vault; desktop shell driven over the WebView2 debug protocol", "Sections 6.2 and 7.1"],
  ]),
  h2("6.2 Test Cases and Results"),
  para("The automated suite runs offline: model calls are replaced by fixtures that return fixed vectors, so the suite needs no model runtime and runs in well under a minute. It runs on every push in continuous integration, and all 123 tests passed at the time of writing. The table shows selected cases; each one was also run against the live models."),
  para(`${tref("Table 6.2")} lists the selected test cases with the expected and observed results.`, { keepNext: true }),
  tableCaption("Table 6.2", "Selected test cases and results"),
  table([3000, 3126, 2900], ["Test case", "Expected", "Result"], [
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
  h1("Results and Discussion"),
  h2("7.1 Performance Evaluation"),
  para("Scale was measured on synthetic collections of 500, 2,000 and 5,000 files. The collections were generated across twelve topics, such as invoices, recipes and research notes, and about half of the documents include one sentence from an unrelated topic, so that the collection is not trivially separable. Each run used a fresh database and measured the real pipeline with the real models: embedding through Ollama, storage in ChromaDB and SQLite, graph construction, and 36 search queries with their latency. The benchmark script is part of the repository (backend/scripts/bench_scale.py) so that the measurements can be reproduced."),
  para(`${tref("Table 7.1")} reports indexing and knowledge-graph build after the fixes.`, { keepNext: true }),
  tableCaption("Table 7.1", "Scale benchmark - indexing and knowledge-graph build (after the fixes)"),
  table([1300, 1900, 1900, 1900, 2026], ["Files", "Index time (s)", "Index rate (files/s)", "Graph rebuild (s)", "Graph links"], [
    ["500", r1(b5.index_seconds), r1(b5.index_files_per_second), r1(b5.graph_rebuild_seconds), String(b5.graph_edges)],
    ["2,000", r1(b2.index_seconds), r1(b2.index_files_per_second), r1(b2.graph_rebuild_seconds), String(b2.graph_edges)],
    ["5,000", r1(b5k.index_seconds), r1(b5k.index_files_per_second), r1(b5k.graph_rebuild_seconds), String(b5k.graph_edges)],
  ]),
  para("Index time includes the knowledge-graph rebuild, which runs after each indexing pass that changed something. Before the vectorisation the same measurement at 2,000 files was " + r1(f2.index_seconds) + " seconds for indexing, including a graph rebuild of " + r1(f2.graph_rebuild_seconds) + " seconds. After vectorising the similarity step the 5,000-file rebuild was still " + r1(m5k.graph_rebuild_seconds) + " seconds, and profiling showed that 98% of it was the reference check, an all-pairs regular-expression search. Filing each file name under its rarest alphanumeric token, so that a text is only searched for names whose token it contains, and replacing the clustering rescan with a heap over per-group adjacency, brought the 5,000-file rebuild to " + r1(b5k.graph_rebuild_seconds) + " seconds with the same " + b5k.graph_edges + " links. At that size the graph is " + (100 * b5k.graph_rebuild_seconds / b5k.index_seconds).toFixed(0) + "% of the " + r1(b5k.index_seconds) + " second index pass; embedding the files now dominates.", { }),
  para(`${tref("Table 7.2")} reports search latency and the retrieval-quality sanity check on the synthetic data.`, { keepNext: true }),
  tableCaption("Table 7.2", "Search latency and retrieval quality on the synthetic vaults"),
  table([1300, 2100, 2100, 1700, 1826], ["Files", "p50 latency (ms)", "p95 latency (ms)", "Precision@5", "Queries with no result"], [
    ["500", r1(b5.search_p50_ms), r1(b5.search_p95_ms), d2(b5.precision_at_5), String(b5.precision_queries_with_no_result)],
    ["2,000", r1(b2.search_p50_ms), r1(b2.search_p95_ms), d2(b2.precision_at_5), String(b2.precision_queries_with_no_result)],
    ["5,000", r1(b5k.search_p50_ms), r1(b5k.search_p95_ms), d2(b5k.precision_at_5), String(b5k.precision_queries_with_no_result)],
  ]),
  para("Precision@5 is the share of the five best results that come from the topic the query describes. On this synthetic data it stays at the maximum, so it shows that the topics separate, but it does not measure retrieval on real documents. The controlled comparison in Section 7.2 addresses that on the demonstration vault."),
  ...figure("fig_scale.png", 440, "Figure 7.1", "Scale results: graph rebuild time, indexing throughput and search latency",
    "Figure 7.1 plots the same runs as Tables 7.1 and 7.2. Panel (a) shows the knowledge-graph rebuild time on a logarithmic scale, with the original pairwise loop, the vectorised-similarity version and the final version side by side; the 5,000-file loop was not measured. Panel (b) shows indexing throughput, which includes the graph rebuild. Panel (c) shows median and 95th-percentile search latency, which grows with the number of stored vectors.", FIGS),
  h2("7.2 Comparison with Existing Systems"),
  h3("7.2.1 Capability comparison"),
  para(`${tref("Table 7.3")} compares the capabilities of DreamOS with the systems reviewed in the Literature Review chapter. The entries for the other systems follow their published documentation; vendor features added later were not evaluated, and LSFS was assessed from its paper only.`, { keepNext: true }),
  tableCaption("Table 7.3", "Capability comparison with existing systems"),
  table([2326, 1200, 1100, 1200, 1100, 1100], ["Capability", "Windows Search", "Spotlight", "Everything", "LSFS", "DreamOS"], [
    ["Matches by meaning (embeddings)", "No", "No", "No", "Yes", "Yes"],
    ["Indexes file content", "Yes", "Yes", "No (names)", "Yes", "Yes"],
    ["Conversational requests with follow-ups", "No", "No", "No", "No (agent API)", "Yes"],
    ["Opens a file only above a confidence bar", "No", "No", "No", "Not assessed", "Yes"],
    ["Acts on results (organise, reverse)", "Open only", "Open only", "Open only", "Yes, for agents", "Yes, with confirmation"],
    ["Typed relationship graph with reasons", "No", "No", "No", "Not assessed", "Yes"],
    ["Runs entirely on local models", "Not applicable", "Not applicable", "Not applicable", "Not shown", "Yes; checked by audit"],
    ["Verifiable privacy report", "No", "No", "No", "No", "Yes (configuration level)"],
  ]),
  h3("7.2.2 Measured retrieval comparison"),
  para(`The capability table is qualitative, so a measured comparison was added. The corpus is the ${RETR.files}-file demonstration vault. ${RETR.queries} queries were written, and the relevant file or files for each were fixed before any system was run. Each query is then partitioned automatically by whether any of its content words, after the system's own stop-word and plural folding, occurs in a relevant file's name or text: ${RETR.queries_sharing_words} queries do and ${RETR.queries_no_shared_words} do not. Four systems return at most ${RETR.k} files: filename match (a lexical match on names only, standing in for name-index tools); BM25 over name and text (standing in for lexical content indexes); DreamOS embeddings only (without the keyword boost and cut-off); and DreamOS as shipped. The metrics are Hit@1, Hit@3 and mean reciprocal rank (MRR). The script is backend/scripts/eval_retrieval.py and the committed output is docs/benchmarks/retrieval_comparison.json.`),
  para(`${tref("Table 7.4")} gives the results.`, { keepNext: true }),
  tableCaption("Table 7.4", `Retrieval comparison on ${RETR.queries} labelled queries (${RETR.files} files)`),
  table([2200, 1000, 1000, 1000, 1275, 1275, 1276], ["System", "Hit@1 all", "Hit@3 all", "MRR all", `Hit@1 shares words (n=${RETR.queries_sharing_words})`, `Hit@1 no shared words (n=${RETR.queries_no_shared_words})`, "MRR no shared words"], [
    ["Filename match", d2(ALL.filename.hit_at_1), d2(ALL.filename.hit_at_3), d2(ALL.filename.mrr), d2(SH.filename.hit_at_1), d2(NS.filename.hit_at_1), d2(NS.filename.mrr)],
    ["BM25 over name and text", d2(ALL.keyword.hit_at_1), d2(ALL.keyword.hit_at_3), d2(ALL.keyword.mrr), d2(SH.keyword.hit_at_1), d2(NS.keyword.hit_at_1), d2(NS.keyword.mrr)],
    ["Embedding only", d2(ALL.embedding.hit_at_1), d2(ALL.embedding.hit_at_3), d2(ALL.embedding.mrr), d2(SH.embedding.hit_at_1), d2(NS.embedding.hit_at_1), d2(NS.embedding.mrr)],
    ["DreamOS (shipped)", d2(ALL.dreamos.hit_at_1), d2(ALL.dreamos.hit_at_3), d2(ALL.dreamos.mrr), d2(SH.dreamos.hit_at_1), d2(NS.dreamos.hit_at_1), d2(NS.dreamos.mrr)],
  ]),
  para(`DreamOS places a relevant file first for ${pct(ALL.dreamos.hit_at_1)} of all queries, against ${pct(ALL.keyword.hit_at_1)} for BM25 and ${pct(ALL.filename.hit_at_1)} for filename match. The partition explains the gap. When a query shares a word with its target, BM25 reaches Hit@1 ${d2(SH.keyword.hit_at_1)} and DreamOS ${d2(SH.dreamos.hit_at_1)}. When it shares none, both lexical baselines score exactly 0.00 by construction, while DreamOS scores ${d2(NS.dreamos.hit_at_1)} with every target inside its top three. Examples are “present for my mother” finding the gift list that says “Mom's birthday”, and “how to brew a hot drink with spices” finding the chai recipe.`),
  ...figure("fig_retrieval.png", 360, "Figure 7.2", "Hit@1 by system and query group, with 95% Wilson intervals",
    "Figure 7.2 shows Hit@1 for each system, split by whether the query shares a word with its target. The error bars are 95% Wilson score intervals, which are wide because the groups are small (26 and 10 queries). The lexical systems cannot answer queries that share no word with the target; the two embedding-based systems can.", FIGS),
  para(`Two results are less favourable and are reported as measured. First, the keyword boost helps queries that share words (Hit@1 ${d2(SH.embedding.hit_at_1)} to ${d2(SH.dreamos.hit_at_1)}) but costs one of the ${RETR.queries_no_shared_words} paraphrase queries (${d2(NS.embedding.hit_at_1)} to ${d2(NS.dreamos.hit_at_1)}); the intervals overlap, so the data cannot separate the two configurations. Second, DreamOS missed rank 1 on two queries (“remarks from our mentor about what to improve” and “spending breakdown for the semester”), both of which placed an unrelated quotes file first with the correct file second. The baselines are reference implementations of the lexical class, not the Windows Search, Spotlight or Everything products, so the table supports a claim about lexical versus embedding retrieval, not about any named product.`),
  h2("7.3 Observations"),
  para(`${tref("Table 7.5")} summarises the effect of the defect fixes on the measured pipeline.`, { keepNext: true }),
  tableCaption("Table 7.5", "Effect of the defect fixes on the measured pipeline"),
  table([2900, 2000, 2000, 2126], ["Measure", "Before fix", "After fix", "Change"], [
    ["Embedding call latency on the test machine", "about 1,000 ms (name resolution)", "about 15 ms", "about 65 times faster"],
    ["Indexing, 100-file test (files/s)", "0.41", "19.6", "about 48 times faster"],
    ["Indexing, 500 files (files/s, includes graph)", r1(f5.index_files_per_second), r1(b5.index_files_per_second), "about " + r1(b5.index_files_per_second / f5.index_files_per_second) + " times faster"],
    ["Graph rebuild at 2,000 files (s)", r1(f2.graph_rebuild_seconds), r1(b2.graph_rebuild_seconds), "about " + Math.round(f2.graph_rebuild_seconds / b2.graph_rebuild_seconds) + " times faster"],
    ["Graph rebuild at 5,000 files (s)", r1(m5k.graph_rebuild_seconds) + " (vectorised similarity only)", r1(b5k.graph_rebuild_seconds), "about " + Math.round(m5k.graph_rebuild_seconds / b5k.graph_rebuild_seconds) + " times faster"],
  ]),
  para("Three findings from the work matter beyond the code itself. First, a delay of about one second on every model call was caused by the way the machine resolved the name localhost, which tries an IPv6 address first. The fix was to use the IPv4 loopback address directly. Without measurement this would have been blamed on the model. Second, the graph computation was quadratic in the number of files: at 2,000 files it took about fourteen times as long as at 500 files for four times the files. Vectorising the similarity step helped, but profiling the 5,000-file run showed that nearly all of the remaining time was a different all-pairs step, the reference check, and then the clustering rescan; each was replaced and checked against the original by a test. Without profiling, the first fix would have been declared enough. Third, a live rehearsal exposed a failure that the automated tests had not covered: a follow-up question about a new topic was answered with an old result, because the model judged the sentence to refer back to the conversation. The fix gives direct evidence precedence over the model's judgement, and a regression test was written that fails on the old behaviour."),
  para("Retrieval on short queries remains the weakest part. A one-word query can rank a file that merely contains the word above the file the user meant. The system reports such results with a confidence label instead of acting on them, which keeps the user in control."),
];

// ---------------------------------------------------------------- chapter 8
const ch8 = [
  h1("Conclusion and Future Scope"),
  h2("8.1 Summary of Work"),
  para(`DreamOS was built as a local, meaning-based file manager with six modules, a desktop interface and a privacy audit. It indexes a folder with local embeddings, answers natural-language requests, opens files only on confident matches, organises files reversibly, relates files through a knowledge graph, remembers conversation so that follow-ups work, and recommends workspaces. In a controlled comparison it placed the intended file first for ${pct(ALL.dreamos.hit_at_1)} of ${RETR.queries} labelled queries, against ${pct(ALL.keyword.hit_at_1)} for a BM25 content index, and answered paraphrased queries that lexical indexes cannot. It was measured on collections of up to 5,000 files, and the measurements led to fixes for the name-resolution delay, three all-pairs graph computations and one behavioural defect, each covered by a test.`),
  h2("8.2 Limitations"),
  bullet("The retrieval comparison uses 36 queries on a 37-file vault, written and labelled by the project team; the intervals are wide and the baselines are reference implementations, not the commercial products."),
  bullet("The scale evaluation uses synthetic documents. Retrieval quality on real personal files has not been measured."),
  bullet("Short, generic queries can rank a file that contains the word above the intended file."),
  bullet("The 3-billion-parameter model misclassifies some borderline wording, for example routing “which files should I archive” to organise rather than workspace; intent accuracy was 88% on held-out phrasings."),
  bullet("The similarity step builds a dense matrix of every pair of files, so its memory grows with the square of the collection (about 200 MB at 5,000 files). Collections beyond roughly ten thousand files would need an approximate nearest-neighbour index."),
  bullet("The privacy audit checks configuration; it does not capture network traffic. The report describes the netstat check that does."),
  bullet("The system runs on Windows only and handles text, Markdown, source, PDF and Word files."),
  h2("8.3 Future Enhancement"),
  bullet("Evaluate retrieval on a labelled set of real documents, with the participants' consent and without storing their content."),
  bullet("Run the same queries against the shipped Windows Search, Spotlight and Everything products for a head-to-head comparison."),
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
  para("[9] S. Robertson and H. Zaragoza, “The Probabilistic Relevance Framework: BM25 and Beyond,” Found. Trends Inf. Retr., vol. 3, no. 4, 2009.", { align: AlignmentType.LEFT }),
  para("[10] E. B. Wilson, “Probable inference, the law of succession, and statistical inference,” J. Amer. Statist. Assoc., vol. 22, no. 158, 1927.", { align: AlignmentType.LEFT }),
];

const appendices = [
  h1("Appendices"),
  h2("Appendix A Source code"),
  para("The complete source code is in the private repository github.com/zaidwhy/dreamos-college-project, which is available to the examiners on request. The main files are backend/app (service), frontend/src (interface), backend/tests (automated tests), backend/scripts/bench_scale.py (scale benchmark) and backend/scripts/eval_retrieval.py (retrieval comparison)."),
  h2("Appendix B Scale benchmark raw results"),
  para(`${tref("Table B.1")} gives the raw benchmark output at each size.`, { keepNext: true }),
  tableCaption("Table B.1", "Raw benchmark output at 500, 2,000 and 5,000 files"),
  table([3000, 2000, 2000, 2026], ["Measure", "500 files", "2,000 files", "5,000 files"], [
    ["Files indexed", String(b5.indexed), String(b2.indexed), String(b5k.indexed)],
    ["Index time (s)", r1(b5.index_seconds), r1(b2.index_seconds), r1(b5k.index_seconds)],
    ["Graph rebuild (s)", r1(b5.graph_rebuild_seconds), r1(b2.graph_rebuild_seconds), r1(b5k.graph_rebuild_seconds)],
    ["Graph links", String(b5.graph_edges), String(b2.graph_edges), String(b5k.graph_edges)],
    ["Search p50 / p95 (ms)", `${r1(b5.search_p50_ms)} / ${r1(b5.search_p95_ms)}`, `${r1(b2.search_p50_ms)} / ${r1(b2.search_p95_ms)}`, `${r1(b5k.search_p50_ms)} / ${r1(b5k.search_p95_ms)}`],
  ]),
  h2("Appendix C Research paper"),
  para("A research paper on this project, prepared in IEEE conference format for the Research Methodology CA4 requirement, is included with this report (docs/paper/DreamOS-IEEE-Paper.pdf). Its figures, tables and measurements are the same as those in this report."),
  h2("Appendix D Papers and certificates"),
  para("No research paper has been accepted or presented as part of this project at the time of writing. Acceptance letters and presentation certificates, if any are issued, will be attached here."),
];

// ---------------------------------------------------------------- document
const footer = () => new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
  new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 }),
] })] });

const sectionProps = (fmt, start) => ({
  page: { size: A4, margin: MARGINS, pageNumbers: { start, formatType: fmt } },
});

// Body must be assembled before the lists so every caption is registered.
const bodyChildren = [
  ...ch1, pageBreak(), ...ch2, pageBreak(), ...ch3, pageBreak(), ...ch4, pageBreak(),
  ...ch5, pageBreak(), ...ch6, pageBreak(), ...ch7, pageBreak(), ...ch8, pageBreak(),
  ...refs, pageBreak(), ...appendices,
];

const doc = new Document({
  creator: "Zaid Ali Syed, Om Vyas, Krushna Kadam",
  title: "DreamOS - Final Year Project Report",
  styles: {
    default: { document: { run: { font: FONT, size: BODY } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: HEAD, bold: true }, paragraph: { keepNext: true, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: BODY, bold: true }, paragraph: { keepNext: true, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: BODY, bold: true }, paragraph: { keepNext: true, outlineLevel: 2 } },
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
      ...makeListOfFigures(), pageBreak(),
      ...makeListOfTables(), pageBreak(),
    ] },
    { properties: sectionProps(NumberFormat.DECIMAL, 1), headers: { default: new Header({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }], children: [new TextRun({ text: "DreamOS - Final Year Project Report", font: FONT, size: 20, italics: true }), new TextRun({ text: "\tIICT, MGM University 2026-2027", font: FONT, size: 20, italics: true })] })] }) }, footers: { default: footer() }, children: bodyChildren },
  ],
});

const out = path.join(__dirname, "DreamOS-Final-Year-Project-Report.docx");
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(out, buf); console.log("wrote", out, buf.length, "bytes", "| tables", REG.tables.length, "figures", REG.figures.length); });
