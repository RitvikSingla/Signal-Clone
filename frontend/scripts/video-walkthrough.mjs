/**
 * Walk the app along the same path as the reference screen recording and
 * capture each step, so the clone can be compared with Signal Desktop frame
 * by frame. Needs both dev servers running and a freshly seeded database
 * (the Lucas Silva message request is consumed once accepted).
 *
 *   node scripts/video-walkthrough.mjs [outputDir]
 *
 * Set CHROME_PATH if Chrome is not in one of the usual locations.
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

const outDir = resolve(process.argv[2] ?? "walkthrough");
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
  if (message.type() === "error") problems.push(`console: ${message.text()}`);
});

async function clickByText(needle, selector = "button") {
  const found = await page.evaluate(
    (text, sel) => {
      const element = [...document.querySelectorAll(sel)].find(
        (node) => (node.textContent ?? "").trim().includes(text) && node.getClientRects().length > 0,
      );
      if (!element) return false;
      element.click();
      return true;
    },
    needle,
    selector,
  );
  if (!found) throw new Error(`No ${selector} containing "${needle}"`);
}

async function clickByLabel(label) {
  const found = await page.evaluate((value) => {
    const element = [...document.querySelectorAll(`[aria-label="${value}"]`)].find(
      (node) => node.getClientRects().length > 0,
    );
    if (!element) return false;
    element.click();
    return true;
  }, label);
  if (!found) throw new Error(`No element labelled "${label}"`);
}

async function hoverByText(needle) {
  const handle = await page.evaluateHandle((text) => {
    return [...document.querySelectorAll("button")].find((node) =>
      (node.textContent ?? "").includes(text),
    );
  }, needle);
  await handle.asElement()?.hover();
}

let step = 0;
async function shot(name) {
  step += 1;
  const file = `${String(step).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: `${outDir}/${file}` });
  console.log(`  captured ${file}`);
}

console.log(`Walking ${BASE} into ${outDir}`);

await page.goto(BASE, { waitUntil: "networkidle2", timeout: 90_000 });
await page.waitForSelector("#phone-field", { timeout: 30_000 });
await clickByText("Ritvik Singla");
await page.waitForSelector("#code-field", { timeout: 20_000 });
await clickByText("Verify");
await page.waitForFunction(() => document.body.innerText.includes("Welcome to Signal"), {
  timeout: 30_000,
});
await wait(1500);
await shot("chats-welcome");

await clickByLabel("Calls");
await wait(600);
await shot("calls");

await clickByLabel("Stories");
await wait(600);
await shot("stories");

await clickByLabel("Chats");
await wait(600);
await clickByText("Lucas Silva");
await page.waitForFunction(() => document.body.innerText.includes("Review requests carefully"), {
  timeout: 20_000,
});
await wait(800);
await shot("message-request");

await clickByText("Accept");
await wait(500);
await shot("accept-dialog");

await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]');
  const accept = [...(dialog?.querySelectorAll("button") ?? [])].find(
    (b) => b.textContent?.trim() === "Accept",
  );
  accept?.click();
});
await page.waitForSelector("#composer-field", { timeout: 20_000 });
await wait(800);
await shot("request-accepted");

await page.type("#composer-field", "hii");
await wait(300);
await shot("typing");
await page.keyboard.press("Enter");
await wait(1500);
await shot("sent");

await clickByLabel("Open emoji chooser");
await wait(1500);
await shot("emoji-picker");
await clickByText("Stickers");
await wait(500);
await shot("stickers");
await clickByText("GIFs");
await wait(800);
await shot("gifs");
await page.keyboard.press("Escape");
await wait(300);

await clickByLabel("Add attachment");
await wait(400);
await shot("attach-menu");
await page.keyboard.press("Escape");
await wait(300);

await clickByLabel("More options");
await wait(400);
await hoverByText("Notification profile");
await wait(500);
await shot("chats-menu");
await page.keyboard.press("Escape");
await wait(300);

await clickByLabel("New chat");
await wait(800);
await shot("new-chat");
await clickByLabel("Back");
await wait(400);

await clickByLabel("Stories");
await wait(500);
await clickByText("Signal");
await wait(1200);
await shot("story-viewer");
await page.keyboard.press("Escape");
await wait(500);
await shot("stories-after-view");

await page.evaluate(() => {
  const help = [...document.querySelectorAll('[role="menubar"] button')].find(
    (b) => b.textContent === "Help",
  );
  help?.click();
});
await wait(400);
await shot("help-menu");
await page.keyboard.press("Escape");

await clickByLabel("Settings");
await wait(800);
await shot("settings-profile");

await clickByText("Appearance");
await wait(400);
await shot("settings-appearance");

console.log(
  problems.length
    ? `\nBrowser reported ${problems.length} problems:\n  ${problems.slice(0, 12).join("\n  ")}`
    : "\nNo browser errors.",
);

await browser.close();
