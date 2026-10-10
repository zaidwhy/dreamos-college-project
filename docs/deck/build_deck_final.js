// Builds docs/deck/DreamOS-Final-Monitoring.pptx: an immersive, plain-language deck for the
// final project monitoring (13 Oct 2026, internal and external examiners).
// Run from the repo root:  NODE_PATH="$(npm root -g)" node docs/deck/build_deck_final.js
// Numbers come from backend/data/bench/results.json, the same source as the blackbook report.
const pptxgen = require("pptxgenjs");
const path = require("path");
const fs = require("fs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const icons = require("react-icons/fa");

const REPO = path.resolve(__dirname, "..", "..");
const DIAG = path.join(REPO, "docs", "diagrams");
const SHOTS = path.join(REPO, "docs", "screenshots");
const BENCH = JSON.parse(fs.readFileSync(path.join(REPO, "docs", "benchmarks", "scale_results.json"), "utf8"));
const BEFORE = JSON.parse(fs.readFileSync(path.join(REPO, "docs", "benchmarks", "scale_results_before.json"), "utf8"));
const OUT = path.join(__dirname, "DreamOS-Final-Monitoring.pptx");

const C = {
  void: "07081A", deep: "0E1433", panel: "151C3D", line: "2A3766",
  teal: "2DE2C4", amber: "FFB547", rose: "FF6B8B", violet: "9B8CFF", sky: "6EC8FF",
  text: "F2F5FF", soft: "AEB8E6", dim: "7C86B8",
};
const HEAD = "Trebuchet MS";
const BODY = "Calibri";
const W = 13.333;
const H = 7.5;

const r1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const b5 = BENCH["500"], b2 = BENCH["2000"], b5k = BENCH["5000"];
const f2 = BEFORE["2000"], f5 = BEFORE["500"];

async function icon(Icon, color) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Icon, { color, size: "256" }));
  return "image/png;base64," + (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
}

// Immersive background: deep gradient, glow orbs and a starfield, drawn once as an image.
async function backgroundPng(glowA, glowB) {
  let stars = "";
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 220; i++) {
    const x = rnd() * 1920, y = rnd() * 1080, r = rnd() * 1.6 + 0.3, o = (rnd() * 0.6 + 0.2).toFixed(2);
    stars += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(2)}" fill="#FFFFFF" opacity="${o}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0A0E26"/><stop offset="0.6" stop-color="#0B1030"/><stop offset="1" stop-color="#070818"/>
      </linearGradient>
      <radialGradient id="ga"><stop offset="0" stop-color="${glowA}" stop-opacity="0.35"/><stop offset="1" stop-color="${glowA}" stop-opacity="0"/></radialGradient>
      <radialGradient id="gb"><stop offset="0" stop-color="${glowB}" stop-opacity="0.28"/><stop offset="1" stop-color="${glowB}" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1920" height="1080" fill="url(#bg)"/>
    <circle cx="1650" cy="180" r="620" fill="url(#ga)"/>
    <circle cx="180" cy="980" r="680" fill="url(#gb)"/>
    ${stars}
  </svg>`;
  return "image/png;base64," + (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
}

function dims(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

function fit(slide, file, x, y, maxW, maxH) {
  const d = dims(file);
  let w = maxW, h = w * (d.h / d.w);
  if (h > maxH) { h = maxH; w = h * (d.w / d.h); }
  slide.addImage({ path: file, x: x + (maxW - w) / 2, y: y + (maxH - h) / 2, w, h });
}

// Glass card: translucent panel with an accent edge.
function glass(s, x, y, w, h, accent) {
  s.addShape("roundRect", { x, y, w, h, rectRadius: 0.12, fill: { color: C.panel, transparency: 22 }, line: { color: C.line, width: 1 } });
  if (accent) s.addShape("rect", { x, y: y + 0.25, w: 0.06, h: h - 0.5, fill: { color: accent }, line: { type: "none" } });
}

let num = 0;
function slide(pres, bg, eyebrow, title) {
  const s = pres.addSlide();
  num += 1;
  s.background = { data: bg };
  if (eyebrow) s.addText(eyebrow.toUpperCase(), { x: 0.7, y: 0.45, w: 10, h: 0.3, fontFace: BODY, fontSize: 12, bold: true, color: C.teal, charSpacing: 3, margin: 0 });
  if (title) s.addText(title, { x: 0.7, y: 0.75, w: 12, h: 0.85, fontFace: HEAD, fontSize: 32, bold: true, color: C.text, margin: 0 });
  s.addText(`DreamOS  |  ${num}`, { x: 9.8, y: 7.05, w: 3, h: 0.3, fontFace: BODY, fontSize: 10, color: C.dim, align: "right", margin: 0 });
  return s;
}

function bullets(s, items, x, y, w, h, size = 17, color = C.text) {
  s.addText(items.map((t, i) => ({ text: t, options: { bullet: { code: "25CF" }, breakLine: i < items.length - 1, color } })),
    { x, y, w, h, fontFace: BODY, fontSize: size, color, valign: "top", margin: 0, paraSpaceAfter: 10 });
}

async function main() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.author = "Zaid Ali Syed, Om Vyas, Krushna Kadam";
  pres.title = "DreamOS - Final Project Monitoring";

  const bgMain = await backgroundPng("#2DE2C4", "#9B8CFF");
  const bgWarm = await backgroundPng("#FFB547", "#FF6B8B");
  const bgCool = await backgroundPng("#6EC8FF", "#2DE2C4");

  const ic = {
    brain: await icon(icons.FaBrain, "#07081A"),
    brainLight: await icon(icons.FaBrain, "#2DE2C4"),
    search: await icon(icons.FaSearch, "#2DE2C4"),
    folder: await icon(icons.FaFolderOpen, "#FFB547"),
    magic: await icon(icons.FaMagic, "#9B8CFF"),
    project: await icon(icons.FaProjectDiagram, "#6EC8FF"),
    book: await icon(icons.FaBook, "#2DE2C4"),
    shield: await icon(icons.FaShieldAlt, "#2DE2C4"),
    warn: await icon(icons.FaExclamationTriangle, "#FFB547"),
    check: await icon(icons.FaCheckCircle, "#2DE2C4"),
    question: await icon(icons.FaQuestionCircle, "#FFB547"),
    server: await icon(icons.FaServer, "#6EC8FF"),
    db: await icon(icons.FaDatabase, "#9B8CFF"),
    robot: await icon(icons.FaRobot, "#FFB547"),
    desktop: await icon(icons.FaDesktop, "#2DE2C4"),
    flask: await icon(icons.FaVial, "#FF6B8B"),
    clock: await icon(icons.FaTachometerAlt, "#2DE2C4"),
    link: await icon(icons.FaLink, "#6EC8FF"),
    memory: await icon(icons.FaHistory, "#FFB547"),
    lock: await icon(icons.FaLock, "#2DE2C4"),
    hands: await icon(icons.FaHandshake, "#FFB547"),
  };

  // 1. TITLE -------------------------------------------------------------
  {
    const s = pres.addSlide(); num += 1;
    s.background = { data: bgMain };
    s.addImage({ data: ic.brainLight, x: 0.8, y: 0.9, w: 0.9, h: 0.9 });
    s.addShape("roundRect", { x: 9.75, y: 0.6, w: 3.0, h: 1.85, fill: { color: "FFFFFF" }, line: { color: "FFFFFF" }, rectRadius: 0.12 });
    s.addImage({ path: path.join(REPO, "docs", "assets", "mgm-logo.png"), x: 9.95, y: 0.75, w: 2.6, h: 1.485 });
    s.addText("DreamOS", { x: 0.7, y: 2.0, w: 12, h: 1.4, fontFace: HEAD, fontSize: 88, bold: true, color: C.text, margin: 0 });
    s.addText("Find your files by what they are about, not by what they are called", { x: 0.75, y: 3.45, w: 11.5, h: 0.6, fontFace: BODY, fontSize: 24, color: C.teal, margin: 0 });
    s.addText("Final Year B.Tech Project  |  Final Monitoring, 13 October 2026", { x: 0.75, y: 4.25, w: 11, h: 0.4, fontFace: BODY, fontSize: 16, color: C.soft, margin: 0 });
    s.addText([
      { text: "Zaid Ali Syed (2305139)   Om Vyas (2305170)   Krushna Kadam (2305165)", options: { breakLine: true } },
      { text: "Under the guidance of Dr. Minakshi R. Rajput", options: { breakLine: true } },
      { text: "Institute of Information and Communication Technology, MGM University", options: { color: C.dim } },
    ], { x: 0.75, y: 5.9, w: 12, h: 1.1, fontFace: BODY, fontSize: 14, color: C.soft, margin: 0 });
  }

  // 2. THE STORY: a messy folder ------------------------------------------
  {
    const s = slide(pres, bgWarm, "Part 1 - The problem", "Every computer has a folder like this");
    const names = ["final_final_v3.txt", "Untitled document.txt", "CV2.txt", "scan0007.txt", "backup_of_backup.txt", "new_doc_2026_03_11.txt", "notes.txt", "important_dont_delete.txt"];
    names.forEach((n, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      glass(s, 0.7 + col * 4.6, 1.95 + row * 0.95, 4.4, 0.75, C.amber);
      s.addText(n, { x: 1.0 + col * 4.6, y: 2.05 + row * 0.95, w: 4.0, h: 0.55, fontFace: "Consolas", fontSize: 15, color: C.text, valign: "middle", margin: 0 });
    });
    s.addImage({ data: ic.question, x: 10.2, y: 2.0, w: 0.7, h: 0.7 });
    s.addText("Which one is the resume I sent to the company?", { x: 9.6, y: 2.85, w: 3.3, h: 1.2, fontFace: BODY, fontSize: 19, italic: true, color: C.amber, margin: 0 });
    s.addText("Computers find files by name. People remember what a file is about.", { x: 0.7, y: 6.05, w: 12, h: 0.6, fontFace: HEAD, fontSize: 22, color: C.soft, margin: 0 });
  }

  // 3. WHAT WE WANT TO BUILD ----------------------------------------------
  {
    const s = slide(pres, bgMain, "Part 1 - The idea", "What if you could just ask?");
    s.addShape("roundRect", { x: 0.7, y: 1.9, w: 5.9, h: 4.6, rectRadius: 0.15, fill: { color: C.panel }, line: { color: C.line } });
    s.addText("You type", { x: 1.0, y: 2.15, w: 5, h: 0.4, fontFace: BODY, fontSize: 15, color: C.dim, margin: 0 });
    s.addText("“find my invoices”", { x: 1.0, y: 2.6, w: 5.3, h: 0.7, fontFace: HEAD, fontSize: 28, bold: true, color: C.teal, margin: 0 });
    s.addText("“open the second one”", { x: 1.0, y: 3.4, w: 5.3, h: 0.6, fontFace: HEAD, fontSize: 24, color: C.text, margin: 0 });
    s.addText("“what is related to my resume?”", { x: 1.0, y: 4.15, w: 5.3, h: 0.6, fontFace: HEAD, fontSize: 24, color: C.text, margin: 0 });
    s.addText("DreamOS finds, opens and groups the files for you - on your own computer.", { x: 1.0, y: 5.2, w: 5.4, h: 0.9, fontFace: BODY, fontSize: 17, color: C.soft, margin: 0, valign: "top" });
    s.addText("Like a librarian who has read every book in your house, and never tells anyone what is on your shelves.", { x: 7.1, y: 2.2, w: 5.5, h: 2.2, fontFace: HEAD, fontSize: 24, italic: true, color: C.amber, margin: 0, valign: "top" });
    s.addText("No cloud. No account. No uploads.", { x: 7.1, y: 4.9, w: 5.5, h: 0.5, fontFace: HEAD, fontSize: 20, bold: true, color: C.text, margin: 0 });
  }

  // 4. OBJECTIVES ---------------------------------------------------------
  {
    const s = slide(pres, bgCool, "Part 1 - Objectives", "Six things we set out to do");
    const items = [
      [ic.search, "Find by meaning", "Search files by what they say, not what they are named"],
      [ic.magic, "Understand requests", "One box that works out whether you want to find, open, relate or organise"],
      [ic.folder, "Organise safely", "Tag and sort files, and undo every move"],
      [ic.project, "Show connections", "Show which files belong together, and why"],
      [ic.memory, "Remember the chat", "Make follow-up questions like “open it” work"],
      [ic.shield, "Keep data private", "Never send files or questions to a server, and prove it"],
    ];
    items.forEach(([img, t, d], i) => {
      const x = 0.7 + (i % 3) * 4.1, y = 1.9 + Math.floor(i / 3) * 2.45;
      glass(s, x, y, 3.8, 2.2, C.teal);
      s.addImage({ data: img, x: x + 0.35, y: y + 0.3, w: 0.5, h: 0.5 });
      s.addText(t, { x: x + 1.0, y: y + 0.35, w: 2.7, h: 0.45, fontFace: HEAD, fontSize: 18, bold: true, color: C.text, margin: 0 });
      s.addText(d, { x: x + 0.35, y: y + 1.0, w: 3.3, h: 1.1, fontFace: BODY, fontSize: 15, color: C.soft, margin: 0, valign: "top" });
    });
  }

  // 5. LITERATURE: what others have done ---------------------------------
  {
    const s = slide(pres, bgMain, "Part 2 - Literature review", "What already exists");
    const cards = [
      ["Windows Search and Spotlight", "Match the words in a query against the words in a file. A query has to share vocabulary with the file.", C.amber],
      ["Everything", "Extremely fast, but only looks at file names.", C.sky],
      ["LSFS (ICLR 2025 paper)", "Shows that searching files by meaning works at the operating-system level, but it is built for AI agents that call an API, not for a person typing.", C.teal],
    ];
    cards.forEach(([t, d, col], i) => {
      glass(s, 0.7, 1.95 + i * 1.6, 7.3, 1.4, col);
      s.addText(t, { x: 1.1, y: 2.05 + i * 1.6, w: 6.7, h: 0.4, fontFace: HEAD, fontSize: 18, bold: true, color: C.text, margin: 0 });
      s.addText(d, { x: 1.1, y: 2.5 + i * 1.6, w: 6.7, h: 0.8, fontFace: BODY, fontSize: 15, color: C.soft, margin: 0, valign: "top" });
    });
    s.addText("The building blocks come from research on word and sentence meaning: Mikolov et al. (word vectors) and Reimers and Gurevych (Sentence-BERT). Plain version: each sentence becomes a point on a map, and similar sentences land close together.", {
      x: 8.4, y: 2.0, w: 4.4, h: 4.6, fontFace: BODY, fontSize: 16, color: C.soft, margin: 0, valign: "top",
    });
  }

  // 6. RESEARCH GAPS ------------------------------------------------------
  {
    const s = slide(pres, bgWarm, "Part 2 - Research gaps", "Where the existing work stops");
    const gaps = [
      ["1", "Built for machines, not people", "Meaning-based search is shown as an API for software agents. Nobody offers one simple box for a person that finds and acts."],
      ["2", "Privacy is promised, not shown", "Few systems show, in a way you can check, that no data leaves the computer."],
      ["3", "Real limits are rarely reported", "Short everyday queries and large folders are where meaning search breaks. We measure both and report what we find."],
    ];
    gaps.forEach(([n, t, d], i) => {
      const y = 1.95 + i * 1.6;
      s.addShape("ellipse", { x: 0.8, y: y + 0.15, w: 0.9, h: 0.9, fill: { color: C.amber }, line: { type: "none" } });
      s.addText(n, { x: 0.8, y: y + 0.15, w: 0.9, h: 0.9, fontFace: HEAD, fontSize: 30, bold: true, color: C.void, align: "center", valign: "middle", margin: 0 });
      s.addText(t, { x: 2.0, y: y + 0.05, w: 10.5, h: 0.5, fontFace: HEAD, fontSize: 22, bold: true, color: C.text, margin: 0 });
      s.addText(d, { x: 2.0, y: y + 0.6, w: 10.5, h: 0.7, fontFace: BODY, fontSize: 16, color: C.soft, margin: 0, valign: "top" });
    });
  }

  // 7. OUR SOLUTION IN FOUR STEPS ----------------------------------------
  {
    const s = slide(pres, bgMain, "Part 3 - Our solution", "How DreamOS works, in four steps");
    const steps = [
      [ic.folder, "1. Read", "Each file is cut into pieces. A local AI model turns each piece into a point on the meaning map."],
      [ic.search, "2. Index", "The points and the file details are stored on your computer, in two local databases."],
      [ic.magic, "3. Understand", "Your question is worked out: find, open, relate, organise, or suggest workspaces."],
      [ic.check, "4. Answer", "You get cards with the best files, the reason they matched, and buttons to act on them."],
    ];
    steps.forEach(([img, t, d], i) => {
      const x = 0.7 + i * 3.1;
      glass(s, x, 2.0, 2.85, 4.2, C.teal);
      s.addImage({ data: img, x: x + 0.3, y: 2.3, w: 0.7, h: 0.7 });
      s.addText(t, { x: x + 0.3, y: 3.2, w: 2.4, h: 0.5, fontFace: HEAD, fontSize: 20, bold: true, color: C.text, margin: 0 });
      s.addText(d, { x: x + 0.3, y: 3.8, w: 2.35, h: 2.2, fontFace: BODY, fontSize: 15, color: C.soft, margin: 0, valign: "top" });
      if (i < 3) s.addText("→", { x: x + 2.82, y: 3.9, w: 0.4, h: 0.5, fontFace: HEAD, fontSize: 26, color: C.amber, align: "center", margin: 0 });
    });
  }

  // 8. ARCHITECTURE -------------------------------------------------------
  {
    const s = slide(pres, bgCool, "Part 3 - Architecture", "Everything runs on one computer");
    s.addShape("roundRect", { x: 0.6, y: 1.8, w: 12.1, h: 5.0, rectRadius: 0.15, fill: { color: C.panel, transparency: 15 }, line: { color: C.line } });
    fit(s, path.join(DIAG, "01_architecture.png"), 0.8, 1.95, 11.7, 4.7);
  }

  // 8b. DIAGRAMS: flow of a request, sequence, use cases and database ------
  {
    const s = slide(pres, bgMain, "Part 3 - Diagrams", "How a request flows through the system");
    s.addShape("roundRect", { x: 0.6, y: 1.8, w: 12.1, h: 5.0, rectRadius: 0.15, fill: { color: C.panel, transparency: 15 }, line: { color: C.line } });
    fit(s, path.join(DIAG, "04_dfd_level1.png"), 0.8, 1.95, 11.7, 4.7);
  }
  {
    const s = slide(pres, bgCool, "Part 3 - Diagrams", "A follow-up question, step by step");
    s.addShape("roundRect", { x: 0.6, y: 1.8, w: 7.9, h: 5.1, rectRadius: 0.15, fill: { color: C.panel, transparency: 15 }, line: { color: C.line } });
    fit(s, path.join(DIAG, "10_sequence_followup.png"), 0.75, 1.92, 7.6, 4.85);
    bullets(s, [
      "You ask for invoices; the answer is remembered with the files it showed.",
      "“open the second one” is worked out from that memory, not guessed.",
      "The app opens the file, and the choice is saved for next time.",
    ], 8.9, 2.0, 3.9, 4.6, 16);
  }
  {
    const s = slide(pres, bgWarm, "Part 3 - Diagrams", "What users can do, and how the data fits together");
    glass(s, 0.6, 1.8, 5.6, 5.1, C.teal);
    fit(s, path.join(DIAG, "05_use_case.png"), 0.8, 1.95, 5.2, 4.8);
    glass(s, 6.5, 1.8, 6.2, 5.1, C.amber);
    fit(s, path.join(DIAG, "08_er_diagram.png"), 6.7, 1.95, 5.8, 4.8);
  }

  // 9. SIX MODULES --------------------------------------------------------
  {
    const s = slide(pres, bgMain, "Part 3 - Modules", "Six modules, each with one job");
    const mods = [
      ["Understanding", "Works out what you want from a plain sentence"],
      ["Search", "Finds files close in meaning, and says when it is only a guess"],
      ["Organiser", "Suggests categories and tags, moves files, and can undo"],
      ["Connections", "Links files that are similar, that name each other, or share tags"],
      ["Memory", "Remembers the chat so follow-ups make sense"],
      ["Workspaces", "Suggests groups of related files and opens them together"],
    ];
    mods.forEach(([t, d], i) => {
      const x = 0.7 + (i % 3) * 4.1, y = 1.95 + Math.floor(i / 3) * 2.45;
      glass(s, x, y, 3.8, 2.2, i % 2 ? C.violet : C.teal);
      s.addText(String(i + 1).padStart(2, "0"), { x: x + 0.3, y: y + 0.2, w: 1.2, h: 0.5, fontFace: HEAD, fontSize: 26, bold: true, color: C.amber, margin: 0 });
      s.addText(t, { x: x + 0.3, y: y + 0.8, w: 3.3, h: 0.45, fontFace: HEAD, fontSize: 20, bold: true, color: C.text, margin: 0 });
      s.addText(d, { x: x + 0.3, y: y + 1.25, w: 3.3, h: 0.85, fontFace: BODY, fontSize: 15, color: C.soft, margin: 0, valign: "top" });
    });
  }

  // 10. KEY IDEA: meaning map ---------------------------------------------
  {
    const s = slide(pres, bgMain, "Key idea 1 - Meaning as location", "Similar files sit close together");
    bullets(s, [
      "Every piece of text becomes a list of 768 numbers, a location on a very large map.",
      "Texts about the same thing land near each other, even with no words in common.",
      "Finding a file = finding the nearest points to your question.",
      "Plain comparison: a library shelved by subject, not by the author's surname.",
    ], 0.8, 2.0, 6.0, 4.5, 19);
    glass(s, 7.4, 2.0, 5.3, 4.4, C.amber);
    s.addText("A real example", { x: 7.8, y: 2.25, w: 4.6, h: 0.4, fontFace: HEAD, fontSize: 16, bold: true, color: C.amber, margin: 0 });
    s.addText("“find something about a meeting”", { x: 7.8, y: 2.8, w: 4.6, h: 0.7, fontFace: HEAD, fontSize: 20, italic: true, color: C.text, margin: 0 });
    s.addText("It returns the team notes, though the file names say nothing about meetings.", { x: 7.8, y: 3.6, w: 4.6, h: 1.2, fontFace: BODY, fontSize: 17, color: C.soft, margin: 0, valign: "top" });
    s.addText("Honest note: very short queries are harder, and we measure that on slides 23 and 24.", { x: 7.8, y: 5.4, w: 4.6, h: 0.9, fontFace: BODY, fontSize: 14, italic: true, color: C.dim, margin: 0, valign: "top" });
  }

  // 11. KEY IDEA: knowledge graph ----------------------------------------
  {
    const s = slide(pres, bgCool, "Key idea 2 - Connections", "A map of how your files relate");
    s.addShape("roundRect", { x: 0.6, y: 1.8, w: 7.9, h: 5.1, rectRadius: 0.15, fill: { color: C.panel }, line: { color: C.line } });
    fit(s, path.join(SHOTS, "ui-knowledge-graph.png"), 0.75, 1.95, 7.6, 4.8);
    bullets(s, [
      "Three kinds of link: similar content, one file names another, shared tags.",
      "Each file keeps only its strongest links, so the picture stays readable.",
      "Click any file to see what it is connected to, and why.",
    ], 8.9, 2.0, 3.9, 4.5, 16);
  }

  // 12. KEY IDEA: memory -------------------------------------------------
  {
    const s = slide(pres, bgWarm, "Key idea 3 - Memory", "Follow-up questions just work");
    const turns = [
      ["You", "find my invoices", C.teal],
      ["DreamOS", "Found 2 file(s) matching ‘invoices’.", C.panel],
      ["You", "open the second one", C.teal],
      ["DreamOS", "Opening recieved_payment.txt...", C.panel],
    ];
    turns.forEach(([who, txt, col], i) => {
      const left = who === "You";
      const x = left ? 6.0 : 0.8, y = 1.9 + i * 1.15;
      s.addShape("roundRect", { x, y, w: 6.5, h: 0.95, rectRadius: 0.15, fill: { color: col === C.teal ? "1B3A48" : C.panel }, line: { color: C.line } });
      s.addText(who, { x: x + 0.2, y: y + 0.08, w: 2, h: 0.3, fontFace: BODY, fontSize: 11, bold: true, color: C.amber, margin: 0 });
      s.addText(txt, { x: x + 0.2, y: y + 0.36, w: 6.1, h: 0.5, fontFace: BODY, fontSize: 17, color: C.text, margin: 0 });
    });
    s.addText("Why this is hard: a computer has to know that “the second one” refers to the list it showed a moment ago. We decide that with rules first, and use the AI model only as a last resort.", {
      x: 0.8, y: 6.35, w: 11.8, h: 0.7, fontFace: BODY, fontSize: 14, italic: true, color: C.soft, margin: 0,
    });
  }

  // 13. PRIVACY -----------------------------------------------------------
  {
    const s = slide(pres, bgMain, "Key idea 4 - Privacy you can check", "Nothing leaves this computer");
    s.addImage({ data: ic.lock, x: 0.8, y: 2.0, w: 1.1, h: 1.1 });
    s.addText("The app tells you where it sends requests. Right now the answer is: only to this computer.", { x: 2.2, y: 2.05, w: 10.4, h: 0.9, fontFace: HEAD, fontSize: 22, color: C.text, margin: 0 });
    glass(s, 0.8, 3.5, 5.8, 2.9, C.teal);
    s.addText("Inside the app", { x: 1.1, y: 3.7, w: 5, h: 0.4, fontFace: HEAD, fontSize: 18, bold: true, color: C.teal, margin: 0 });
    bullets(s, ["A Privacy tab lists every service DreamOS talks to", "It marks each one as “this computer only” or “another computer”", "If someone points it at a remote model, the warning turns red"], 1.1, 4.2, 5.3, 2.0, 15);
    glass(s, 6.9, 3.5, 5.8, 2.9, C.amber);
    s.addText("Checking it yourself", { x: 7.2, y: 3.7, w: 5, h: 0.4, fontFace: HEAD, fontSize: 18, bold: true, color: C.amber, margin: 0 });
    s.addText("Run  netstat -ano  in a terminal. The DreamOS service listens on 127.0.0.1 only, which means it cannot be reached from another computer.", { x: 7.2, y: 4.2, w: 5.3, h: 2.0, fontFace: BODY, fontSize: 15, color: C.soft, margin: 0, valign: "top" });
  }

  // 14. TECH STACK --------------------------------------------------------
  {
    const s = slide(pres, bgCool, "Part 3 - Technology", "What it is built with");
    const layers = [
      [ic.desktop, "Desktop app", "React, TypeScript, Tauri (a small native window)"],
      [ic.server, "Service", "Python with FastAPI"],
      [ic.robot, "AI models", "Ollama running nomic-embed-text (meaning) and llama3.2 (understanding)"],
      [ic.db, "Storage", "SQLite for details and history; ChromaDB for meaning vectors"],
      [ic.flask, "Testing", "pytest with 116 automated tests; GitHub Actions on every push"],
    ];
    layers.forEach(([img, t, d], i) => {
      const y = 1.9 + i * 0.98;
      glass(s, 0.7, y, 11.9, 0.84, i % 2 ? C.violet : C.teal);
      s.addImage({ data: img, x: 1.0, y: y + 0.17, w: 0.5, h: 0.5 });
      s.addText(t, { x: 1.8, y: y + 0.12, w: 3.0, h: 0.6, fontFace: HEAD, fontSize: 19, bold: true, color: C.text, valign: "middle", margin: 0 });
      s.addText(d, { x: 4.8, y: y + 0.12, w: 7.6, h: 0.6, fontFace: BODY, fontSize: 16, color: C.soft, valign: "middle", margin: 0 });
    });
  }

  // 15. SCREENS -----------------------------------------------------------
  {
    const s = slide(pres, bgMain, "Part 3 - The app", "What the user sees");
    const shots = [["ui-chat.png", "Chat: ask in plain words; cards show why each file matched"], ["ui-workspaces.png", "Workspaces: suggested groups, one click to create and open"]];
    shots.forEach(([f, cap], i) => {
      const x = 0.7 + i * 6.2;
      s.addShape("roundRect", { x, y: 1.85, w: 5.9, h: 4.2, rectRadius: 0.12, fill: { color: C.panel }, line: { color: C.line } });
      fit(s, path.join(SHOTS, f), x + 0.1, 1.95, 5.7, 4.0);
      s.addText(cap, { x, y: 6.2, w: 5.9, h: 0.6, fontFace: BODY, fontSize: 14, color: C.soft, margin: 0 });
    });
  }

  // 16. TESTING: what it means --------------------------------------------
  {
    const s = slide(pres, bgWarm, "Part 4 - Testing", "How we checked it works");
    const levels = [
      ["Small checks", "One piece at a time: does the ranking, the memory rule and the reversal work?", "116 automated tests, run offline in under a minute"],
      ["Joined-up checks", "Pieces together: index a folder, search it, organise it, undo it", "Run against the real AI models"],
      ["Real app", "The desktop window itself, driven like a user would drive it", "Opened and checked inside the running app"],
    ];
    levels.forEach(([t, d, r], i) => {
      const y = 1.9 + i * 1.6;
      glass(s, 0.7, y, 12, 1.35, [C.teal, C.amber, C.rose][i]);
      s.addText(t, { x: 1.1, y: y + 0.15, w: 3.3, h: 0.5, fontFace: HEAD, fontSize: 20, bold: true, color: C.text, margin: 0 });
      s.addText(d, { x: 4.5, y: y + 0.15, w: 4.8, h: 1.0, fontFace: BODY, fontSize: 15, color: C.soft, margin: 0, valign: "top" });
      s.addText(r, { x: 9.5, y: y + 0.15, w: 3.0, h: 1.0, fontFace: BODY, fontSize: 14, italic: true, color: C.amber, margin: 0, valign: "top" });
    });
  }

  // 17. LARGE-SCALE TEST: setup -------------------------------------------
  {
    const s = slide(pres, bgCool, "Part 4 - Large-scale testing", "Could it cope with a real-sized folder?");
    bullets(s, [
      "We generated fake but realistic folders: 500, 2,000 and 5,000 files.",
      "Twelve topics: invoices, recipes, research notes, code, and more.",
      "Half of the files also carry a sentence from another topic, to make it harder.",
      "The real AI models did the work, on an ordinary laptop with no graphics card.",
      "Every number on the next slides comes from one script, which anyone can rerun.",
    ], 0.8, 2.0, 7.0, 4.6, 18);
    glass(s, 8.4, 2.0, 4.3, 4.4, C.amber);
    s.addText("The question we asked", { x: 8.8, y: 2.25, w: 3.6, h: 0.4, fontFace: HEAD, fontSize: 16, bold: true, color: C.amber, margin: 0 });
    s.addText("If my folder has five thousand files, will I wait minutes for an answer?", { x: 8.8, y: 2.8, w: 3.6, h: 3.0, fontFace: HEAD, fontSize: 22, italic: true, color: C.text, margin: 0, valign: "top" });
  }

  // 18. SCALE RESULT: speed of building -----------------------------------
  {
    const s = slide(pres, bgMain, "Part 4 - Results", "Rebuilding the map of 5,000 files takes two minutes");
    s.addChart(pres.charts.BAR, [{ name: "Knowledge-graph rebuild (seconds)", labels: ["500 files", "2,000 files", "5,000 files"], values: [Number(r1(b5.graph_rebuild_seconds)), Number(r1(b2.graph_rebuild_seconds)), Number(r1(b5k.graph_rebuild_seconds))] }], {
      x: 0.7, y: 1.9, w: 6.6, h: 4.8, barDir: "col", chartColors: [C.teal],
      catAxisLabelColor: C.soft, valAxisLabelColor: C.soft, valGridLine: { color: C.line, size: 0.5 }, catGridLine: { style: "none" },
      showValue: true, dataLabelColor: C.text, dataLabelFontSize: 14, showLegend: false,
      showTitle: true, title: "Rebuilding the file-relationship map (seconds, lower is better)", titleColor: C.text, titleFontSize: 14,
    });
    glass(s, 7.7, 1.9, 5.0, 4.8, C.teal);
    s.addText(`${r1(b5k.index_seconds)} s`, { x: 8.1, y: 2.2, w: 4.4, h: 0.9, fontFace: HEAD, fontSize: 44, bold: true, color: C.teal, margin: 0 });
    s.addText(`to index 5,000 files (about ${Math.round(b5k.index_files_per_second)} files every second)`, { x: 8.1, y: 3.1, w: 4.4, h: 0.7, fontFace: BODY, fontSize: 15, color: C.soft, margin: 0 });
    s.addText(`${r1(b5.search_p50_ms)} ms`, { x: 8.1, y: 4.0, w: 4.4, h: 0.9, fontFace: HEAD, fontSize: 44, bold: true, color: C.amber, margin: 0 });
    s.addText(`median search time at 500 files; ${r1(b5k.search_p50_ms)} ms at 5,000 files`, { x: 8.1, y: 4.9, w: 4.4, h: 0.8, fontFace: BODY, fontSize: 15, color: C.soft, margin: 0, valign: "top" });
  }

  // 19. SCALE RESULT: before and after ------------------------------------
  {
    const s = slide(pres, bgWarm, "Part 4 - Results", "Before and after fixing what the tests exposed");
    s.addChart(pres.charts.BAR, [
      { name: "Before", labels: ["Knowledge-graph rebuild at 2,000 files"], values: [Number(r1(f2.graph_rebuild_seconds))] },
      { name: "After", labels: ["Knowledge-graph rebuild at 2,000 files"], values: [Number(r1(b2.graph_rebuild_seconds))] },
    ], {
      x: 0.7, y: 1.9, w: 6.0, h: 4.8, barDir: "col", barGrouping: "clustered", chartColors: [C.rose, C.teal],
      catAxisLabelColor: C.soft, valAxisLabelColor: C.soft, valGridLine: { color: C.line, size: 0.5 }, catGridLine: { style: "none" },
      showValue: true, dataLabelColor: C.text, dataLabelFontSize: 14, showLegend: true, legendPos: "b", legendColor: C.soft,
    });
    bullets(s, [
      "Every embedding call waited about one second. The cause: the name \"localhost\" was tried over IPv6 first. Fix: use 127.0.0.1. Measured: about 1 s down to about 15 ms per call.",
      `The relationship map grew with the square of the file count. Fix: vectorise it with NumPy, and test that the answers are unchanged.`,
      "A follow-up about a new topic was answered with an old result. Fix: direct evidence now wins over the AI's guess, with a test that fails on the old behaviour.",
    ], 7.1, 1.95, 5.6, 4.9, 15);
  }

  // 20. QUALITY: honest result ---------------------------------------------
  {
    const s = slide(pres, bgMain, "Part 4 - Results", "Is the answer the right one?");
    s.addText(`${b5k.precision_at_5.toFixed(2)}`, { x: 0.8, y: 2.0, w: 4.0, h: 1.4, fontFace: HEAD, fontSize: 96, bold: true, color: C.teal, margin: 0 });
    s.addText("of the top 5 answers are on the right topic, on the 5,000-file set", { x: 0.8, y: 3.5, w: 4.2, h: 1.0, fontFace: BODY, fontSize: 18, color: C.soft, margin: 0, valign: "top" });
    glass(s, 5.6, 2.0, 7.1, 4.4, C.amber);
    s.addText("What this does and does not show", { x: 5.95, y: 2.2, w: 6.5, h: 0.45, fontFace: HEAD, fontSize: 18, bold: true, color: C.amber, margin: 0 });
    bullets(s, [
      "It shows that the topics separate cleanly in meaning at this size.",
      "It does not show quality on your real documents. Those are not in the test, on purpose.",
      "Test files were generated, so they are easier than real ones. We say so in the report.",
      "A harder test on real documents is the next step.",
    ], 5.95, 2.8, 6.5, 3.5, 16);
  }

  // 21. WHERE IT STRUGGLES -------------------------------------------------
  {
    const s = slide(pres, bgWarm, "Part 5 - Honest limits", "Where DreamOS is weaker");
    const items = [
      ["One-word questions", "“meeting notes” can rank a file that only mentions a meeting above the real notes. We show such results as guesses, and never open a guess."],
      ["Borderline wording", "A 3-billion-parameter model sometimes misreads the intent of a sentence. Measured on new phrasings: 88% correct."],
      ["Very large folders", "Some steps still grow with the square of the file count. Fine for thousands of files; tens of thousands would need a better method."],
      ["One computer, Windows only", "Not designed for several users, phones, or syncing between machines."],
    ];
    items.forEach(([t, d], i) => {
      const y = 1.9 + i * 1.25;
      s.addImage({ data: ic.warn, x: 0.8, y: y + 0.15, w: 0.5, h: 0.5 });
      s.addText(t, { x: 1.6, y, w: 11, h: 0.45, fontFace: HEAD, fontSize: 20, bold: true, color: C.text, margin: 0 });
      s.addText(d, { x: 1.6, y: y + 0.45, w: 11, h: 0.7, fontFace: BODY, fontSize: 15, color: C.soft, margin: 0, valign: "top" });
    });
  }

  // 22. CONCLUSION ---------------------------------------------------------
  {
    const s = slide(pres, bgMain, "Part 5 - Conclusion", "What we delivered");
    const won = [
      "Six working modules, tested end to end",
      "A privacy check you can run yourself",
      "Tested at 5,000 files, with the weak spots reported",
      "Three real defects found and fixed during testing",
    ];
    bullets(s, won, 0.8, 2.0, 6.2, 4.0, 19);
    glass(s, 7.5, 2.0, 5.2, 4.2, C.teal);
    s.addText("Future scope", { x: 7.9, y: 2.25, w: 4.5, h: 0.45, fontFace: HEAD, fontSize: 18, bold: true, color: C.teal, margin: 0 });
    bullets(s, ["Test on real documents, with consent", "Faster method for very large folders", "Scanned documents and images", "Installer that includes the AI models"], 7.9, 2.85, 4.5, 3.2, 16);
  }

  // 23. GLOSSARY FOR EXAMINERS ---------------------------------------------
  {
    const s = slide(pres, bgCool, "Questions", "Plain-English glossary");
    const terms = [
      ["Embedding", "A list of numbers that stands for the meaning of a piece of text"],
      ["Vector database", "A store that finds the nearest meaning-points quickly"],
      ["Knowledge graph", "A map of which files are linked, and why"],
      ["Local model", "An AI model that runs on this computer, with no internet"],
      ["Cosine similarity", "How close two meaning-points are, from 0 (unrelated) to 1 (the same)"],
      ["Average linkage", "A way to group files that avoids joining two groups by one weak link"],
    ];
    terms.forEach(([t, d], i) => {
      const x = 0.7 + (i % 2) * 6.1, y = 1.9 + Math.floor(i / 2) * 1.6;
      glass(s, x, y, 5.8, 1.35, C.violet);
      s.addText(t, { x: x + 0.3, y: y + 0.12, w: 5.2, h: 0.4, fontFace: HEAD, fontSize: 17, bold: true, color: C.text, margin: 0 });
      s.addText(d, { x: x + 0.3, y: y + 0.55, w: 5.3, h: 0.75, fontFace: BODY, fontSize: 14, color: C.soft, margin: 0, valign: "top" });
    });
  }

  // 24. THANK YOU ----------------------------------------------------------
  {
    const s = pres.addSlide(); num += 1;
    s.background = { data: bgMain };
    s.addImage({ data: ic.hands, x: 6.1, y: 1.9, w: 1.1, h: 1.1 });
    s.addText("Thank you", { x: 0.7, y: 3.2, w: 12, h: 1.2, fontFace: HEAD, fontSize: 60, bold: true, color: C.text, align: "center", margin: 0 });
    s.addText("Questions and live demo", { x: 0.7, y: 4.4, w: 12, h: 0.6, fontFace: BODY, fontSize: 24, color: C.teal, align: "center", margin: 0 });
    s.addText("github.com/zaidwhy/dreamos-college-project  (private, available to examiners)", { x: 0.7, y: 6.4, w: 12, h: 0.4, fontFace: BODY, fontSize: 14, color: C.dim, align: "center", margin: 0 });
  }

  await pres.writeFile({ fileName: OUT });
  console.log("wrote", OUT, "slides:", num);
}

main().catch((e) => { console.error(e); process.exit(1); });
