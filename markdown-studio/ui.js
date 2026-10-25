"use strict";
(function () {
  const by = (id) => document.getElementById(id),
    S = window.StudioSearch;
  const features = [
    {
      id: "editor",
      name: "Συγγραφή Markdown",
      route: "/editor",
      keywords: "κειμενο πηγη source editor αποθηκευση",
      help: "Γράψε Markdown αριστερά και έλεγξε την προεπισκόπηση δεξιά. Ctrl+S κατεβάζει .md. Η πρόχειρη πηγή κρατιέται στον browser· για μόνιμο αντίγραφο χρησιμοποίησε Αποθήκευση. Για αναζήτηση μέσα στο κείμενο πάτα Εύρεση ή Ctrl+F.",
    },
    {
      id: "document",
      name: "Στοιχεία εξέτασης και εξώφυλλο",
      route: "/document",
      keywords: "μαθημα εξαμηνο ετος course cover",
      help: "Διάλεξε εξάμηνο και έτος εξέτασης και ενημέρωσε από GitHub. Η αναζήτηση μαθημάτων προτείνει μόνο ονόματα του συγκεκριμένου έτους και εξαμήνου. Βελάκια και Enter επιλέγουν πρόταση. Οι διορθώσεις εφαρμόζονται μόνο όταν επιλέξεις πρόταση.",
    },
    {
      id: "reports",
      name: "Ενημερώσεις και reports PR",
      route: "/reports",
      keywords: "email notifications κατηγορια ενημερωση",
      help: "Αναζήτησε σε τίτλους, περιγραφές, labels και αρχεία PR. Τα επιπλέον φίλτρα ανοίγουν μόνο όταν χρειάζονται. Πάτα Ανάκτηση από GitHub για νέα δεδομένα· η αναζήτηση στη συνέχεια φιλτράρει το ήδη φορτωμένο report. Προφίλ αποθηκεύουν προτιμήσεις στον browser. Email στέλνεται μόνο με δικό σου πάτημα και επιβεβαίωση.",
    },
    {
      id: "settings",
      name: "Εμφάνιση και ρυθμίσεις",
      route: "/settings",
      keywords: "θεμα theme background φοντο σκοτεινο light dark",
      help: "Επίλεξε το φωτεινό μπλε θέμα του forum, σκοτεινό ή αυτόματο. Το φόντο, η πυκνότητα και το μέγεθος κειμένου αποθηκεύονται στον browser. Δεν αλλάζουν τη μορφή του PDF. Οι ρυθμίσεις repository βρίσκονται στην προχωρημένη ενότητα.",
    },
    {
      id: "pdf",
      name: "Επεξεργασία PDF",
      route: "/pdf",
      keywords: "pdf source mapping πηγη",
      help: "Άνοιξε παραγόμενο PDF για αντιστοίχιση blocks με Markdown. Αλλαγή στο επιλεγμένο block ενημερώνει την πηγή και παράγει νέο PDF. Απευθείας αλλαγές σε ανεξάρτητο PDF δεν ενημερώνουν το Markdown. Απαιτεί Python mode.",
    },
    {
      id: "tools",
      name: "Εργαλεία LaTeX",
      route: "/tools",
      keywords: "latex μαθηματικα blocks",
      help: "Επιπλέον εργαλεία χωρίς να γεμίζει ο editor. Εξισώσεις, πίνακες και εικόνα εξίσωσης → LaTeX έχουν δικό τους σύνδεσμο και μπορούν να ανοίξουν σε ξεχωριστό παράθυρο για copy/paste.",
    },
    {
      id: "equations",
      name: "Εξισώσεις και συστήματα",
      route: "/tools/equations",
      keywords:
        "κλασμα ολοκληρωμα εξισωση matrix πινακας συστημα integral equation",
      help: "Αναζήτησε έτοιμο block ή γράψε LaTeX. Η προεπισκόπηση χρησιμοποιεί MathJax. Αντίγραψε σκέτο LaTeX ή Markdown με μαθηματικούς delimiters. Σύνθετες εντολές που βλέπεις εδώ μπορεί να μην υποστηρίζονται από το βασικό Python PDF· έλεγξε την εξαγωγή.",
    },
    {
      id: "tables",
      name: "Δημιουργία πινάκων",
      route: "/tools/tables",
      keywords: "table πινακας κελια rows columns tabular csv tsv",
      help: "Δώσε γραμμές και στήλες και συμπλήρωσε τα κελιά. Εξήγαγε Markdown, LaTeX tabular ή μαθηματικό array/matrix. Το Markdown εισάγεται ως κανονικός πίνακας. Το tabular είναι πλήρης LaTeX κώδικας και απαιτεί κατάλληλη LaTeX εξαγωγή.",
    },
    {
      id: "ocr",
      name: "Εικόνα εξίσωσης → LaTeX",
      route: "/tools/image-latex",
      keywords: "εικονα image OCR φωτογραφια εξισωση αναγνωριση",
      help: "Ανέβασε ή επικόλλησε εικόνα εξίσωσης ή διαδοχικών γραμμών. Έλεγξε τα προτεινόμενα πλαίσια και σύρε περιοχή για να περιορίσεις την εικόνα. Η αναγνώριση γίνεται τοπικά με προαιρετικό pix2tex και χρειάζεται εγκατάσταση του requirements-ocr.txt. Η πρώτη χρήση μπορεί να κατεβάσει βάρη. Διόρθωσε το αποτέλεσμα πριν από copy/paste· η ορθότητα δεν είναι εγγυημένη.",
    },
    {
      id: "feedback",
      name: "Σχόλια ανά λειτουργία",
      route: "/feedback",
      keywords: "bug προβλημα προταση feedback σχολια discord zip",
      help: "Κράτησε σχόλιο για κάθε λειτουργία, με τύπο, βήματα και προαιρετικά αρχεία. Η εξαγωγή δημιουργεί ZIP με φάκελο σχολίων, έτοιμο να το επισυνάψεις στο Discord. Δεν στέλνεται αυτόματα τίποτα και δεν περιλαμβάνονται το έγγραφο, SMTP κωδικοί ή ρυθμίσεις λογαριασμού.",
    },
    {
      id: "github",
      name: "Σύνδεση και υποβολή GitHub PR",
      route: "/editor",
      keywords: "github login συνδεση υποβολη ελεγχος pull request",
      help: "Σύνδεση μέσω του τοπικού GitHub CLI. Έλεγξε στοιχεία και PDF πριν υποβάλεις Draft PR. Η εφαρμογή ζητά επιβεβαίωση πριν από πραγματική δημιουργία PR. Ένα Draft PR δεν αποτελεί έγκριση λύσης.",
    },
  ];
  const routes = {
    "/editor": null,
    "/document": "metaPanel",
    "/reports": "reportsPanel",
    "/settings": "settingsPanel",
    "/pdf": "pdfPanel",
    "/tools": "toolsPanel",
    "/tools/equations": "equationsPanel",
    "/tools/tables": "tablesPanel",
    "/tools/image-latex": "ocrPanel",
    "/feedback": "feedbackPanel",
  };
  let current = "/editor",
    helpFeature = features[0],
    catalogKey = "",
    courseNames = [],
    allNames = [],
    pathNames = [];
  const combos = [];
  const sessionId = crypto.randomUUID();
  const params = new URLSearchParams(location.search),
    detached = params.get("tool") === "1";
  if (detached) document.documentElement.classList.add("detached");
  function navigate(route) {
    if (location.hash === "#" + route) renderRoute();
    else location.hash = route;
  }
  function featureForRoute(route) {
    return features.find((x) => x.route === route) || features[0];
  }
  function routeInfo() {
    const raw = location.hash.replace(/^#/, "") || "/editor";
    const [route, q] = raw.split("?");
    return {
      route: route in routes ? route : "/editor",
      query: new URLSearchParams(q || ""),
    };
  }
  function renderRoute() {
    const { route, query } = routeInfo();
    current = route;
    for (const id of Object.values(routes))
      if (id && by(id)) by(id).hidden = id !== routes[route];
    by("editorWorkspace").hidden = route !== "/editor";
    by("editorActions").hidden = route !== "/editor";
    by("routeTitle").textContent = featureForRoute(route).name;
    for (const a of document.querySelectorAll(".toolbar a")) {
      if (a.getAttribute("href") === "#" + route)
        a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
    for (const c of combos) c.close();
    window.dispatchEvent(
      new CustomEvent("studio:route", { detail: { route, query } }),
    );
    if (route !== "/editor") window.scrollTo({ top: 0, behavior: "instant" });
  }
  function deepLink(route = current, tool = false) {
    const u = new URL(location.href);
    u.hash = route;
    u.search = "";
    if (tool) {
      u.searchParams.set("tool", "1");
      u.searchParams.set("document", sessionId);
    }
    return u.href;
  }
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const t = document.createElement("textarea");
      t.value = text;
      t.style.cssText = "position:fixed;left:-9999px";
      document.body.append(t);
      t.select();
      const ok = document.execCommand("copy");
      t.remove();
      if (!ok)
        throw Error(
          "Η αντιγραφή δεν επιτράπηκε. Επίλεξε το κείμενο και πάτα Ctrl+C.",
        );
      return true;
    }
  }
  function tell(s) {
    notify(s);
  }
  function help(id, text) {
    helpFeature = features.find((f) => f.id === id) || features[0];
    by("helpTitle").textContent = helpFeature.name;
    by("helpText").textContent = text || helpFeature.help;
    if (!by("helpDialog").open) by("helpDialog").showModal();
  }
  function helpButton(id, text) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "help-trigger";
    b.textContent = "?";
    b.setAttribute(
      "aria-label",
      "Βοήθεια: " +
        (text?.split("\n")[0] || features.find((x) => x.id === id)?.name || id),
    );
    b.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      help(id, text);
    };
    return b;
  }
  function decorate(container, id) {
    const f = features.find((f) => f.id === id);
    if (!container) return;
    const head =
      container.querySelector(".sectionHeading") ||
      container.querySelector("h2");
    if (!container.querySelector(":scope > .panel-controls")) {
      const c = document.createElement("div");
      c.className = "panel-controls";
      c.append(helpButton(id));
      const link = document.createElement("button");
      link.className = "icon-button";
      link.textContent = "↗";
      link.setAttribute("aria-label", "Αντιγραφή συνδέσμου: " + f?.name);
      link.onclick = () =>
        copy(deepLink(f.route))
          .then(() => tell("Αντιγράφηκε ο σύνδεσμος."))
          .catch((e) => tell(e.message));
      const close = document.createElement("button");
      close.className = "icon-button";
      close.textContent = "×";
      close.setAttribute("aria-label", "Κλείσιμο: " + f?.name);
      close.onclick = () => {
        if (detached) {
          window.close();
          setTimeout(() => navigate("/editor"), 150);
        } else navigate("/editor");
      };
      c.append(link, close);
      container.prepend(c);
    }
    for (const label of container.querySelectorAll("label")) {
      if (label.dataset.helpReady || label.classList.contains("file-button"))
        continue;
      label.dataset.helpReady = "1";
      const input =
        label.querySelector("input,select,textarea") ||
        (label.htmlFor ? by(label.htmlFor) : null);
      if (!input) continue;
      if (input.type === "checkbox") label.classList.add("check-label");
      let title = [...label.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim())
        .filter(Boolean)
        .join(" ");
      if (!title) title = input.getAttribute("aria-label") || input.id;
      const extra = fieldHelp[input.id] || f?.help;
      const caption = document.createElement("span");
      caption.className = "label-caption";
      caption.textContent = title;
      caption.append(helpButton(id, title + "\n\n" + extra));
      for (const n of [...label.childNodes]) if (n.nodeType === 3) n.remove();
      label.prepend(caption);
    }
  }
  const fieldHelp = {
    course:
      "Προτάσεις μόνο για το επιλεγμένο εξάμηνο και έτος εξέτασης. Η αναζήτηση αγνοεί τόνους, πεζά/κεφαλαία και προτείνει διορθώσεις λέξεων. Κάνε κλικ ή πάτα Enter σε πρόταση.",
    year: "Το ημερολογιακό έτος της εξέτασης όπως υπάρχει στο GitHub, π.χ. 2025. Το εξάμηνο καθορίζει το έτος σπουδών.",
    repoPath:
      "Η ακριβής διαδρομή παραμένει όπως γράφεται στο repository. Η αναζήτηση δεν αλλάζει ελληνικούς/λατινικούς χαρακτήρες του αποθηκευμένου path.",
    rPath:
      "Πρόθεμα διαδρομής repository. Μπορείς να επιλέξεις εξάμηνο, μάθημα ή πλήρη φάκελο εξέτασης.",
    rCourse:
      "Μέρος του ονόματος μαθήματος. Προτάσεις από τον κατάλογο GitHub. Άφησέ το κενό για όλα.",
    rSince:
      "Δείχνει PR που ενημερώθηκαν την ημερομηνία αυτή ή αργότερα. Δεν σημαίνει μόνο όσα δεν έχεις διαβάσει.",
    rLabels:
      "Πολλά labels χωρίζονται με κόμμα. Ταιριάζει οποιοδήποτε από αυτά. Τα υπόλοιπα φίλτρα συνδυάζονται με AND.",
    rRecipients:
      "Πραγματικοί παραλήπτες email, χωρισμένοι με κόμμα. Χρειάζεται πρώτα ρύθμιση SMTP στον Python server. Δεν αποστέλλεται email χωρίς επιβεβαίωση.",
    uiBackground:
      "Χρώμα φόντου της εφαρμογής. Η σελίδα του PDF παραμένει λευκή.",
    tableFormat:
      "Markdown για χρήση στον editor. tabular για LaTeX έγγραφο. array/matrix για μαθηματική έκφραση. Η HTML προεπισκόπηση δεν είναι LaTeX compiler.",
  };
  function catalogChanged(force = false) {
    const key =
      catalog.join("\n") + "|" + by("semester").value + "|" + by("year").value;
    if (!force && key === catalogKey) return;
    catalogKey = key;
    courseNames = scopedCourses();
    allNames = [
      ...new Set(
        catalog
          .map((p) => p.split("/")[1]?.replaceAll("_", " "))
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b, "el"));
    pathNames = [
      ...new Set(
        catalog.flatMap((p) => {
          const a = p.split("/");
          return [a[0], a.slice(0, 2).join("/"), p];
        }),
      ),
    ].sort();
    by("courseHint").textContent = catalog.length
      ? courseNames.length +
        " μαθήματα · " +
        by("semester").value +
        "ο εξάμηνο · " +
        by("year").value
      : "Ανανέωσε από GitHub για προτάσεις.";
    window.dispatchEvent(new Event("studio:catalog"));
  }
  function insert(text) {
    const e = by("source");
    const start = e.selectionStart,
      end = e.selectionEnd;
    e.setRangeText(text, start, end, "end");
    e.dispatchEvent(new Event("input", { bubbles: true }));
    navigate("/editor");
    e.focus();
    tell("Το block μπήκε στην πηγή. Έλεγξε την προεπισκόπηση.");
  }
  const channel =
    typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel("markdown-studio-tools")
      : null;
  if (channel)
    channel.onmessage = (e) => {
      const m = e.data;
      if (
        m?.kind === "insert" &&
        !detached &&
        m.target === sessionId &&
        typeof m.text === "string" &&
        m.text.length <= 200000
      ) {
        insert(m.text);
        channel.postMessage({ kind: "ack", id: m.id });
      }
    };
  async function deliver(text) {
    if (!detached) {
      insert(text);
      return true;
    }
    const target = params.get("document");
    if (!channel || !target) {
      await copy(text);
      tell("Αντιγράφηκε. Επικόλλησέ το στο Studio.");
      return false;
    }
    const id = crypto.randomUUID();
    return new Promise((resolve) => {
      let ack = false;
      const handler = (e) => {
        if (e.data?.kind === "ack" && e.data.id === id) {
          ack = true;
          channel.removeEventListener("message", handler);
          tell("Το block μπήκε στο αρχικό Studio.");
          resolve(true);
        }
      };
      channel.addEventListener("message", handler);
      channel.postMessage({ kind: "insert", id, target, text });
      setTimeout(async () => {
        channel.removeEventListener("message", handler);
        if (!ack) {
          try {
            await copy(text);
            tell(
              "Δεν βρέθηκε το αρχικό παράθυρο. Το block αντιγράφηκε για επικόλληση.",
            );
          } catch (e) {
            tell(e.message);
          }
          resolve(false);
        }
      }, 1200);
    });
  }
  function init() {
    for (const id of [
      "toggleMeta",
      "toggleSettings",
      "togglePDF",
      "btnReports",
    ])
      by(id).onclick = null;
    for (const [route, id] of Object.entries(routes))
      if (id) decorate(by(id), featureForRoute(route).id);
    by("helpStart").onclick = () => help("editor");
    by("helpFeedback").onclick = () => {
      by("helpDialog").close();
      navigate("/feedback?feature=" + helpFeature.id);
    };
    by("helpCopyLink").onclick = () =>
      copy(deepLink(helpFeature.route))
        .then(() => tell("Αντιγράφηκε ο σύνδεσμος."))
        .catch((e) => tell(e.message));
    for (const b of document.querySelectorAll("[data-close-dialog]"))
      b.onclick = () => by(b.dataset.closeDialog).close();
    combos.push(
      S.combo(by("globalSearch"), {
        items: () =>
          features.map((f) => ({
            value: f.name,
            label: f.name,
            keywords: f.keywords,
            route: f.route,
            id: f.id,
          })),
        onSelect: (o) => {
          by("globalSearch").value = "";
          if (o.id === "github") by("btnGithubAuth").click();
          else navigate(o.route);
        },
        allowFree: false,
      }),
    );
    combos.push(
      S.combo(by("course"), {
        items: () => courseNames,
        onSelect: () => {
          updateRepoPaths();
          schedule();
        },
        placeholder: "Αναζήτηση μαθήματος…",
      }),
    );
    const rp = by("repoPath"),
      search = document.createElement("input");
    search.id = "repoPathSearch";
    search.placeholder = "Αναζήτηση διαδρομής…";
    search.setAttribute("aria-label", "Αναζήτηση διαδρομής GitHub");
    rp.before(search);
    rp.hidden = true;
    combos.push(
      S.combo(search, {
        items: () => [...rp.options].filter((o) => o.value).map((o) => o.value),
        onSelect: (o) => {
          rp.value = o.value;
          rp.dispatchEvent(new Event("input", { bubbles: true }));
        },
      }),
    );
    rp.addEventListener("input", () => {
      search.value = rp.value;
    });
    search.value = rp.value;
    window.addEventListener("studio:paths", () => {
      search.value = rp.value;
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const template = by("template"),
      ts = document.createElement("input");
    ts.id = "templateSearch";
    ts.setAttribute("aria-label", "Αναζήτηση προτύπου");
    template.before(ts);
    template.hidden = true;
    ts.value = template.selectedOptions[0]?.textContent || "";
    combos.push(
      S.combo(ts, {
        items: () =>
          [...template.options].map((o) => ({
            value: o.textContent,
            label: o.textContent,
            id: o.value,
          })),
        onSelect: (o) => {
          template.value = o.id;
          template.dispatchEvent(new Event("change", { bubbles: true }));
        },
        placeholder: "Αναζήτηση προτύπου…",
        allowFree: false,
      }),
    );
    template.addEventListener("change", () => {
      ts.value = template.selectedOptions[0]?.textContent || "";
    });
    let timer;
    by("source").addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          if (by("source").value.length < 1000000)
            localStorage.setItem("studio-source-draft", by("source").value);
          by("editInfo").textContent = "Πρόχειρο στον browser";
        } catch (_) {
          by("editInfo").textContent = "Αποθήκευσε .md";
        }
      }, 800);
    });
    initAppearance();
    initFind();
    catalogChanged(true);
    renderRoute();
    window.addEventListener("hashchange", renderRoute);
    let toastTimer = setTimeout(() => (by("message").hidden = true), 6500);
    const originalNotify = notify;
    notify = (s) => {
      originalNotify(s);
      by("message").hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => (by("message").hidden = true), 8000);
    };
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        by("globalSearch").focus();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "f" &&
        current === "/editor" &&
        !document.querySelector("dialog[open]")
      ) {
        e.preventDefault();
        by("sourceFindBar").hidden = false;
        by("sourceQuery").focus();
      }
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) {
        if (!by("sourceFindBar").hidden) by("sourceFindBar").hidden = true;
        else if (current !== "/editor") navigate("/editor");
      }
    });
    // Header help for the two central tasks.
    by("editorActions").append(helpButton("github"));
    by("editorWorkspace")
      .querySelector(".paneTitle")
      .append(helpButton("editor"));
  }
  function initAppearance() {
    let prefs = {
      theme: "forum",
      density: "normal",
      text: "14",
      background: "",
    };
    try {
      prefs = {
        ...prefs,
        ...JSON.parse(localStorage.getItem("studio-appearance") || "{}"),
      };
    } catch (_) {}
    const media = matchMedia("(prefers-color-scheme: dark)");
    function apply() {
      const dark =
        prefs.theme === "dark" || (prefs.theme === "system" && media.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "forum";
      document.documentElement.dataset.density = prefs.density;
      document.documentElement.style.setProperty(
        "--ui-font",
        prefs.text + "px",
      );
      document.documentElement.style.setProperty(
        "--bg",
        prefs.background || (dark ? "#161c24" : "#f4f7fa"),
      );
      by("uiBackground").value =
        prefs.background || (dark ? "#161c24" : "#f4f7fa");
      try {
        localStorage.setItem("studio-appearance", JSON.stringify(prefs));
      } catch (_) {}
    }
    by("uiTheme").value = prefs.theme;
    by("uiDensity").value = prefs.density;
    by("uiTextSize").value = prefs.text;
    by("uiTheme").onchange = () => {
      prefs.theme = by("uiTheme").value;
      prefs.background = "";
      apply();
    };
    by("uiDensity").onchange = () => {
      prefs.density = by("uiDensity").value;
      apply();
    };
    by("uiTextSize").onchange = () => {
      prefs.text = by("uiTextSize").value;
      apply();
    };
    by("uiBackground").oninput = () => {
      prefs.background = by("uiBackground").value;
      apply();
    };
    by("resetAppearance").onclick = () => {
      prefs = { theme: "forum", density: "normal", text: "14", background: "" };
      by("uiTheme").value = "forum";
      by("uiDensity").value = "normal";
      by("uiTextSize").value = "14";
      apply();
    };
    media.addEventListener("change", apply);
    apply();
  }
  function initFind() {
    let matches = [],
      at = -1;
    function find() {
      const q = by("sourceQuery").value.toLocaleLowerCase("el"),
        text = by("source").value.toLocaleLowerCase("el");
      matches = [];
      at = -1;
      if (q) {
        let i = 0;
        while ((i = text.indexOf(q, i)) >= 0 && matches.length < 10000) {
          matches.push(i);
          i += Math.max(1, q.length);
        }
      }
      by("sourceMatches").textContent = matches.length + " αποτελέσματα";
    }
    function step(dir) {
      if (!matches.length) return;
      at = (at + dir + matches.length) % matches.length;
      const e = by("source"),
        n = matches[at];
      e.focus();
      e.setSelectionRange(n, n + by("sourceQuery").value.length);
      const line = e.value.slice(0, n).split("\n").length;
      e.scrollTop = Math.max(
        0,
        (line - 5) * parseFloat(getComputedStyle(e).lineHeight),
      );
      by("sourceMatches").textContent = at + 1 + " / " + matches.length;
    }
    by("findSource").onclick = () => {
      by("sourceFindBar").hidden = false;
      by("sourceQuery").focus();
    };
    by("sourceFindClose").onclick = () => {
      by("sourceFindBar").hidden = true;
    };
    by("sourceQuery").oninput = find;
    by("sourceQuery").onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        step(e.shiftKey ? -1 : 1);
      }
    };
    by("sourcePrev").onclick = () => step(-1);
    by("sourceNext").onclick = () => step(1);
    by("source").addEventListener("input", () => {
      if (!by("sourceFindBar").hidden) find();
    });
  }
  window.StudioUI = {
    features,
    navigate,
    deepLink,
    copy,
    help,
    decorate,
    helpButton,
    catalogChanged,
    insert,
    deliver,
    detached,
    getCourseNames: (filters = {}) => {
      if (!filters.year && !filters.semester) return allNames;
      return [
        ...new Set(
          catalog
            .filter((p) => {
              const a = p.split("/");
              return (
                (!filters.year || a[2] === filters.year) &&
                (!filters.semester ||
                  a[0].match(/^\d+/)?.[0] === filters.semester)
              );
            })
            .map((p) => p.split("/")[1].replaceAll("_", " ")),
        ),
      ].sort((a, b) => a.localeCompare(b, "el"));
    },
    getPaths: () => pathNames,
    registerCombo: (c) => combos.push(c),
  };
  document.addEventListener("DOMContentLoaded", init);
})();
