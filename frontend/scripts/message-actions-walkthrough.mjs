/**
 * Walk the message actions from the second reference recording, then the
 * attachment flow, capturing each step:
 *
 *   reaction bar -> full emoji list -> reply bar -> More menu -> Pin dialog
 *   -> pinned banner and event -> Forward To -> Info -> Delete dialog
 *   -> attach two photos and a PDF -> sent bubbles -> lightbox
 *
 *   node scripts/message-actions-walkthrough.mjs <outputDir> <filesDir>
 *
 * filesDir must hold trail.jpg, summit.jpg and permits.pdf. Needs both dev
 * servers running and a freshly seeded database.
 */

import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import puppeteer from "puppeteer-core";

const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
const executablePath = CANDIDATES.find((path) => existsSync(path));
if (!executablePath) {
  console.error("No Chrome found. Set CHROME_PATH and try again.");
  process.exit(1);
}

const outDir = resolve(process.argv[2] ?? "message-actions");
const filesDir = resolve(process.argv[3] ?? "fixtures");
mkdirSync(outDir, { recursive: true });

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

const browser = await puppeteer.launch({
  executablePath,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
  defaultViewport: { width: 1366, height: 768 },
});
const page = await browser.newPage();
const problems = [];
page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error" && !message.text().includes("401")) {
    problems.push(`console: ${message.text()}`);
  }
});

async function clickText(text, selector = "button") {
  const ok = await page.evaluate(
    (t, sel) => {
      const node = [...document.querySelectorAll(sel)].find(
        (n) => (n.textContent ?? "").trim() === t && n.getClientRects().length > 0,
      );
      node?.click();
      return Boolean(node);
    },
    text,
    selector,
  );
  if (!ok) throw new Error(`No ${selector} with text "${text}"`);
}
async function clickLabel(label, scope = "") {
  const ok = await page.evaluate(
    (l, s) => {
      const root = s ? document.querySelector(s) : document;
      const node = [...(root?.querySelectorAll(`[aria-label="${l}"]`) ?? [])].find(
        (n) => n.getClientRects().length > 0,
      );
      node?.click();
      return Boolean(node);
    },
    label,
    scope,
  );
  if (!ok) throw new Error(`No element labelled "${label}"`);
}

let step = 0;
async function shot(name) {
  step += 1;
  const file = `${String(step).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: `${outDir}/${file}` });
  console.log(`  captured ${file}`);
}

/** Id of the last incoming (left-aligned) bubble in the open thread. */
async function lastIncomingId() {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll('[id^="msg-"]')].filter((n) =>
      n.className.includes("justify-start"),
    );
    return rows.at(-1)?.id ?? null;
  });
}

console.log(`Walking ${BASE} into ${outDir}`);
await page.goto(BASE, { waitUntil: "networkidle2", timeout: 90_000 });
await page.waitForSelector("#phone-field", { timeout: 30_000 });
await wait(1500);
await page.evaluate(() =>
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Ritvik Singla"))?.click(),
);
await page.waitForSelector("#code-field", { timeout: 20_000 });
await page.evaluate(() =>
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Verify"))?.click(),
);
await page.waitForFunction(() => document.body.innerText.includes("Aarav Mehta"), { timeout: 30_000 });
await wait(1200);
await page.evaluate(() =>
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Aarav Mehta"))?.click(),
);
await page.waitForSelector("#composer-field", { timeout: 20_000 });
await wait(1200);

// --- reactions ----------------------------------------------------------
let target = await lastIncomingId();
await page.hover(`#${target}`);
await wait(300);
await clickLabel("React", `#${target}`);
await wait(400);
await shot("reaction-bar");
await clickLabel("More reactions");
await wait(1200);
await shot("reaction-full-picker");
await page.keyboard.press("Escape");
await wait(300);
await page.hover(`#${target}`);
await clickLabel("React", `#${target}`);
await wait(300);
await clickLabel("React ❤️");
await wait(900);
await shot("reacted");

// --- reply ----------------------------------------------------------------
await page.hover(`#${target}`);
await clickLabel("Reply", `#${target}`);
await wait(400);
await shot("reply-bar");
await page.keyboard.press("Escape");

// --- more menu and pin ---------------------------------------------------
await page.hover(`#${target}`);
await clickLabel("More actions", `#${target}`);
await wait(400);
await shot("more-menu");
await clickText("Pin");
await wait(400);
await shot("pin-dialog");
await clickText("Pin");
await wait(1500);
await shot("pinned-banner-and-event");

// --- forward ----------------------------------------------------------------
target = await lastIncomingId();
await page.hover(`#${target}`);
await clickLabel("More actions", `#${target}`);
await wait(300);
await clickText("Forward");
await wait(500);
await shot("forward-dialog");
await page.evaluate(() =>
  [...document.querySelectorAll('[role="dialog"] button')]
    .find((b) => b.textContent?.includes("Priya Nair"))
    ?.click(),
);
await wait(300);
await shot("forward-picked");
await clickLabel("Send", '[role="dialog"]');
await wait(1200);

// --- info ---------------------------------------------------------------------
await page.hover(`#${target}`);
await clickLabel("More actions", `#${target}`);
await wait(300);
await clickText("Info");
await wait(1200);
await shot("message-info");
await clickLabel("Back");
await wait(600);

// --- delete -------------------------------------------------------------------
await page.hover(`#${target}`);
await clickLabel("More actions", `#${target}`);
await wait(300);
await clickText("Delete");
await wait(400);
await shot("delete-dialog");
await page.keyboard.press("Escape");
await wait(300);

// --- attachments ----------------------------------------------------------
const input = await page.$('input[type="file"]');
await input.uploadFile(`${filesDir}/trail.jpg`, `${filesDir}/summit.jpg`, `${filesDir}/permits.pdf`);
await wait(300);
await shot("staged-uploading");
await page.waitForFunction(
  () => !document.querySelector('svg[aria-label$="uploaded"]'),
  { timeout: 20_000 },
);
await page.type("#composer-field", "Trail photos and the permits");
await wait(300);
await shot("staged-ready");
await page.keyboard.press("Enter");
await wait(2500);
await shot("sent-attachments");

await page.evaluate(() => {
  const img = [...document.querySelectorAll('[id^="msg-"] button[aria-label^="Open"]')].at(-1);
  img?.click();
});
await wait(1200);
await shot("lightbox");
await page.keyboard.press("Escape");
await wait(400);

// --- select mode ------------------------------------------------------------
target = await lastIncomingId();
await page.hover(`#${target}`);
await clickLabel("More actions", `#${target}`);
await wait(300);
await clickText("Select");
await wait(500);
await shot("select-mode");

// --- reload: the album must come back from the server, in order ----------
await page.reload({ waitUntil: "networkidle2" });
await page.waitForFunction(() => document.body.innerText.includes("Aarav Mehta"), { timeout: 30_000 });
await wait(1000);
await page.evaluate(() =>
  [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Aarav Mehta"))?.click(),
);
await page.waitForSelector("#composer-field", { timeout: 20_000 });
await wait(2000);
await shot("after-reload");
const order = await page.evaluate(() =>
  [...document.querySelectorAll('[id^="msg-"] button[aria-label^="Open"]')].map((b) =>
    b.getAttribute("aria-label"),
  ),
);
console.log(`  album order after reload: ${order.join(", ")}`);

console.log(
  problems.length
    ? `\nBrowser reported ${problems.length} problems:\n  ${problems.slice(0, 12).join("\n  ")}`
    : "\nNo browser errors.",
);
await browser.close();
