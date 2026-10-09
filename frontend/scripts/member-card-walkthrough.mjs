/**
 * Walk the group member card from reference recording 6, capturing each step:
 *
 *   group thread with sender avatars -> click an avatar -> contact modal ->
 *   name -> About -> Signal Connection explainer -> Nickname (save, the
 *   thread shows it, delete) -> Add to another group -> Make admin confirm ->
 *   Block confirm -> Voice opens their chat and the call lobby
 *
 *   node scripts/member-card-walkthrough.mjs <outputDir>
 *
 * Needs both dev servers and a seeded database.
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

const outDir = resolve(process.argv[2] ?? "member-card");
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
  if (message.type() === "error" && !message.text().includes("401")) problems.push(`console: ${message.text()}`);
});

let step = 0;
async function shot(name) {
  step += 1;
  const file = `${String(step).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: `${outDir}/${file}` });
  console.log(`  captured ${file}`);
}
async function click(text, scope = "body", exact = true) {
  const ok = await page.evaluate(
    (t, s, ex) => {
      const root = document.querySelector(s) ?? document.body;
      const node = [...root.querySelectorAll("button, [role=menuitem]")].find((n) => {
        const label = (n.textContent ?? "").trim();
        return (ex ? label === t : label.includes(t)) && n.getClientRects().length > 0 && !n.disabled;
      });
      node?.click();
      return Boolean(node);
    },
    text,
    scope,
    exact,
  );
  if (!ok) throw new Error(`No button "${text}" in ${scope}`);
}
async function label(l) {
  const ok = await page.evaluate((v) => {
    const node = [...document.querySelectorAll(`[aria-label="${v}"]`)].find((n) => n.getClientRects().length > 0);
    node?.click();
    return Boolean(node);
  }, l);
  if (!ok) throw new Error(`No element labelled "${l}"`);
}

console.log(`Walking ${BASE} into ${outDir}`);
await page.goto(BASE, { waitUntil: "networkidle2", timeout: 90_000 });
await page.waitForSelector("#phone-field", { timeout: 30_000 });
await wait(1500);
await click("Ritvik Singla", "body", false);
await page.waitForSelector("#code-field");
await click("Verify", "body", false);
await page.waitForFunction(() => document.body.innerText.includes("Aarav Mehta"), { timeout: 30_000 });
await wait(1000);

await click("Weekend Trek", "aside", false);
await page.waitForSelector("#composer-field", { timeout: 20_000 });
await wait(1200);
await shot("thread-sender-avatars");
const avatars = await page.$$eval('button[aria-label^="About "]', (n) => n.map((b) => b.getAttribute("aria-label")));
console.log(`  sender avatar buttons: ${avatars.length} (${[...new Set(avatars)].join(", ")})`);

await label("About Aarav Mehta");
await wait(500);
await shot("contact-modal");
const rows = await page.$eval('[role="dialog"]', (d) => d.innerText);
console.log(`  modal rows: ${rows.replace(/\n+/g, " | ")}`);

await click("Aarav Mehta", '[role="dialog"]', false);
await wait(400);
await shot("about");
await click("Signal Connection", '[role="dialog"]', false);
await wait(300);
await shot("signal-connection");
await click("OK", '[role="dialog"]');
await wait(300);
await page.keyboard.press("Escape");
await wait(300);

await click("Nickname", '[role="dialog"]');
await wait(300);
await page.type('input[aria-label="First name"]', "Aaru");
await page.type('input[aria-label="Last name"]', "M");
await page.type('textarea[aria-label="Note"]', "Trek buddy");
await shot("nickname");
await click("Save", '[role="dialog"]');
await wait(1200);
await page.keyboard.press("Escape");
await wait(500);
const renamed = await page.evaluate(() => document.querySelector("section")?.innerText.includes("Aaru M"));
console.log(`  nickname shown in thread: ${renamed}`);
await shot("nickname-in-thread");

await label("About Aaru M");
await wait(400);
await click("Add to another group", '[role="dialog"]');
await wait(400);
await shot("add-to-group");
await page.keyboard.press("Escape");
await wait(300);
await click("Make admin", '[role="dialog"]');
await wait(300);
await shot("make-admin-confirm");
await click("Cancel", '[role="alertdialog"]');
await click("Block", '[role="dialog"]');
await wait(300);
await shot("block-confirm");
await click("Cancel", '[role="alertdialog"]');

await click("Nickname", '[role="dialog"]');
await wait(300);
await click("Delete", '[role="dialog"]');
await wait(1000);
await click("Voice", '[role="dialog"]');
await wait(3500);
await shot("voice-call-from-card");
const inDirect = await page.evaluate(() => document.body.innerText.includes("Aarav Mehta"));
console.log(`  nickname removed and direct chat opened: ${inDirect}`);

console.log(problems.length ? `\nBrowser reported ${problems.length} problems:\n  ${problems.slice(0, 12).join("\n  ")}` : "\nNo browser errors.");
await browser.close();
