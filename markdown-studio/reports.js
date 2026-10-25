"use strict";
(function () {
  const el = document.createElement("section");
  el.id = "reportsPanel";
  el.className = "collapsible";
  el.hidden = true;
  el.innerHTML = `<div class="sectionHeading"><h2>Ενημερώσεις PR</h2><span>Αναζήτηση, report και email όταν τα χρειάζεσαι.</span></div>
<div class="row"><button id="rBuild" class="strong">↻ Ανάκτηση από GitHub</button><button id="rDownload" disabled>Λήψη report</button><button id="rSend" disabled>Email…</button></div>
<div class="report-query"><label for="rQuery" class="subtext">Αναζήτηση σε τίτλους, περιγραφές, μαθήματα και αρχεία του report</label><input id="rQuery" placeholder="Αναζήτηση PR ή μαθήματος…" aria-label="Αναζήτηση ενημερώσεων PR"></div>
<details id="reportFilters"><summary>Φίλτρα και προφίλ ενημέρωσης</summary><div class="formgrid">
<label>Κατηγορία / διαδρομή<input id="rPath" placeholder="Όλες οι κατηγορίες"></label><label>Μάθημα<input id="rCourse" placeholder="Όλα τα μαθήματα"></label><label>Έτος εξέτασης<input id="rYear" type="number" min="1990" max="2100" placeholder="Όλα"></label>
<label>Εξάμηνο<select id="rSemester"><option value="">Όλα</option>${Array.from({ length: 9 }, (_, i) => `<option value="${i + 1}">${i + 1}ο</option>`).join("")}</select></label><label>Κατάσταση<select id="rState"><option value="open">Ανοικτά</option><option value="merged">Merged</option><option value="closed">Κλειστά (και merged)</option><option value="all">Όλα</option></select></label><label>Ενημερωμένα από<input id="rSince" type="date"></label>
<label>Labels (οποιοδήποτε, με κόμμα)<input id="rLabels"></label><label>GitHub συντάκτης<input id="rAuthor"></label><label>Προφίλ<input id="rProfileSearch" placeholder="Αναζήτηση προφίλ…"></label>
<label><input id="rDrafts" type="checkbox" checked> Συμπερίληψη drafts</label><label><input id="rDescription" type="checkbox" checked> Περιγραφή στο report/email</label><label><input id="rFiles" type="checkbox" checked> Αρχεία και links στο report/email</label></div>
<div class="row"><button id="rCurrent">Από τρέχουσα λύση</button><button id="rSave">Αποθήκευση προφίλ</button><button id="rDelete">Διαγραφή προφίλ</button><button id="rReset">Καθαρισμός φίλτρων</button></div></details>
<details id="emailOptions"><summary>Ρυθμίσεις email</summary><div class="formgrid"><label class="full">Παραλήπτες (με κόμμα)<input id="rRecipients" type="email" multiple></label><label class="full">Θέμα email<input id="rSubject" value="Markdown Studio — PR report"></label></div><p class="subtext">Ρύθμιση SMTP στον Python server: δείτε τον οδηγό μέσα στο πακέτο. Στέλνεται το report που εμφανίζεται εδώ, με τα φίλτρα και την αναζήτησή σας.</p></details><p id="rStatus" class="tool-status" role="status">Πάτα «Ανάκτηση» για τις τρέχουσες ενημερώσεις.</p><div id="reportOutput" class="empty-state">Οι ενημερώσεις θα εμφανιστούν εδώ.</div>`;
  document.querySelector(".breadcrumbs").after(el);
  let source = null,
    active = null,
    epoch = 0,
    profiles = {},
    reportIndex = [],
    queryOptions = [],
    authors = [],
    labels = [];
  try {
    profiles = JSON.parse(
      localStorage.getItem("studio-report-profiles") || "{}",
    );
  } catch (_) {}
  const fieldNames = [
    "Path",
    "Course",
    "Year",
    "Semester",
    "State",
    "Since",
    "Labels",
    "Author",
    "Drafts",
    "Description",
    "Files",
    "Recipients",
    "Subject",
    "Query",
  ];
  const get = () => ({
    path: $("rPath").value,
    course: $("rCourse").value,
    year: $("rYear").value,
    semester: $("rSemester").value,
    state: $("rState").value,
    since: $("rSince").value,
    labels: $("rLabels").value,
    author: $("rAuthor").value,
    drafts: $("rDrafts").checked,
    description: $("rDescription").checked,
    files: $("rFiles").checked,
  });
  function invalidate() {
    epoch++;
    source = null;
    active = null;
    $("rSend").disabled = $("rDownload").disabled = true;
    $("reportOutput").className = "empty-state";
    $("reportOutput").textContent =
      "Τα φίλτρα άλλαξαν. Πάτα Ανάκτηση από GitHub.";
  }
  for (const n of fieldNames.filter(
    (n) =>
      !["Query", "Recipients", "Subject", "Description", "Files"].includes(n),
  ))
    $("r" + n).addEventListener("input", invalidate);
  for (const n of ["Description", "Files"])
    $("r" + n).addEventListener("change", renderLocal);
  function reportLinks(raw) {
    let html = "",
      last = 0;
    for (const match of String(raw).matchAll(/https?:\/\/[^\s<>"']+/g)) {
      html += esc(raw.slice(last, match.index));
      const url = match[0];
      html +=
        '<a href="' +
        esc(url) +
        '" target="_blank" rel="noopener noreferrer">' +
        esc(url) +
        "</a>";
      last = match.index + url.length;
    }
    return html + esc(raw.slice(last));
  }
  function renderLocal() {
    if (!source) return;
    const q = $("rQuery").value,
      found = StudioSearch.rank(q, reportIndex, source.items.length),
      items = found.map((o) => source.items[o.i]);
    active = {
      ...source,
      items,
      settings: { ...source.settings, ...get(), query: q },
    };
    const title = "Markdown Studio — PR report";
    let h =
        "<h2>" +
        esc(title) +
        "</h2><p>" +
        esc(source.generated_at) +
        " · " +
        items.length +
        " PR</p><p>Φίλτρα: " +
        esc(JSON.stringify(active.settings)) +
        "</p>",
      text =
        title +
        "\n" +
        source.generated_at +
        "\n" +
        JSON.stringify(active.settings) +
        "\n";
    for (const x of items) {
      h +=
        '<article><h3><a target="_blank" rel="noopener noreferrer" href="' +
        esc(x.url) +
        '">#' +
        x.number +
        " " +
        esc(x.title) +
        "</a></h3><p>" +
        esc(x.author) +
        " · " +
        esc(x.state) +
        (x.draft ? " · draft" : "") +
        "</p>";
      text += "\n#" + x.number + " " + x.title + "\n" + x.url + "\n";
      if ($("rDescription").checked) {
        h +=
          '<pre style="white-space:pre-wrap">' +
          reportLinks(x.body || "") +
          "</pre>";
        text += (x.body || "") + "\n";
      }
      if ($("rFiles").checked)
        for (const f of x.files || []) {
          const u = x.file_links?.[f] || x.url + "/files";
          h +=
            '<p><a href="' +
            esc(u) +
            '" target="_blank" rel="noopener noreferrer">' +
            esc(f) +
            "</a></p>";
          text += f + " " + u + "\n";
        }
      h += "</article>";
    }
    active.html = h;
    active.text = text;
    $("reportOutput").className = "";
    $("reportOutput").innerHTML =
      h +
      (items.length
        ? ""
        : '<div class="empty-state">Δεν βρέθηκε PR. Δοκίμασε άλλη λέξη ή λιγότερα φίλτρα.</div>');
    $("rStatus").textContent =
      items.length +
      " / " +
      source.items.length +
      " PR · " +
      source.generated_at +
      (source.cached ? " · από προσωρινή μνήμη" : "") +
      (source.warnings?.length ? " · " + source.warnings.join(" · ") : "");
    $("rSend").disabled = $("rDownload").disabled = false;
  }
  $("rQuery").addEventListener("input", () => {
    clearTimeout(renderLocal.timer);
    renderLocal.timer = setTimeout(renderLocal, 100);
  });
  $("rBuild").onclick = async () => {
    const id = ++epoch;
    $("rBuild").disabled = true;
    $("rStatus").textContent = "Ανάκτηση PR και αρχείων από GitHub…";
    try {
      const data = await serverRequest("/api/reports/build", {
        settings: { ...get(), description: true, files: true },
      });
      if (id !== epoch) return;
      source = data;
      reportIndex = StudioSearch.index(
        data.items.map((x) => ({
          value: x.title,
          label: x.title,
          keywords: [
            x.body?.slice(0, 5000),
            ...(x.files || []),
            ...(x.labels || []),
            x.author,
          ].join(" "),
        })),
      );
      queryOptions = [
        ...new Set(
          data.items
            .map((x) => x.title)
            .concat(window.StudioUI?.getCourseNames() || []),
        ),
      ];
      authors = [...new Set(data.items.map((x) => x.author))];
      labels = [...new Set(data.items.flatMap((x) => x.labels || []))];
      renderLocal();
    } catch (e) {
      if (id === epoch) $("rStatus").textContent = e.message;
    } finally {
      $("rBuild").disabled = false;
    }
  };
  $("rDownload").onclick = () => {
    if (active)
      download(
        '<!doctype html><html lang="el"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>PR report</title><style>body{max-width:900px;margin:35px auto;padding:20px;font:15px/1.6 system-ui;color:#25435a}article{border-top:1px solid #d2dfe8;padding:16px 0}a{color:#075f94}pre{white-space:pre-wrap}</style>' +
          active.html +
          "</html>",
        "PR_Report.html",
        "text/html;charset=utf-8",
      );
  };
  $("rSend").onclick = async () => {
    if (!active) return;
    $("emailOptions").open = true;
    const recipients = $("rRecipients");
    if (!recipients.value || !recipients.reportValidity()) {
      recipients.focus();
      $("rStatus").textContent = "Συμπλήρωσε παραλήπτες και ξαναπάτα Email.";
      return;
    }
    if (
      !confirm(
        "Αποστολή του εμφανιζόμενου report (" +
          active.items.length +
          " PR) στους: " +
          recipients.value +
          ";",
      )
    )
      return;
    $("rSend").disabled = true;
    try {
      const d = await serverRequest("/api/reports/send", {
        confirm: true,
        report: active,
        recipients: recipients.value,
        subject: $("rSubject").value,
      });
      $("rStatus").textContent =
        "SMTP αποδέχθηκε: " +
        d.accepted.join(", ") +
        (d.refused.length ? " · Απορρίφθηκαν: " + d.refused.join(", ") : "") +
        " · Η παράδοση δεν έχει επιβεβαιωθεί.";
    } catch (e) {
      $("rStatus").textContent = e.message;
    } finally {
      $("rSend").disabled = !active;
    }
  };
  $("rCurrent").onclick = () => {
    $("rCourse").value = $("course").value;
    $("rPath").value = $("repoPath").value || $("customPath").value;
    $("rYear").value = $("year").value;
    $("rSemester").value = $("semester").value;
    invalidate();
  };
  $("rSave").onclick = () => {
    const name = prompt("Όνομα προφίλ ενημέρωσης", $("rProfileSearch").value);
    if (!name?.trim()) return;
    const v = {};
    for (const n of fieldNames)
      v[n] =
        $("r" + n).type === "checkbox" ? $("r" + n).checked : $("r" + n).value;
    profiles = { ...profiles, [name.trim()]: v };
    try {
      localStorage.setItem("studio-report-profiles", JSON.stringify(profiles));
      $("rProfileSearch").value = name.trim();
      notify("Αποθηκεύτηκε το προφίλ ενημέρωσης.");
    } catch (e) {
      notify("Δεν αποθηκεύτηκε το προφίλ: " + e.message);
    }
  };
  $("rDelete").onclick = () => {
    const n = $("rProfileSearch").value;
    if (!Object.hasOwn(profiles, n)) return;
    if (!confirm("Διαγραφή προφίλ «" + n + "»;")) return;
    delete profiles[n];
    localStorage.setItem("studio-report-profiles", JSON.stringify(profiles));
    $("rProfileSearch").value = "";
  };
  $("rReset").onclick = () => {
    for (const n of [
      "Path",
      "Course",
      "Year",
      "Semester",
      "Since",
      "Labels",
      "Author",
      "Query",
    ])
      $("r" + n).value = "";
    $("rState").value = "open";
    $("rDrafts").checked = true;
    invalidate();
  };
  document.addEventListener("DOMContentLoaded", () => {
    const U = window.StudioUI,
      S = window.StudioSearch;
    U.registerCombo(
      S.combo($("rCourse"), {
        items: () =>
          U.getCourseNames({
            year: $("rYear").value,
            semester: $("rSemester").value,
          }),
        placeholder: "Αναζήτηση μαθήματος…",
      }),
    );
    U.registerCombo(
      S.combo($("rPath"), {
        items: () => U.getPaths(),
        placeholder: "Αναζήτηση κατηγορίας…",
      }),
    );
    U.registerCombo(
      S.combo($("rQuery"), {
        items: () => queryOptions,
        onSelect: () => renderLocal(),
        empty: source
          ? "Δοκίμασε άλλη λέξη."
          : "Ανάκτησε πρώτα PR από το GitHub.",
      }),
    );
    U.registerCombo(S.combo($("rAuthor"), { items: () => authors }));
    U.registerCombo(S.combo($("rLabels"), { items: () => labels }));
    U.registerCombo(
      S.combo($("rProfileSearch"), {
        items: () => Object.keys(profiles),
        onSelect: (o) => {
          const v = profiles[o.value];
          for (const n of fieldNames)
            if (n in v) {
              const e = $("r" + n);
              if (e.type === "checkbox") e.checked = v[n];
              else e.value = v[n];
            }
          invalidate();
        },
      }),
    );
  });
})();
