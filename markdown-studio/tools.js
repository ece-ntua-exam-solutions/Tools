"use strict";
(function () {
  const E = (id) => document.getElementById(id),
    U = window.StudioUI,
    S = window.StudioSearch;
  const snippets = [
    {
      name: "Κλάσμα · fraction",
      code: String.raw`I = \frac{V}{R}`,
      keys: "κλασμα ρευμα ohm",
    },
    {
      name: "Δύναμη και δείκτης",
      code: String.raw`x_{n+1} = a x_n^2`,
      keys: "power index εκθετης",
    },
    {
      name: "Ρίζα",
      code: String.raw`x = \sqrt{a^2+b^2}`,
      keys: "root τετραγωνικη",
    },
    {
      name: "Ολοκλήρωμα",
      code: String.raw`E = \int_{0}^{T} P(t)\,\mathrm{d}t`,
      keys: "integral ενεργεια",
    },
    {
      name: "Άθροισμα",
      code: String.raw`x_{\mathrm{rms}} = \sqrt{\sum_{k=1}^{N} X_k^2}`,
      keys: "sum rms αρμονικες",
    },
    {
      name: "Παράγωγος",
      code: String.raw`v(t) = L\frac{\mathrm{d}i(t)}{\mathrm{d}t}`,
      keys: "derivative παραγωγος",
    },
    {
      name: "Μερική παράγωγος",
      code: String.raw`\nabla^2 V = \frac{\partial^2 V}{\partial x^2}+\frac{\partial^2 V}{\partial y^2}`,
      keys: "partial πεδια",
    },
    {
      name: "Σύστημα εξισώσεων",
      code: String.raw`\begin{cases}2x+y=5\\x-y=1\end{cases}`,
      keys: "system συστημα cases",
    },
    {
      name: "Στοίχιση εξισώσεων",
      code: String.raw`\begin{aligned}V &= RI\\P &= VI = RI^2\end{aligned}`,
      keys: "align aligned πολυγραμμικο",
    },
    {
      name: "Πίνακας 2×2",
      code: String.raw`A = \begin{bmatrix}a & b\\c & d\end{bmatrix}`,
      keys: "matrix πινακας",
    },
    {
      name: "Διάνυσμα",
      code: String.raw`\mathbf{x} = \begin{bmatrix}x_1\\x_2\\x_3\end{bmatrix}`,
      keys: "vector διανυσμα",
    },
    {
      name: "Όριο",
      code: String.raw`\lim_{x\to 0}\frac{\sin x}{x}=1`,
      keys: "limit οριο",
    },
    {
      name: "Μιγαδική αντίσταση",
      code: String.raw`Z = R+j\omega L = |Z|e^{j\varphi}`,
      keys: "impedance ηλεκτρολογια μιγαδικος",
    },
    {
      name: "Τριφασική ισχύς",
      code: String.raw`P = \sqrt{3}\,V_L I_L\cos\varphi`,
      keys: "three phase τριφασικο",
    },
    {
      name: "Μετασχηματισμός Fourier",
      code: String.raw`X(f)=\int_{-\infty}^{\infty}x(t)e^{-j2\pi ft}\,\mathrm{d}t`,
      keys: "fft φουριε",
    },
    {
      name: "Μονάδες SI",
      code: String.raw`R = 20\,\Omega,\qquad I=5\,\mathrm{A}`,
      keys: "units μοναδες",
    },
    {
      name: "Πιθανότητα",
      code: String.raw`P(A\mid B)=\frac{P(B\mid A)P(A)}{P(B)}`,
      keys: "probability bayes",
    },
    {
      name: "Συνάρτηση κατά τμήματα",
      code: String.raw`f(x)=\begin{cases}x^2,&x\geq 0\\-x,&x<0\end{cases}`,
      keys: "piecewise τμηματα",
    },
  ];
  E("toolsPanel").innerHTML =
    `<div class="sectionHeading"><h2>Εργαλεία LaTeX</h2><span>Μικρά ανεξάρτητα εργαλεία, έτοιμα για copy/paste.</span></div><div class="report-query"><input id="toolSearch" aria-label="Αναζήτηση εργαλείων" placeholder="Αναζήτηση εργαλείου…"></div><div id="toolCards" class="tool-grid"></div>`;
  const cards = [
    {
      id: "equations",
      title: "Εξισώσεις",
      description: "Έτοιμα blocks, συστήματα και ζωντανή προεπισκόπηση.",
      route: "/tools/equations",
      keywords: "math συστημα ολοκληρωμα",
    },
    {
      id: "tables",
      title: "Πίνακες",
      description: "Συμπλήρωσε κελιά. Πάρε Markdown ή LaTeX.",
      route: "/tools/tables",
      keywords: "table matrix πινακας",
    },
    {
      id: "ocr",
      title: "Εικόνα → LaTeX",
      description: "Εικόνα μίας εξίσωσης, αναγνώριση και διόρθωση.",
      route: "/tools/image-latex",
      keywords: "image φωτογραφια ocr",
    },
  ];
  function renderCards(q = "") {
    E("toolCards").replaceChildren();
    for (const o of S.rank(
      q,
      S.index(cards.map((c) => ({ ...c, value: c.title, label: c.title }))),
    )) {
      const c = document.createElement("article");
      c.className = "tool-card";
      const h = document.createElement("h3");
      h.textContent = o.title;
      const p = document.createElement("p");
      p.textContent = o.description;
      const row = document.createElement("div");
      row.className = "row";
      const a = document.createElement("a");
      a.href = "#" + o.route;
      a.textContent = "Άνοιγμα";
      const b = document.createElement("a");
      b.href = U.deepLink(o.route, true);
      b.target = "_blank";
      b.rel = "noopener";
      b.textContent = "Νέο παράθυρο ↗";
      row.append(a, b, U.helpButton(o.id));
      c.append(h, p, row);
      E("toolCards").append(c);
    }
  }
  E("equationsPanel").innerHTML =
    `<div class="sectionHeading"><h2>Εξισώσεις και συστήματα</h2><span>LaTeX με προεπισκόπηση · χωρίς compiler.</span></div><div class="report-query"><input id="equationSearch" placeholder="Αναζήτηση block: κλάσμα, σύστημα, ολοκλήρωμα…" aria-label="Αναζήτηση blocks εξισώσεων"></div><div id="equationSnippets" class="snippet-list"></div><div class="tool-layout"><div><label for="equationCode">LaTeX</label><textarea id="equationCode" spellcheck="false" rows="10"></textarea><div class="row"><label>Αντιγραφή ως <select id="equationMode"><option value="display">Markdown · ξεχωριστή εξίσωση</option><option value="inline">Markdown · μέσα στο κείμενο</option><option value="latex">Σκέτο LaTeX</option></select></label></div><div class="row"><button id="equationCopy" class="strong">Αντιγραφή</button><button id="equationInsert">Εισαγωγή στο Studio</button><button id="equationDownload">Λήψη .tex</button></div></div><div><p class="subtext">Ζωντανή προεπισκόπηση</p><div id="equationPreview" class="math-preview"></div><p id="equationStatus" class="tool-status" role="status"></p><details><summary>Συμβουλή για την εξαγωγή PDF</summary><p class="subtext">Η προεπισκόπηση MathJax υποστηρίζει περισσότερες εντολές από το βασικό Python PDF. Για σύνθετα blocks έλεγξε την τελική εξαγωγή· το εργαλείο δεν επιβεβαιώνει μαθηματική ορθότητα.</p></details></div></div>`;
  E("equationCode").value = String.raw`I = \frac{V}{R}`;
  try {
    E("equationCode").value =
      localStorage.getItem("studio-equation-draft") || E("equationCode").value;
  } catch (_) {}
  function blockCode(raw, mode) {
    return mode === "latex"
      ? raw
      : mode === "inline"
        ? "\\(" + raw + "\\)"
        : "\n\\[\n" + raw + "\n\\]\n";
  }
  let mathQueue = Promise.resolve(),
    mathVersion = {};
  function preview(id, code, status) {
    const version = (mathVersion[id] || 0) + 1;
    mathVersion[id] = version;
    mathQueue = mathQueue
      .catch(() => {})
      .then(async () => {
        if (version !== mathVersion[id]) return;
        const e = E(id);
        try {
          if (window.MathJax?.startup?.promise) await MathJax.startup.promise;
          if (!window.MathJax?.typesetPromise)
            throw Error(
              "Η MathJax δεν φορτώθηκε. Ο κώδικας παραμένει διαθέσιμος για αντιγραφή.",
            );
          MathJax.typesetClear?.([e]);
          e.textContent = "\\[" + code.slice(0, 25000) + "\\]";
          await MathJax.typesetPromise([e]);
          if (status)
            E(status).textContent = e.querySelector(
              "mjx-merror,[data-mjx-error]",
            )
              ? "Έλεγξε τη σύνταξη LaTeX."
              : "Προεπισκόπηση έτοιμη.";
        } catch (err) {
          e.textContent = code;
          if (status) E(status).textContent = err.message;
        }
      });
  }
  let eqTimer;
  function updateEquation() {
    const code = E("equationCode").value;
    preview("equationPreview", code, "equationStatus");
    try {
      localStorage.setItem("studio-equation-draft", code.slice(0, 100000));
    } catch (_) {}
  }
  E("equationCode").oninput = () => {
    clearTimeout(eqTimer);
    eqTimer = setTimeout(updateEquation, 240);
  };
  function setSnippet(x) {
    const s = snippets.find((s) => s.name === x);
    if (!s) return;
    E("equationCode").value = s.code;
    updateEquation();
  }
  function renderSnippets(q = "") {
    E("equationSnippets").replaceChildren();
    for (const x of S.rank(
      q,
      S.index(
        snippets.map((o) => ({
          value: o.name,
          label: o.name,
          keywords: o.keys,
        })),
      ),
      8,
    )) {
      const b = document.createElement("button");
      b.textContent = x.label;
      b.onclick = () => setSnippet(x.value);
      E("equationSnippets").append(b);
    }
  }
  E("equationCopy").onclick = async () => {
    try {
      await U.copy(blockCode(E("equationCode").value, E("equationMode").value));
      E("equationStatus").textContent = "Αντιγράφηκε.";
    } catch (e) {
      E("equationStatus").textContent = e.message;
    }
  };
  E("equationInsert").onclick = () =>
    U.deliver(blockCode(E("equationCode").value, E("equationMode").value));
  E("equationDownload").onclick = () =>
    download(
      E("equationCode").value,
      "equation.tex",
      "text/x-tex;charset=utf-8",
    );
  E("tablesPanel").innerHTML =
    `<div class="sectionHeading"><h2>Δημιουργία πίνακα</h2><span>Συμπλήρωσε κελιά και πάρε έτοιμο κώδικα.</span></div><div class="row"><label>Γραμμές <input id="tableRows" type="number" value="3" min="1" max="20" style="width:70px"></label><label>Στήλες <input id="tableCols" type="number" value="3" min="1" max="12" style="width:70px"></label><button id="tableResize">Ενημέρωση μεγέθους</button><label>Μορφή <select id="tableFormat"><option value="markdown">Markdown</option><option value="tabular">LaTeX tabular</option><option value="array">LaTeX array</option><option value="matrix">LaTeX bmatrix</option></select></label><label><input id="tableHeader" type="checkbox" checked> Πρώτη γραμμή: κεφαλίδα</label><label>Στοίχιση <select id="tableAlign"><option value="l">Αριστερά</option><option value="c">Κέντρο</option><option value="r">Δεξιά</option></select></label></div><div class="table-scroll"><table id="tableGrid" class="table-grid" aria-label="Κελιά πίνακα"></table></div><details><summary>Εισαγωγή από Excel / TSV</summary><textarea id="tablePaste" rows="3" aria-label="Δεδομένα TSV" placeholder="Επικόλλησε γραμμές με στήλες χωρισμένες με Tab"></textarea><button id="tableImport">Γέμισμα πίνακα</button></details><div class="tool-layout"><div><label for="tableOutput">Έτοιμος κώδικας</label><textarea id="tableOutput" rows="10" spellcheck="false" readonly></textarea><div class="row"><button id="tableCopy" class="strong">Αντιγραφή</button><button id="tableInsert">Εισαγωγή στο Studio</button><button id="tableDownload">Λήψη αρχείου</button></div></div><div><p class="subtext">Προεπισκόπηση περιεχομένου</p><div id="tablePreview" class="table-scroll"></div><p id="tableStatus" class="tool-status" role="status"></p></div></div>`;
  let cells = [
    ["Μέγεθος", "Τιμή", "Μονάδα"],
    ["Τάση", "100", "V"],
    ["Ρεύμα", "5", "A"],
  ];
  function drawGrid() {
    const t = E("tableGrid");
    t.replaceChildren();
    for (let r = 0; r < cells.length; r++) {
      const tr = document.createElement("tr");
      for (let c = 0; c < cells[r].length; c++) {
        const td = document.createElement("td"),
          i = document.createElement("input");
        i.value = cells[r][c];
        i.setAttribute(
          "aria-label",
          "Γραμμή " + (r + 1) + ", στήλη " + (c + 1),
        );
        i.oninput = () => {
          cells[r][c] = i.value;
          updateTable();
        };
        td.append(i);
        tr.append(td);
      }
      t.append(tr);
    }
    updateTable();
  }
  function texCell(s) {
    return String(s)
      .split(/(\$[^$]*\$)/g)
      .map((v, i) =>
        i % 2
          ? v
          : v.replace(
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
            ),
      )
      .join("");
  }
  function updateTable() {
    const format = E("tableFormat").value,
      a = E("tableAlign").value,
      n = cells[0].length,
      header = E("tableHeader").checked;
    let code = "";
    if (format === "markdown") {
      const rows = cells.map(
        (r) =>
          "| " +
          r
            .map((s) => s.replace(/\|/g, "\\|").replace(/\n/g, " "))
            .join(" | ") +
          " |",
      );
      const sep =
        "| " +
        Array(n)
          .fill(a === "c" ? ":---:" : a === "r" ? "---:" : ":---")
          .join(" | ") +
        " |";
      if (header) rows.splice(1, 0, sep);
      else rows.unshift("| " + Array(n).fill(" ").join(" | ") + " |", sep);
      code = rows.join("\n");
    } else {
      const env = format === "matrix" ? "bmatrix" : format;
      const math = format !== "tabular";
      const body = cells
        .map(
          (r, i) =>
            r.map((x) => (math ? x : texCell(x))).join(" & ") +
            " \\\\" +
            (header && i === 0 && format === "tabular" ? " \\hline" : ""),
        )
        .join("\n");
      code =
        "\\begin{" +
        env +
        "}" +
        (format === "tabular" || format === "array"
          ? "{" + a.repeat(n) + "}"
          : "") +
        "\n" +
        body +
        "\n\\end{" +
        env +
        "}";
    }
    E("tableOutput").value = code;
    const p = E("tablePreview");
    p.replaceChildren();
    const t = document.createElement("table");
    t.className = "table-grid";
    for (const [r, row] of cells.entries()) {
      const tr = document.createElement("tr");
      for (const v of row) {
        const td = document.createElement(header && r === 0 ? "th" : "td");
        td.textContent = v;
        td.style.textAlign = { l: "left", c: "center", r: "right" }[a];
        tr.append(td);
      }
      t.append(tr);
    }
    p.append(t);
    E("tableStatus").textContent =
      format === "tabular"
        ? "Πλήρης LaTeX κώδικας· η προεπισκόπηση δείχνει το περιεχόμενο."
        : format === "markdown"
          ? "Έτοιμο για τον Markdown editor."
          : "Τα κελιά θεωρούνται μαθηματικές εκφράσεις LaTeX.";
  }
  E("tableResize").onclick = () => {
    if (!E("tableRows").reportValidity() || !E("tableCols").reportValidity())
      return;
    const r = +E("tableRows").value,
      c = +E("tableCols").value;
    cells = Array.from({ length: r }, (_, i) =>
      Array.from({ length: c }, (_, j) => cells[i]?.[j] || ""),
    );
    drawGrid();
  };
  for (const id of ["tableFormat", "tableAlign", "tableHeader"])
    E(id).onchange = updateTable;
  E("tableImport").onclick = () => {
    const rows = E("tablePaste")
      .value.replace(/\r/g, "")
      .trimEnd()
      .split("\n")
      .map((x) => x.split("\t"));
    if (rows.length > 20 || rows.some((r) => r.length > 12)) {
      E("tableStatus").textContent = "Έως 20 γραμμές και 12 στήλες.";
      return;
    }
    const n = Math.max(...rows.map((r) => r.length));
    cells = rows.map((r) => Array.from({ length: n }, (_, i) => r[i] || ""));
    E("tableRows").value = cells.length;
    E("tableCols").value = n;
    drawGrid();
  };
  E("tableCopy").onclick = () =>
    U.copy(E("tableOutput").value)
      .then(() => (E("tableStatus").textContent = "Αντιγράφηκε."))
      .catch((e) => (E("tableStatus").textContent = e.message));
  E("tableInsert").onclick = () =>
    U.deliver(
      E("tableFormat").value === "array" || E("tableFormat").value === "matrix"
        ? blockCode(E("tableOutput").value, "display")
        : "\n" + E("tableOutput").value + "\n",
    );
  E("tableDownload").onclick = () =>
    download(
      E("tableOutput").value,
      E("tableFormat").value === "markdown" ? "table.md" : "table.tex",
    );
  window.StudioMath = { preview, blockCode };
  document.addEventListener("DOMContentLoaded", () => {
    U.registerCombo(
      S.combo(E("toolSearch"), {
        items: () =>
          cards.map((c) => ({
            value: c.title,
            label: c.title,
            keywords: c.keywords,
            route: c.route,
          })),
        onSelect: (o) => U.navigate(o.route),
        onQuery: (q) => renderCards(q),
      }),
    );
    U.registerCombo(
      S.combo(E("equationSearch"), {
        items: () =>
          snippets.map((o) => ({
            value: o.name,
            label: o.name,
            keywords: o.keys,
          })),
        onSelect: (o) => setSnippet(o.value),
        onQuery: (q) => renderSnippets(q),
      }),
    );
    renderCards();
    renderSnippets();
    drawGrid();
  });
  window.addEventListener("studio:route", (e) => {
    if (e.detail.route === "/tools/equations") updateEquation();
  });
})();
