/**
 * Drive the running app in a real browser and capture the key screens:
 * desktop (dark and light), tablet and phone widths. Produces the images in
 * docs/screenshots for the README. Needs both dev servers running and a
 * seeded database.
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
  if (message.type() === "error" && !message.text().includes("401")) {
    problems.push(`console: ${message.text()}`);
  }
});

/** Click the first visible button or menu item whose text contains `needle`. */
async function clickByText(needle, scope = "body") {
  const found = await page.evaluate(
    (text, s) => {
      const root = document.querySelector(s) ?? document.body;
      const node = [...root.querySelectorAll("button, [role=menuitem]")].find(
        (n) => (n.textContent ?? "").includes(text) && n.getClientRects().length > 0,
      );
      node?.click();
      return Boolean(node);
    },
    needle,
    scope,
  );
  if (!found) throw new Error(`No button containing "${needle}"`);
}

async function clickByLabel(label) {
  const found = await page.evaluate((value) => {
    const node = [...document.querySelectorAll(`[aria-label="${value}"]`)].find(
      (n) => n.getClientRects().length > 0,
    );
    node?.click();
    return Boolean(node);
  }, label);
  if (!found) throw new Error(`No element labelled "${label}"`);
}

async function setTheme(value) {
  await clickByLabel("Settings");
  await wait(600);
  await clickByText("Appearance");
  await wait(400);
  await page.select('select[aria-label="Theme"]', value);
  await wait(500);
}

async function shot(name) {
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log(`  captured ${name}.png`);
}

console.log(`Capturing ${BASE} into ${outDir}`);

await page.goto(BASE, { waitUntil: "networkidle2", timeout: 60_000 });
await page.waitForSelector("#phone-field", { timeout: 20_000 });
await wait(800);
await shot("01-sign-in");

await clickByText(DEMO_ACCOUNT);
await page.waitForSelector("#code-field", { timeout: 20_000 });
await clickByText("Verify");
await page.waitForFunction(() => document.body.innerText.includes("Aarav Mehta"), {
  timeout: 30_000,
});
await wait(1200);
await shot("02-welcome");

await clickByText("Weekend Trek", "aside");
await page.waitForSelector("#composer-field", { timeout: 20_000 });
await wait(1500);
await shot("03-group-thread");

await clickByLabel("About Aarav Mehta");
await wait(500);
await shot("04-member-card");
await page.keyboard.press("Escape");
await wait(300);

await page.evaluate(() =>
  [...document.querySelectorAll("header button")]
    .find((b) => b.textContent?.includes("Weekend Trek"))
    ?.click(),
);
await wait(1000);
await shot("05-group-settings");
await clickByLabel("Back");
await wait(600);

await clickByText("Aarav Mehta", "aside");
await page.waitForSelector("#composer-field", { timeout: 20_000 });
await wait(1500);
await shot("06-direct-thread");

await clickByLabel("Calls");
await wait(1000);
await shot("07-calls");
await clickByLabel("Stories");
await wait(1000);
await shot("08-stories");

await setTheme("light");
await shot("09-settings-light");
await clickByLabel("Chats");
await wait(800);
await clickByText("Weekend Trek", "aside");
await wait(1500);
await shot("10-light-theme");

await setTheme("dark");
await clickByLabel("Chats");
await wait(800);

await page.setViewport({ width: 820, height: 1180 });
await wait(1000);
await shot("11-tablet");

await page.setViewport({ width: 390, height: 844 });
await wait(800);
await clickByLabel("Back to chats");
await wait(800);
await shot("12-mobile-list");
await clickByText("Weekend Trek", "aside");
await wait(1500);
await shot("13-mobile-thread");

console.log(
  problems.length
    ? `\nBrowser reported ${problems.length} problems:\n  ${problems.slice(0, 10).join("\n  ")}`
    : "\nNo browser errors.",
);

await browser.close();
