/* Local vocabulary + prefix + typo suggestions inspired by discord-search-advanced.
 * No network, embeddings, or model required for UI search. */
(function (root) {
  "use strict";
  const norm = (s) =>
    String(s ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("el")
      .replace(/ς/g, "σ")
      .replace(/[_\s/-]+/g, " ")
      .trim();
  const words = (s) => norm(s).match(/[\p{L}\p{N}]+/gu) || [];
  const greek = {
    α: "a",
    β: "v",
    γ: "g",
    δ: "d",
    ε: "e",
    ζ: "z",
    η: "i",
    θ: "th",
    ι: "i",
    κ: "k",
    λ: "l",
    μ: "m",
    ν: "n",
    ξ: "x",
    ο: "o",
    π: "p",
    ρ: "r",
    σ: "s",
    τ: "t",
    υ: "y",
    φ: "f",
    χ: "ch",
    ψ: "ps",
    ω: "o",
  };
  const latin = (s) => norm(s).replace(/[α-ω]/g, (c) => greek[c] || c);
  function distance(a, b) {
    if (a.length > 90 || b.length > 90) return Math.max(a.length, b.length);
    const rows = [Array.from({ length: b.length + 1 }, (_, i) => i)];
    for (let i = 1; i <= a.length; i++) {
      const r = [i];
      for (let j = 1; j <= b.length; j++) {
        r[j] = Math.min(
          r[j - 1] + 1,
          rows[i - 1][j] + 1,
          rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        );
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
          r[j] = Math.min(r[j], rows[i - 2][j - 2] + 1);
      }
      rows.push(r);
    }
    return rows[a.length][b.length];
  }
  function tokenScore(q, w) {
    if (q === w) return 1;
    if (w.startsWith(q)) return 0.93;
    if (
      q.length < 3 ||
      Math.abs(q.length - w.length) > Math.max(2, Math.floor(q.length * 0.4))
    )
      return 0;
    return 1 - distance(q, w) / Math.max(q.length, w.length);
  }
  function index(items) {
    return items.map((x, i) => {
      const o = typeof x === "string" ? { value: x, label: x } : x;
      const n = norm(o.label + " " + (o.keywords || ""));
      return { ...o, i, n, tokens: words(n), roman: latin(n) };
    });
  }
  function rank(query, items, limit = 12) {
    const q = norm(query);
    if (!q)
      return items
        .slice(0, limit)
        .map((x) => ({ ...x, score: 1, corrected: false }));
    const qs = words(q).slice(0, 10);
    return items
      .map((o) => {
        let score;
        if (o.n === q) score = 2;
        else if (o.n.includes(q)) score = 1.6;
        else if (o.roman.includes(latin(q))) score = 1.4;
        else
          score =
            qs.reduce(
              (sum, t) =>
                sum + Math.max(0, ...o.tokens.map((w) => tokenScore(t, w))),
              0,
            ) / Math.max(1, qs.length);
        return { ...o, score, corrected: score < 1.35 };
      })
      .filter((x) => x.score >= 0.68)
      .sort((a, b) => b.score - a.score || a.i - b.i)
      .slice(0, limit);
  }
  const icon =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>';
  let sequence = 0;
  function combo(
    input,
    {
      items = () => [],
      onSelect = () => {},
      onQuery = () => {},
      placeholder,
      empty = "Δεν βρέθηκε αποτέλεσμα. Δοκίμασε άλλη λέξη.",
      allowFree = true,
    } = {},
  ) {
    const box = document.createElement("div");
    box.className = "searchbox";
    input.before(box);
    box.insertAdjacentHTML("beforeend", icon);
    box.append(input);
    input.type = "search";
    input.removeAttribute("list");
    input.autocomplete = "off";
    if (placeholder) input.placeholder = placeholder;
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "search-clear";
    clear.textContent = "×";
    clear.setAttribute("aria-label", "Καθαρισμός αναζήτησης");
    clear.hidden = !input.value;
    box.append(clear);
    const menu = document.createElement("div");
    menu.id = "suggestions-" + ++sequence;
    menu.className = "suggestions";
    menu.role = "listbox";
    menu.hidden = true;
    box.append(menu);
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", menu.id);
    let active = -1,
      found = [],
      timer,
      cachedRaw = null,
      cached = [];
    const close = () => {
      menu.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      active = -1;
    };
    const choose = (i) => {
      const o = found[i];
      if (!o) return;
      input.value = o.value;
      clear.hidden = false;
      close();
      onSelect(o);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      close();
    };
    const draw = () => {
      if (document.activeElement !== input) return;
      const raw = items();
      if (raw !== cachedRaw) {
        cached = index(raw);
        cachedRaw = raw;
      }
      found = rank(input.value, cached);
      active = -1;
      menu.replaceChildren();
      if (!found.length) {
        const e = document.createElement("p");
        e.className = "suggest-empty";
        e.textContent = empty;
        menu.append(e);
      }
      for (const [i, o] of found.entries()) {
        const b = document.createElement("div");
        b.id = menu.id + "-" + i;
        b.role = "option";
        b.setAttribute("aria-selected", "false");
        b.className = "suggest-option";
        const label = document.createElement("span");
        label.textContent = o.label;
        b.append(label);
        if (o.corrected) {
          const s = document.createElement("small");
          s.textContent = "Μήπως εννοείς;";
          b.append(s);
        }
        b.onpointerdown = (e) => {
          e.preventDefault();
          choose(i);
        };
        menu.append(b);
      }
      menu.hidden = false;
      input.setAttribute("aria-expanded", "true");
    };
    input.addEventListener("input", () => {
      clear.hidden = !input.value;
      clearTimeout(timer);
      timer = setTimeout(draw, 90);
      onQuery(input.value);
    });
    input.addEventListener("focus", draw);
    input.addEventListener("blur", () => {
      clearTimeout(timer);
      close();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (menu.hidden) draw();
        if (!found.length) return;
        active =
          (active + (e.key === "ArrowDown" ? 1 : -1) + found.length) %
          found.length;
        for (const [i, b] of [
          ...menu.querySelectorAll("[role=option]"),
        ].entries())
          b.setAttribute("aria-selected", String(i === active));
        input.setAttribute("aria-activedescendant", menu.id + "-" + active);
        menu.children[active]?.scrollIntoView({ block: "nearest" });
      }
      if (e.key === "Enter" && !menu.hidden && (active >= 0 || !allowFree)) {
        e.preventDefault();
        choose(active >= 0 ? active : 0);
      }
    });
    clear.onclick = () => {
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    };
    return {
      draw,
      close,
      box,
      invalidate: () => {
        cachedRaw = null;
      },
    };
  }
  const api = { norm, words, latin, distance, index, rank, combo, icon };
  root.StudioSearch = api;
  if (typeof module === "object") module.exports = api;
})(globalThis);
