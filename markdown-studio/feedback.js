"use strict";
(function () {
  const E = (id) => document.getElementById(id),
    U = window.StudioUI,
    S = window.StudioSearch;
  E("feedbackPanel").innerHTML =
    `<div class="sectionHeading"><h2>Σχόλια για το Studio</h2><span>Ένα σχόλιο ανά λειτουργία, συγκεντρωμένα σε φάκελο ZIP.</span></div><div class="formgrid"><label>Λειτουργία<input id="feedbackFeature" placeholder="Αναζήτηση λειτουργίας…"></label><label>Τύπος<select id="feedbackType"><option value="usability">Ευχρηστία / εμφάνιση</option><option value="bug">Πρόβλημα</option><option value="suggestion">Πρόταση</option><option value="question">Ερώτηση</option></select></label><label>Όνομα / Discord (προαιρετικό)<input id="feedbackName" maxlength="100"></label><label class="full">Σχόλιο<textarea id="feedbackComment" rows="5" maxlength="15000" placeholder="Τι σε δυσκόλεψε; Τι θα άλλαζες;"></textarea></label><label class="full">Βήματα και αναμενόμενη συμπεριφορά (προαιρετικά)<textarea id="feedbackSteps" rows="3" maxlength="10000"></textarea></label><label class="full">Συνημμένα για τη λειτουργία (προαιρετικά)<input id="feedbackAttachments" type="file" multiple accept="image/png,image/jpeg,image/webp,.txt,.log,.md,.pdf"><small>Έως 10 MB συνολικά. Μπαίνουν στο ZIP μόνο τα αρχεία που επιλέγεις.</small></label></div><div class="row"><button id="feedbackSave">Αποθήκευση σχολίου</button><button id="feedbackExport" class="strong">Λήψη φακέλου ZIP για Discord</button><button id="feedbackDelete">Διαγραφή τρέχοντος σχολίου</button></div><p id="feedbackStatus" class="tool-status" role="status"></p><div id="feedbackSaved" class="feedback-list"></div><p class="subtext">Επισύναψε το ZIP στο κατάλληλο κανάλι Discord. Δεν αποστέλλεται αυτόματα. Τα σχόλια αποθηκεύονται μόνο στον browser μέχρι να κατεβάσεις τον φάκελο.</p>`;
  let comments = {},
    files = {},
    selected = "editor",
    timer,
    loaded = false;
  try {
    comments = JSON.parse(localStorage.getItem("studio-feedback-v10") || "{}");
  } catch (_) {}
  const feature = (id) => U.features.find((f) => f.id === id) || U.features[0];
  function persist() {
    try {
      localStorage.setItem("studio-feedback-v10", JSON.stringify(comments));
      E("feedbackStatus").textContent = "Το σχόλιο αποθηκεύτηκε στον browser.";
    } catch (e) {
      E("feedbackStatus").textContent =
        "Δεν αποθηκεύτηκε στον browser: " + e.message;
    }
    drawSaved();
  }
  function save() {
    if (!loaded) return;
    clearTimeout(timer);
    const comment = E("feedbackComment").value,
      steps = E("feedbackSteps").value;
    if (comment.trim() || steps.trim())
      comments[selected] = {
        feature: selected,
        name: E("feedbackName").value,
        type: E("feedbackType").value,
        comment,
        steps,
        updated: new Date().toISOString(),
      };
    else delete comments[selected];
    persist();
  }
  function load(id) {
    save();
    selected = feature(id).id;
    const v = comments[selected] || {};
    E("feedbackFeature").value = feature(selected).name;
    E("feedbackComment").value = v.comment || "";
    E("feedbackSteps").value = v.steps || "";
    E("feedbackType").value = v.type || "usability";
    E("feedbackName").value = v.name || "";
    E("feedbackAttachments").value = "";
    E("feedbackStatus").textContent = files[selected]?.length
      ? files[selected].length +
        " συνημμένα στη μνήμη. Αποθηκεύστε τα με το ZIP."
      : "";
  }
  function drawSaved() {
    E("feedbackSaved").replaceChildren();
    for (const id of Object.keys(comments)) {
      const b = document.createElement("button");
      b.textContent = feature(id).name;
      b.onclick = () => load(id);
      E("feedbackSaved").append(b);
    }
  }
  for (const id of [
    "feedbackComment",
    "feedbackSteps",
    "feedbackType",
    "feedbackName",
  ])
    E(id).addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(save, 600);
    });
  E("feedbackSave").onclick = save;
  E("feedbackDelete").onclick = () => {
    if (!confirm("Διαγραφή σχολίου για «" + feature(selected).name + "»;"))
      return;
    delete comments[selected];
    delete files[selected];
    E("feedbackComment").value = E("feedbackSteps").value = "";
    E("feedbackAttachments").value = "";
    persist();
  };
  E("feedbackAttachments").onchange = () => {
    const chosen = [...E("feedbackAttachments").files];
    const total = Object.entries(files)
      .filter(([k]) => k !== selected)
      .flatMap(([, v]) => v)
      .concat(chosen)
      .reduce((n, f) => n + f.size, 0);
    if (total > 10 * 1024 * 1024) {
      E("feedbackStatus").textContent =
        "Τα συνημμένα ξεπερνούν τα 10 MB συνολικά.";
      E("feedbackAttachments").value = "";
      return;
    }
    files[selected] = chosen;
    E("feedbackStatus").textContent =
      chosen.length +
      " συνημμένα θα μπουν στο ZIP. Μένουν στη μνήμη μέχρι να κλείσει η σελίδα.";
  };
  const encoder = new TextEncoder();
  let crcTable;
  function crc32(data) {
    if (!crcTable)
      crcTable = Array.from({ length: 256 }, (_, n) => {
        for (let k = 0; k < 8; k++)
          n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
        return n >>> 0;
      });
    let n = 0xffffffff;
    for (const b of data) n = crcTable[(n ^ b) & 255] ^ (n >>> 8);
    return (n ^ 0xffffffff) >>> 0;
  }
  function zip(entries) {
    const parts = [],
      central = [];
    let offset = 0;
    const now = new Date(),
      date =
        ((Math.max(1980, now.getFullYear()) - 1980) << 9) |
        ((now.getMonth() + 1) << 5) |
        now.getDate(),
      time =
        (now.getHours() << 11) |
        (now.getMinutes() << 5) |
        (now.getSeconds() >> 1);
    for (const { name, data } of entries) {
      const fname = encoder.encode(name),
        bytes = typeof data === "string" ? encoder.encode(data) : data,
        crc = crc32(bytes);
      const h = new Uint8Array(30 + fname.length),
        v = new DataView(h.buffer);
      v.setUint32(0, 0x04034b50, true);
      v.setUint16(4, 20, true);
      v.setUint16(6, 0x800, true);
      v.setUint16(10, time, true);
      v.setUint16(12, date, true);
      v.setUint32(14, crc, true);
      v.setUint32(18, bytes.length, true);
      v.setUint32(22, bytes.length, true);
      v.setUint16(26, fname.length, true);
      h.set(fname, 30);
      parts.push(h, bytes);
      const c = new Uint8Array(46 + fname.length),
        w = new DataView(c.buffer);
      w.setUint32(0, 0x02014b50, true);
      w.setUint16(4, 20, true);
      w.setUint16(6, 20, true);
      w.setUint16(8, 0x800, true);
      w.setUint16(12, time, true);
      w.setUint16(14, date, true);
      w.setUint32(16, crc, true);
      w.setUint32(20, bytes.length, true);
      w.setUint32(24, bytes.length, true);
      w.setUint16(28, fname.length, true);
      w.setUint32(42, offset, true);
      c.set(fname, 46);
      central.push(c);
      offset += h.length + bytes.length;
    }
    const size = central.reduce((n, c) => n + c.length, 0),
      end = new Uint8Array(22),
      v = new DataView(end.buffer);
    v.setUint32(0, 0x06054b50, true);
    v.setUint16(8, entries.length, true);
    v.setUint16(10, entries.length, true);
    v.setUint32(12, size, true);
    v.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end], { type: "application/zip" });
  }
  E("feedbackExport").onclick = async () => {
    save();
    const ids = [
      ...new Set([
        ...Object.keys(comments),
        ...Object.keys(files).filter((k) => files[k].length),
      ]),
    ];
    if (!ids.length) {
      E("feedbackStatus").textContent = "Γράψε πρώτα ένα σχόλιο.";
      return;
    }
    E("feedbackExport").disabled = true;
    try {
      const stamp = new Date().toISOString();
      const entries = [
        {
          name: "Markdown_Studio_Feedback/README.md",
          data:
            "# Σχόλια Markdown Studio v10.0.1\n\nΗμερομηνία: " +
            stamp +
            "\n\nΤα σχόλια βρίσκονται στο comments/, ένα αρχείο ανά λειτουργία. Τα συνημμένα επιλέχθηκαν από τον χρήστη. Δεν περιλαμβάνονται έγγραφα εργασίας ή ρυθμίσεις λογαριασμού.\n",
        },
        {
          name: "Markdown_Studio_Feedback/comments.json",
          data: JSON.stringify(
            {
              version: "10.0.1",
              exported_at: stamp,
              comments: ids.map((id) => comments[id] || { feature: id }),
            },
            null,
            2,
          ),
        },
      ];
      for (const id of ids) {
        const c = comments[id] || {};
        entries.push({
          name: "Markdown_Studio_Feedback/comments/" + id + ".md",
          data:
            "# " +
            feature(id).name +
            "\n\nΤύπος: " +
            (c.type || "") +
            "\nΣυντάκτης: " +
            (c.name || "—") +
            "\nΕνημέρωση: " +
            (c.updated || stamp) +
            "\nΛειτουργία: #" +
            feature(id).route +
            "\n\n## Σχόλιο\n" +
            (c.comment || "") +
            "\n\n## Βήματα / αναμενόμενη συμπεριφορά\n" +
            (c.steps || "") +
            "\n",
        });
        for (const [i, file] of (files[id] || []).entries()) {
          const safe =
            file.name
              .replace(/[^\p{L}\p{N}._-]/gu, "_")
              .replace(/^\.+/, "")
              .slice(0, 140) || "attachment";
          entries.push({
            name:
              "Markdown_Studio_Feedback/attachments/" +
              id +
              "/" +
              (i + 1) +
              "_" +
              safe,
            data: new Uint8Array(await file.arrayBuffer()),
          });
        }
      }
      download(
        zip(entries),
        "Markdown_Studio_Feedback_" + stamp.slice(0, 10) + ".zip",
      );
      E("feedbackStatus").textContent =
        "Το ZIP είναι έτοιμο για επισύναψη στο Discord.";
    } catch (e) {
      E("feedbackStatus").textContent = e.message;
    } finally {
      E("feedbackExport").disabled = false;
    }
  };
  document.addEventListener("DOMContentLoaded", () => {
    U.registerCombo(
      S.combo(E("feedbackFeature"), {
        items: () =>
          U.features.map((f) => ({
            value: f.name,
            label: f.name,
            id: f.id,
            keywords: f.keywords,
          })),
        onSelect: (o) => load(o.id),
        allowFree: false,
      }),
    );
    const c = comments[selected] || {};
    E("feedbackFeature").value = feature(selected).name;
    E("feedbackComment").value = c.comment || "";
    E("feedbackSteps").value = c.steps || "";
    E("feedbackName").value = c.name || "";
    E("feedbackType").value = c.type || "usability";
    loaded = true;
    const requested = new URLSearchParams(
      location.hash.split("?")[1] || "",
    ).get("feature");
    if (requested) load(requested);
    drawSaved();
  });
  window.addEventListener("studio:route", (e) => {
    if (e.detail.route === "/feedback") {
      const id = e.detail.query.get("feature");
      if (id) load(id);
    }
  });
  window.StudioFeedback = { zip };
})();
