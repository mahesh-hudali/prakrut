/**
 * Real-browser smoke test for the Prakrut home page (ProseMirror editor and
 * book library).
 *
 * Builds, serves the production bundle and drives Chrome. The library folder
 * is the browser's private file system (?library=opfs): Chrome's folder
 * picker cannot be automated, and OPFS has the same file API.
 *
 *   npm run test:browser
 */
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

const CHROME = process.env.SMOKE_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.SMOKE_PORT || 5191);
const URL_ = `http://localhost:${PORT}/?library=opfs`;

async function startServer() {
  await new Promise((resolve, reject) => {
    const build = spawn("npx", ["vite", "build", "--logLevel", "error"], { stdio: "inherit" });
    build.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`build failed (${code})`))));
  });
  const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
    stdio: ["ignore", "pipe", "inherit"],
  });
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
const browser = await chromium.launch({ executablePath: CHROME });
// A crash must not leave the server running (it would block the next run).
const shutdown = async (code) => {
  await browser.close().catch(() => {});
  server.kill();
  process.exit(code);
};
for (const event of ["uncaughtException", "unhandledRejection"]) {
  process.on(event, (error) => {
    console.error(error);
    shutdown(1);
  });
}

let failures = 0;
const check = (label, condition, detail = "") => {
  if (!condition) failures += 1;
  console.log(`${condition ? "  ok  " : "  FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

const paragraphs = () => page.locator(".manuscript .page-paragraph");
const paragraphTexts = () => paragraphs().allTextContents();
const readOpfs = (path) =>
  page.evaluate(async (parts) => {
    let dir = await navigator.storage.getDirectory();
    for (const name of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(name);
    const last = parts[parts.length - 1];
    if (last === "*") {
      const names = [];
      for await (const [name] of dir.entries()) names.push(name);
      return names;
    }
    return (await (await dir.getFileHandle(last)).getFile()).text();
  }, path);
// Like a writer's click-and-drag: focus the editor, then select.
const selectText = async (index, start, end) => {
  await paragraphs().nth(index).click();
  await page.evaluate(
    ([i, s, e]) => {
      const el = document.querySelectorAll(".manuscript .page-paragraph")[i];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const node = walker.nextNode();
      const range = document.createRange();
      range.setStart(node, s);
      range.setEnd(node, e);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    },
    [index, start, end]
  );
  await page.waitForTimeout(150);
};

console.log("\n1. Library and a new, blank book");
await page.goto(URL_, { waitUntil: "networkidle" });
await page.getByRole("heading", { name: "Your books" }).waitFor();
check("first visit opens the library, not a sample book", (await page.locator(".manuscript").count()) === 0);
await page.getByRole("button", { name: "Choose folder" }).click();
await page.getByText("Books are kept in your").waitFor();
check("library folder connected", true);
await page.getByLabel("Title of your new book").fill("ಪರೀಕ್ಷಾ ಪುಸ್ತಕ");
await page.getByRole("button", { name: "New book" }).click();
await page.locator(".manuscript").waitFor();
const blank = await paragraphTexts();
check("a new book is blank (chapter title + empty paragraph)", blank.length === 2 && blank[1] === "", JSON.stringify(blank));

console.log("\n2. Typing, Enter and autosave");
await paragraphs().nth(1).click();
await page.keyboard.type("ಮೊದಲ ಸಾಲು ಇಲ್ಲಿದೆ");
await page.keyboard.press("Enter");
await page.keyboard.type("Second line in English");
await page.waitForTimeout(400);
check("Enter makes exactly one new paragraph", (await paragraphs().count()) === 3);
await page.waitForTimeout(1200);
check("status says saved locally", /Saved locally/.test(await page.locator(".status-bar__save").textContent()));

await page.reload({ waitUntil: "networkidle" });
await page.locator(".manuscript").waitFor();
await page.waitForTimeout(300);
const afterReload = await paragraphTexts();
check(
  "refresh reopens the same book with every change",
  afterReload.includes("ಮೊದಲ ಸಾಲು ಇಲ್ಲಿದೆ") && afterReload.includes("Second line in English"),
  JSON.stringify(afterReload)
);

await page.waitForTimeout(800);
const folders = await readOpfs(["prakrut-kbooks", "*"]);
const bookFolder = folders[0];
check("the book has its own folder", folders.length === 1, JSON.stringify(folders));
const autosave = await readOpfs(["prakrut-kbooks", bookFolder, "autosave.kbook"]).catch(() => "");
check("folder backup (autosave.kbook) is current right after a refresh", autosave.includes("Second line in English"));

await page.keyboard.press("ControlOrMeta+s");
await page.waitForTimeout(800);
const saved = await readOpfs(["prakrut-kbooks", bookFolder, "book.kbook"]).catch(() => "");
const backups = await readOpfs(["prakrut-kbooks", bookFolder, "backups", "*"]).catch(() => []);
check("⌘S writes book.kbook", saved.includes("ಮೊದಲ ಸಾಲು"));
check("⌘S keeps a dated backup", backups.length === 1, JSON.stringify(backups));

console.log("\n3. Formatting applies to the selection only");
await selectText(1, 0, 4);
await page.getByLabel("Font size").selectOption("18");
await page.waitForTimeout(200);
const sized = await page.evaluate(() => {
  const ps = document.querySelectorAll(".manuscript .page-paragraph");
  return { big: [...ps[1].querySelectorAll("span")].filter((s) => s.style.fontSize === "18pt").map((s) => s.textContent), other: getComputedStyle(ps[2]).fontSize, base: getComputedStyle(ps[1]).fontSize };
});
check("size changes only the selected word", sized.big.length === 1 && sized.big[0] === "ಮೊದಲ" && sized.other === sized.base, JSON.stringify(sized));
await page.keyboard.press("ControlOrMeta+z");

console.log("\n4. Binder: chapters");
await page.keyboard.press("ControlOrMeta+Shift+b");
await page.getByRole("button", { name: "New chapter" }).click();
await page.waitForTimeout(300);
check("New chapter adds a chapter", (await page.locator(".manuscript .manuscript-chapter").count()) === 2);
check("binder lists both chapters", (await page.locator(".chapter-list li").count()) === 2);
await page.getByRole("button", { name: "Move up" }).nth(1).click();
await page.waitForTimeout(200);
const firstTitle = await page.locator(".manuscript .manuscript-chapter").first().locator(".page-paragraph").first().textContent();
check("Move up reorders chapters", firstTitle === "ಅಧ್ಯಾಯ 2", firstTitle);
page.once("dialog", (d) => d.accept());
await page.getByRole("button", { name: "Delete chapter" }).first().click();
await page.waitForTimeout(300);
check("Delete removes the chapter", (await page.locator(".manuscript .manuscript-chapter").count()) === 1);
await page.keyboard.press("ControlOrMeta+Shift+b");

console.log("\n5. Comments and highlights");
await selectText(2, 0, 6);
await page.locator(".selection-toolbar").waitFor();
await page.locator(".selection-toolbar").getByRole("button", { name: "Comment" }).click();
await page.getByLabel("Comment", { exact: true }).fill("Check this word");
await page.getByRole("button", { name: "Add comment" }).click();
await page.waitForTimeout(400);
check("comment highlight on the text", (await page.locator(".manuscript .comment-mark.is-unresolved").count()) === 1);
check("comment listed in the panel", (await page.locator(".comment-card").count()) === 1);
await page.getByRole("button", { name: "Resolve" }).click();
await page.waitForTimeout(300);
check("resolving keeps a quiet trace", (await page.locator(".manuscript .comment-mark.is-resolved").count()) === 1);
await page.getByLabel("Show resolved").check();
await page.getByRole("button", { name: "Delete" }).click();
await page.waitForTimeout(300);
check("deleting removes the mark", (await page.locator(".manuscript .comment-mark").count()) === 0);
await selectText(2, 7, 11);
await page.locator(".selection-toolbar").waitFor();
await page.getByRole("button", { name: "Highlight green" }).click();
await page.waitForTimeout(200);
check("highlight colour applies", (await page.locator(".manuscript .comment-mark").count()) === 1);

console.log("\n6. Kannada typing and transliteration");
// A deliberate click at the start of the line (not a repeat of the last one).
await page.waitForTimeout(600);
await paragraphs().nth(2).click({ position: { x: 4, y: 6 } });
await page.keyboard.press("Home");
await page.keyboard.type("ಇಲ್ಲಿ ", { delay: 30 });
await page.waitForTimeout(200);
const typedLine = await paragraphs().nth(2).textContent();
check("Kannada typed before existing text stays intact", typedLine.startsWith("ಇಲ್ಲಿ Second"), typedLine);

// The case Chrome itself gets wrong (even in a plain <textarea>): a virama
// typed in front of Kannada fuses with the next letter, and the caret jumps.
await paragraphs().nth(1).click();
await page.keyboard.press("Home");
await page.keyboard.type("ಇಲ್ಲಿ ", { delay: 30 });
await page.waitForTimeout(200);
const fused = await paragraphs().nth(1).textContent();
check("Kannada typed before Kannada is not scrambled", fused.startsWith("ಇಲ್ಲಿ ಮೊದಲ"), fused);
const backendUp = await fetch("http://127.0.0.1:8000/health", { signal: AbortSignal.timeout(3000) }).then((r) => r.ok).catch(() => false);
if (backendUp) {
  await page.waitForTimeout(600);
  await paragraphs().nth(2).click({ position: { x: 4, y: 6 } });
  await page.keyboard.press("End");
  await page.keyboard.type(" naanu", { delay: 50 });
  await page.locator(".xlit .xlit-kn").first().waitFor({ timeout: 8000 }).catch(() => {});
  const suggestions = await page.locator(".xlit .xlit-kn").allTextContents();
  check("suggestions for the word at the caret", suggestions[0] === "ನಾನು", suggestions.join(" "));
  await page.keyboard.press(" ");
  await page.waitForTimeout(200);
  check("Space accepts it", (await paragraphs().nth(2).textContent()).includes("ನಾನು "));
} else {
  console.log("  skip transliteration (backend not running)");
}

console.log("\n7. Focus mode");
await page.keyboard.press("ControlOrMeta+Shift+f");
await page.waitForTimeout(300);
check("focus hides the toolbar and status bar", !(await page.locator(".writer-toolbar").isVisible()) && !(await page.locator(".status-bar").isVisible()));
await page.keyboard.press("ControlOrMeta+Shift+f");
await page.waitForTimeout(300);
check("leaving focus brings them back", await page.locator(".writer-toolbar").isVisible());

console.log("\n8. Export");
await page.getByRole("button", { name: "Export", exact: true }).click();
const [download] = await Promise.all([
  page.waitForEvent("download", { timeout: 60000 }),
  page.getByRole("menuitem", { name: "Export as DOCX" }).click(),
]);
const { execFileSync } = await import("node:child_process");
const xml = execFileSync("unzip", ["-p", await download.path(), "word/document.xml"], { encoding: "utf8", maxBuffer: 64 << 20 });
// Text is split into runs wherever formatting changes; compare the words.
const docxText = xml.replace(/<[^>]+>/g, "");
check("DOCX contains the latest text", docxText.includes("Second line in English") && docxText.includes("ಮೊದಲ"), docxText.slice(0, 160));

console.log("\n9. Library");
await page.getByRole("button", { name: "Books" }).click();
await page.getByRole("heading", { name: "Your books" }).waitFor();
check("the book is listed", (await page.locator(".library__book").count()) === 1);
await page.getByLabel("Title of your new book").fill("Second book");
await page.getByRole("button", { name: "New book" }).click();
await page.locator(".manuscript").waitFor();
await page.getByRole("button", { name: "Books" }).click();
await page.locator(".library__book").nth(1).waitFor({ timeout: 5000 }).catch(() => {});
check("both books listed", (await page.locator(".library__book").count()) === 2);
await page.locator(".library__book", { hasText: "ಪರೀಕ್ಷಾ ಪುಸ್ತಕ" }).click();
await page.locator(".manuscript").waitFor();
check("opening a book from the list shows its text", (await paragraphTexts()).some((t) => t.includes("ಮೊದಲ ಸಾಲು")));

console.log("\n10. Theme and phone width");
await page.getByRole("button", { name: "View", exact: true }).click();
await page.getByRole("menuitemradio", { name: "Dark" }).click();
check("dark theme applies", (await page.evaluate(() => document.documentElement.dataset.theme)) === "dark");
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(500);
const overflow = await page.evaluate(() => {
  const stage = document.querySelector(".manuscript-stage");
  const bar = document.querySelector(".writer-toolbar .ds-toolbar");
  return { stage: stage.scrollWidth - stage.clientWidth, bar: bar.scrollWidth - bar.clientWidth };
});
check("page and toolbar fit a phone", overflow.stage <= 1 && overflow.bar <= 1, JSON.stringify(overflow));

console.log("\n11. No runtime errors");
const relevant = errors.filter((t) => !/favicon|transliterate|127\.0\.0\.1:8000|ERR_CONNECTION/i.test(t));
check("console is clean", relevant.length === 0, relevant.slice(0, 3).join(" | "));

console.log(failures === 0 ? "\nAll browser checks passed.\n" : `\n${failures} browser check(s) failed.\n`);
await shutdown(failures === 0 ? 0 : 1);
