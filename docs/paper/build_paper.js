// Builds the IEEE-conference-style, two-column DreamOS paper (US Letter, 6 pages including
// references). Every number is read from docs/benchmarks/*.json, so text, tables and figures
// cannot drift apart. Figures come from docs/paper/make_figures.py.
//
//   py -3.14 docs/paper/make_figures.py
//   NODE_PATH="$(npm root -g)" node docs/paper/build_paper.js          -> DreamOS-IEEE-Paper.docx
//   ANON=1 NODE_PATH="$(npm root -g)" node docs/paper/build_paper.js   -> ...-Anonymous.docx
//
// The anonymous build removes author names, affiliations, e-mail and the acknowledgment so the
// file can go to a double-blind review.
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, Footer,
  AlignmentType, BorderStyle, WidthType, ShadingType, PageNumber, SectionType, VerticalAlign,
} = require("docx");

const ANON = process.env.ANON === "1";
const REPO = path.resolve(__dirname, "..", "..");
const FIGS = path.join(__dirname, "figs");
const BENCH = JSON.parse(fs.readFileSync(path.join(REPO, "docs", "benchmarks", "scale_results.json"), "utf8"));
const BEFORE = JSON.parse(fs.readFileSync(path.join(REPO, "docs", "benchmarks", "scale_results_before.json"), "utf8"));
const RETR = JSON.parse(fs.readFileSync(path.join(REPO, "docs", "benchmarks", "retrieval_comparison.json"), "utf8"));

const FONT = "Times New Roman";
const T10 = 20, T9 = 18, T8 = 16; // half-points
const LETTER = { width: 12240, height: 15840 };
const MARGINS = { top: 1000, right: 1000, bottom: 1000, left: 1000 };
const CONTENT_W = 12240 - 2000;
const COL_W = Math.floor((CONTENT_W - 360) / 2);

const r1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const f2 = (x) => x.toFixed(2);
const b5 = BENCH["500"], b2 = BENCH["2000"], b5k = BENCH["5000"];
const a5 = BEFORE["500"], a2 = BEFORE["2000"];
const ALL = RETR.all, SH = RETR.sharing_words, NS = RETR.no_shared_words;

// ---------------------------------------------------------------- helpers
const run = (text, opts = {}) => new TextRun({ text, font: FONT, size: T10, ...opts });

function p(text, opts = {}) {
  const { indent = true, align = AlignmentType.JUSTIFIED, after = 0, children } = opts;
  return new Paragraph({
    alignment: align,
    spacing: { line: 230, after },
    indent: indent ? { firstLine: 280 } : undefined,
    children: children || [run(text)],
  });
}

function sectionHead(numeral, title) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 140, after: 70 },
    keepNext: true,
    children: [new TextRun({ text: `${numeral}. ${title.toUpperCase()}`, font: FONT, size: T10, bold: true })],
  });
}

function subHead(title) {
  return new Paragraph({
    spacing: { before: 80, after: 30 },
    keepNext: true,
    children: [new TextRun({ text: title, font: FONT, size: T10, bold: true, italics: true })],
  });
}

function leadIn(label, text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 230, after: 80 },
    children: [
      new TextRun({ text: `${label}: `, font: FONT, size: T9, bold: true, italics: true }),
      new TextRun({ text, font: FONT, size: T9 }),
    ],
  });
}

function eq(text, n) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 30, after: 30 },
    children: [new TextRun({ text, font: FONT, size: T10, italics: true }), new TextRun({ text: `        (${n})`, font: FONT, size: T10 })],
  });
}

function refEntry(n, text) {
  return new Paragraph({
    spacing: { line: 216, after: 30 },
    indent: { left: 260, hanging: 260 },
    children: [new TextRun({ text: `[${n}] ${text}`, font: FONT, size: T8 })],
  });
}

const caption = (label, text) => new Paragraph({
  alignment: AlignmentType.JUSTIFIED,
  spacing: { before: 50, after: 110, line: 216 },
  children: [new TextRun({ text: `${label}. `, font: FONT, size: T8, bold: true }), new TextRun({ text, font: FONT, size: T8 })],
});

const tableCaption = (n, text) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 90, after: 50, line: 216 },
  keepNext: true,
  children: [new TextRun({ text: `TABLE ${n}`, font: FONT, size: T8, bold: true }), new TextRun({ text: `. ${text}`, font: FONT, size: T8 })],
});

const note = (text) => new Paragraph({
  alignment: AlignmentType.JUSTIFIED,
  spacing: { before: 40, after: 100, line: 208 },
  children: [new TextRun({ text, font: FONT, size: 15 })],
});

const border = { style: BorderStyle.SINGLE, size: 2, color: "000000" };
const borders = { top: border, bottom: border, left: border, right: border };

function table(widths, header, rows, opts = {}) {
  const { align = AlignmentType.CENTER, firstColLeft = false, size = T8 } = opts;
  const total = widths.reduce((a, b) => a + b, 0);
  const cell = (text, w, isHead, ci) => new TableCell({
    borders, width: { size: w, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    shading: isHead ? { fill: "E6E6E6", type: ShadingType.CLEAR } : undefined,
    margins: { top: 30, bottom: 30, left: 60, right: 60 },
    children: [new Paragraph({
      alignment: isHead ? AlignmentType.CENTER : (firstColLeft && ci === 0 ? AlignmentType.LEFT : align),
      spacing: { line: 208, after: 0 },
      children: [new TextRun({ text: String(text), font: FONT, size, bold: isHead })],
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

// widthDxa is a width in DXA; docx.js image transformations are in pixels (1440 DXA = 96 px).
function figure(file, widthDxa) {
  const data = fs.readFileSync(path.join(FIGS, file));
  const w = Math.round(widthDxa / 15);
  const h = Math.round(w * (data.readUInt32BE(20) / data.readUInt32BE(16)));
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    keepNext: true,
    spacing: { before: 80, after: 0 },
    children: [new ImageRun({ type: "png", data, transformation: { width: w, height: h } })],
  });
}

// ---------------------------------------------------------------- title block (1 column)
const titleBlock = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 100 }, children: [
    new TextRun({ text: "DreamOS: A Locally Run Semantic File Manager with a Knowledge Graph, Conversational Memory and a Checkable Privacy Audit", font: FONT, size: 40, bold: true }),
  ] }),
  ...(ANON
    ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 140 }, children: [
        new TextRun({ text: "Anonymous submission for double-blind review", font: FONT, size: T10, italics: true }),
      ] })]
    : [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 10 }, children: [
          new TextRun({ text: "Zaid Ali Syed, Om Vyas and Krushna Kadam", font: FONT, size: 22 }),
        ] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 10 }, children: [
          new TextRun({ text: "Department of Information Technology, Institute of Information and Communication Technology (IICT)", font: FONT, size: T9, italics: true }),
        ] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 10 }, children: [
          new TextRun({ text: "MGM University, Chhatrapati Sambhajinagar, India  |  sidzaid72@gmail.com", font: FONT, size: T9, italics: true }),
        ] }),
        new Paragraph({ spacing: { after: 100 }, children: [] }),
      ]),
];

// ---------------------------------------------------------------- 2-column: abstract, intro, related work
const part1 = [
  leadIn("Abstract", `Personal file collections are organised by names chosen at save time, and those names rarely describe the content later. We present DreamOS, a locally run desktop file manager that finds, opens, relates and organises files from natural-language requests using only a local embedding model and a local 3B-parameter language model. Six modules cooperate: intent routing, semantic search, a reversible organiser, a knowledge graph, a context-memory engine and a workspace manager, and a privacy audit reports from live configuration which endpoints the system can reach. On ${RETR.queries} labelled queries over a ${RETR.files}-file vault, DreamOS ranks the intended file first for ${Math.round(ALL.dreamos.hit_at_1 * 100)}% of queries (MRR ${f2(ALL.dreamos.mrr)}), against ${Math.round(ALL.keyword.hit_at_1 * 100)}% (MRR ${f2(ALL.keyword.mrr)}) for a BM25 content index and ${Math.round(ALL.filename.hit_at_1 * 100)}% for filename matching; on the ${RETR.queries_no_shared_words} queries that share no word with their target, both lexical baselines score 0.00 and DreamOS scores ${f2(NS.dreamos.hit_at_1)}. On synthetic collections of 500 to 5,000 files, vectorising the graph computation cut a 2,000-file rebuild from ${r1(a2.graph_rebuild_seconds)} s to ${r1(b2.graph_rebuild_seconds)} s; the remaining ${r1(b5k.graph_rebuild_seconds)} s rebuild at 5,000 files is reported as the current scaling limit. We also document a failure in which a language model's own reference flag overrode a confident direct answer, and the rule precedence that fixed it. Limitations, including the small hand-labelled query set, are stated in full.`),
  leadIn("Index Terms", "semantic search, sentence embeddings, knowledge graph, local language models, personal information management, conversational memory, privacy by design."),

  sectionHead("I", "Introduction"),
  p("A personal computer accumulates thousands of files whose names were chosen once, in a hurry, and rarely describe what the file is about. A user who saved final_final_v3.txt must later remember that exact name, or the folder it went into, to find it again. Mainstream desktop search is lexical: a query must share vocabulary with the file name, its metadata or its text [5]-[7]. Semantic file systems [1], [8] and dense retrieval [3], [9] show that matching by meaning is feasible, but the closest recent system, LSFS [1], is designed for software agents calling an API, and neither it nor the consumer tools report in a checkable way what could leave the user's machine."),
  p("DreamOS lets a person describe a file in plain language and have it found, opened, related to other files, or organised, with every inference step running on the user's own computer. The six modules map loosely onto the memory vocabulary of cognitive science [10]: the embedding index and knowledge graph play the role of semantic memory, the stored conversation turns and open events that of episodic memory, and the session context that of working memory. We use this only as a design analogy and make no claim of cognitive modelling. The contributions are:"),
  p("1) An architecture that exposes semantic retrieval and action through one conversational interface for a human user, with six cooperating modules and a reversible organiser.", { indent: false }),
  p("2) A controlled retrieval comparison against two lexical baselines on a labelled query set, partitioned by whether a query shares any word with its target, with confidence intervals and the failures listed.", { indent: false }),
  p("3) A deterministic-precedence rule for conversational follow-ups, introduced after a live failure in which the language model's own flag for \"refers to previous\" overrode a confident direct search result.", { indent: false }),
  p("4) A vectorised, equivalence-tested knowledge-graph construction with mean-centred similarity and average-linkage clustering, evaluated at up to 5,000 files with the real local models, including the scaling limit that remains.", { indent: false }),
  p("5) A privacy audit that reports endpoints from live configuration, with an independent network-level check that can falsify it.", { indent: false, after: 80 }),

  sectionHead("II", "Related Work"),
  subHead("A. Semantic file systems and personal retrieval"),
  p("Gifford et al. introduced semantic file systems, in which attributes extracted from content are exposed as virtual directories [8]. Stuff I've Seen made previously encountered personal information retrievable by content rather than location [11]. LSFS, presented at ICLR 2025, indexes files as embedding vectors and exposes create, retrieve, update and roll-up operations to an LLM agent, showing that embedding indexes can replace command-based file operations at the operating-system-agent level [1]. DreamOS follows the same architectural direction but targets a person rather than an agent, adds a relationship graph and conversational memory, and reports an auditable privacy statement."),
  subHead("B. Dense retrieval, anisotropy and ranking"),
  p("Word and sentence embeddings place related text near each other [2], [3]; dense passage retrieval showed that learned embeddings can rival lexical ranking such as BM25 [9], [12]. Sentence-embedding spaces are anisotropic, so unrelated texts have high cosine similarity [13], [14]; DreamOS observes this directly (median document-pair cosine 0.52 on its vault) and counters it by mean-centring before graph construction, in the spirit of [14]. Approximate nearest-neighbour indexes such as HNSW [15] are what the vector store uses internally."),
  subHead("C. Consumer desktop search"),
  p("Windows Search indexes names, metadata and text but matches lexically [5]; Spotlight layers metadata and ranking heuristics on a keyword index [6]; Everything indexes NTFS file names for instant lookup without reading content [7]. Table I summarises the capability gap. None of the three retrieves by meaning in the documented configuration, and none reports a checkable statement of what leaves the machine.", { after: 60 }),
];

// ---------------------------------------------------------------- 1-column: Table I
const tableI = [
  tableCaption("I", "Capability Comparison with Existing File-Search Systems"),
  table([2900, 1400, 1400, 1400, 1500, 1480],
    ["Capability", "Windows Search [5]", "Spotlight [6]", "Everything [7]", "LSFS [1]", "DreamOS"],
    [
      ["Retrieval by embedding similarity (meaning)", "No", "No", "No", "Yes", "Yes"],
      ["Indexes file content", "Yes", "Yes", "No (names)", "Yes", "Yes"],
      ["Conversational requests with follow-ups", "No", "No", "No", "No (agent API)", "Yes"],
      ["Opens a file only above a confidence bar", "No", "No", "No", "Not assessed", "Yes"],
      ["Reversible AI-assisted organisation", "No", "No", "No", "Not assessed", "Yes"],
      ["Typed file-relationship graph with reasons", "No", "No", "No", "Not assessed", "Yes"],
      ["Needs no cloud model or service", "Yes", "Yes", "Yes", "Not shown", "Yes"],
      ["Live, checkable privacy report", "No", "No", "No", "No", "Yes"],
    ], { firstColLeft: true }),
  note("\"No\" means the capability is not provided in the standard configuration documented in [5]-[7]; vendor features added after those documents (for example AI-assisted search on newer hardware) were not evaluated. LSFS was assessed from its published paper only; \"Not assessed\" marks properties that paper does not state."),
];

// ---------------------------------------------------------------- 2-column: system design
const part2 = [
  sectionHead("III", "System Design"),
  subHead("A. Architecture"),
  p("DreamOS is a client-server application confined to one machine (Fig. 1). A Tauri 2 shell hosts a React interface with four views (chat, knowledge graph, workspaces, privacy). The interface calls a FastAPI service bound to 127.0.0.1:8420, which calls a local Ollama runtime for two models, nomic-embed-text [16] for embeddings and llama3.2 (3B) for intent classification, summaries and tags, and reads and writes three local stores: SQLite for relational data, ChromaDB [4] for chunk vectors and a sandboxed vault of files. No component is reachable from outside the machine by default."),
  subHead("B. Pipelines"),
  p("Two pipelines share these components (Fig. 2). Indexing extracts text, chunks it, embeds each chunk, stores the vectors, asks the language model for a summary, tags and a category, and rebuilds the graph; unchanged files are skipped by content hash. The query pipeline classifies each message into one of five intents (search, open, related, workspace, organise), resolves any reference to earlier results, and routes the request to the matching module."),
];

const fig1 = [
  figure("fig_architecture.png", CONTENT_W * 0.80),
  caption("Fig. 1", "DreamOS architecture. A desktop client talks over loopback HTTP to a local service with eight components (blue: request modules; green: supporting modules). The service calls a local model runtime and three local stores. Nothing in the path leaves the machine."),
  figure("fig_pipelines.png", CONTENT_W * 0.88),
  caption("Fig. 2", "(a) The indexing pipeline turns files into vectors, summaries, tags and graph edges. (b) The query pipeline classifies a message, resolves references (amber: the step that carries the paper's precedence rule), and routes to one of five actions."),
];

const part3 = [
  subHead("C. Data model"),
  p("Table II lists the design tables. Every derived table (edges, turns, usage, workspace membership) is keyed on the file's integer identifier, not its path. The organiser renames files when it moves them, but the identifier survives, so relationships and memory never need re-synchronising after a move, and a move can be reversed from the stored original path."),
];

const tableII = [
  tableCaption("II", "Database Design: Tables, Key Fields and Role"),
  table([2200, 4600, 3280],
    ["Store / table", "Key fields", "Role"],
    [
      ["SQLite / files", "id (PK), path (unique), original_path, content_hash, summary, tags, category", "One row per file; stable identity"],
      ["SQLite / file_edges", "src_id, dst_id, kind, weight", "similar, references, shared_tag"],
      ["SQLite / conversation_turns", "session_id, role, message, intent, file_ids", "Episodic memory of the chat"],
      ["SQLite / usage_events", "file_id, kind, created_at", "Open history; tie-break and rules"],
      ["SQLite / workspaces, workspace_files", "name (unique); workspace_id, file_id", "Named groups of files"],
      ["ChromaDB / vectors", "id, document chunk, embedding, metadata (path)", "Nearest-neighbour retrieval"],
    ], { firstColLeft: true }),
];

const part4 = [
  sectionHead("IV", "Methods"),
  subHead("A. Semantic search"),
  p("A query q is embedded and compared with every chunk c. A file f takes the score of its best chunk, plus a small boost for literal vocabulary overlap, where Q is the query's content words (stop-words removed, plurals folded) and T_f the words of the file's name and text:"),
  eq("s(f) = max_c cos(e_q, e_c) + λ · |Q ∩ T_f| / |Q|", 1),
  eq("keep f  iff  s(f) ≥ max(τ, s* − δ)", 2),
  p("with floor τ = 0.47, margin δ = 0.06 below the best score s*, and λ = 0.08. A fixed cut-off was abandoned because it dropped correct answers to short queries (20 of 27 on the tuning set, against 27 of 27 with the relative rule). Results below a confidence bar of 0.55 are labelled low-confidence, and the open action never launches a file from such a result.", { indent: false }),
  subHead("B. Knowledge graph"),
  p("Three typed, weighted edge kinds connect files: similar (cosine of mean chunk embeddings), references (one file's text names another by file name) and shared_tag (at least two AI-generated tags in common). Raw cosine is compressed by anisotropy, so vectors are first mean-centred, ĥ_f = (h_f − μ) / ‖h_f − μ‖, which spreads unrelated pairs to about 0 and related pairs to 0.25-0.4; the similar-edge threshold is 0.25 on that scale and each file keeps its three strongest neighbours. Clusters use average-linkage merging, joining two groups only while the mean edge weight between their members, counting missing edges as 0, exceeds 0.12. Plain connected components chained unrelated groups through single weak bridges (a 7-file cluster mixing resumes with proposals); average linkage cannot chain."),
  p("The pairwise Python loop was replaced by one matrix product, S = ĤĤ^T, with neighbours chosen by partial sort. An equivalence test on random vectors confirms identical edges, so the rewrite changes speed and not behaviour. The inverted index for shared tags removed the other quadratic term."),
  subHead("C. Context memory and deterministic precedence"),
  p("Each turn is stored with the identifiers of the files it showed, so follow-ups such as \"open the second one\" or \"open it\" resolve after a restart or a file move. Fig. 3 gives the resolution order: ordinal and bare-pronoun rules first, then a direct search on the topic the classifier extracted, and only if that search is below the confidence bar does the model's own \"refers to previous\" flag act as a last resort."),
];

const fig3 = [
  figure("fig_followup.png", COL_W * 0.92),
  caption("Fig. 3", "Follow-up resolution flowchart. Amber: decisions, evaluated top to bottom; green: outcomes. Deterministic evidence precedes the language model's own judgement."),
];

const part5 = [
  p("The order was fixed after a live rehearsal. Asked \"what is related to my resume\" after a search for invoices, the system answered about an invoice file. The 3B model set its continuation flag to true for this sentence while correctly extracting \"resume\" as the topic, apparently because the sentence matched an example in its own instructions; the system had trusted the flag unconditionally. A regression test that fails on the old precedence and passes on the new guards it.", { indent: false }),
  subHead("D. Privacy audit"),
  p("An endpoint reads live configuration and lists every address the service is set to call, whether each is loopback, and what is stored locally. It states that it checks configuration, not traffic, and names the independent check (listing listening sockets with netstat to confirm loopback-only binding), so the claim can be falsified."),
  subHead("E. Organiser and workspaces"),
  p("For each file the model proposes a summary, tags, a category and a reason; a move is applied only on confirmation and is reversible. Workspace recommendations (related groups, frequently opened files, duplicates, uncategorised and stale files) are rule-based on purpose, so they are reproducible and explainable and cost no extra model calls."),

  sectionHead("V", "Experimental Setup"),
  p("All runs used one laptop (AMD Ryzen 7 6800H, 16 GB RAM, Windows 11, CPU only) with nomic-embed-text and llama3.2 3B served by Ollama. The suite of 116 automated tests runs offline against fixtures and on every push in continuous integration."),
  subHead("A. Retrieval comparison"),
  p(`The corpus is the ${RETR.files}-file demonstration vault: deliberately messy text, Markdown and source files (CVs, invoices, meeting notes, a recipe, scripts). We wrote ${RETR.queries} queries with their relevant files before running any system. Each query is partitioned automatically by whether any of its content words, after the system's own stop-word and plural folding, occurs in a relevant file's name or text: ${RETR.queries_sharing_words} do, ${RETR.queries_no_shared_words} do not. Four systems return at most ${RETR.k} files: (i) filename match, a lexical match on names only, standing in for name-index tools [7]; (ii) BM25 [12] over name and text, standing in for lexical content indexes [5], [6]; (iii) embedding only, DreamOS without the keyword boost and cut-off; (iv) DreamOS as shipped. Metrics are Hit@1, Hit@3 and mean reciprocal rank (MRR), with 95% Wilson intervals [17] on Hit@1.`),
  subHead("B. Scale evaluation"),
  p("Synthetic vaults of 500, 2,000 and 5,000 text files across twelve topics were generated, about half with one distractor sentence from another topic. Each size ran in a fresh process with a fresh database and the real models. We measured indexing throughput (including the graph rebuild that follows an index pass), graph rebuild time, the latency of 36 queries, and precision at 5 against the generated topic label. The scripts (bench_scale.py, eval_retrieval.py) are part of the project repository."),
];

// ---------------------------------------------------------------- 1-column: Table III + Fig 5 etc.
const tableIII = [
  tableCaption("III", `Retrieval Comparison on ${RETR.queries} Labelled Queries (${RETR.files} Files)`),
  table([2500, 1100, 1100, 1100, 1450, 1450, 1380],
    ["System", "Hit@1 (all)", "Hit@3 (all)", "MRR (all)", `Hit@1, shares words (n=${RETR.queries_sharing_words})`, `Hit@1, no shared words (n=${RETR.queries_no_shared_words})`, `MRR, no shared words`],
    [
      ["Filename match", f2(ALL.filename.hit_at_1), f2(ALL.filename.hit_at_3), f2(ALL.filename.mrr), f2(SH.filename.hit_at_1), f2(NS.filename.hit_at_1), f2(NS.filename.mrr)],
      ["BM25 over name and text", f2(ALL.keyword.hit_at_1), f2(ALL.keyword.hit_at_3), f2(ALL.keyword.mrr), f2(SH.keyword.hit_at_1), f2(NS.keyword.hit_at_1), f2(NS.keyword.mrr)],
      ["Embedding only", f2(ALL.embedding.hit_at_1), f2(ALL.embedding.hit_at_3), f2(ALL.embedding.mrr), f2(SH.embedding.hit_at_1), f2(NS.embedding.hit_at_1), f2(NS.embedding.mrr)],
      ["DreamOS (shipped)", f2(ALL.dreamos.hit_at_1), f2(ALL.dreamos.hit_at_3), f2(ALL.dreamos.mrr), f2(SH.dreamos.hit_at_1), f2(NS.dreamos.hit_at_1), f2(NS.dreamos.mrr)],
    ], { firstColLeft: true }),
];

const part6 = [
  sectionHead("VI", "Results"),
  subHead("A. Retrieval quality"),
  p(`Table III and Fig. 4 show the comparison. DreamOS places a relevant file first for ${Math.round(ALL.dreamos.hit_at_1 * 100)}% of all queries and within the first three for ${Math.round(ALL.dreamos.hit_at_3 * 100)}%, against ${Math.round(ALL.keyword.hit_at_1 * 100)}% and ${Math.round(ALL.keyword.hit_at_3 * 100)}% for BM25. The partition explains the gap: when a query shares a word with its target, BM25 reaches Hit@1 ${f2(SH.keyword.hit_at_1)} and DreamOS ${f2(SH.dreamos.hit_at_1)}; when it shares none, both lexical baselines score exactly 0.00 by construction, while DreamOS scores ${f2(NS.dreamos.hit_at_1)} with all ${RETR.queries_no_shared_words} targets inside the top three. Examples are \"present for my mother\" finding the gift list that says \"Mom's birthday\", and \"how to brew a hot drink with spices\" finding the chai recipe.`),
];

const fig4 = [
  figure("fig_retrieval.png", COL_W * 0.96),
  caption("Fig. 4", "Hit@1 by system and query group, with 95% Wilson intervals. Lexical systems cannot answer queries that share no word with the target; the embedding-based systems can."),
];

const part7 = [
  p(`Two findings are less favourable and are reported as measured. First, the keyword boost helps queries that share words (Hit@1 ${f2(SH.embedding.hit_at_1)} to ${f2(SH.dreamos.hit_at_1)}) but costs one of the ${RETR.queries_no_shared_words} paraphrase queries (${f2(NS.embedding.hit_at_1)} to ${f2(NS.dreamos.hit_at_1)}); the intervals overlap, so the data cannot separate the two configurations. Second, DreamOS missed rank 1 on two queries (\"remarks from our mentor about what to improve\" and \"spending breakdown for the semester\"), both of which placed an unrelated quotes file first with the correct file second. With ${RETR.queries} queries the Hit@1 interval for DreamOS is wide (about 0.82 to 0.99), so differences of a few points between the embedding systems should not be over-read.`, { indent: false }),
  subHead("B. Scale"),
  p(`Table IV and Fig. 5 report the scale runs. Indexing stays above ${r1(b5k.index_files_per_second)} files per second up to 5,000 files and median search latency grows from ${r1(b5.search_p50_ms)} ms to ${r1(b5k.search_p50_ms)} ms. Vectorising the graph computation reduced the 500-file rebuild from ${r1(a5.graph_rebuild_seconds)} s to ${r1(b5.graph_rebuild_seconds)} s and the 2,000-file rebuild from ${r1(a2.graph_rebuild_seconds)} s to ${r1(b2.graph_rebuild_seconds)} s (${(a2.graph_rebuild_seconds / b2.graph_rebuild_seconds).toFixed(1)} times); the 5,000-file rebuild was not measured before the change and takes ${r1(b5k.graph_rebuild_seconds)} s after it. This last figure is the system's present scaling limit: the reference check and the clustering remain pairwise. Precision at 5 is 1.00 at every size, which shows only that the twelve synthetic topics separate; it is not a quality claim for real documents.`),
];

const tableIV = [
  tableCaption("IV", "Scale Benchmark: Before and After Vectorising the Graph Computation (n/m: not measured)"),
  table([1100, 1900, 1900, 1900, 1280, 1280, 1520],
    ["Files", "Index files/s (before to after)", "Graph rebuild s (before to after)", "Graph edges", "Search p50 (ms)", "Search p95 (ms)", "Precision@5"],
    [
      ["500", `${r1(a5.index_files_per_second)} to ${r1(b5.index_files_per_second)}`, `${r1(a5.graph_rebuild_seconds)} to ${r1(b5.graph_rebuild_seconds)}`, String(b5.graph_edges), r1(b5.search_p50_ms), r1(b5.search_p95_ms), f2(b5.precision_at_5)],
      ["2,000", `${r1(a2.index_files_per_second)} to ${r1(b2.index_files_per_second)}`, `${r1(a2.graph_rebuild_seconds)} to ${r1(b2.graph_rebuild_seconds)}`, String(b2.graph_edges), r1(b2.search_p50_ms), r1(b2.search_p95_ms), f2(b2.precision_at_5)],
      ["5,000", `n/m to ${r1(b5k.index_files_per_second)}`, `n/m to ${r1(b5k.graph_rebuild_seconds)}`, String(b5k.graph_edges), r1(b5k.search_p50_ms), r1(b5k.search_p95_ms), f2(b5k.precision_at_5)],
    ]),
];

const fig5 = [
  figure("fig_scale.png", CONTENT_W * 0.96),
  caption("Fig. 5", "Scale results from the same runs as Table IV. (a) Graph rebuild time on a log scale: the pairwise loop against the vectorised matrix product. (b) Indexing throughput, which includes the graph rebuild. (c) Median and 95th-percentile search latency, which grows with the number of stored vectors."),
];

const tableV = [
  tableCaption("V", "Defects Exposed by Testing, Their Causes and Fixes"),
  table([2000, 2700, 2900, 2480],
    ["Defect", "Symptom", "Cause", "Fix and evidence"],
    [
      ["Name-resolution delay", "About 1 s added to every embedding call", "\"localhost\" tried IPv6 first; the model server listens on IPv4", "Use 127.0.0.1; call about 15 ms; 100-file index 0.41 to 19.6 files/s"],
      ["Quadratic graph", `Rebuild ${r1(a2.graph_rebuild_seconds)} s at 2,000 files`, "Pairwise Python loop over all file pairs", `Matrix product, equivalence test; ${r1(b2.graph_rebuild_seconds)} s`],
      ["Stale-context override", "Answer about the previous topic", "Model flag trusted over a confident direct search", "Rules first, flag last; regression test fails on old order"],
    ], { firstColLeft: true }),
];

const part8 = [
  subHead("C. Defects found by testing"),
  p("Table V lists the three defects that testing exposed. Each was diagnosed by measurement rather than assumption: the first by profiling, which located the time inside the socket connect call rather than in inference; the second by scaling the input and observing super-linear growth; the third by a live rehearsal that the unit tests had not anticipated. Each fix has a test that fails against the prior code."),
  subHead("D. Intent routing"),
  p("The intent prompt was evaluated rather than guessed: a 32-message tuning set and a separate 26-message held-out set were run on the real llama3.2. The first prompt scored 80% on the held-out set and the revised prompt 88% (23 of 26). The remaining misses are borderline phrasings, for example \"which files should I archive\" routed to organise rather than workspace. Every module sits behind this classifier, so this error rate bounds how often a request is routed to the wrong module."),
  subHead("E. Interface"),
  p("Fig. 6 shows three of the four views. The chat view returns result cards, each with an action and, for related-file answers, the reason the files are linked (similar content, a direct reference or shared tags). The graph view lays out files and edges by force-directed layout; the workspace view lists recommendations with the rule that produced each, and creates workspaces that open together."),
];

const fig6 = [
  figure("fig_ui.png", CONTENT_W * 0.92),
  caption("Fig. 6", "Screenshots of the desktop client: (a) chat results with the reason each related file is linked, (b) the knowledge-graph view, (c) workspaces with rule-based suggestions."),
];

const part9 = [
  sectionHead("VII", "Discussion and Threats to Validity"),
  p("Meaning-based matching is what separates the systems, and it comes from the embedding model, not from the surrounding engineering; what DreamOS adds is a single interface over retrieval, action and memory, evidence-ordered resolution of follow-ups, and a privacy statement that can be falsified. The negative results matter as much: the keyword boost trades a paraphrase query for several shared-word ones, and the graph rebuild is a real limit at 5,000 files."),
  p("Threats to validity. Internal: the authors wrote and labelled the queries, which risks unconscious favouring of the system; labels were fixed before the run, the partition is computed rather than judged, and failures are listed. Baselines are reference implementations of the lexical class (name match, BM25 with the system's own tokeniser), not the Windows Search, Spotlight or Everything products, so Table III supports a claim about lexical versus embedding retrieval, not about any named product. Construct: precision on synthetic topic labels measures topic separation, not usefulness. External: 37 files and 36 queries, one author's vault, one machine, one pair of small models; intent classification is 88% correct (23 of 26) on held-out phrasings and borderline phrasing is misrouted. Reproducibility: all numbers in this paper are read from committed result files produced by the two scripts above."),

  sectionHead("VIII", "Conclusion"),
  p("DreamOS shows that a single laptop with two small local models can support meaning-based file retrieval, conversational follow-ups and a relationship graph, with a privacy claim that can be checked. In a controlled comparison it retrieved paraphrased targets that lexical indexes cannot, at the cost of a small, reported regression on one query; measurement exposed two performance defects and one behavioural defect, each fixed and tested. Future work is a labelled evaluation on consented real documents, an approximate nearest-neighbour graph for collections beyond 10,000 files, and a head-to-head run against the shipped desktop-search products.", { after: 60 }),
];

const ack = ANON ? [] : [
  new Paragraph({ spacing: { before: 60, after: 40 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ACKNOWLEDGMENT", font: FONT, size: T10, bold: true })] }),
  p("The authors thank their project guide, Dr. Minakshi R. Rajput, and the Institute of Information and Communication Technology, MGM University, for the Project Monitoring structure under which this work was reviewed.", { after: 60 }),
];

const refs = [
  new Paragraph({ spacing: { before: 60, after: 40 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "REFERENCES", font: FONT, size: T10, bold: true })] }),
  refEntry(1, "Z. Shi et al., “From Commands to Prompts: LLM-Based Semantic File System for AIOS,” in Proc. ICLR, 2025, arXiv:2410.11843."),
  refEntry(2, "T. Mikolov, K. Chen, G. Corrado and J. Dean, “Efficient Estimation of Word Representations in Vector Space,” arXiv:1301.3781, 2013."),
  refEntry(3, "N. Reimers and I. Gurevych, “Sentence-BERT: Sentence Embeddings Using Siamese BERT-Networks,” in Proc. EMNLP-IJCNLP, 2019."),
  refEntry(4, "Chroma, “Chroma: the open-source embedding database,” github.com/chroma-core/chroma."),
  refEntry(5, "Microsoft, “Windows Search overview,” Microsoft Learn documentation."),
  refEntry(6, "Apple Inc., “Spotlight User Guide,” support.apple.com."),
  refEntry(7, "voidtools, “Everything: locate files and folders by name instantly,” voidtools.com."),
  refEntry(8, "D. K. Gifford, P. Jouvelot, M. A. Sheldon and J. W. O'Toole, “Semantic file systems,” in Proc. 13th ACM Symp. on Operating Systems Principles (SOSP), 1991."),
  refEntry(9, "V. Karpukhin et al., “Dense Passage Retrieval for Open-Domain Question Answering,” in Proc. EMNLP, 2020."),
  refEntry(10, "E. Tulving, “Episodic and semantic memory,” in Organization of Memory, E. Tulving and W. Donaldson, Eds. Academic Press, 1972."),
  refEntry(11, "S. Dumais, E. Cutrell, J. J. Cadiz, G. Jancke, R. Sarin and D. C. Robbins, “Stuff I've Seen: A System for Personal Information Retrieval and Re-Use,” in Proc. ACM SIGIR, 2003."),
  refEntry(12, "S. Robertson and H. Zaragoza, “The Probabilistic Relevance Framework: BM25 and Beyond,” Found. Trends Inf. Retr., vol. 3, no. 4, 2009."),
  refEntry(13, "K. Ethayarajh, “How Contextual are Contextualized Word Representations? Comparing the Geometry of BERT, ELMo, and GPT-2 Embeddings,” in Proc. EMNLP-IJCNLP, 2019."),
  refEntry(14, "J. Mu and P. Viswanath, “All-but-the-Top: Simple and Effective Postprocessing for Word Representations,” in Proc. ICLR, 2018."),
  refEntry(15, "Y. A. Malkov and D. A. Yashunin, “Efficient and Robust Approximate Nearest Neighbor Search Using Hierarchical Navigable Small World Graphs,” IEEE Trans. Pattern Anal. Mach. Intell., vol. 42, no. 4, 2020."),
  refEntry(16, "Z. Nussbaum, J. X. Morris, B. Duderstadt and A. Mulyar, “Nomic Embed: Training a Reproducible Long Context Text Embedder,” arXiv:2402.01613, 2024."),
  refEntry(17, "E. B. Wilson, “Probable inference, the law of succession, and statistical inference,” J. Amer. Statist. Assoc., vol. 22, no. 158, 1927."),
];

// ---------------------------------------------------------------- document
const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: T9 })] })] });
const pageProps = { size: LETTER, margin: MARGINS };
const one = (children) => ({ properties: { page: pageProps, type: SectionType.CONTINUOUS }, footers: { default: footer }, children });
const two = (children) => ({ properties: { page: pageProps, type: SectionType.CONTINUOUS, column: { count: 2, space: 360 } }, footers: { default: footer }, children });

const doc = new Document({
  creator: ANON ? "Anonymous" : "Zaid Ali Syed, Om Vyas, Krushna Kadam",
  title: "DreamOS: A Locally Run Semantic File Manager with a Knowledge Graph, Conversational Memory and a Checkable Privacy Audit",
  styles: { default: { document: { run: { font: FONT, size: T10 } } } },
  sections: [
    one(titleBlock),
    two(part1),
    one(tableI),
    two(part2),
    one(fig1),
    two([...part3]),
    one(tableII),
    two([...part4, ...fig3, ...part5]),
    one(tableIII),
    two([...part6, ...fig4, ...part7]),
    one(tableIV),
    one(fig5),
    two(part8),
    one(tableV),
    one(fig6),
    two([...part9, ...ack, ...refs]),
  ],
});

const out = path.join(__dirname, ANON ? "DreamOS-IEEE-Paper-Anonymous.docx" : "DreamOS-IEEE-Paper.docx");
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(out, buf); console.log("wrote", out, buf.length, "bytes"); });
