const { chromium } = require("playwright"),
  assert = require("assert"),
  path = require("path"),
  fs = require("fs");
const os = require("os");
const appRoot = path.resolve(__dirname, "../..");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "studio-qa-"));
const launch = {
  headless: true,
  ...(process.env.STUDIO_TEST_BROWSER
    ? { executablePath: process.env.STUDIO_TEST_BROWSER }
    : {}),
  args: process.env.STUDIO_TEST_BROWSER
    ? [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--single-process",
      ]
    : [],
};
const base = process.env.STUDIO_TEST_BASE || "http://127.0.0.1:8765";
(async () => {
  const browser = await chromium.launch(launch);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    permissions: ["clipboard-read", "clipboard-write"],
    acceptDownloads: true,
  });
  const p = await context.newPage(),
    errors = [];
  context.on("page", (page) =>
    page.on("pageerror", (e) => errors.push(e.message)),
  );
  p.on("pageerror", (e) => errors.push(e.message));
  await context.route("**/api/ocr/status", (r) =>
    r.fulfill({ json: { available: false, loaded: false } }),
  );
  await context.route("**/api/github/status", (r) =>
    r.fulfill({
      json: {
        gh_installed: true,
        git_installed: true,
        authenticated: true,
        login: "test",
      },
    }),
  );
  const paths = [
    "1ο_Εξάμηνο/Γραμμική_Άλγεβρα/2025/ΚΑΝ",
    "1ο_Εξάμηνο/Ανάλυση/2025/ΚΑΝ",
    "1ο_Εξάμηνο/Φυσική/2024/ΚΑΝ",
    "2ο_Εξάμηνο/Φυσική/2025/ΚΑΝ",
  ];
  await context.route("https://api.github.com/**/git/trees/**", (r) =>
    r.fulfill({
      json: { tree: paths.map((path) => ({ path: path + "/thema.pdf" })) },
    }),
  );
  let sent = null;
  const items = [
    {
      number: 1,
      title: "Λύση Γραμμικής Άλγεβρας",
      body: "Περιγραφή με <script>alert(1)</script>",
      url: "https://github.com/ece-ntua-exam-solutions/Problems-Solutions/pull/1",
      files: [paths[0] + "/lysi.md"],
      author: "alice",
      state: "open",
      draft: true,
      labels: ["review"],
    },
    {
      number: 2,
      title: "Φυσική",
      body: "Δεύτερη λύση",
      url: "https://github.com/ece-ntua-exam-solutions/Problems-Solutions/pull/2",
      files: [paths[3] + "/lysi.pdf"],
      author: "bob",
      state: "open",
      draft: false,
      labels: [],
    },
  ];
  await context.route("**/api/reports/build", (r) =>
    r.fulfill({
      json: {
        items,
        settings: {},
        generated_at: "2026-10-25T14:00:00Z",
        warnings: [],
      },
    }),
  );
  await context.route("**/api/reports/send", (r) => {
    sent = r.request().postDataJSON();
    return r.fulfill({
      json: { sent: true, accepted: ["test@example.org"], refused: [] },
    });
  });
  await p.goto(base);
  await p.waitForFunction(
    () =>
      window.StudioUI &&
      document.querySelector("#course").getAttribute("role") === "combobox",
  );
  assert.equal(await p.locator(".collapsible:visible").count(), 0);
  assert.equal(await p.locator("html").getAttribute("data-theme"), "forum");
  await p.locator("#toggleMeta").click();
  await p.locator("#refreshRepo").click();
  await p.waitForFunction(() =>
    document.querySelector("#catalogStatus").textContent.includes("4"),
  );
  await p.locator("#course").fill("γραμικη αλγερα");
  await p.waitForTimeout(180);
  assert((await p.locator("#course").getAttribute("aria-expanded")) === "true");
  await p.locator("#course").press("ArrowDown");
  await p.locator("#course").press("Enter");
  assert.equal(await p.locator("#course").inputValue(), "Γραμμική Άλγεβρα");
  assert.equal(await p.locator("#repoPath").inputValue(), paths[0]);
  await p.locator("#semester").selectOption("2");
  assert.equal(await p.locator("#course").inputValue(), "");
  await p.locator("#course").focus();
  assert(
    (await p.locator("[role=listbox]:visible").textContent()).includes(
      "Φυσική",
    ),
  );
  assert(
    !(await p.locator("[role=listbox]:visible").textContent()).includes(
      "Γραμμική",
    ),
  );
  console.log("PASS scoped catalogue, typo correction and keyboard navigation");
  await p.locator("#metaPanel .panel-controls .icon-button").last().click();
  assert.equal(new URL(p.url()).hash, "#/editor");
  await p.keyboard.press("Control+k");
  await p.locator("#globalSearch").fill("εξισωσεις");
  await p.waitForTimeout(180);
  await p.locator("#globalSearch").press("Enter");
  assert.equal(new URL(p.url()).hash, "#/tools/equations");
  await p.locator("#equationCode").fill("x=\\frac{1}{2}");
  await p.waitForFunction(() => document.querySelector("#equationPreview svg"));
  await p.locator("#equationCopy").click();
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  assert(clip.includes("\\frac{1}{2}"));
  console.log("PASS feature search, deep route, MathJax preview, clipboard");
  await p.locator("#equationsPanel .panel-controls .help-trigger").click();
  await p.locator("#helpFeedback").click();
  await p.locator("#feedbackComment").fill("Πρόταση για εξισώσεις");
  await p.locator("#feedbackSave").click();
  await p.goto(base + "/#/tools/tables");
  await p.locator("#tableGrid input").first().fill("Μέγεθος & τιμή");
  await p.locator("#tableFormat").selectOption("tabular");
  assert((await p.locator("#tableOutput").inputValue()).includes("\\&"));
  await p.locator("#tableFormat").selectOption("markdown");
  await p.locator("#tableInsert").click();
  assert.equal(new URL(p.url()).hash, "#/editor");
  await p.waitForTimeout(400);
  assert((await p.locator("#docBody table").count()) > 0);
  console.log(
    "PASS table editing, LaTeX escaping and insertion into Markdown preview",
  );
  await p.goto(base + "/#/reports");
  await p.locator("#rBuild").click();
  await p.waitForFunction(
    () => document.querySelectorAll("#reportOutput article").length === 2,
  );
  await p.locator("#rQuery").fill("αλγερα");
  await p.waitForTimeout(250);
  assert.equal(await p.locator("#reportOutput article").count(), 1);
  assert(!(await p.locator("#reportOutput").innerHTML()).includes("<script>"));
  await p.locator("#emailOptions summary").click();
  await p.locator("#rRecipients").fill("test@example.org");
  p.once("dialog", (d) => d.accept());
  await p.locator("#rSend").click();
  await p.waitForTimeout(100);
  assert.equal(sent.report.items.length, 1);
  assert(sent.report.html.includes("Γραμμικής"));
  console.log(
    "PASS PR search, report escaping and exact filtered email payload (mock SMTP route)",
  );
  await p.goto(base + "/#/settings");
  await p.locator("#uiTheme").selectOption("dark");
  assert.equal(await p.locator("html").getAttribute("data-theme"), "dark");
  await p.reload();
  assert.equal(await p.locator("html").getAttribute("data-theme"), "dark");
  await p.locator("#resetAppearance").click();
  assert.equal(await p.locator("html").getAttribute("data-theme"), "forum");
  console.log("PASS theme persistence and reset");
  await p.goto(base + "/#/tools");
  const popupPromise = p.waitForEvent("popup");
  await p.locator('#toolCards a[target="_blank"]').first().click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  await popup.locator("#equationCode").fill("z=987654");
  await popup.locator("#equationInsert").click();
  await p.waitForFunction(() =>
    document.querySelector("#source").value.includes("987654"),
  );
  await popup
    .locator("#equationsPanel .panel-controls .icon-button")
    .last()
    .click();
  console.log("PASS detached tools and cross-window insertion");
  await p.goto(base + "/#/feedback?feature=reports");
  await p
    .locator("#feedbackComment")
    .fill("Αναζήτηση report, δοκιμαστικό σχόλιο");
  await p.locator("#feedbackSave").click();
  const dl = p.waitForEvent("download");
  await p.locator("#feedbackExport").click();
  const file = await dl;
  await file.saveAs(path.join(out, "feedback-test.zip"));
  assert(
    (
      await p.evaluate(() =>
        JSON.parse(localStorage.getItem("studio-feedback-v10")),
      )
    ).equations,
  );
  console.log("PASS per-feature feedback persistence and ZIP export");
  await p.goto(base + "/#/tools/image-latex");
  await p.locator("#ocrCheck").click();
  await p.waitForFunction(() =>
    document
      .querySelector("#ocrStatus")
      .textContent.includes("δεν είναι εγκατεστημένο"),
  );
  console.log("PASS missing OCR dependency is explicit");
  await p.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    "/editor",
    "/document",
    "/reports",
    "/settings",
    "/tools",
    "/tools/equations",
    "/tools/tables",
    "/tools/image-latex",
    "/feedback",
  ]) {
    await p.goto(base + "/#" + route);
    await p.waitForTimeout(80);
    const size = await p.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert(
      size.scroll <= size.width + 2,
      route + " overflow " + JSON.stringify(size),
    );
  }
  await p.goto(base + "/#/tools");
  await p.screenshot({
    path: path.join(out, "mobile-tools.png"),
    fullPage: true,
  });
  await p.setViewportSize({ width: 1440, height: 1000 });
  await p.goto(base + "/#/reports");
  await p.screenshot({ path: path.join(out, "reports.png"), fullPage: true });
  await p.goto(base + "/#/tools/equations");
  await p.screenshot({ path: path.join(out, "equations.png"), fullPage: true });
  assert.deepEqual(errors, []);
  console.log("PASS all 9 routes on mobile, no page errors");
  const offline = await context.newPage();
  const offlineErrors = [];
  offline.on("pageerror", (e) => offlineErrors.push(e.message));
  await offline.goto(
    "file://" + path.join(appRoot, "index.html") + "#/tools/tables",
  );
  await offline.waitForTimeout(300);
  assert(await offline.locator("#tablesPanel").isVisible());
  assert.deepEqual(offlineErrors, []);
  console.log("PASS HTML-only offline tool route");
  await browser.close();
})();
