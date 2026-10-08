/** Capture the conversation list in the light theme, for a side-by-side check. */

import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import puppeteer from "puppeteer-core";

const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].filter(Boolean);

const executablePath = CANDIDATES.find((path) => existsSync(path));
if (!executablePath) {
  console.error("No Chrome found. Set CHROME_PATH.");
  process.exit(1);
}

const outDir = resolve(process.argv[2] ?? "screenshots");
mkdirSync(outDir, { recursive: true });

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

const browser = await puppeteer.launch({
  executablePath,
  headless: "new",
  args: ["--no-sandbox"],
  defaultViewport: { width: 1440, height: 900 },
});

const page = await browser.newPage();
await page.emulateMediaFeatures([
  { name: "prefers-color-scheme", value: "light" },
]);

await page.goto(process.env.APP_URL ?? "http://localhost:3000", {
  waitUntil: "networkidle2",
  timeout: 60_000,
});

await page.waitForSelector("#phone-field", { timeout: 20_000 });
await page.evaluate(() => {
  [...document.querySelectorAll("button")]
    .find((b) => (b.textContent ?? "").includes("Ritvik Singla"))
    ?.click();
});
await page.waitForSelector("#code-field", { timeout: 20_000 });
await page.evaluate(() => {
  [...document.querySelectorAll("button")]
    .find((b) => (b.textContent ?? "").trim().startsWith("Verify"))
    ?.click();
});
await page.waitForFunction(() => document.body.innerText.includes("Chats"), {
  timeout: 30_000,
});
await wait(1200);
await page.evaluate(() => {
  [...document.querySelectorAll("button")]
    .find((b) => (b.textContent ?? "").includes("Weekend Trek"))
    ?.click();
});
await wait(2000);
await page.screenshot({ path: `${outDir}/10-light-theme.png` });
console.log("  captured 10-light-theme.png");

await browser.close();
