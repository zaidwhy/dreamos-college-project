const pptxgen = require("pptxgenjs");
const path = require("path");
const fs = require("fs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const {
  FaBrain, FaSearch, FaFolderOpen, FaMagic, FaCheckCircle, FaHourglassHalf,
  FaServer, FaDatabase, FaRobot, FaDesktop, FaVial, FaBoxOpen,
} = require("react-icons/fa");

const DIAGRAMS_DIR = "C:/Users/Asus/projects/DreamOS/docs/diagrams";

// ---- palette ----
const NAVY = "1E2761";
const NAVY_DARK = "141A45";
const ICE = "F4F6FB";
const WHITE = "FFFFFF";
const TEAL = "00C2A8";
const SLATE = "5B6478";
const TEXT_DARK = "1C2333";

const HEAD_FONT = "Trebuchet MS";
const BODY_FONT = "Calibri";

async function iconPng(IconComponent, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

function pngDims(file) {
  const buf = fs.readFileSync(file);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function iconCircle(slide, icon, x, y, d, circleColor, iconColor) {
  slide.addShape("ellipse", {
    x, y, w: d, h: d, fill: { color: circleColor }, line: { type: "none" },
  });
  const pad = d * 0.26;
  slide.addImage({ data: icon, x: x + pad / 2, y: y + pad / 2, w: d - pad, h: d - pad });
}

async function main() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.3 x 7.5
  pres.author = "Zaid Ali Syed, Om Vyas, Krushna Kadam";
  pres.title = "DreamOS - Project Monitoring I";

  const W = 13.333, H = 7.5;

  const icons = {};
  icons.brainWhite = await iconPng(FaBrain, "#FFFFFF", 256);
  icons.brainTeal = await iconPng(FaBrain, "#00C2A8", 256);
  icons.searchTeal = await iconPng(FaSearch, "#00C2A8", 256);
  icons.folderTeal = await iconPng(FaFolderOpen, "#00C2A8", 256);
  icons.magicTeal = await iconPng(FaMagic, "#00C2A8", 256);
  icons.checkWhite = await iconPng(FaCheckCircle, "#FFFFFF", 256);
  icons.hourglassNavy = await iconPng(FaHourglassHalf, "#1E2761", 256);
  icons.serverWhite = await iconPng(FaServer, "#FFFFFF", 256);
  icons.dbWhite = await iconPng(FaDatabase, "#FFFFFF", 256);
  icons.robotWhite = await iconPng(FaRobot, "#FFFFFF", 256);
  icons.desktopWhite = await iconPng(FaDesktop, "#FFFFFF", 256);
  icons.vialTeal = await iconPng(FaVial, "#00C2A8", 256);
  icons.boxTeal = await iconPng(FaBoxOpen, "#00C2A8", 256);

  // =========================================================
  // SLIDE 1 - TITLE
  // =========================================================
  {
    const s = pres.addSlide();
    s.background = { color: NAVY };

    // subtle repeated motif: faint large brain icon top-right corner
    s.addImage({ data: await iconPng(FaBrain, "#232C63", 256), x: 9.6, y: -1.0, w: 5.2, h: 5.2 });

    iconCircle(s, icons.brainWhite, 0.9, 1.0, 0.9, TEAL, WHITE);

    s.addText("DreamOS", {
      x: 0.85, y: 2.15, w: 10, h: 1.3, fontFace: HEAD_FONT, fontSize: 54, bold: true,
      color: WHITE, margin: 0,
    });
    s.addText("AI-Native Semantic File Management for the Desktop", {
      x: 0.9, y: 3.25, w: 9.5, h: 0.6, fontFace: BODY_FONT, fontSize: 19,
      color: "CADCFC", margin: 0,
    });

    s.addShape("rect", { x: 0.9, y: 4.05, w: 2.3, h: 0.42, fill: { color: TEAL }, line: { type: "none" } });
    s.addText("PROJECT MONITORING - I", {
      x: 0.9, y: 4.05, w: 2.3, h: 0.42, fontFace: HEAD_FONT, fontSize: 13, bold: true,
      color: NAVY_DARK, align: "center", valign: "middle", margin: 0,
    });

    s.addText([
      { text: "Zaid Ali Syed (2305139)  |  Om Vyas (2305170)  |  Krushna Kadam (2305165)", options: { breakLine: true } },
      { text: "B.Tech Information Technology - IICT, MGM University", options: { breakLine: true, color: "8FA0D6" } },
    ], { x: 0.9, y: 6.15, w: 11.2, h: 0.85, fontFace: BODY_FONT, fontSize: 13.5, color: "CADCFC", margin: 0 });
  }

  // =========================================================
  // SLIDE 2 - PROBLEM & OBJECTIVE
  // =========================================================
  {
    const s = pres.addSlide();
    s.background = { color: ICE };

    s.addText("The Problem, and What We're Building", {
      x: 0.7, y: 0.5, w: 11.9, h: 0.8, fontFace: HEAD_FONT, fontSize: 32, bold: true,
      color: TEXT_DARK, margin: 0,
    });

    // left: messy file card
    const cardX = 0.7, cardY = 1.7, cardW = 5.7, cardH = 5.05;
    s.addShape("rect", {
      x: cardX, y: cardY, w: cardW, h: cardH, fill: { color: WHITE }, line: { type: "none" },
      shadow: { type: "outer", color: "000000", blur: 8, offset: 3, angle: 135, opacity: 0.12 },
    });
    s.addShape("rect", { x: cardX, y: cardY, w: 0.09, h: cardH, fill: { color: "C0475B" }, line: { type: "none" } });

    s.addText("A REAL DESKTOP, TODAY", {
      x: cardX + 0.35, y: cardY + 0.25, w: cardW - 0.7, h: 0.35, fontFace: HEAD_FONT, fontSize: 12.5,
      bold: true, color: "C0475B", margin: 0,
    });
    const badFiles = [
      "final_final_v3.txt", "Untitled document.txt", "CV2.txt",
      "backup_of_backup.txt", "scan0007.txt", "new_doc_2026_03_11.txt",
    ];
    s.addText(
      badFiles.map((f, i) => ({ text: f, options: { breakLine: i < badFiles.length - 1, fontFace: "Consolas" } })),
      { x: cardX + 0.35, y: cardY + 0.7, w: cardW - 0.7, h: 2.35, fontSize: 14.5, color: SLATE, margin: 0, lineSpacingMultiple: 1.35 }
    );
    s.addText(
      "Nobody finds a file by its name anymore - they remember what it's about.",
      { x: cardX + 0.35, y: cardY + 3.2, w: cardW - 0.7, h: 1.5, fontFace: BODY_FONT, fontSize: 15,
        italic: true, color: TEXT_DARK, margin: 0 }
    );

    // right: objective, icon rows
    const rx = 6.85;
    s.addText("OUR OBJECTIVE", {
      x: rx, y: cardY + 0.25 - 0.25, w: 5.6, h: 0.4, fontFace: HEAD_FONT, fontSize: 12.5,
      bold: true, color: TEAL, margin: 0,
    });
    const rows = [
      { icon: icons.searchTeal, title: "Search by meaning", body: "Find files by what they're about, not what they're named." },
      { icon: icons.folderTeal, title: "Open by intent", body: "\"Open my resume\" resolves and launches the right file directly." },
      { icon: icons.magicTeal, title: "Organize with AI", body: "Auto-categorize a messy vault - safely, and fully reversibly." },
    ];
    let ry = cardY + 0.35;
    for (const r of rows) {
      iconCircle(s, r.icon, rx, ry, 0.62, "E7F8F4", TEAL);
      s.addText(r.title, { x: rx + 0.85, y: ry - 0.03, w: 4.8, h: 0.35, fontFace: HEAD_FONT, fontSize: 16.5,
        bold: true, color: TEXT_DARK, margin: 0 });
      s.addText(r.body, { x: rx + 0.85, y: ry + 0.33, w: 4.85, h: 0.6, fontFace: BODY_FONT, fontSize: 13,
        color: SLATE, margin: 0 });
      ry += 1.28;
    }
    s.addText(
      "Selected from three proposed directions (Cognitive Spectre / DreamOS / SentinelLLM) - proposal deck, slides 7-10.",
      { x: rx, y: ry + 0.15, w: 5.6, h: 0.6, fontFace: BODY_FONT, fontSize: 11, italic: true, color: SLATE, margin: 0 }
    );
  }

  // =========================================================
  // SLIDE 3 - SYSTEM ARCHITECTURE
  // =========================================================
  {
    const s = pres.addSlide();
    s.background = { color: ICE };

    s.addText("System Architecture", {
      x: 0.7, y: 0.5, w: 11.9, h: 0.8, fontFace: HEAD_FONT, fontSize: 32, bold: true, color: TEXT_DARK, margin: 0,
    });

    const archFile = path.join(DIAGRAMS_DIR, "01_architecture.png");
    const dims = pngDims(archFile);
    const maxW = 7.45, maxH = 5.05;
    let dw = maxW, dh = dw * (dims.h / dims.w);
    if (dh > maxH) { dh = maxH; dw = dh * (dims.w / dims.h); }
    const dx = 0.7, dy = 1.55 + (maxH - dh) / 2;

    s.addShape("rect", {
      x: 0.55, y: 1.4, w: maxW + 0.3, h: maxH + 0.3, fill: { color: WHITE }, line: { color: "DCE2F0", width: 1 },
      shadow: { type: "outer", color: "000000", blur: 8, offset: 3, angle: 135, opacity: 0.1 },
    });
    s.addImage({ path: archFile, x: dx + 0.15, y: dy, w: dw - 0.3, h: dh });

    const rx = 8.75;
    s.addText("TECH STACK", { x: rx, y: 1.55, w: 4, h: 0.35, fontFace: HEAD_FONT, fontSize: 12.5, bold: true, color: TEAL, margin: 0 });
    const stack = [
      { icon: icons.desktopWhite, title: "Desktop shell", body: "Tauri + React" },
      { icon: icons.serverWhite, title: "Backend service", body: "FastAPI (Python)" },
      { icon: icons.dbWhite, title: "Storage", body: "SQLite metadata + ChromaDB vectors" },
      { icon: icons.robotWhite, title: "Local AI runtime", body: "Ollama - nomic-embed-text, llama3.2" },
    ];
    let ry = 2.0;
    for (const r of stack) {
      s.addShape("rect", { x: rx, y: ry, w: 0.55, h: 0.55, fill: { color: NAVY }, line: { type: "none" } });
      s.addImage({ data: r.icon, x: rx + 0.11, y: ry + 0.11, w: 0.33, h: 0.33 });
      s.addText(r.title, { x: rx + 0.72, y: ry - 0.04, w: 3.5, h: 0.32, fontFace: HEAD_FONT, fontSize: 14.5, bold: true, color: TEXT_DARK, margin: 0 });
      s.addText(r.body, { x: rx + 0.72, y: ry + 0.28, w: 3.5, h: 0.5, fontFace: BODY_FONT, fontSize: 11.5, color: SLATE, margin: 0 });
      ry += 1.02;
    }
    s.addText("No cloud calls, no API keys - everything runs on-device.", {
      x: rx, y: ry + 0.05, w: 4, h: 0.5, fontFace: BODY_FONT, fontSize: 11.5, italic: true, color: SLATE, margin: 0,
    });
  }

  // =========================================================
  // SLIDE 4 - PROGRESS STATUS
  // =========================================================
  {
    const s = pres.addSlide();
    s.background = { color: ICE };

    s.addText("Where We Stand at Monitoring - I", {
      x: 0.7, y: 0.5, w: 11.9, h: 0.8, fontFace: HEAD_FONT, fontSize: 32, bold: true, color: TEXT_DARK, margin: 0,
    });

    // stat callouts
    const statY = 1.55, statH = 1.55;
    const stat1X = 0.7, stat2X = 4.4;
    for (const [x, big, small, col] of [
      [stat1X, "50%", "of module scope built, tested, and packaged", NAVY],
      [stat2X, "~20%", "is what these guidelines expect at this checkpoint", "8A93AA"],
    ]) {
      s.addShape("rect", { x, y: statY, w: 3.35, h: statH, fill: { color: WHITE }, line: { type: "none" },
        shadow: { type: "outer", color: "000000", blur: 6, offset: 2, angle: 135, opacity: 0.1 } });
      s.addText(big, { x: x + 0.25, y: statY + 0.12, w: 2.9, h: 0.85, fontFace: HEAD_FONT, fontSize: 46, bold: true, color: col, margin: 0 });
      s.addText(small, { x: x + 0.25, y: statY + 0.95, w: 2.9, h: 0.55, fontFace: BODY_FONT, fontSize: 11.5, color: SLATE, margin: 0 });
    }
    s.addShape("line", { x: 8.25, y: statY + 0.15, w: 0, h: statH - 0.3, line: { color: "D6DCEA", width: 1.5 } });
    s.addText([
      { text: "21 / 21 backend tests passing", options: { bullet: true, breakLine: true } },
      { text: "Fully offline - embeddings & LLM mocked in tests", options: { bullet: true, breakLine: true } },
      { text: "Packaged as a real Windows installer (MSI + NSIS)", options: { bullet: true } },
    ], { x: 8.5, y: statY + 0.12, w: 4.15, h: statH, fontFace: BODY_FONT, fontSize: 12.5, color: TEXT_DARK, margin: 0, paraSpaceAfter: 6 });

    // built vs planned grid
    const gy = 3.5;
    const cardW = 5.75, card2X = 6.88;
    s.addShape("rect", { x: 0.7, y: gy, w: cardW, h: 3.15, fill: { color: WHITE }, line: { type: "none" },
      shadow: { type: "outer", color: "000000", blur: 6, offset: 2, angle: 135, opacity: 0.1 } });
    s.addShape("rect", { x: 0.7, y: gy, w: cardW, h: 0.55, fill: { color: NAVY }, line: { type: "none" } });
    s.addImage({ data: icons.checkWhite, x: 0.95, y: gy + 0.13, w: 0.3, h: 0.3 });
    s.addText("BUILT & TESTED", { x: 1.35, y: gy, w: 4, h: 0.55, fontFace: HEAD_FONT, fontSize: 14, bold: true, color: WHITE, valign: "middle", margin: 0 });
    s.addText([
      { text: "Natural Language Interface - routes search / open / organize", options: { bullet: true, breakLine: true } },
      { text: "Semantic Search Engine - vector similarity, tuned threshold", options: { bullet: true, breakLine: true } },
      { text: "AI File Organizer - categorize, apply, reversible revert", options: { bullet: true } },
    ], { x: 1.0, y: gy + 0.75, w: cardW - 0.55, h: 2.3, fontFace: BODY_FONT, fontSize: 13, color: TEXT_DARK, margin: 0, paraSpaceAfter: 10 });

    s.addShape("rect", { x: card2X, y: gy, w: cardW, h: 3.15, fill: { color: WHITE }, line: { type: "none" },
      shadow: { type: "outer", color: "000000", blur: 6, offset: 2, angle: 135, opacity: 0.1 } });
    s.addShape("rect", { x: card2X, y: gy, w: cardW, h: 0.55, fill: { color: "8A93AA" }, line: { type: "none" } });
    s.addImage({ data: icons.hourglassNavy, x: card2X + 0.25, y: gy + 0.13, w: 0.3, h: 0.3 });
    s.addText("PLANNED - MONITORING II / III", { x: card2X + 0.65, y: gy, w: 5, h: 0.55, fontFace: HEAD_FONT, fontSize: 14, bold: true, color: WHITE, valign: "middle", margin: 0 });
    s.addText([
      { text: "Knowledge Graph - file relationship graph", options: { bullet: true, breakLine: true } },
      { text: "Context Memory Engine - session-aware retrieval", options: { bullet: true, breakLine: true } },
      { text: "Intelligent Workspace Manager", options: { bullet: true } },
    ], { x: card2X + 0.3, y: gy + 0.75, w: cardW - 0.55, h: 2.3, fontFace: BODY_FONT, fontSize: 13, color: SLATE, margin: 0, paraSpaceAfter: 10 });
  }

  // =========================================================
  // SLIDE 5 - DEMO & ROADMAP
  // =========================================================
  {
    const s = pres.addSlide();
    s.background = { color: NAVY };

    s.addImage({ data: await iconPng(FaBrain, "#232C63", 256), x: -1.4, y: 3.9, w: 5.0, h: 5.0 });

    s.addText("Today's Demo, and What's Next", {
      x: 0.7, y: 0.55, w: 11.9, h: 0.8, fontFace: HEAD_FONT, fontSize: 32, bold: true, color: WHITE, margin: 0,
    });

    s.addText("LIVE TODAY", { x: 0.7, y: 1.55, w: 5.6, h: 0.35, fontFace: HEAD_FONT, fontSize: 13, bold: true, color: TEAL, margin: 0 });
    const demo = [
      { icon: icons.searchTeal, t: "Semantic search", b: "\"find something about a meeting\" - no filename match needed" },
      { icon: icons.folderTeal, t: "Open by intent", b: "\"open my resume\" - resolves and launches the right file" },
      { icon: icons.magicTeal, t: "AI organizer + revert", b: "Categorize the vault, apply, then reverse it cleanly" },
    ];
    let ry = 2.05;
    for (const d of demo) {
      iconCircle(s, d.icon, 0.7, ry, 0.6, "27306B", TEAL);
      s.addText(d.t, { x: 1.5, y: ry - 0.02, w: 4.9, h: 0.32, fontFace: HEAD_FONT, fontSize: 15.5, bold: true, color: WHITE, margin: 0 });
      s.addText(d.b, { x: 1.5, y: ry + 0.31, w: 4.9, h: 0.55, fontFace: BODY_FONT, fontSize: 11.5, color: "AEB9E0", margin: 0 });
      ry += 1.12;
    }

    // roadmap timeline
    s.addText("ROADMAP", { x: 7.1, y: 1.55, w: 5.5, h: 0.35, fontFace: HEAD_FONT, fontSize: 13, bold: true, color: TEAL, margin: 0 });
    const steps = [
      { n: "II", t: "Monitoring - II (~80%)", b: "Knowledge Graph + Context Memory Engine; begin Intelligent Workspace Manager" },
      { n: "III", t: "Monitoring - III (100%)", b: "Finish Intelligent Workspace Manager; full testing; final report & submission" },
    ];
    let sy = 2.05;
    for (const st of steps) {
      s.addShape("rect", { x: 7.1, y: sy, w: 0.55, h: 0.55, fill: { color: TEAL }, line: { type: "none" } });
      s.addText(st.n, { x: 7.1, y: sy, w: 0.55, h: 0.55, fontFace: HEAD_FONT, fontSize: 14, bold: true, color: NAVY_DARK, align: "center", valign: "middle", margin: 0 });
      s.addText(st.t, { x: 7.85, y: sy - 0.03, w: 4.7, h: 0.32, fontFace: HEAD_FONT, fontSize: 15.5, bold: true, color: WHITE, margin: 0 });
      s.addText(st.b, { x: 7.85, y: sy + 0.31, w: 4.7, h: 0.7, fontFace: BODY_FONT, fontSize: 11.5, color: "AEB9E0", margin: 0 });
      sy += 1.35;
    }
    if (steps.length > 1) {
      // Connects bottom of badge 1 (y=2.05+0.55) to top of badge 2 (y=2.05+1.35) - must not
      // extend into badge 2 itself or the line draws over the numbered circle.
      s.addShape("line", { x: 7.37, y: 2.6, w: 0, h: 0.8, line: { color: "3A4380", width: 2 } });
    }

    s.addShape("rect", { x: 0.7, y: 6.55, w: 11.9, h: 0.02, fill: { color: "3A4380" }, line: { type: "none" } });
    s.addText(
      "3 of 6 proposed modules shipped and verified - ahead of schedule, with an honest plan for the rest.",
      { x: 0.7, y: 6.7, w: 11.9, h: 0.6, fontFace: BODY_FONT, fontSize: 13, italic: true, color: "CADCFC", margin: 0 }
    );
  }

  const outPath = "C:/Users/Asus/projects/DreamOS/docs/DreamOS-Project-Monitoring-I.pptx";
  await pres.writeFile({ fileName: outPath });
  console.log("WROTE", outPath);
}

main().catch(e => { console.error(e); process.exit(1); });
