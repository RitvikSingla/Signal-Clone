/** Capture the Calls, Stories and Settings tabs for comparison. */

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
const problems = [];
page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));

async function clickText(text) {
  const ok = await page.evaluate((needle) => {
    const button = [...document.querySelectorAll("button")].find((element) =>
      (element.textContent ?? "").includes(needle),
    );
    if (!button) return false;
    button.click();
    return true;
  }, text);
  if (!ok) throw new Error(`No button containing "${text}"`);
}

async function clickLabel(label) {
  const ok = await page.evaluate((value) => {
    const button = document.querySelector(`button[aria-label="${value}"]`);
    if (!button) return false;
    button.click();
    return true;
  }, label);
  if (!ok) throw new Error(`No button labelled "${label}"`);
}

await page.goto(process.env.APP_URL ?? "http://localhost:3000", {
  waitUntil: "networkidle2",
  timeout: 60_000,
});
await page.waitForSelector("#phone-field", { timeout: 20_000 });
await clickText("Ritvik Singla");
await page.waitForSelector("#code-field", { timeout: 20_000 });
await clickText("Verify");
await page.waitForFunction(() => document.body.innerText.includes("Chats"), {
  timeout: 30_000,
});
await wait(1200);

await clickLabel("Calls");
await wait(900);
await page.screenshot({ path: `${outDir}/tab-calls.png` });
console.log("  captured tab-calls.png");

await clickLabel("Stories");
await wait(900);
await page.screenshot({ path: `${outDir}/tab-stories.png` });
console.log("  captured tab-stories.png");

await clickLabel("Settings");
await wait(900);
await page.screenshot({ path: `${outDir}/tab-settings.png` });
console.log("  captured tab-settings.png");

await clickText("Appearance");
await wait(600);
await page.screenshot({ path: `${outDir}/tab-settings-appearance.png` });
console.log("  captured tab-settings-appearance.png");

console.log(problems.length ? `\nProblems: ${problems.join("; ")}` : "\nNo page errors.");
await browser.close();
