"use strict";
(function () {
  const E = (id) => document.getElementById(id),
    U = window.StudioUI,
    M = window.StudioMath;
  E("ocrPanel").innerHTML =
    `<div class="sectionHeading"><h2>Εικόνα εξίσωσης → LaTeX</h2><span>Επιλογή περιοχής · αναγνώριση ανά γραμμή · έλεγχος αποτελέσματος.</span></div><div class="tool-layout"><div><div id="ocrDrop" class="drop-zone" tabindex="0" role="button" aria-label="Επιλογή εικόνας εξίσωσης">Επίλεξε PNG/JPEG/WebP<br><small>ή σύρε εικόνα / επικόλλησε με Ctrl+V</small></div><input id="ocrFile" type="file" accept="image/png,image/jpeg,image/webp" hidden>
<div id="ocrImageWrap" class="ocr-image-wrap" hidden><img id="ocrImage" alt="Εικόνα προς αναγνώριση· σύρε για επιλογή περιοχής" draggable="false"><div id="ocrRowsOverlay"></div><div id="ocrSelection" hidden></div></div><p id="ocrCropHint" class="subtext">Έως 8 MB. Μπορείς να σύρεις ορθογώνιο πάνω στην εικόνα για επιλογή περιοχής.</p>
<div class="row"><label>Διάταξη<select id="ocrLayout"><option value="auto">Αυτόματα · ανά γραμμή</option><option value="single">Μία εξίσωση / ενιαίο block</option><option value="lines">Πολλές γραμμές λύσης</option></select></label><button id="ocrAnalyse" disabled>Εντοπισμός γραμμών</button><button id="ocrResetCrop" disabled>Όλη η εικόνα</button></div><div id="ocrLineSelection" class="ocr-line-selection"></div>
<details><summary>Ρυθμίσεις εντοπισμού και μοντέλου</summary><label>Ένωση κοντινών ζωνών (pixel)<input id="ocrLineGap" type="number" min="1" max="40" placeholder="Αυτόματο"><small>Μεγαλύτερη τιμή ενώνει ζώνες. Κράτησε αριθμητή/παρονομαστή στο ίδιο πλαίσιο.</small></label><label><input id="ocrResize" type="checkbox" checked> Αυτόματη κλίμακα pix2tex</label><label><input id="ocrRetry" type="checkbox" checked> Δεύτερη απόπειρα χωρίς/με κλίμακα για ύποπτο αποτέλεσμα</label></details>
<label><input id="ocrAllowModel" type="checkbox"> Επιτρέπω φόρτωση μοντέλου και πρώτη λήψη βαρών, αν λείπουν.</label><div class="row"><button id="ocrConvert" class="strong" disabled>Αναγνώριση επιλεγμένων γραμμών</button><button id="ocrCheck">Έλεγχος εγκατάστασης</button></div><p id="ocrStatus" class="tool-status" role="status">Ο εντοπισμός περιοχών δεν απαιτεί μοντέλο. Η αναγνώριση απαιτεί προαιρετικό pix2tex.</p><details id="ocrSetup"><summary>Εγκατάσταση προαιρετικής αναγνώρισης</summary><p class="subtext">Στο environment του Studio: <code>python -m pip install -r requirements-ocr.txt</code>. Επανεκκίνησε τον server. Το μοντέλο φορτώνεται μόνο όταν πατήσεις αναγνώριση. Η εικόνα αναλύεται τοπικά.</p></details></div>
<div><label for="ocrCode">LaTeX — επεξεργάσιμο</label><textarea id="ocrCode" rows="9" spellcheck="false" placeholder="Το αποτέλεσμα θα εμφανιστεί εδώ"></textarea><div id="ocrQuality" class="warning" hidden role="alert"></div><label id="ocrAckLabel" hidden><input id="ocrAck" type="checkbox"> Έλεγξα το ύποπτο αποτέλεσμα και έκανα τις απαραίτητες διορθώσεις.</label><div id="ocrPreview" class="math-preview"></div><div class="row"><button id="ocrCopy" disabled>Αντιγραφή LaTeX</button><button id="ocrCopyMarkdown" disabled>Αντιγραφή Markdown</button><button id="ocrInsert" disabled>Εισαγωγή στο Studio</button></div><details id="ocrLineResults" hidden><summary>Αποτελέσματα και απόπειρες ανά γραμμή</summary><div id="ocrAlternatives"></div></details><p class="subtext">Η απουσία προειδοποίησης δεν επιβεβαιώνει ορθότητα. Έλεγξε κάθε γραμμή, δείκτη, πρόσημο και παρονομαστή. Τα πλαίσια είναι βοηθητικός εντοπισμός διάταξης.</p></div></div>`;
  let imageData = null,
    imageURL = null,
    busy = false,
    analysing = false,
    generation = 0,
    crop = null,
    plan = null,
    selected = new Set(),
    suspect = false,
    resultLines = [],
    drag = null;
  function outputChanged() {
    const code = E("ocrCode").value,
      blocked = suspect && !E("ocrAck").checked;
    for (const id of ["ocrCopy", "ocrCopyMarkdown", "ocrInsert"])
      E(id).disabled = !code.trim() || blocked;
    M.preview("ocrPreview", code);
  }
  function clearOutput() {
    E("ocrCode").value = "";
    E("ocrAck").checked = false;
    suspect = false;
    resultLines = [];
    E("ocrQuality").hidden =
      E("ocrAckLabel").hidden =
      E("ocrLineResults").hidden =
        true;
    outputChanged();
  }
  function payload() {
    return {
      image: imageData,
      crop,
      layout: E("ocrLayout").value,
      line_gap: E("ocrLineGap").value,
    };
  }
  function controls() {
    E("ocrConvert").disabled = !imageData || busy || analysing;
    E("ocrAnalyse").disabled = !imageData || busy || analysing;
    E("ocrResetCrop").disabled = !imageData || busy || analysing;
    for (const id of ["ocrLayout", "ocrLineGap", "ocrResize", "ocrRetry"])
      E(id).disabled = busy || analysing;
  }
  function rectStyle(el, r) {
    const im = E("ocrImage");
    el.style.left = r[0] * im.clientWidth + "px";
    el.style.top = r[1] * im.clientHeight + "px";
    el.style.width = (r[2] - r[0]) * im.clientWidth + "px";
    el.style.height = (r[3] - r[1]) * im.clientHeight + "px";
  }
  function draw() {
    E("ocrRowsOverlay").replaceChildren();
    if (!E("ocrImage").clientWidth) return;
    if (plan)
      for (const r of plan.regions) {
        const b = document.createElement("div");
        b.className =
          "ocr-region" + (selected.has(r.index) ? "" : " unchecked");
        rectStyle(b, r.rect);
        const t = document.createElement("span");
        t.textContent = r.index + 1;
        b.append(t);
        E("ocrRowsOverlay").append(b);
      }
    E("ocrSelection").hidden = !crop;
    if (crop) rectStyle(E("ocrSelection"), crop);
  }
  function showPlan() {
    E("ocrLineSelection").replaceChildren();
    if (plan) {
      for (const r of plan.regions) {
        const l = document.createElement("label"),
          c = document.createElement("input");
        c.type = "checkbox";
        c.checked = selected.has(r.index);
        c.onchange = () => {
          if (busy) {
            c.checked = selected.has(r.index);
            return;
          }
          if (c.checked) selected.add(r.index);
          else selected.delete(r.index);
          clearOutput();
          draw();
        };
        l.append(c, document.createTextNode("Γραμμή " + (r.index + 1)));
        E("ocrLineSelection").append(l);
      }
    }
    draw();
  }
  async function analyzeImage() {
    if (!imageData || busy || analysing) return;
    const id = generation;
    analysing = true;
    controls();
    E("ocrStatus").textContent = "Εντοπισμός περιοχών…";
    try {
      const d = await serverRequest("/api/ocr/analyze", payload());
      if (id !== generation) return;
      plan = d;
      selected = new Set(d.regions.map((r) => r.index));
      showPlan();
      E("ocrStatus").textContent =
        d.line_count +
        " περιοχές. Έλεγξε ότι κάθε πλαίσιο περιέχει ολόκληρη εξίσωση.";
      E("ocrCropHint").textContent =
        (crop ? "Επιλεγμένη περιοχή. " : "Όλη η εικόνα. ") +
        (d.line_count > 1
          ? "Εντοπίστηκαν πολλές γραμμές· αναγνωρίζονται χωριστά."
          : "Μπορείς να σύρεις ορθογώνιο για μικρότερη περιοχή.");
    } catch (e) {
      if (id === generation) E("ocrStatus").textContent = e.message;
    } finally {
      analysing = false;
      controls();
    }
  }
  async function setImage(f) {
    if (!f) return;
    if (busy || analysing) {
      E("ocrStatus").textContent =
        "Περίμενε να ολοκληρωθεί η τρέχουσα εργασία.";
      return;
    }
    if (
      f.size > 8 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp"].includes(f.type)
    ) {
      E("ocrStatus").textContent = "Επίλεξε PNG/JPEG/WebP έως 8 MB.";
      return;
    }
    const id = ++generation;
    try {
      const raw = await getBase64(f);
      if (id !== generation) return;
      imageData = raw;
      crop = null;
      plan = null;
      selected.clear();
      clearOutput();
      showPlan();
      if (imageURL) URL.revokeObjectURL(imageURL);
      imageURL = URL.createObjectURL(f);
      E("ocrImage").onload = () => {
        draw();
        analyzeImage();
      };
      E("ocrImage").onerror = () => {
        imageData = null;
        E("ocrImageWrap").hidden = true;
        E("ocrStatus").textContent =
          "Ο browser δεν διάβασε την εικόνα. Επίλεξε έγκυρο PNG/JPEG/WebP.";
        controls();
      };
      E("ocrImage").src = imageURL;
      E("ocrImageWrap").hidden = false;
      controls();
    } catch (e) {
      E("ocrStatus").textContent = e.message;
    }
  }
  E("ocrDrop").onclick = () => E("ocrFile").click();
  E("ocrDrop").onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      E("ocrFile").click();
    }
  };
  E("ocrFile").onchange = (e) => {
    setImage(e.target.files[0]);
    e.target.value = "";
  };
  for (const event of ["dragover", "dragleave", "drop"])
    E("ocrDrop").addEventListener(event, (e) => {
      e.preventDefault();
      E("ocrDrop").classList.toggle("drag", event === "dragover");
      if (event === "drop") setImage(e.dataTransfer.files[0]);
    });
  document.addEventListener("paste", (e) => {
    if (!location.hash.startsWith("#/tools/image-latex")) return;
    const f = [...e.clipboardData.items]
      .find((x) => x.type.startsWith("image/"))
      ?.getAsFile();
    if (f) {
      e.preventDefault();
      setImage(f);
    }
  });
  function point(e) {
    const r = E("ocrImage").getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    ];
  }
  E("ocrImageWrap").onpointerdown = (e) => {
    if (busy || analysing || e.button !== 0) return;
    e.preventDefault();
    drag = point(e);
    E("ocrImageWrap").setPointerCapture(e.pointerId);
  };
  E("ocrImageWrap").onpointermove = (e) => {
    if (!drag) return;
    const p = point(e);
    crop = [
      Math.min(drag[0], p[0]),
      Math.min(drag[1], p[1]),
      Math.max(drag[0], p[0]),
      Math.max(drag[1], p[1]),
    ];
    draw();
  };
  E("ocrImageWrap").onpointerup = (e) => {
    if (!drag) return;
    const p = point(e),
      a = drag;
    drag = null;
    if (
      Math.abs(a[0] - p[0]) * E("ocrImage").clientWidth < 8 ||
      Math.abs(a[1] - p[1]) * E("ocrImage").clientHeight < 8
    ) {
      crop = null;
      draw();
      return;
    }
    crop = [
      Math.min(a[0], p[0]),
      Math.min(a[1], p[1]),
      Math.max(a[0], p[0]),
      Math.max(a[1], p[1]),
    ];
    generation++;
    plan = null;
    selected.clear();
    clearOutput();
    showPlan();
    analyzeImage();
  };
  E("ocrImageWrap").onpointercancel = () => {
    drag = null;
    draw();
  };
  new ResizeObserver(draw).observe(E("ocrImageWrap"));
  E("ocrAnalyse").onclick = () => {
    generation++;
    plan = null;
    clearOutput();
    showPlan();
    analyzeImage();
  };
  E("ocrResetCrop").onclick = () => {
    crop = null;
    generation++;
    plan = null;
    clearOutput();
    showPlan();
    analyzeImage();
  };
  for (const id of ["ocrLayout", "ocrLineGap"])
    E(id).onchange = () => {
      if (busy) return;
      generation++;
      plan = null;
      clearOutput();
      showPlan();
      analyzeImage();
    };
  function combined(lines) {
    if (lines.length === 1) return lines[0];
    return (
      "\\begin{aligned}\n" +
      lines
        .map((s) => {
          s = s || "\\text{[OCR: missing line]}";
          return s.includes("=") && !s.includes("&") ? s.replace("=", "&=") : s;
        })
        .join(" \\\\\n") +
      "\n\\end{aligned}"
    );
  }
  function renderResults() {
    const flagged = resultLines.filter((r) => r.flags?.length);
    suspect = flagged.length > 0;
    E("ocrQuality").hidden = !suspect;
    E("ocrAckLabel").hidden = !suspect;
    E("ocrAck").checked = false;
    E("ocrQuality").textContent = suspect
      ? "Το OCR έδωσε ύποπτο ή ελλιπές αποτέλεσμα στις περιοχές " +
        flagged.map((r) => r.index + 1).join(", ") +
        ". Οι πολλές επαναλήψεις μπορεί να είναι αποτυχία αναγνώρισης. Διόρθωσέ το πριν το χρησιμοποιήσεις."
      : "";
    E("ocrCode").value = combined(resultLines.map((r) => r.latex));
    E("ocrLineResults").hidden = false;
    E("ocrAlternatives").replaceChildren();
    for (const r of resultLines) {
      const box = document.createElement("section"),
        title = document.createElement("p"),
        code = document.createElement("textarea");
      title.textContent =
        "Περιοχή " +
        (r.index + 1) +
        (r.flags?.length ? " · χρειάζεται έλεγχο" : " · έλεγξε τη μεταγραφή");
      code.rows = 2;
      code.readOnly = true;
      code.value = r.latex || r.error || "";
      code.setAttribute("aria-label", "Αποτέλεσμα περιοχής " + (r.index + 1));
      box.append(title, code);
      if (r.alternatives?.length > 1)
        for (const [i, a] of r.alternatives.entries()) {
          const b = document.createElement("button");
          b.textContent =
            "Απόπειρα " +
            (i + 1) +
            (a.resize ? " · αυτόματη κλίμακα" : " · χωρίς κλίμακα");
          b.onclick = () => {
            r.latex = a.latex;
            r.flags = a.flags;
            renderResults();
          };
          box.append(b);
        }
      E("ocrAlternatives").append(box);
    }
    outputChanged();
  }
  E("ocrConvert").onclick = async () => {
    if (!imageData || busy || analysing) return;
    if (!E("ocrAllowModel").checked) {
      E("ocrStatus").textContent =
        "Επίλεξε φόρτωση μοντέλου πριν από την αναγνώριση.";
      return;
    }
    if (!plan) {
      await analyzeImage();
      if (!plan) return;
    }
    const regions = plan.regions
      .filter((r) => selected.has(r.index))
      .map((r) => r.rect);
    if (!regions.length) {
      E("ocrStatus").textContent = "Επίλεξε τουλάχιστον μία γραμμή.";
      return;
    }
    busy = true;
    clearOutput();
    controls();
    E("ocrStatus").textContent =
      "Αναγνώριση " +
      regions.length +
      " περιοχών χωριστά… Η πρώτη φόρτωση μοντέλου μπορεί να χρειαστεί χρόνο.";
    try {
      const d = await serverRequest("/api/ocr/equation", {
        ...payload(),
        regions,
        allow_model: true,
        resize: E("ocrResize").checked,
        retry: E("ocrRetry").checked,
      });
      resultLines = d.lines || [
        {
          index: 0,
          latex: d.latex,
          flags: d.suspect ? ["suspect"] : [],
          alternatives: [],
        },
      ];
      renderResults();
      E("ocrStatus").textContent = suspect
        ? "Υπάρχει ύποπτο αποτέλεσμα. Δεν θεωρείται επιτυχής μεταγραφή."
        : "Επιστράφηκαν " +
          resultLines.length +
          " περιοχές. Έλεγξε τη μεταγραφή κάθε γραμμής.";
    } catch (e) {
      E("ocrStatus").textContent = e.message;
    } finally {
      busy = false;
      controls();
    }
  };
  E("ocrCheck").onclick = async () => {
    try {
      const r = await fetch("/api/ocr/status"),
        d = await r.json();
      if (!r.ok) throw Error();
      E("ocrStatus").textContent = d.available
        ? d.loaded
          ? "Το μοντέλο είναι φορτωμένο. Αυτό δεν ελέγχει την ορθότητα μεταγραφής."
          : "Το pix2tex είναι εγκατεστημένο· φορτώνεται στην πρώτη αναγνώριση."
        : "Το pix2tex δεν είναι εγκατεστημένο. Άνοιξε τις οδηγίες εγκατάστασης.";
      E("ocrSetup").open = !d.available;
    } catch (e) {
      E("ocrStatus").textContent =
        "Δεν απάντησε η υπηρεσία OCR. Άνοιξε το Studio μέσω Python.";
    }
  };
  let timer;
  E("ocrCode").oninput = () => {
    E("ocrAck").checked = false;
    clearTimeout(timer);
    timer = setTimeout(outputChanged, 200);
  };
  E("ocrAck").onchange = outputChanged;
  E("ocrCopy").onclick = () =>
    U.copy(E("ocrCode").value)
      .then(() => (E("ocrStatus").textContent = "Αντιγράφηκε LaTeX."))
      .catch((e) => (E("ocrStatus").textContent = e.message));
  E("ocrCopyMarkdown").onclick = () =>
    U.copy(M.blockCode(E("ocrCode").value, "display"))
      .then(() => (E("ocrStatus").textContent = "Αντιγράφηκε Markdown."))
      .catch((e) => (E("ocrStatus").textContent = e.message));
  E("ocrInsert").onclick = () =>
    U.deliver(M.blockCode(E("ocrCode").value, "display"));
})();
