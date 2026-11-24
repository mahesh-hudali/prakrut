/**
 * Real-browser smoke test.
 *
 * Drives the running dev server in Chrome to check the things jsdom cannot:
 * that typing produces exactly the characters typed, that the File and Export
 * menus are actually visible and clickable, and that PDF/DOCX downloads fire.
 *
 *   npm run dev            # in another terminal
 *   npm run test:browser
 */

import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

const CHROME =
  process.env.SMOKE_CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.SMOKE_PORT || 5191);

/**
 * Serve a fresh production build rather than reusing a dev server: a long-lived
 * dev server can keep serving stale transforms, which silently invalidates
 * everything below.
 */
async function startServer() {
  await new Promise((resolve, reject) => {
    const build = spawn("npx", ["vite", "build", "--logLevel", "error"], {
      stdio: "inherit",
    });
    build.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`build failed (${code})`))
    );
  });

  const server = spawn(
    "npx",
    ["vite", "preview", "--port", String(PORT), "--strictPort"],
    { stdio: ["ignore", "pipe", "inherit"] }
  );

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("preview did not start")), 30000);
    server.stdout.on("data", (chunk) => {
      if (String(chunk).includes(String(PORT))) {
        clearTimeout(timer);
        resolve();
      }
    });
  });

  return server;
}

const server = await startServer();
const BASE_URL = `http://localhost:${PORT}/`;

let failures = 0;
const check = (label, condition, detail = "") => {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

const browser = await chromium.launch({ executablePath: CHROME });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
const page = await context.newPage();

const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error") pageErrors.push(message.text());
});

await page.goto(BASE_URL, { waitUntil: "networkidle" });
await page.waitForSelector(".page-content [data-block-id]");

console.log("\n1. The page is a single editing surface");
{
  const surfaces = await page.locator(".page-content").count();
  const editables = await page.locator('[contenteditable="true"]').count();
  check("one contentEditable per page", surfaces === editables, `${surfaces} pages, ${editables} editables`);

  const placeholders = await page.locator("[data-placeholder]").count();
  check("at most one placeholder on screen", placeholders <= 1, `${placeholders} found`);
}

console.log("\n2. Typing produces exactly what was typed");
{
  // A paragraph with real prose: appending to a long paragraph is where the
  // stale slice offsets used to re-append already-typed characters.
  const target = page
    .locator(".page-content [data-block-id]")
    .filter({ hasText: /.{80,}/ })
    .last();

  // Put the caret at the true end of the paragraph. Pressing End would only
  // reach the end of the current visual line in a wrapped paragraph.
  await target.evaluate((el) => {
    el.closest(".page-content").focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });

  const charCount = () =>
    page
      .locator(".book-status span", { hasText: "Characters:" })
      .locator("strong")
      .textContent()
      .then((value) => Number(value.replace(/,/g, "")));

  const before = await target.textContent();
  const charsBefore = await charCount();
  await page.keyboard.type("niddeye", { delay: 45 });
  await page.waitForTimeout(600);

  // The status bar counts the document model, so this fails if the text only
  // ever reached the DOM.
  check(
    "the model received the text",
    (await charCount()) === charsBefore + 7,
    `${charsBefore} → ${await charCount()}`
  );

  const after = await target.textContent();
  check(
    "typing appends exactly the typed characters",
    after === `${before}niddeye`,
    `tail was "${after.slice(before.length)}"`
  );

  // Same again with pauses long enough for pagination to land between keys.
  for (const character of "xyz") {
    await page.keyboard.type(character);
    await page.waitForTimeout(220);
  }
  const afterSlow = await target.textContent();
  check(
    "typing across pagination passes stays exact",
    afterSlow === `${before}niddeyexyz`,
    `tail was "${afterSlow.slice(before.length)}"`
  );

  for (let i = 0; i < 10; i += 1) await page.keyboard.press("Backspace");
  await page.waitForTimeout(400);
  const restored = await target.textContent();
  check("backspace removes exactly what was typed", restored === before,
    `tail was "${restored.slice(before.length)}"`);
}

console.log("\n3. Kannada transliteration suggestions");
{
  const backendUp = await fetch("http://127.0.0.1:8000/health")
    .then((response) => response.ok)
    .catch(() => false);

  if (!backendUp) {
    console.log("  skip transliteration (backend not running)");
  } else {
    const target = page
      .locator(".page-content [data-block-id]")
      .filter({ hasText: /.{80,}/ })
      .last();
    await target.evaluate((el) => {
      el.closest(".page-content").focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });

    await page.keyboard.type(" naanu", { delay: 60 });

    let suggestions = [];
    try {
      await page.waitForSelector(".xlit-suggestions .xlit-kn", { timeout: 8000 });
      suggestions = await page
        .locator(".xlit-suggestions .xlit-kn")
        .allTextContents();
    } catch {
      /* reported below */
    }

    check("suggestions appear for a Roman word", suggestions.length > 0);
    check(
      "suggestions are in Kannada",
      suggestions.some((text) => /[\u0C80-\u0CFF]/.test(text)),
      suggestions.slice(0, 4).join(", ")
    );

    await page.keyboard.press("Escape");
    for (let i = 0; i < 6; i += 1) await page.keyboard.press("Backspace");
    await page.waitForTimeout(300);
  }
}

console.log("\n4. Enter and Backspace join/split paragraphs");
{
  // Enter accepts a transliteration suggestion while the popup is open, so
  // make sure it is dismissed before testing paragraph splitting.
  await page.keyboard.press("Escape");
  await page
    .locator(".xlit-suggestions")
    .waitFor({ state: "hidden", timeout: 3000 })
    .catch(() => {});

  const countBefore = await page.locator(".page-content [data-block-id]").count();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(350);
  const countAfter = await page.locator(".page-content [data-block-id]").count();
  check("Enter creates a paragraph", countAfter === countBefore + 1, `${countBefore} → ${countAfter}`);

  await page.keyboard.press("Backspace");
  await page.waitForTimeout(350);
  const countMerged = await page.locator(".page-content [data-block-id]").count();
  check("Backspace merges it back", countMerged === countBefore, `${countAfter} → ${countMerged}`);
}

console.log("\n5. Menus are visible");
{
  const fileTrigger = page.getByRole("button", { name: "File ▾" });
  check("File button is visible", await fileTrigger.isVisible());
  await fileTrigger.click();
  const fileMenu = page.locator(".file-dropdown");
  check("File dropdown opens on screen", await fileMenu.isVisible());
  const box = await fileMenu.boundingBox();
  check(
    "File dropdown is inside the viewport",
    Boolean(box) && box.y >= 0 && box.y + box.height <= 900,
    JSON.stringify(box)
  );
  await page.keyboard.press("Escape");

  const exportTrigger = page.getByRole("button", { name: "Export ▾" });
  check("Export button is visible", await exportTrigger.isVisible());

  const contrast = await exportTrigger.evaluate((el) => {
    const style = getComputedStyle(el);
    return { color: style.color, background: style.backgroundColor };
  });
  check(
    "Export button is not white-on-white",
    contrast.color !== contrast.background,
    JSON.stringify(contrast)
  );

  await exportTrigger.click();
  check("Export dropdown opens on screen", await page.locator(".export-dropdown").isVisible());
  await page.keyboard.press("Escape");
}

console.log("\n6. Exports produce files containing the current text");
{
  const MARKER = "ZqxExportMarker";
  await page
    .locator(".page-content [data-block-id]")
    .filter({ hasText: /.{80,}/ })
    .last()
    .evaluate((el) => {
      el.closest(".page-content").focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });
  await page.keyboard.type(MARKER);
  await page.waitForTimeout(500);

  const { stat } = await import("node:fs/promises");
  const { execFileSync } = await import("node:child_process");

  for (const [label, itemName] of [
    ["DOCX", "Export as DOCX"],
    ["PDF", "Export as PDF"],
  ]) {
    await page.getByRole("button", { name: "Export ▾" }).click();
    try {
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 60000 }),
        page.getByRole("menuitem", { name: itemName }).click(),
      ]);
      const path = await download.path();
      const { size } = await stat(path);
      check(
        `${label} downloaded`,
        size > 1000,
        `${download.suggestedFilename()} (${size} bytes)`
      );

      if (label === "DOCX") {
        const xml = execFileSync("unzip", ["-p", path, "word/document.xml"], {
          encoding: "utf8",
          maxBuffer: 64 * 1024 * 1024,
        });
        check("DOCX contains the freshly typed text", xml.includes(MARKER));
        check(
          "DOCX preserves Kannada text",
          /[\u0C80-\u0CFF]/.test(xml)
        );
      }
    } catch (error) {
      check(`${label} downloaded`, false, String(error).split("\n")[0]);
    }
  }
}

console.log("\n7. No runtime errors");
{
  // The transliteration backend is not part of this smoke test.
  const relevant = pageErrors.filter(
    (text) =>
      !/favicon|transliterate|Failed to fetch|ERR_FAILED|ERR_CONNECTION|127\.0\.0\.1:8000/i.test(
        text
      )
  );
  check("console is clean", relevant.length === 0, relevant.slice(0, 3).join(" | "));
}

await browser.close();
server.kill();

console.log(
  failures === 0
    ? "\nAll browser smoke checks passed.\n"
    : `\n${failures} browser smoke check(s) failed.\n`
);
process.exit(failures === 0 ? 0 : 1);
