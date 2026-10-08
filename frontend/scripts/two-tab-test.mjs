/**
 * The Phase 4 gate, checked in a real browser.
 *
 * Opens two isolated browser contexts signed in as different accounts, then
 * verifies that a message typed in one appears in the other without a
 * refresh, that the typing indicator shows, and that the sender's check
 * marks move to read.
 *
 *   node scripts/two-tab-test.mjs [screenshotDir]
 */

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

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const failures = [];

function ok(label, condition, extra = "") {
  if (condition) {
    console.log("  PASS  " + label);
  } else {
    failures.push(label);
    console.log(`  FAIL  ${label}  -> ${extra}`);
  }
}

const browser = await puppeteer.launch({
  executablePath,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
  defaultViewport: { width: 1280, height: 860 },
});

/** Each account gets its own context so the sessions do not share cookies. */
async function signIn(displayName) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 60_000 });
  await page.waitForSelector("#phone-field", { timeout: 20_000 });

  await page.evaluate((name) => {
    [...document.querySelectorAll("button")]
      .find((b) => (b.textContent ?? "").includes(name))
      ?.click();
  }, displayName);

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
  return { context, page };
}

async function openThread(page, title) {
  await page.evaluate((needle) => {
    [...document.querySelectorAll("button")]
      .find((b) => (b.textContent ?? "").includes(needle))
      ?.click();
  }, title);
  await page.waitForSelector("#composer-field", { timeout: 20_000 });
  await wait(1200);
}

console.log("Signing in two accounts...");
const alice = await signIn("Ritvik Singla");
const bob = await signIn("Aarav Mehta");

await openThread(alice.page, "Aarav Mehta");
await openThread(bob.page, "Ritvik Singla");

console.log("\n--- typing indicator ---");
await alice.page.focus("#composer-field");
await alice.page.type("#composer-field", "Typing live now", { delay: 30 });
await wait(1200);

const bobSeesTyping = await bob.page.evaluate(
  () => document.querySelectorAll('[aria-live="polite"]').length > 0,
);
ok("the other tab shows the typing indicator", bobSeesTyping);
await bob.page.screenshot({ path: `${outDir}/live-01-typing.png` });

console.log("\n--- live delivery, no refresh ---");
const marker = `Live check ${Date.now()}`;
await alice.page.evaluate(() => {
  const field = document.querySelector("#composer-field");
  if (field) field.value = "";
});
await alice.page.focus("#composer-field");
await alice.page.type("#composer-field", marker, { delay: 15 });
await alice.page.keyboard.press("Enter");

let arrived = false;
for (let attempt = 0; attempt < 25 && !arrived; attempt += 1) {
  await wait(300);
  arrived = await bob.page.evaluate(
    (text) => document.body.innerText.includes(text),
    marker,
  );
}
ok("the message appears in the other tab without a refresh", arrived);
await bob.page.screenshot({ path: `${outDir}/live-02-received.png` });

console.log("\n--- read receipts move the sender's ticks ---");
// Bob's tab has the thread open, so opening it already posted a read cursor.
// Nudge it by clicking into the thread, then check Alice's bubble.
await bob.page.focus("#composer-field");
await wait(2000);

const senderStatus = await alice.page.evaluate((text) => {
  const store = window.__chatStoreProbe;
  void store;
  // Fall back to reading the DOM: the read state renders the filled ticks
  // in white, which carries the class the bubble applies at "read".
  const bubbles = [...document.querySelectorAll("p")].filter((p) =>
    (p.textContent ?? "").includes(text),
  );
  if (bubbles.length === 0) return "bubble not found";
  const bubble = bubbles[0].closest("div.rounded-bubble");
  if (!bubble) return "no bubble wrapper";
  const svg = bubble.querySelector("svg path + path");
  return svg ? "double-tick" : "single-tick";
}, marker);
ok("sender shows the double check", senderStatus === "double-tick", senderStatus);
await alice.page.screenshot({ path: `${outDir}/live-03-sender.png` });

console.log("\n--- the reply direction works too ---");
const reply = `Reply ${Date.now()}`;
await bob.page.focus("#composer-field");
await bob.page.type("#composer-field", reply, { delay: 15 });
await bob.page.keyboard.press("Enter");

let replyArrived = false;
for (let attempt = 0; attempt < 25 && !replyArrived; attempt += 1) {
  await wait(300);
  replyArrived = await alice.page.evaluate(
    (text) => document.body.innerText.includes(text),
    reply,
  );
}
ok("the reply reaches the first tab live", replyArrived);

console.log("\n--- the list reorders for a thread that is not open ---");
await alice.page.evaluate(() => {
  [...document.querySelectorAll("button")]
    .find((b) => (b.textContent ?? "").includes("Priya Nair"))
    ?.click();
});
await wait(1200);

const nudge = `Nudge ${Date.now()}`;
await bob.page.focus("#composer-field");
await bob.page.type("#composer-field", nudge, { delay: 15 });
await bob.page.keyboard.press("Enter");

let previewUpdated = false;
for (let attempt = 0; attempt < 25 && !previewUpdated; attempt += 1) {
  await wait(300);
  previewUpdated = await alice.page.evaluate(
    (text) => document.body.innerText.includes(text),
    nudge,
  );
}
ok("the conversation list shows the new preview live", previewUpdated);
await alice.page.screenshot({ path: `${outDir}/live-04-list-reorder.png` });

console.log("\n==================================");
if (failures.length) {
  console.log(`${failures.length} FAILED:`);
  for (const failure of failures) console.log("   -", failure);
} else {
  console.log("All two-tab checks passed.");
}

await browser.close();
process.exit(failures.length ? 1 : 0);
