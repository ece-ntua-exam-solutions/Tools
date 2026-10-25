"use strict";
const $ = (id) => document.getElementById(id),
  KEYS = [
    "semester",
    "course",
    "year",
    "period",
    "solver",
    "reviewerA",
    "reviewerB",
    "accent",
    "font",
    "margin",
    "tagline",
    "template",
    "repo",
    "branch",
    "pdfName",
    "texName",
    "mdName",
    "customPath",
    "repoPath",
  ];
let backend = false,
  catalog = [],
  currentFile = "lysi.md",
  pdfData = null,
  pdfIndex = 0,
  pdfTotal = 0,
  pdfSize = [1, 1],
  pdfSelected = null,
  pdfSelectedText = "",
  pdfDrag = null,
  history = [],
  historyIndex = -1,
  sourceDirty = false;
let pdfSourceMap = [],
  pdfSourceSnapshot = "",
  pdfSourceSelected = null,
  pdfMode = "external",
  pdfImageUrl = null;
const builtIn = [
  {
    id: "purple-cover",
    name: "Μωβ · ξεχωριστό εξώφυλλο (επιλογή ομάδας)",
    accent: "#7446a7",
    font: "serif",
    margin: 23,
    tagline: "Λύσεις γραμμένες από φοιτητές για φοιτητές",
    cover: "separate",
  },
];
let templates = [...builtIn];
function notify(s) {
  $("message").textContent = s;
}
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
function decode(v) {
  return String(v || "").trim();
}
function metadata() {
  return {
    course: decode($("course").value),
    semester: decode($("semester").value),
    year: decode($("year").value),
    period: decode($("period").value),
    solver: decode($("solver").value),
    reviewer_a: decode($("reviewerA").value),
    reviewer_b: decode($("reviewerB").value),
    repo: decode($("repo").value),
    repo_path: decode($("customPath").value) || decode($("repoPath").value),
    template: "shmmy-purple-cover-v1",
    accent_override: $("accent").value.replace("#", ""),
    font_override: $("font").value,
    margin_override: $("margin").value,
    tagline_override: $("tagline").value,
    base_branch: $("branch").value,
    repo_pdf_name: $("pdfName").value,
    repo_tex_name: $("texName").value,
    repo_md_name: $("mdName").value,
  };
}
function repoPartMatches(path) {
  const parts = path.split("/");
  if (parts.length !== 4) return false;
  const aliases = { Κ: "K", Α: "A", Ν: "N", Ε: "E", Π: "P" };
  const period = parts[3].toUpperCase().replace(/[ΚΑΝΕΠ]/g, (c) => aliases[c]);
  return (
    parts[2] === $("year").value &&
    parts[0].match(/^\d+/)?.[0] === $("semester").value &&
    ($("period").value === "ΚΑΝ"
      ? period === "KAN"
      : period.startsWith("EPAN")) &&
    searchNorm(parts[1]) === searchNorm($("course").value)
  );
}
function saveSettings() {
  try {
    const v = {};
    for (const id of KEYS) v[id] = $(id).value;
    localStorage.setItem("shmmy-v9-settings", JSON.stringify(v));
    localStorage.setItem(
      "shmmy-v9-templates",
      JSON.stringify(
        templates.filter((x) => !builtIn.some((a) => a.id === x.id)),
      ),
    );
  } catch (e) {}
}
function toggleSection(id, btn) {
  const node = $(id);
  node.hidden = !node.hidden;
  if (btn) btn.setAttribute("aria-expanded", String(!node.hidden));
}
$("toggleMeta").onclick = () => toggleSection("metaPanel", $("toggleMeta"));
$("toggleSettings").onclick = () => toggleSection("settingsPanel");
$("togglePDF").onclick = async () => {
  toggleSection("pdfPanel");
  if (!$("pdfPanel").hidden && backend && !pdfData) {
    pdfStatus(
      "Δεν έχει ανοίξει PDF. Πάτα «Άνοιγμα παραγόμενου PDF» για επεξεργασία Markdown ή «Άνοιγμα PDF» για ανεξάρτητο αρχείο.",
    );
  }
};
function download(data, name, mime) {
  const blob =
    data instanceof Blob
      ? data
      : new Blob([data], { type: mime || "text/plain;charset=utf-8" });
  const u = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = u;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 12000);
}
function downloadB64(b64, name, mime) {
  const raw = atob(b64),
    arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  download(arr, name, mime);
}
async function getBase64(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  let s = "";
  for (let i = 0; i < data.length; i += 32768)
    s += String.fromCharCode(...data.subarray(i, i + 32768));
  return btoa(s);
}
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^\n*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^\n*]+)\*/g, "<em>$1</em>");
}
function renderMarkdown(md) {
  const lines = md.replaceAll("\r", "").split("\n");
  let html = "",
    paragraph = [],
    listing = [],
    math = [],
    fence = [],
    mode = "",
    tableRows = [];
  const flushTable = () => {
    if (!tableRows.length) return;
    const rows = tableRows.map((r) =>
      r
        .replace(/^\||\|$/g, "")
        .split(/(?<!\\)\|/)
        .map((c) => c.trim().replace(/\\\|/g, "|")),
    );
    const head = rows.length > 1 && rows[1].every((c) => /^:?-{3,}:?$/.test(c));
    html += "<table>";
    for (let i = 0; i < rows.length; i++) {
      if (head && i === 1) continue;
      const tag = head && i === 0 ? "th" : "td";
      html +=
        "<tr>" +
        rows[i]
          .map((c) => "<" + tag + ">" + inline(c) + "</" + tag + ">")
          .join("") +
        "</tr>";
    }
    html += "</table>";
    tableRows = [];
  };
  const flush = () => {
    if (paragraph.length) {
      html += "<p>" + inline(paragraph.join(" ")) + "</p>";
      paragraph = [];
    }
    if (listing.length) {
      html +=
        "<ol>" +
        listing.map((x) => "<li>" + inline(x) + "</li>").join("") +
        "</ol>";
      listing = [];
    }
  };
  for (const line of lines) {
    const t = line.trim();
    if (tableRows.length && !t.startsWith("|")) flushTable();
    if (mode === "fence") {
      if (/^```/.test(t)) {
        html += "<pre><code>" + esc(fence.join("\n")) + "</code></pre>";
        fence = [];
        mode = "";
      } else fence.push(line);
      continue;
    }
    if (mode === "math") {
      math.push(line);
      if (/\\\]|\$\$/.test(t)) {
        html += '<div class="mathline">' + esc(math.join("\n")) + "</div>";
        math = [];
        mode = "";
      }
      continue;
    }
    if (t.startsWith("```")) {
      flush();
      mode = "fence";
      continue;
    }
    if (t === "\\[" || t === "$$") {
      flush();
      math = [line];
      mode = "math";
      continue;
    }
    if (!t) {
      flush();
      continue;
    }
    if (/^#{1,4}\s/.test(t)) {
      flush();
      const lvl = Math.min(4, t.match(/^#+/)[0].length);
      html += `<h${lvl}>${inline(t.replace(/^#+\s+/, ""))}</h${lvl}>`;
      continue;
    }
    if (/^\d+[.)]\s+/.test(t)) {
      if (paragraph.length) flush();
      listing.push(t.replace(/^\d+[.)]\s+/, ""));
      continue;
    }
    if (/^[-*] /.test(t)) {
      flush();
      html += "<p>• " + inline(t.substring(2)) + "</p>";
      continue;
    }
    if (/^\|/.test(t)) {
      flush();
      tableRows.push(t);
      continue;
    }
    if (/^!\[.*\]\(data:image\//.test(t)) {
      flush();
      const m = t.match(
        /^!\[([^\]]*)\]\((data:image\/(?:png|jpeg|jpg);base64,[^)]+)\)/,
      );
      if (m) html += '<p><img alt="' + esc(m[1]) + '" src="' + m[2] + '"></p>';
      continue;
    }
    paragraph.push(t);
  }
  flush();
  flushTable();
  if (math.length)
    html += '<div class="mathline">' + esc(math.join("\n")) + "</div>";
  return html;
}
let rendering = 0,
  lastRenderedSource = null;
async function render() {
  document.documentElement.style.setProperty("--accent", $("accent").value);
  document.documentElement.style.setProperty(
    "--font-family",
    $("font").value === "serif"
      ? "Georgia,'DejaVu Serif',serif"
      : "Arial,'DejaVu Sans',sans-serif",
  );
  document.documentElement.style.setProperty(
    "--sheet-margin",
    Math.min(35, Math.max(12, Number($("margin").value) || 23)) + "mm",
  );
  const title = $("course").value || "Μάθημα",
    period =
      $("period").value === "ΚΑΝ" ? "Κανονική εξέταση" : "Επαναληπτική εξέταση";
  $("docCover").innerHTML =
    `<div class="coverinner"><div class="coverTop"><div class="eyebrow">ΟΜΑΔΑ ΕΠΙΛΥΣΗΣ ΘΕΜΑΤΩΝ · ΣΗΜΜΥ</div><div class="coverTitle">${esc(title)}</div><div class="coverSubtitle">${esc(period)} · ${esc($("year").value)}</div></div><table><tbody><tr><td><b>Λύτης</b></td><td>${esc($("solver").value || "—")}</td></tr><tr><td><b>Ελεγκτής Α</b></td><td>${esc($("reviewerA").value || "—")}</td></tr><tr><td><b>Ελεγκτής Β</b></td><td>${esc($("reviewerB").value || "—")}</td></tr></tbody></table><div class="tagline">${esc($("tagline").value)}</div></div>`;
  const changed = lastRenderedSource !== $("source").value;
  if (changed) {
    $("docBody").innerHTML = renderMarkdown($("source").value);
    lastRenderedSource = $("source").value;
  }
  $("summaryMeta").textContent =
    title +
    " · " +
    $("year").value +
    " · " +
    $("period").value +
    " · " +
    $("template").selectedOptions[0]?.textContent;
  saveSettings();
  const version = ++rendering;
  try {
    if (
      changed &&
      window.MathJax?.typesetClear &&
      window.MathJax?.typesetPromise
    ) {
      MathJax.typesetClear([$("docBody")]);
      await MathJax.typesetPromise([$("docBody")]);
    }
  } catch (e) {
    if (version === rendering)
      notify("Προεπισκόπηση κειμένου ΟΚ, MathJax: " + e.message);
  }
}
let debounce;
function schedule() {
  sourceDirty = true;
  clearTimeout(debounce);
  debounce = setTimeout(render, 220);
}
$("source").addEventListener("input", schedule);
$("docBody").addEventListener("click", (e) => {
  const block = e.target.closest("h1,h2,h3,p,li");
  if (!block) return;
  let text = (block.textContent || "").trim().replace(/\s+/g, " ");
  if (!text) return;
  const raw = $("source").value;
  const norm = raw.replace(/\*\*/g, "").replace(/`/g, "");
  const where = norm.indexOf(text);
  if (where < 0) {
    notify(
      "Δεν βρέθηκε ακριβής αντιστοίχιση στην πηγή. Για εξισώσεις επέλεξε το αντίστοιχο block χειροκίνητα.",
    );
    return;
  }
  const lead = raw.indexOf(text.slice(0, Math.min(24, text.length)));
  const pos = lead >= 0 ? lead : where;
  $("source").focus();
  $("source").setSelectionRange(pos, pos + text.length);
  notify("Επιλέχθηκε το αντίστοιχο κείμενο Markdown για επεξεργασία.");
});

for (const id of KEYS)
  $(id).addEventListener("input", () => {
    schedule();
    if (["semester", "year", "period"].includes(id)) refreshCourses(true);
    if (id === "course") showCourseSuggestions();
    if (["semester", "course", "year", "period"].includes(id))
      updateRepoPaths();
  });
function loadTemplateList() {
  try {
    templates = builtIn.concat(
      JSON.parse(localStorage.getItem("shmmy-v9-templates") || "[]"),
    );
  } catch (e) {
    templates = [...builtIn];
  }
  const current = $("template").value;
  $("template").replaceChildren();
  for (const t of templates) {
    const x = document.createElement("option");
    x.value = t.id;
    x.textContent = t.name;
    $("template").append(x);
  }
  if (current && templates.some((t) => t.id === current))
    $("template").value = current;
}
$("template").addEventListener("change", () => {
  const t = templates.find((x) => x.id === $("template").value);
  if (t) {
    $("accent").value = t.accent || "#7446a7";
    $("font").value = t.font || "serif";
    $("margin").value = t.margin || 23;
    $("tagline").value =
      t.tagline || "Λύσεις γραμμένες από φοιτητές για φοιτητές";
  }
  render();
});
$("importTemplate").onclick = () => $("templateFile").click();
$("templateFile").onchange = async (e) => {
  try {
    const f = e.target.files[0],
      obj = JSON.parse(await f.text());
    if (!obj.id || !obj.name || !/^#[a-f0-9]{6}$/i.test(obj.accent || ""))
      throw Error("Απαιτούνται id, name, accent (#RRGGBB).");
    if (templates.some((x) => x.id === obj.id))
      throw Error("Το template ID υπάρχει ήδη.");
    templates.push(obj);
    saveSettings();
    loadTemplateList();
    $("template").value = obj.id;
    $("template").dispatchEvent(new Event("change"));
    notify("Πρότυπο εισήχθη στο browser.");
  } catch (err) {
    notify(err.message);
  }
  e.target.value = "";
};
$("btnOpen").onclick = () => $("openMarkdown").click();
$("openMarkdown").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  $("source").value = await f.text();
  currentFile = f.name;
  schedule();
  notify("Άνοιξε " + f.name);
};
$("btnSave").onclick = () => {
  download($("source").value, currentFile, "text/markdown;charset=utf-8");
  notify("Έγινε λήψη Markdown.");
};
$("btnNew").onclick = () => {
  if (
    $("source").value &&
    !confirm("Νέο έγγραφο; Αποθήκευσε προηγουμένως τις αλλαγές σου.")
  )
    return;
  $("source").value = "";
  currentFile = "lysi.md";
  schedule();
};
$("btnPrint").onclick = () => window.print();
$("viewCover").onclick = () =>
  $("docCover").scrollIntoView({ behavior: "smooth", block: "center" });
$("viewSolutions").onclick = () =>
  $("docBody").scrollIntoView({ behavior: "smooth", block: "start" });
$("btnCover").onclick = () => {
  $("docCover").scrollIntoView({ behavior: "smooth", block: "center" });
};
function texEsc(s) {
  return String(s).replace(
    /[\\{}%$#&_~^]/g,
    (c) =>
      ({
        "\\": "\\textbackslash{}",
        "{": "\\{",
        "}": "\\}",
        "%": "\\%",
        $: "\\$",
        "#": "\\#",
        "&": "\\&",
        _: "\\_",
        "~": "\\textasciitilde{}",
        "^": "\\textasciicircum{}",
      })[c],
  );
}
function texInline(raw) {
  // Keep math intact; escape surrounding prose and map simple Markdown emphasis.
  const chunks = String(raw).split(/(\\\([^)]*\\\)|\$[^$\n]+\$)/g);
  return chunks
    .map((p, i) => {
      if (i % 2 === 1)
        return p.startsWith("$") ? "\\(" + p.slice(1, -1) + "\\)" : p;
      const bits = p.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g);
      return bits
        .map((q) =>
          q.startsWith("**") && q.endsWith("**")
            ? "\\textbf{" + texEsc(q.slice(2, -2)) + "}"
            : q.startsWith("`") && q.endsWith("`")
              ? "\\texttt{" + texEsc(q.slice(1, -1)) + "}"
              : texEsc(q),
        )
        .join("");
    })
    .join("");
}
function mdToTex(text) {
  let inMath = false,
    inCode = false,
    inList = false;
  const out = [];
  const endList = () => {
    if (inList) {
      out.push("\\end{enumerate}");
      inList = false;
    }
  };
  for (const line of String(text).replaceAll("\r", "").split("\n")) {
    const t = line.trim();
    if (t.startsWith("```")) {
      endList();
      inCode = !inCode;
      out.push(inCode ? "\\begin{verbatim}" : "\\end{verbatim}");
      continue;
    }
    if (inCode) {
      out.push(line);
      continue;
    }
    if (t === "\\[" || t === "$$") {
      endList();
      inMath = true;
      out.push("\\[");
      continue;
    }
    if (t === "\\]" || t === "$$") {
      inMath = false;
      out.push("\\]");
      continue;
    }
    if (inMath) {
      out.push(line);
      continue;
    }
    if (/^#{1,4}\s/.test(t)) {
      endList();
      out.push("\\section*{" + texEsc(t.replace(/^#+\s+/, "")) + "}");
      continue;
    }
    if (/^\d+[.)]\s+/.test(t)) {
      if (!inList) {
        out.push("\\begin{enumerate}");
        inList = true;
      }
      out.push("\\item " + texInline(t.replace(/^\d+[.)]\s+/, "")));
      continue;
    }
    endList();
    // Standard Pandoc is available in Python mode for tables/images and rich Markdown.
    out.push(texInline(line) + (t ? "\\par" : ""));
  }
  endList();
  return out.join("\n");
}
function offlineTex() {
  const x = metadata(),
    name = texEsc(x.course),
    tag = texEsc(x.tagline_override),
    a = x.accent_override.toUpperCase();
  return (
    String.raw`% ΣΗΜΜΥ — source exported in HTML-only mode. Compile with XeLaTeX.
\documentclass[a4paper,11pt]{article}
\usepackage{fontspec,polyglossia,amsmath,amssymb,geometry,xcolor,graphicx}
\setmainlanguage{greek}
\IfFontExistsTF{DejaVu Serif}{\setmainfont{DejaVu Serif}}{\setmainfont{FreeSerif}}
\geometry{margin=${x.margin_override}mm}
\definecolor{accent}{HTML}{${a}}
\setlength{\parindent}{0pt}
\begin{document}
\begin{titlepage}\centering\vspace*{2cm}
{\Large\color{accent}\bfseries ΟΜΑΔΑ ΕΠΙΛΥΣΗΣ ΘΕΜΑΤΩΝ ΣΗΜΜΥ\par}\vspace{2cm}
{\Huge\bfseries ${name}\par}\vspace{0.7cm}
{\Large ${x.period === "ΚΑΝ" ? "Κανονική" : "Επαναληπτική"} Εξέταση -- ${x.year}\par}\vfill
\begin{tabular}{rl}Λύτης: & ${texEsc(x.solver)} \\
Ελεγκτής Α: & ${texEsc(x.reviewer_a)} \\
Ελεγκτής Β: & ${texEsc(x.reviewer_b)}\end{tabular}
\vfill
{\itshape ${tag}\par}\end{titlepage}
` +
    mdToTex($("source").value) +
    "\n\\end{document}\n"
  );
}
async function serverRequest(url, payload) {
  let r;
  try {
    r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw Error(
      "Δεν είναι διαθέσιμος ο Python server. Εκκίνησε από Anaconda Prompt: python studio_server.py.",
    );
  }
  const text = await r.text();
  let d;
  try {
    d = JSON.parse(text);
  } catch (e) {
    throw Error("Μη έγκυρη απάντηση server.");
  }
  if (!r.ok) throw Error(d.error || "HTTP " + r.status);
  return d;
}
async function exportTeX() {
  try {
    const t = backend
      ? (
          await serverRequest("/api/export", {
            text: $("source").value,
            metadata: metadata(),
            compile: false,
          })
        ).tex
      : offlineTex();
    download(t, "lysi.tex", "text/x-tex;charset=utf-8");
    notify(
      "Εξήχθη αρχείο .tex" +
        (backend ? " από Pandoc" : " σε βασική λειτουργία") +
        ".",
    );
  } catch (e) {
    notify("Σφάλμα LaTeX: " + e.message);
  }
}
$("btnTeX").onclick = exportTeX;
let generatedPdf = null;
async function exportPDF() {
  if (!backend) {
    notify(
      "HTML-only: θα ανοίξει Print → Save as PDF, με εξώφυλλο σε ξεχωριστή πρώτη σελίδα.",
    );
    setTimeout(() => window.print(), 100);
    return;
  }
  try {
    notify("Δημιουργία PDF με PyMuPDF (χωρίς XeLaTeX)...");
    const d = await serverRequest("/api/export", {
      text: $("source").value,
      metadata: metadata(),
      compile: true,
    });
    generatedPdf = d.pdf;
    sourceDirty = false;
    downloadB64(d.pdf, `lysi.pdf`, "application/pdf");
    notify(
      "Το PDF δημιουργήθηκε με PyMuPDF." +
        (d.warnings?.length ? " Προσοχή: " + d.warnings.join(" · ") : ""),
    );
  } catch (e) {
    notify(
      "Αδυναμία δημιουργίας PDF: " +
        e.message +
        " · Εναλλακτικά: Εκτύπωση → Save as PDF.",
    );
  }
}
$("btnPDF").onclick = exportPDF;
function updateRepoPaths() {
  const s = $("repoPath");
  const old = s.value;
  s.replaceChildren(new Option("— Επίλεξε υπάρχοντα φάκελο —", ""));
  const matched = catalog.filter(repoPartMatches);
  for (const p of matched) s.append(new Option(p, p));
  if (matched.includes(old)) s.value = old;
  else if (matched.length === 1) s.value = matched[0];
  else s.value = "";
  window.dispatchEvent(new Event("studio:paths"));
}
let catalogRequest = 0,
  catalogController = null;
function catalogStorageKey() {
  return (
    "shmmy-v10-catalog-" +
    $("repo").value.trim() +
    ":" +
    ($("branch").value.trim() || "main")
  );
}
function cachedCatalog() {
  try {
    const raw =
      localStorage.getItem(catalogStorageKey()) ||
      (($("branch").value.trim() || "main") === "main"
        ? localStorage.getItem("shmmy-v9-catalog-" + $("repo").value.trim())
        : null);
    const paths = JSON.parse(raw || "[]");
    return Array.isArray(paths)
      ? paths.filter((p) => typeof p === "string" && p.split("/").length === 4)
      : [];
  } catch (_) {
    return [];
  }
}
async function refreshCatalog() {
  const repo = $("repo").value.trim(),
    branch = $("branch").value.trim() || "main";
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    notify("Μη έγκυρο OWNER/REPO");
    return;
  }
  const request = ++catalogRequest;
  catalogController?.abort();
  catalogController = new AbortController();
  const signal = catalogController.signal;
  const timeout = setTimeout(() => catalogController?.abort(), 30000);
  $("refreshRepo").disabled = true;
  $("catalogStatus").textContent = "Ανάκτηση…";
  try {
    let r = await fetch(
      `https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      { signal, headers: { Accept: "application/vnd.github+json" } },
    );
    if (!r.ok && backend)
      r = await fetch(
        "/api/catalog?repo=" +
          encodeURIComponent(repo) +
          "&branch=" +
          encodeURIComponent(branch),
        { signal },
      );
    if (!r.ok) throw Error("HTTP " + r.status);
    const d = await r.json();
    if (d.truncated) throw Error("Ο κατάλογος GitHub είναι ελλιπής.");
    const paths = d.paths || [
      ...new Set(
        (d.tree || [])
          .map((x) => x.path.split("/"))
          .filter((x) => x.length >= 4 && /^\d{4}$/.test(x[2]))
          .map((x) => x.slice(0, 4).join("/")),
      ),
    ];
    if (!paths.length) throw Error("Δεν βρέθηκαν φάκελοι εξέτασης.");
    if (
      request !== catalogRequest ||
      repo !== $("repo").value.trim() ||
      branch !== ($("branch").value.trim() || "main")
    )
      return;
    catalog = paths;
    try {
      localStorage.setItem(catalogStorageKey(), JSON.stringify(catalog));
    } catch (_) {}
    refreshCourses(true);
    updateRepoPaths();
    $("catalogStatus").textContent = catalog.length + " φάκελοι";
    notify("Ο κατάλογος ενημερώθηκε από GitHub.");
  } catch (e) {
    if (request !== catalogRequest) return;
    const cached = cachedCatalog();
    if (cached.length) {
      catalog = cached;
      refreshCourses(true);
      updateRepoPaths();
      $("catalogStatus").textContent =
        "Αποθηκευμένος κατάλογος: " + cached.length + " φάκελοι";
      notify(
        "Δεν ανανεώθηκε το GitHub. Χρησιμοποιούνται οι αποθηκευμένες διαδρομές του ίδιου repo/branch.",
      );
    } else {
      $("catalogStatus").textContent =
        "Σφάλμα: " +
        (e.name === "AbortError" ? "Έληξε ο χρόνος ανάκτησης." : e.message);
      notify("Δεν φορτώθηκε κατάλογος. Έλεγξε σύνδεση και repository.");
    }
  } finally {
    clearTimeout(timeout);
    if (request === catalogRequest) $("refreshRepo").disabled = false;
  }
}
$("refreshRepo").onclick = refreshCatalog;
function fullPath() {
  return metadata().repo_path;
}
async function openPR() {
  if (!backend) {
    notify(
      "Για πραγματικό PR χρειάζεται ο προαιρετικός Python server με Git και GitHub CLI. Το HTML-only δεν αποθηκεύει GitHub tokens.",
    );
    return;
  }
  const m = metadata();
  if (!m.repo_path) {
    if (window.StudioUI) window.StudioUI.navigate("/settings");
    else $("settingsPanel").hidden = false;
    notify("Διάλεξε ακριβή διαδρομή repo από τις ρυθμίσεις.");
    return;
  }
  $("prDetails").innerHTML =
    `<p><b>Repository:</b> ${esc(m.repo)}</p><p><b>Φάκελος:</b> ${esc(m.repo_path)}</p><p><b>Αρχεία:</b> ${esc(m.repo_pdf_name)}, ${esc(m.repo_tex_name)}, ${esc(m.repo_md_name)}</p><p>Θα δημιουργηθεί νέο branch σε προσωπικό fork και Draft PR μετά από επιβεβαίωση. Το PR δεν αποτελεί έγκριση επιστημονικού περιεχομένου.</p>`;
  $("prResult").textContent = "Πάτα «Έλεγχος» πριν από την υποβολή.";
  $("prConfirm").disabled = true;
  $("prDialog").showModal();
  refreshGithubStatus();
}
$("btnPR").onclick = openPR;
$("btnCheckPR").onclick = () => {
  $("prDialog").showModal();
  refreshGithubStatus();
};
$("btnGithubAuth").onclick = () => {
  $("prDialog").showModal();
  refreshGithubStatus();
};
$("prClose").onclick = () => $("prDialog").close();
let githubPolling = null;
async function refreshGithubStatus() {
  const label = $("githubAccountStatus"),
    head = $("btnGithubAuth"),
    message = $("githubAuthResult");
  if (!backend) {
    label.textContent = "Απαιτείται Python mode";
    head.textContent = "GitHub: Python mode";
    message.textContent =
      "Άνοιξε την εφαρμογή από το localhost:8765 με τον Python server. Το HTML-only δεν μπορεί να κάνει authentication.";
    return null;
  }
  try {
    const response = await fetch("/api/github/status", { cache: "no-store" });
    if (!response.ok) throw Error("HTTP " + response.status);
    const d = await response.json();
    if (!d.gh_installed) {
      label.textContent = "Λείπει το gh";
      head.textContent = "GitHub: απαιτεί gh";
      message.textContent =
        "Εγκατάστησε GitHub CLI και επανεκκίνησε τον Python server. Χρειάζεσαι επίσης Git για PR.";
    } else if (d.authenticated) {
      label.textContent = "Συνδεδεμένος: @" + d.login;
      head.textContent = "GitHub: @" + d.login;
      message.textContent =
        (d.message || "") +
        (d.git_installed ? "" : " · Λείπει το Git για Pull Requests.");
    } else if (d.auth_running) {
      label.textContent = "Σύνδεση σε εξέλιξη";
      head.textContent = "GitHub: σύνδεση…";
      message.textContent = d.message || "Ολοκλήρωσε την έγκριση στο GitHub.";
    } else {
      label.textContent = "Δεν έχεις συνδεθεί";
      head.textContent = "GitHub: σύνδεση";
      message.textContent =
        d.message ||
        "Πάτα «Σύνδεση με GitHub». Θα ανοίξει το παράθυρο GitHub CLI.";
    }
    $("githubConnect").disabled =
      !d.gh_installed || d.authenticated || d.auth_running;
    $("githubSetupGit").disabled = !d.authenticated || !d.git_installed;
    if (d.auth_running && !githubPolling) {
      githubPolling = setInterval(async () => {
        const n = await refreshGithubStatus();
        if (!n || !n.auth_running) {
          clearInterval(githubPolling);
          githubPolling = null;
        }
      }, 2500);
    }
    return d;
  } catch (e) {
    label.textContent = "Σφάλμα ελέγχου";
    message.textContent = "Αδυναμία πρόσβασης στον τοπικό server: " + e.message;
    return null;
  }
}
$("githubConnect").onclick = async () => {
  if (!backend) {
    await refreshGithubStatus();
    return;
  }
  $("githubAuthResult").textContent = "Εκκίνηση σύνδεσης μέσω GitHub CLI…";
  try {
    const d = await serverRequest("/api/github/connect", {});
    $("githubAuthResult").textContent =
      d.message +
      (d.started ? " Ακολούθησε τις οδηγίες στο παράθυρο GitHub CLI." : "");
    await refreshGithubStatus();
  } catch (e) {
    $("githubAuthResult").textContent = e.message;
    await refreshGithubStatus();
  }
};
$("githubRefresh").onclick = () => refreshGithubStatus();
$("githubSetupGit").onclick = async () => {
  try {
    const d = await serverRequest("/api/github/setup-git", {});
    $("githubAuthResult").textContent = d.message;
    await refreshGithubStatus();
  } catch (e) {
    $("githubAuthResult").textContent = "Αποτυχία ρύθμισης Git: " + e.message;
  }
};
$("prPreflight").onclick = async () => {
  const m = metadata();
  try {
    $("prResult").textContent = "Έλεγχος δικαιωμάτων και αρχείων...";
    const d = await serverRequest("/api/pr/preflight", {
      metadata: m,
      text: $("source").value,
    });
    $("prResult").textContent = d.message || "Έτοιμο.";
    $("prConfirm").disabled = !d.ok;
    if (!d.ok) refreshGithubStatus();
  } catch (e) {
    $("prResult").textContent = "Αδυναμία ελέγχου: " + e.message;
    $("prConfirm").disabled = true;
  }
};
$("prConfirm").onclick = async () => {
  if (!confirm("Επιβεβαίωση: να δημιουργηθεί Draft PR στο GitHub;")) return;
  $("prConfirm").disabled = true;
  $("prResult").textContent = "Δημιουργία PR... μην πατήσεις δεύτερη φορά.";
  try {
    const d = await serverRequest("/api/pr/create", {
      metadata: metadata(),
      text: $("source").value,
      confirm: true,
    });
    let p = document.createElement("p");
    p.textContent = d.verified
      ? "Επαληθεύτηκε μέσω GitHub API."
      : "Η δημιουργία επέστρεψε URL, απαιτείται έλεγχος.";
    let a = document.createElement("a");
    a.textContent = "Άνοιγμα PR #" + (d.number || "") + " στο GitHub";
    a.href = d.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    $("prResult").replaceChildren(p, a);
    try {
      localStorage.setItem("shmmy-v9-lastPR", d.url);
      $("prLookup").value = d.url;
    } catch (e) {}
    const refresh = document.createElement("button");
    refresh.textContent = "Επανέλεγχος PR";
    refresh.onclick = async () => {
      try {
        const x = await serverRequest("/api/pr/verify", { url: d.url });
        p.textContent =
          "PR " +
          (x.state || "unknown") +
          " · " +
          (x.verified ? "επαληθευμένο" : "χωρίς επαλήθευση");
      } catch (e) {
        p.textContent = e.message;
      }
    };
    $("prResult").append(refresh);
    notify("Η διαδικασία PR ολοκληρώθηκε. Έλεγξε το link.");
  } catch (e) {
    $("prResult").textContent =
      "Δεν επιβεβαιώθηκε δημιουργία PR: " +
      e.message +
      " · Έλεγξε το GitHub πριν ξαναπατήσεις για αποφυγή διπλότυπου.";
  }
};
async function checkBackend() {
  try {
    const r = await fetch("/api/capabilities", { cache: "no-store" });
    if (!r.ok) throw Error("HTTP");
    const d = await r.json();
    backend = !!d.python;
    $("backendState").textContent = backend
      ? "Python mode · PyMuPDF PDF · " +
        (d.pdf_edit ? "PDF editing ενεργό" : "PyMuPDF μη διαθέσιμο")
      : "HTML-only";
    if (backend) refreshGithubStatus();
  } catch (e) {
    backend = false;
    $("backendState").textContent = "HTML-only · χωρίς Python";
  }
}
function loadSettings() {
  loadTemplateList();
  try {
    const s = JSON.parse(localStorage.getItem("shmmy-v9-settings") || "{}");
    for (const [id, val] of Object.entries(s)) {
      if (KEYS.includes(id) && $(id)) $(id).value = val;
    }
  } catch (e) {}
}
// PDF Editor v9.4: reliable preview + explicit anchored source mapping.
function pdfStatus(s) {
  $("pdfInfo").textContent = s;
}
function pdfSourceStatus(s) {
  $("pdfSourceStatus").textContent = s;
}
function resetPdfSource() {
  pdfSourceMap = [];
  pdfSourceSelected = null;
  pdfSourceSnapshot = "";
  pdfMode = "external";
  $("pdfSourceEdit").value = "";
  $("pdfSourceEdit").disabled = true;
  $("pdfSourceFind").disabled = true;
  $("pdfSourceApply").disabled = true;
  pdfSourceStatus(
    "Αυτό είναι ανεξάρτητο PDF. Δεν αντιστοιχίζεται αυτόματα στην πηγή Markdown.",
  );
}
function pushPdf(data) {
  if (historyIndex >= 0 && history[historyIndex] === data) return;
  history = history.slice(0, historyIndex + 1);
  history.push(data);
  if (history.length > 9) history.shift();
  historyIndex = history.length - 1;
  pdfData = data;
}
async function loadPdf(file) {
  if (!backend) {
    pdfStatus("Άνοιξε την εφαρμογή μέσω Python server.");
    return;
  }
  if (file.size > 18_000_000) {
    pdfStatus("Μέγιστο PDF 18 MB.");
    return;
  }
  resetPdfSource();
  pushPdf(await getBase64(file));
  pdfIndex = 0;
  await previewPdf();
}
$("openPDF").onchange = async (e) => {
  const f = e.target.files?.[0];
  if (f) await loadPdf(f);
  e.target.value = "";
};
async function generateMappedPDF(markdown = $("source").value) {
  if (!backend) {
    pdfStatus("Απαιτείται Python backend.");
    return false;
  }
  try {
    pdfStatus("Δημιουργία παραγόμενου PDF και χάρτη Markdown…");
    const m = metadata();
    // A generated draft preview does not imply that two independent reviewers
    // approved the exam. PR submission still validates the real metadata.
    m.solver ||= "προς συμπλήρωση";
    m.reviewer_a ||= "προς έλεγχο Α";
    m.reviewer_b ||= "προς έλεγχο Β";
    const d = await serverRequest("/api/export", {
      text: markdown,
      metadata: m,
      compile: true,
      source_map: true,
    });
    if (!d.pdf || !Array.isArray(d.source_map) || !d.source_map.length)
      throw Error("Δεν δημιουργήθηκαν θέσεις πηγής στο PDF.");
    pdfSourceMap = d.source_map;
    pdfSourceSnapshot = markdown;
    pdfSourceSelected = null;
    pdfMode = "generated";
    generatedPdf = d.pdf;
    sourceDirty = false;
    pushPdf(d.pdf);
    pdfIndex = Math.min(pdfIndex, 99);
    pdfIndex = 0;
    $("pdfSourceEdit").value = "";
    $("pdfSourceEdit").disabled = true;
    $("pdfSourceApply").disabled = true;
    $("pdfSourceFind").disabled = true;
    pdfSourceStatus(
      "Έτοιμο (PyMuPDF, χωρίς MiKTeX): " +
        pdfSourceMap.length +
        " συνδεδεμένα blocks. Κάνε κλικ σε κείμενο ή εξίσωση." +
        (d.warnings?.length ? " Προσοχή: " + d.warnings.join(" · ") : ""),
    );
    await previewPdf();
    return true;
  } catch (e) {
    pdfStatus("Δεν δημιουργήθηκε PDF: " + e.message);
    pdfSourceStatus("Αποτυχία: " + e.message);
    return false;
  }
}
$("pdfFromSource").onclick = () => generateMappedPDF();
function pdfSourceForPoint(page, y) {
  if (pdfMode !== "generated" || !pdfSourceMap.length) return null;
  // Cover is metadata, not editable Markdown. Choose closest preceding named PDF
  // destination. Anchors are embedded in LaTeX and survive pagination.
  const entries = pdfSourceMap.filter((x) => x.page === page && x.y <= y + 8);
  if (!entries.length) return null;
  const candidate = entries[entries.length - 1];
  // The page footer, large whitespace and other non-source content must not
  // silently map to a distant Markdown block.
  if (y - candidate.y > 115) return null;
  return candidate;
}
function selectSourceAtPdfY(y) {
  const match = pdfSourceForPoint(pdfIndex, y);
  if (!match) {
    pdfSourceStatus("Δεν υπάρχει αντίστοιχο Markdown εδώ (ίσως εξώφυλλο).");
    return;
  }
  if ($("source").value !== pdfSourceSnapshot) {
    pdfSourceStatus(
      "Το Markdown άλλαξε μετά την παραγωγή PDF. Πάτα «Άνοιγμα παραγόμενου PDF» για νέο χάρτη.",
    );
    return;
  }
  pdfSourceSelected = match;
  $("pdfSourceEdit").value = pdfSourceSnapshot.slice(match.start, match.end);
  $("pdfSourceEdit").disabled = false;
  $("pdfSourceApply").disabled = false;
  $("pdfSourceFind").disabled = false;
  pdfSourceStatus(
    "Επιλέχθηκε block " +
      match.id.replace("shmmy-source-", "") +
      " (χαρακτήρες " +
      match.start +
      "–" +
      match.end +
      "). Διόρθωσε το LaTeX/Markdown εδώ και πάτα αποθήκευση.",
  );
}
async function previewPdf() {
  if (!pdfData) return;
  try {
    const d = await serverRequest("/api/pdf/preview", {
      pdf: pdfData,
      page: pdfIndex,
    });
    if (!d.png || !d.png.startsWith("iVBOR"))
      throw Error("Ο server δεν επέστρεψε έγκυρη εικόνα PNG.");
    pdfTotal = d.pages;
    pdfSize = [d.width_pt, d.height_pt];
    const binary = atob(d.png),
      arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: "image/png" }));
    const image = $("pdfImage");
    image.onload = () => {
      if (pdfImageUrl && pdfImageUrl !== url) URL.revokeObjectURL(pdfImageUrl);
      pdfImageUrl = url;
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      image.hidden = true;
      $("pdfEmpty").hidden = false;
      pdfStatus(
        "Το PNG επέστρεψε από τον server, αλλά δεν εμφανίστηκε στον browser. Έλεγξε την Console (F12).",
      );
    };
    image.src = url;
    image.hidden = false;
    $("pdfEmpty").hidden = true;
    $("pdfPageNum").textContent = pdfIndex + 1 + " / " + pdfTotal;
    $("pdfRect").hidden = true;
    pdfSelected = null;
    pdfSelectedText = "";
    $("pdfBlocks").replaceChildren();
    for (const block of d.blocks || []) {
      if (!block.rect) continue;
      const span = document.createElement("div");
      span.className = "pdfblock";
      span.style.left = (100 * block.rect[0]) / pdfSize[0] + "%";
      span.style.top = (100 * block.rect[1]) / pdfSize[1] + "%";
      span.style.width =
        (100 * (block.rect[2] - block.rect[0])) / pdfSize[0] + "%";
      span.style.height =
        (100 * (block.rect[3] - block.rect[1])) / pdfSize[1] + "%";
      span.title = (block.text || "").slice(0, 110);
      span.onclick = (ev) => {
        ev.stopPropagation();
        pdfSelected = block.rect;
        pdfSelectedText = block.text || "";
        const r = image.getBoundingClientRect(),
          sx = r.width / pdfSize[0],
          sy = r.height / pdfSize[1];
        drawPdfRect([
          block.rect[0] * sx,
          block.rect[1] * sy,
          block.rect[2] * sx,
          block.rect[3] * sy,
        ]);
        $("pdfText").value = block.text || "";
        for (const prev of $("pdfBlocks").children)
          prev.classList.remove("active");
        span.classList.add("active");
        selectSourceAtPdfY(block.rect[1]);
        pdfStatus(
          "Επιλέχθηκε block PDF. " +
            (pdfMode === "generated"
              ? "Διόρθωσε την πηγή δεξιά."
              : "Για ανεξάρτητο PDF χρησιμοποίησε τις επιλογές παρακάτω."),
        );
      };
      $("pdfBlocks").append(span);
    }
    pdfStatus(
      "Σελίδα " +
        (pdfIndex + 1) +
        "/" +
        pdfTotal +
        " — " +
        (pdfMode === "generated"
          ? "κλικ σε κείμενο / εξίσωση → Markdown"
          : "επιλογή περιοχής για επεξεργασία PDF"),
    );
  } catch (e) {
    pdfStatus("Πρόβλημα PDF preview: " + e.message);
  }
}
function imageRelative(e) {
  const r = $("pdfImage").getBoundingClientRect();
  return [
    Math.max(0, Math.min(r.width, e.clientX - r.left)),
    Math.max(0, Math.min(r.height, e.clientY - r.top)),
  ];
}
function drawPdfRect(points) {
  const [x0, y0, x1, y1] = points,
    box = $("pdfRect");
  box.hidden = false;
  box.style.left = Math.min(x0, x1) + "px";
  box.style.top = Math.min(y0, y1) + "px";
  box.style.width = Math.abs(x1 - x0) + "px";
  box.style.height = Math.abs(y1 - y0) + "px";
}
$("pdfImage").onpointerdown = (e) => {
  e.preventDefault();
  pdfDrag = imageRelative(e);
  $("pdfImage").setPointerCapture(e.pointerId);
};
$("pdfImage").onpointermove = (e) => {
  if (pdfDrag) {
    const p = imageRelative(e);
    drawPdfRect([...pdfDrag, ...p]);
  }
};
$("pdfImage").onpointerup = (e) => {
  if (!pdfDrag) return;
  const p = imageRelative(e),
    r = $("pdfImage").getBoundingClientRect();
  drawPdfRect([...pdfDrag, ...p]);
  pdfSelectedText = "";
  pdfSelected = [
    (Math.min(pdfDrag[0], p[0]) / r.width) * pdfSize[0],
    (Math.min(pdfDrag[1], p[1]) / r.height) * pdfSize[1],
    (Math.max(pdfDrag[0], p[0]) / r.width) * pdfSize[0],
    (Math.max(pdfDrag[1], p[1]) / r.height) * pdfSize[1],
  ];
  pdfDrag = null;
  if (pdfMode === "generated") selectSourceAtPdfY(pdfSelected[1]);
  pdfStatus(
    "Ορίστηκε περιοχή PDF " + pdfSelected.map((x) => x.toFixed(1)).join(", "),
  );
};
$("pdfPrev").onclick = async () => {
  if (pdfIndex > 0) {
    pdfIndex--;
    await previewPdf();
  }
};
$("pdfNext").onclick = async () => {
  if (pdfIndex < pdfTotal - 1) {
    pdfIndex++;
    await previewPdf();
  }
};
$("pdfUndo").onclick = async () => {
  if (historyIndex > 0) {
    historyIndex--;
    pdfData = history[historyIndex];
    resetPdfSource();
    await previewPdf();
  }
};
$("pdfRedo").onclick = async () => {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    pdfData = history[historyIndex];
    resetPdfSource();
    await previewPdf();
  }
};
$("pdfSourceFind").onclick = () => {
  if (!pdfSourceSelected) return;
  const x = pdfSourceSelected,
    source = $("source");
  source.focus();
  source.setSelectionRange(x.start, x.end);
  source.scrollIntoView({ behavior: "smooth", block: "center" });
  pdfSourceStatus(
    "Το αντίστοιχο Markdown είναι επιλεγμένο στον αριστερό editor.",
  );
};
$("pdfSourceApply").onclick = async () => {
  const b = pdfSourceSelected;
  if (!b || pdfMode !== "generated") return;
  if ($("source").value !== pdfSourceSnapshot) {
    pdfSourceStatus(
      "Η πηγή έχει αλλάξει. Ξαναδημιούργησε το PDF για νέα αντιστοίχιση.",
    );
    return;
  }
  const old = pdfSourceSnapshot,
    next = old.slice(0, b.start) + $("pdfSourceEdit").value + old.slice(b.end),
    oldPage = pdfIndex;
  if (next === old) {
    pdfSourceStatus("Δεν έγινε αλλαγή στο block.");
    return;
  }
  $("pdfSourceApply").disabled = true;
  try {
    pdfSourceStatus("Δοκιμή νέου LaTeX και αναδημιουργία PDF…");
    const m = metadata();
    m.solver ||= "προς συμπλήρωση";
    m.reviewer_a ||= "προς έλεγχο Α";
    m.reviewer_b ||= "προς έλεγχο Β";
    const d = await serverRequest("/api/export", {
      text: next,
      metadata: m,
      compile: true,
      source_map: true,
    });
    if (!d.pdf || !d.source_map?.length)
      throw Error("Λείπει PDF ή source map.");
    // Atomically commit the Markdown change only AFTER valid PDF production.
    $("source").value = next;
    pdfSourceSnapshot = next;
    pdfSourceMap = d.source_map;
    pdfMode = "generated";
    pdfSourceSelected = null;
    generatedPdf = d.pdf;
    pushPdf(d.pdf);
    pdfIndex = Math.min(oldPage, d.source_map.at(-1).page);
    $("pdfSourceEdit").value = "";
    $("pdfSourceEdit").disabled = true;
    $("pdfSourceFind").disabled = true;
    sourceDirty = false;
    await render();
    await previewPdf();
    pdfSourceStatus(
      "Η αλλαγή αποθηκεύτηκε στο Markdown και δημιουργήθηκε νέο PDF. Έλεγξε τη σελίδα.",
    );
  } catch (e) {
    pdfSourceStatus(
      "Δεν άλλαξε η πηγή — αποτυχία επαναμεταγλώττισης: " + e.message,
    );
    $("pdfSourceApply").disabled = false;
  }
};
$("pdfToSource").onclick = () => {
  if (pdfMode === "generated" && pdfSourceSelected) {
    $("pdfSourceFind").click();
    return;
  }
  pdfStatus(
    "Η σύνδεση PDF → Markdown υποστηρίζεται μόνο για PDF που παράχθηκε από το Studio και φέρει source map.",
  );
};
$("pdfExport").onclick = () => {
  if (pdfData) downloadB64(pdfData, "edited_lysi.pdf", "application/pdf");
  else pdfStatus("Δεν έχει ανοιχτεί PDF.");
};
$("pdfApply").onclick = async () => {
  if (!pdfData || !pdfSelected) {
    pdfStatus("Πρώτα άνοιξε PDF και επίλεξε περιοχή.");
    return;
  }
  try {
    const op = $("pdfOp").value,
      change = {
        pdf: pdfData,
        page: pdfIndex,
        rect: pdfSelected,
        operation: op,
        text: $("pdfText").value,
        font_size: Number($("pdfFontSize").value),
      };
    if (op === "image") {
      const f = $("pdfImageFile").files[0];
      if (!f) throw Error("Δώσε PNG ή JPG εικόνα.");
      change.image = await getBase64(f);
    }
    if (
      ["replace", "redact", "image"].includes(op) &&
      !confirm(
        "Προσοχή: απευθείας PDF edit, χωρίς αλλαγή Markdown. Να συνεχίσω;",
      )
    )
      return;
    const d = await serverRequest("/api/pdf/edit", change);
    resetPdfSource();
    pushPdf(d.pdf);
    await previewPdf();
    pdfStatus("Αποθηκεύτηκε απευθείας στο PDF, όχι στο Markdown.");
  } catch (e) {
    pdfStatus("Αποτυχία: " + e.message);
  }
};
function validPrUrl(url) {
  const m = String(url || "").match(
    /^https:\/\/github\.com\/ece-ntua-exam-solutions\/Problems-Solutions\/pull\/(\d+)\/?$/,
  );
  if (!m) throw Error("Δώσε PR URL από το Problems-Solutions repo.");
  return m[1];
}
async function lookupPR() {
  const target = $("prLookupResult");
  try {
    const url = $("prLookup").value.trim(),
      num = validPrUrl(url);
    target.textContent = "Ανάκτηση...";
    let d;
    try {
      const r = await fetch(
        "https://api.github.com/repos/ece-ntua-exam-solutions/Problems-Solutions/pulls/" +
          num,
        { headers: { Accept: "application/vnd.github+json" } },
      );
      if (!r.ok) throw Error("HTTP " + r.status);
      const x = await r.json();
      d = {
        number: x.number,
        state: x.state,
        draft: x.draft,
        title: x.title,
        url: x.html_url,
      };
    } catch (e) {
      if (!backend) throw e;
      const x = await serverRequest("/api/pr/verify", { url });
      d = {
        number: x.number,
        state: x.state,
        draft: null,
        title: "",
        url: x.url,
      };
    }
    const line = document.createElement("p");
    line.textContent =
      "PR #" +
      d.number +
      " · " +
      d.state +
      (d.draft ? " (draft)" : "") +
      (d.title ? " · " + d.title : "");
    const a = document.createElement("a");
    a.href = d.url;
    a.textContent = "Άνοιγμα PR στο GitHub";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    target.replaceChildren(line, a);
    localStorage.setItem("shmmy-v9-lastPR", d.url);
  } catch (e) {
    target.textContent = "Αποτυχία ανάκτησης: " + e.message;
  }
}
$("prLookupBtn").onclick = lookupPR;
try {
  $("prLookup").value = localStorage.getItem("shmmy-v9-lastPR") || "";
} catch (e) {}
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    $("btnSave").click();
  }
});
(async () => {
  loadSettings();
  try {
    const saved = localStorage.getItem("studio-source-draft");
    if (saved !== null) $("source").value = saved;
  } catch (_) {}
  catalog = cachedCatalog();
  refreshCourses(false);
  await checkBackend();
  await render();
})();

// v9.5: scoped catalogue; fuzzy suggestions never silently rewrite the course.
function searchNorm(s) {
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("el")
    .replace(/ς/g, "σ")
    .replace(/[_\s-]+/g, " ")
    .trim();
}
function scopedCourses() {
  return [
    ...new Set(
      catalog
        .filter((p) => {
          const x = p.split("/");
          return (
            x[2] === $("year").value &&
            x[0].match(/^\d+/)?.[0] === $("semester").value
          );
        })
        .map((p) => p.split("/")[1].replaceAll("_", " ")),
    ),
  ].sort((a, b) => a.localeCompare(b, "el"));
}
function refreshCourses(reset = false) {
  const names = scopedCourses();
  if (
    reset &&
    catalog.length &&
    !names.some((n) => searchNorm(n) === searchNorm($("course").value))
  ) {
    $("course").value = "";
    schedule();
  }
  showCourseSuggestions();
  updateRepoPaths();
}
$("course").addEventListener("focus", showCourseSuggestions);

function showCourseSuggestions() {
  if (window.StudioUI) window.StudioUI.catalogChanged();
}

for (const id of ["repo", "branch"])
  $(id).addEventListener("change", () => {
    catalogRequest++;
    catalogController?.abort();
    catalog = cachedCatalog();
    refreshCourses(false);
    updateRepoPaths();
    $("refreshRepo").disabled = false;
  });
