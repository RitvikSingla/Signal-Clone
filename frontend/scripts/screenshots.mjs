/**
 * Drive the running app in a real browser and capture the key screens.
 *
 * Used to check the UI against Signal side by side, and to produce the
 * images for the README. Needs both dev servers running.
 *
 *   node scripts/screenshots.mjs [outputDir]
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

const outDir = resolve(process.argv[2] ?? "screenshots");
mkdirSync(outDir, { recursive: true });

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const DEMO_ACCOUNT = "Ritvik Singla";

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

const browser = await puppeteer.launch({
  executablePath,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
  defaultViewport: { width: 1440, height: 900 },
});

const page = await browser.newPage();
const problems = [];
page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") problems.push(`console: ${message.text()}`);
});

/** Click the first button whose text contains `needle`. */
async function clickByText(needle) {
  const found = await page.evaluate((text) => {
    const button = [...document.querySelectorAll("button")].find((element) =>
      (element.textContent ?? "").includes(text),
    );
    if (!button) return false;
    button.click();
    return true;
  }, needle);
  if (!found) throw new Error(`No button containing "${needle}"`);
}

async function clickByLabel(label) {
  const found = await page.evaluate((value) => {
    const button = document.querySelector(`button[aria-label="${value}"]`);
    if (!button) return false;
    button.click();
    return true;
  }, label);
  if (!found) throw new Error(`No button labelled "${label}"`);
}

async function shot(name) {
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log(`  captured ${name}.png`);
}

console.log(`Capturing ${BASE} into ${outDir}`);

await page.goto(BASE, { waitUntil: "networkidle2", timeout: 60_000 });
await page.waitForSelector("#phone-field", { timeout: 20_000 });
await shot("01-sign-in");

await clickByText(DEMO_ACCOUNT);
await page.waitForSelector("#code-field", { timeout: 20_000 });
await shot("02-verification");

await clickByText("Verify");
await page.waitForFunction(() => document.body.innerText.includes("Chats"), {
  timeout: 30_000,
});
await wait(1200);
await shot("03-conversation-list");

await clickByText("Weekend Trek");
await page.waitForFunction(() => document.body.innerText.includes("members"), {
  timeout: 30_000,
});
await wait(1800);
await shot("04-group-thread");

await clickByText("Priya Nair");
await wait(1800);
await shot("05-direct-thread");

await clickByLabel("Conversation details");
await wait(1200);
await shot("06-details-panel");

await clickByLabel("Settings");
await wait(700);
await clickByText("dark");
await wait(700);
await shot("07-settings-dark");

await clickByLabel("Chats");
await wait(1500);
await shot("08-dark-thread");

await page.setViewport({ width: 390, height: 844 });
await wait(900);
await shot("09-mobile");

console.log(
  problems.length
    ? `\nBrowser reported ${problems.length} problems:\n  ${problems.slice(0, 10).join("\n  ")}`
    : "\nNo browser errors.",
);

await browser.close();
