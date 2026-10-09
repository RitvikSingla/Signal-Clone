/**
 * Walk the flows from reference recordings 3 and 4, capturing each step:
 *
 *   unread divider and two-line previews -> a tall photo with a caption ->
 *   hover Download (checks the signal-<timestamp> file name) -> lightbox
 *   Forward / Download / Close -> chat-scoped search in the left pane and
 *   jumping to a hit -> scroll-to-bottom button -> accepted-request
 *   "Block or Report" dialog -> File menu -> Sticker Pack Creator, install a
 *   pack and send a sticker -> "Allow Access" for calls -> call lobby ->
 *   record and send a voice message
 *
 *   node scripts/media-search-walkthrough.mjs <outputDir> <filesDir>
 *
 * filesDir must hold screenshot.png and smile.png. Chrome runs with a fake
 * camera and microphone so the media paths really execute. Needs both dev
 * servers and a freshly seeded database.
 */

import { existsSync, mkdirSync, readdirSync } from "node:fs";
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

const outDir = resolve(process.argv[2] ?? "media-search");
const filesDir = resolve(process.argv[3] ?? "fixtures");
const downloadDir = resolve(outDir, "downloads");
mkdirSync(downloadDir, { recursive: true });

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

const browser = await puppeteer.launch({
  executablePath,
  headless: "new",
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
  defaultViewport: { width: 1366, height: 768 },
});
const page = await browser.newPage();
const cdp = await page.createCDPSession();
await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir });

const problems = [];
page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error" && !message.text().includes("401")) {
    problems.push(`console: ${message.text()}`);
  }
});

let step = 0;
async function shot(name) {
  step += 1;
  const file = `${String(step).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: `${outDir}/${file}` });
  console.log(`  captured ${file}`);
}

async function clickText(text, scope = "body") {
  const ok = await page.evaluate(
    (t, s) => {
      const root = document.querySelector(s) ?? document.body;
      const node = [...root.querySelectorAll("button, [role=menuitem]")].find(
        (n) => (n.textContent ?? "").trim() === t && n.getClientRects().length > 0,
      );
      node?.click();
      return Boolean(node);
    },
    text,
    scope,
  );
  if (!ok) throw new Error(`No button "${text}" in ${scope}`);
}
async function clickIncludes(text) {
  const ok = await page.evaluate((t) => {
    const node = [...document.querySelectorAll("button")].find(
      (n) => (n.textContent ?? "").includes(t) && n.getClientRects().length > 0,
    );
    node?.click();
    return Boolean(node);
  }, text);
  if (!ok) throw new Error(`No button containing "${text}"`);
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
const lastBubble = (side) =>
  page.evaluate((cls) => {
    const rows = [...document.querySelectorAll('[id^="msg-"]')].filter((n) => n.className.includes(cls));
    return rows.at(-1)?.id ?? null;
  }, side === "mine" ? "justify-end" : "justify-start");

console.log(`Walking ${BASE} into ${outDir}`);
await page.goto(BASE, { waitUntil: "networkidle2", timeout: 90_000 });
await page.waitForSelector("#phone-field", { timeout: 30_000 });
await wait(1500);
await clickIncludes("Ritvik Singla");
await page.waitForSelector("#code-field", { timeout: 20_000 });
await clickIncludes("Verify");
await page.waitForFunction(() => document.body.innerText.includes("Aarav Mehta"), { timeout: 30_000 });
await wait(1200);
await shot("two-line-previews");

// --- unread divider ------------------------------------------------------
await clickIncludes("Aarav Mehta");
await page.waitForSelector("#composer-field", { timeout: 20_000 });
await wait(1500);
const divider = await page.evaluate(() => document.body.innerText.match(/\d+ Unread Messages?/)?.[0] ?? null);
console.log(`  unread divider: ${divider}`);
await shot("unread-divider");

// --- tall photo with a caption --------------------------------------------
const input = await page.$('input[type="file"]');
await input.uploadFile(`${filesDir}/screenshot.png`);
await page.waitForFunction(() => !document.querySelector('svg[aria-label$="uploaded"]'), { timeout: 20_000 });
await page.type("#composer-field", "3 dots");
await page.keyboard.press("Enter");
await wait(2500);
let photo = await lastBubble("mine");
await page.hover(`#${photo}`);
await wait(300);
await shot("photo-hover-download");
await clickLabel("Download", `#${photo}`);
await wait(2500);
const saved = readdirSync(downloadDir);
console.log(`  downloaded: ${saved.join(", ") || "(nothing)"}`);

await page.evaluate((id) => document.querySelector(`#${id} button[aria-label^="Open"]`)?.click(), photo);
await wait(1000);
await shot("lightbox-icons");
await clickLabel("Forward", '[aria-label="Media viewer"]');
await wait(500);
await shot("lightbox-forward");
await page.keyboard.press("Escape");
await wait(400);

// --- chat-scoped search ----------------------------------------------------
await clickLabel("Search in chat");
await wait(400);
await page.type("#conversation-search", "sto", { delay: 60 });
await wait(120);
await shot("scoped-search-loading");
await wait(1200);
await shot("scoped-search-results");
await page.evaluate(() => {
  const hit = [...document.querySelectorAll("aside button")].find((b) =>
    (b.textContent ?? "").includes("Small stove"),
  );
  hit?.click();
});
await wait(1500);
await shot("jumped-to-hit");
const scrolledUp = await page.evaluate(() => Boolean(document.querySelector('[aria-label="Scroll to bottom"]')));
console.log(`  scroll-to-bottom button shown: ${scrolledUp}`);
await clickLabel(`Stop searching in Aarav Mehta`);
await wait(400);

// --- accepted request: Block or Report ---------------------------------------
await clickIncludes("Lucas Silva");
await page.waitForFunction(() => document.body.innerText.includes("Review requests carefully"), { timeout: 20_000 });
await clickText("Accept");
await wait(300);
await clickText("Accept", '[role="dialog"]');
await page.waitForSelector("#composer-field", { timeout: 20_000 });
await wait(800);
await clickIncludes("Block or Report");
await wait(400);
await shot("block-or-report");
await clickText("Cancel", '[role="dialog"]');
await wait(300);

// --- File menu and the Sticker Pack Creator -------------------------------
await clickText("File", '[role="menubar"]');
await wait(300);
await shot("file-menu");
await clickText("Create/upload sticker pack");
await wait(500);
await shot("sticker-creator");
const stickerInput = await page.$('[aria-label="Signal Sticker Pack Creator"] input[type="file"]');
await stickerInput.uploadFile(`${filesDir}/smile.png`);
await wait(500);
await shot("sticker-added");
await clickText("Next", '[aria-label="Signal Sticker Pack Creator"]');
await wait(300);
await page.select('[aria-label="Emoji for this sticker"]', "😀");
await clickText("Next", '[aria-label="Signal Sticker Pack Creator"]');
await page.type("#pack-title", "Sunny");
await page.type("#pack-author", "Ritvik");
await clickText("Upload", '[aria-label="Signal Sticker Pack Creator"]');
await page.waitForFunction(() => document.body.innerText.includes("Your sticker pack is installed"), { timeout: 20_000 });
await shot("sticker-installed");
await clickText("Done");
await wait(300);
await clickLabel("Open emoji chooser");
await wait(600);
await clickText("Stickers");
await wait(600);
await shot("custom-pack-in-picker");
await clickLabel("Send sticker 😀");
await wait(2500);
await shot("sticker-sent");

// --- calls: Allow Access, then the lobby -------------------------------------
await clickLabel("Start video call");
await wait(500);
await shot("allow-access-call");
await clickText("Cancel", '[aria-label="Allow Access"]');
await wait(300);
await clickLabel("Start voice call");
await wait(400);
await clickText("Allow Access", '[aria-label="Allow Access"]');
await wait(1500);
await shot("call-lobby");
await clickText("Leave");
await wait(400);

// --- voice message ------------------------------------------------------------
await clickLabel("Record a voice message");
await wait(2200);
await shot("recording");
await clickLabel("Send voice message");
await wait(3000);
await shot("voice-note-sent");

console.log(
  problems.length
    ? `\nBrowser reported ${problems.length} problems:\n  ${problems.slice(0, 12).join("\n  ")}`
    : "\nNo browser errors.",
);
await browser.close();
