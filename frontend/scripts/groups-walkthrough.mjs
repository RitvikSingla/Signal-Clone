/**
 * Walk the group flow from reference recording 5 and disappearing messages,
 * capturing each step:
 *
 *   New chat (Groups section) -> Choose members -> Name this group (timer
 *   menu) -> created thread -> group settings -> chat color -> notifications
 *   -> add members -> group link -> member label -> permissions -> requests
 *   -> report spam -> end group dialog -> header menu (mute submenu) ->
 *   collapsed group updates -> a 5-second disappearing message
 *   vanishing live
 *
 *   node scripts/groups-walkthrough.mjs <outputDir>
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

const outDir = resolve(process.argv[2] ?? "groups");
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

// --- create ------------------------------------------------------------------
await label("New chat");
await wait(600);
await shot("new-chat-groups-section");
await click("New group", "aside", false);
await wait(400);
await click("Aarav Mehta", "aside", false);
await click("Priya Nair", "aside", false);
await wait(300);
await shot("choose-members");
await click("Next");
await wait(400);
await page.type('input[aria-label="Group name"]', "Friend");
await label("Disappearing messages: Off");
await wait(300);
await shot("name-this-group-timer-menu");
await page.keyboard.press("Escape");
await click("Create");
await page.waitForFunction(() => document.body.innerText.includes("created the group"), { timeout: 20_000 });
await wait(1000);
await shot("group-created");

// --- settings ------------------------------------------------------------------
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Friend")?.click());
await wait(800);
await shot("group-settings");
await click("Chat color", "section", false);
await wait(400);
await page.evaluate(() => document.querySelectorAll('button[aria-label="Chat color"]')[4]?.click());
await wait(300);
await shot("chat-color");
await label("Back");
await wait(300);
await click("Notifications", "section", false);
await wait(300);
await shot("notifications");
await click("While muted", "section", false);
await wait(300);
await shot("while-muted");
await label("Back");
await label("Back");
await wait(300);

await click("Add members", "section", false);
await wait(400);
await shot("add-members-dialog");
await click("Kenji Tanaka", '[role="dialog"]', false);
await click("Update", '[role="dialog"]');
await wait(1200);

await click("Group link", "section", false);
await wait(300);
await label("Group link");
await wait(800);
await shot("group-link-on");
await label("Require admin approval");
await wait(800);
await label("Back");
await wait(300);

await click("Member label", "section", false);
await wait(300);
await page.type('input[aria-label="Member label"]', "RS");
await wait(300);
await shot("member-label");
await click("Save");
await wait(800);

await click("Permissions", "section", false);
await wait(300);
await click("All members", "section", false);
await wait(300);
await shot("permissions-menu");
await page.keyboard.press("Escape");
await label("Back");
await wait(300);
await click("Requests & invites", "section", false);
await wait(300);
await shot("requests-invites");
await label("Back");
await wait(300);

await page.evaluate(() => document.querySelector("section .overflow-y-auto")?.scrollTo(0, 99999));
await wait(300);
await shot("settings-bottom");
await click("Report spam", "section", false);
await wait(300);
await shot("report-spam");
await click("Cancel", '[role="dialog"]');
await click("End group", "section", false);
await wait(300);
await shot("end-group-dialog");
await click("Cancel", '[role="dialog"]');
await label("Back");
await wait(800);

// --- thread: collapsed updates and the menu --------------------------------
await shot("thread-with-updates");
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /group updates/.test(b.textContent ?? ""))?.click());
await wait(400);
await shot("updates-expanded");
await label("Chat options");
await wait(300);
const muteItem = await page.evaluateHandle(() =>
  [...document.querySelectorAll('[role="menuitem"]')].find((n) => n.textContent?.includes("Mute notifications")),
);
await muteItem.asElement()?.hover();
await wait(400);
await shot("header-menu-mute");
await page.keyboard.press("Escape");
await wait(300);

// --- disappearing message, live --------------------------------------------
await label("Chat options");
await wait(300);
await page.evaluate(() =>
  [...document.querySelectorAll('[role="menuitem"]')]
    .find((n) => n.textContent?.includes("Disappearing messages"))
    ?.click(),
);
await wait(300);
await click("Custom time…");
await wait(300);
await page.select('select[aria-label="Unit"]', "0");
await page.select('select[aria-label="Amount"]', "5");
await click("Set", '[role="dialog"]');
await wait(1200);
await page.type("#composer-field", "This disappears in five seconds");
await page.keyboard.press("Enter");
await wait(1500);
await shot("disappearing-sent");
const visibleBefore = await page.evaluate(() => document.body.innerText.includes("This disappears in five seconds"));
await wait(6500);
const visibleAfter = await page.evaluate(() => document.body.innerText.includes("This disappears in five seconds"));
await shot("disappearing-gone");
console.log(`  disappearing message visible before: ${visibleBefore}, after 8s: ${visibleAfter}`);

console.log(problems.length ? `\nBrowser reported ${problems.length} problems:\n  ${problems.slice(0, 12).join("\n  ")}` : "\nNo browser errors.");
await browser.close();
