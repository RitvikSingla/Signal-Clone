/**
 * Walk profile photos and contacts, capturing each step:
 *
 *   sign up a new number -> profile step with a photo -> app shows it ->
 *   (as Ritvik) Settings photo upload -> Lucas's chat settings ->
 *   Add to contacts -> safety number -> Block -> blocked bar -> Unblock ->
 *   New chat search for a non-contact with "+ Add"
 *
 *   node scripts/profile-contacts-walkthrough.mjs <outputDir> <photo.jpg>
 *
 * Needs both dev servers and a freshly seeded database.
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

const outDir = resolve(process.argv[2] ?? "profile-contacts");
const photo = resolve(process.argv[3] ?? "photo.jpg");
mkdirSync(outDir, { recursive: true });
const BASE = process.env.APP_URL ?? "http://localhost:3000";
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

const browser = await puppeteer.launch({
  executablePath,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
  defaultViewport: { width: 1366, height: 768 },
});
const problems = [];

let step = 0;
async function shot(page, name) {
  step += 1;
  const file = `${String(step).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: `${outDir}/${file}` });
  console.log(`  captured ${file}`);
}
async function click(page, text, scope = "body", exact = true) {
  const ok = await page.evaluate(
    (t, s, ex) => {
      const root = document.querySelector(s) ?? document.body;
      const node = [...root.querySelectorAll("button, [role=menuitem], [role=button]")].find((n) => {
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
async function label(page, l) {
  const ok = await page.evaluate((v) => {
    const node = [...document.querySelectorAll(`[aria-label="${v}"]`)].find((n) => n.getClientRects().length > 0);
    node?.click();
    return Boolean(node);
  }, l);
  if (!ok) throw new Error(`No element labelled "${l}"`);
}
async function fresh() {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("response", (r) => {
    if (r.status() === 404) problems.push(`404: ${r.request().method()} ${r.url()}`);
  });
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("401") && !m.text().includes("409")) problems.push(`console: ${m.text()}`);
  });
  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 90_000 });
  await page.waitForSelector("#phone-field", { timeout: 30_000 });
  await wait(1500);
  return page;
}

console.log(`Walking ${BASE} into ${outDir}`);

// --- a new account picks a photo on the profile step ----------------------
let page = await fresh();
await page.click("#phone-field", { clickCount: 3 });
await page.type("#phone-field", "+15550001234");
await click(page, "Continue");
await page.waitForSelector("#code-field", { timeout: 20_000 });
await wait(500);
await page.evaluate(() => {
  const field = document.querySelector("#code-field");
  if (field && !field.value) field.value = "";
});
const codeValue = await page.$eval("#code-field", (n) => n.value);
if (!codeValue) await page.type("#code-field", "123456");
await click(page, "Verify");
await page.waitForSelector("#display-name", { timeout: 20_000 });
await page.type("#display-name", "Meera Joshi");
const input = await page.$('main input[type="file"]');
await input.uploadFile(photo);
await wait(500);
await shot(page, "profile-step-with-photo");
await click(page, "Continue");
await page.waitForFunction(() => document.body.innerText.includes("Chats"), { timeout: 20_000 });
await wait(2500);
await label(page, "Settings");
await wait(1200);
await shot(page, "new-account-settings-photo");
const newPhoto = await page.evaluate(() => Boolean(document.querySelector('section img[src*="/media/"]')));
console.log(`  new account's photo stored and shown: ${newPhoto}`);
await page.browserContext().close();

// --- Ritvik: settings photo, contacts, blocking ----------------------------
page = await fresh();
await click(page, "Ritvik Singla", "body", false);
await page.waitForSelector("#code-field");
await click(page, "Verify", "body", false);
await page.waitForFunction(() => document.body.innerText.includes("Aarav Mehta"), { timeout: 30_000 });
await wait(1200);

await label(page, "Settings");
await wait(800);
const settingsInput = await page.$('section input[type="file"]');
await settingsInput.uploadFile(photo);
await page.waitForFunction(() => Boolean(document.querySelector('section img[src*="/media/"]')), { timeout: 20_000 });
await wait(600);
await shot(page, "settings-photo-updated");
await label(page, "Chats");
await wait(800);

await click(page, "Lucas Silva", "aside", false);
await page.waitForFunction(() => document.body.innerText.includes("Review requests carefully"), { timeout: 20_000 });
await click(page, "Accept");
await click(page, "Accept", '[role="dialog"]');
await page.waitForSelector("#composer-field", { timeout: 20_000 });
await wait(800);
await page.evaluate(() => [...document.querySelectorAll("header button")].find((b) => b.textContent?.includes("Lucas Silva"))?.click());
await wait(1000);
await shot(page, "contact-settings");
await click(page, "View safety number", "section", false);
await wait(1200);
await shot(page, "safety-number");
await click(page, "Close", '[role="dialog"]');
await wait(300);
await click(page, "Block", "section");
await click(page, "Block", '[role="dialog"]');
await wait(1500);
await shot(page, "after-block");
await label(page, "Back");
await wait(800);
const blockedBar = await page.evaluate(() => document.body.innerText.includes("Unblock them to send a message"));
console.log(`  blocked bar shown: ${blockedBar}`);
await shot(page, "blocked-bar");
await click(page, "Unblock");
await wait(1200);
const composerBack = await page.evaluate(() => Boolean(document.querySelector("#composer-field")));
console.log(`  composer back after unblock: ${composerBack}`);

// --- New chat: add a non-contact -------------------------------------------
await label(page, "New chat");
await wait(500);
await page.type("#people-search", "meera");
await wait(1200);
await shot(page, "new-chat-add-button");
const canAdd = await page.evaluate(() => [...document.querySelectorAll('[role="button"]')].some((n) => n.textContent?.includes("Add")));
console.log(`  "+ Add" offered for a non-contact: ${canAdd}`);
if (canAdd) {
  await click(page, "+ Add", "aside");
  await wait(1200);
  await shot(page, "added-from-new-chat");
}

console.log(problems.length ? `\nBrowser reported ${problems.length} problems:\n  ${problems.slice(0, 12).join("\n  ")}` : "\nNo browser errors.");
await browser.close();
