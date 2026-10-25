const { chromium } = require("playwright"),
  assert = require("assert"),
  path = require("path"),
  os = require("os");
const output = process.env.STUDIO_TEST_OUTPUT || os.tmpdir();
const input =
  process.env.STUDIO_OCR_TEST_IMAGE ||
  path.join(__dirname, "fixtures/ocr_multiline.png");
const base = process.env.STUDIO_TEST_BASE || "http://127.0.0.1:8765";
const good = [
  String.raw`\frac{x-1}{2}-\frac{2x+1}{6}=x+1`,
  String.raw`6\cdot\frac{x-1}{2}-6\cdot\frac{2x+1}{6}=6x+6`,
  String.raw`3(x-1)-(2x+1)=6x+6`,
  String.raw`3x-3-2x-1=6x+6`,
  String.raw`3x-2x-6x=6+3+1`,
  String.raw`-5x=10`,
  String.raw`\frac{-5x}{-5}=\frac{10}{-5}`,
  String.raw`x=-2`,
];
const bad =
  String.raw`\begin{array}{l}` +
  String.raw`\frac{1}{1}\mathrm{I}^{1}`.repeat(12) +
  String.raw`\end{array}`;
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.STUDIO_TEST_BROWSER
      ? {
          executablePath: process.env.STUDIO_TEST_BROWSER,
          args: [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-zygote",
            "--single-process",
          ],
        }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const p = await context.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  let captured = null;
  await context.route("**/api/ocr/status", (r) =>
    r.fulfill({ json: { available: true, loaded: true } }),
  );
  await context.route("**/api/ocr/equation", (r) => {
    captured = r.request().postDataJSON();
    return r.fulfill({
      json: {
        lines: captured.regions.map((rect, i) => ({
          index: i,
          rect,
          latex: i === 0 ? bad : good[i],
          flags: i === 0 ? ["repeated_ones"] : [],
          alternatives:
            i === 0
              ? [
                  { latex: bad, flags: ["repeated_ones"], resize: true },
                  { latex: good[0], flags: [], resize: false },
                ]
              : [],
        })),
        suspect: true,
      },
    });
  });
  await p.goto(base + "/#/tools/image-latex");
  await p.locator("#ocrFile").setInputFiles(input);
  await p.waitForFunction(
    () => document.querySelectorAll("#ocrLineSelection input").length === 8,
  );
  assert.equal(await p.locator(".ocr-region").count(), 8);
  assert(await p.locator("#ocrAckLabel").isHidden());
  console.log(
    "PASS actual analyze endpoint: test input detected as 8 intact regions",
  );
  await p.locator("#ocrAllowModel").check();
  await p.locator("#ocrConvert").click();
  await p.waitForFunction(() => !document.querySelector("#ocrQuality").hidden);
  assert.equal(captured.regions.length, 8);
  assert(await p.locator("#ocrCopy").isDisabled());
  assert((await p.locator("#ocrStatus").textContent()).includes("ύποπτο"));
  await p.locator("#ocrAck").check();
  assert(await p.locator("#ocrCopy").isEnabled());
  await p.locator("#ocrCode").fill("x=-2");
  await p.waitForTimeout(250);
  assert(await p.locator("#ocrCopy").isDisabled());
  console.log(
    "PASS suspect output warning, copy gate and edit resets acknowledgment",
  );
  await p.locator("#ocrLineResults summary").click();
  await p
    .locator("#ocrAlternatives section")
    .first()
    .getByRole("button", { name: /Απόπειρα 2/ })
    .click();
  assert(await p.locator("#ocrQuality").isHidden());
  assert(await p.locator("#ocrAckLabel").isHidden());
  assert(await p.locator("#ocrCopy").isEnabled());
  await p.locator("#ocrCopyMarkdown").click();
  assert(
    (await p.evaluate(() => navigator.clipboard.readText())).includes(
      "aligned",
    ),
  );
  console.log("PASS alternate scaling candidate and multiline copy");
  const box = await p.locator("#ocrImage").boundingBox(),
    region = await p.locator(".ocr-region").first().boundingBox();
  await p.mouse.move(box.x + 3, region.y - 3);
  await p.mouse.down();
  await p.mouse.move(box.x + box.width - 3, region.y + region.height + 3, {
    steps: 5,
  });
  await p.mouse.up();
  await p.waitForFunction(
    () => document.querySelectorAll("#ocrLineSelection input").length === 1,
  );
  await p.locator("#ocrResetCrop").click();
  await p.waitForFunction(
    () => document.querySelectorAll("#ocrLineSelection input").length === 8,
  );
  await p.locator("#ocrLayout").selectOption("single");
  await p.waitForFunction(
    () => document.querySelectorAll("#ocrLineSelection input").length === 1,
  );
  console.log("PASS draggable crop, reset and single-block override");
  await p.screenshot({
    path: path.join(output, "studio-ocr-qa.png"),
    fullPage: true,
  });
  await p.setViewportSize({ width: 390, height: 844 });
  const dims = await p.evaluate(() => ({
    w: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert(dims.scroll <= dims.w + 2);
  assert.deepEqual(errors, []);
  await browser.close();
  console.log("PASS OCR mobile width and no JavaScript errors");
})();
