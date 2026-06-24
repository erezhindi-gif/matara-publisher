/**
 * sync-groups.js - סנכרון קבוצות פייסבוק
 * הפעלה: node sync-groups.js
 *
 * הוראות:
 * 1. הסקריפט יפתח את פייסבוק
 * 2. גלול ידנית בסרגל הקבוצות הימני כדי לטעון את כל הקבוצות
 * 3. לחץ Enter בפאוורשל כשסיימת לגלול
 */

const puppeteer = require("puppeteer-core");
const path = require("path");
const os = require("os");
const readline = require("readline");

const API_BASE = "https://matara-publisher.vercel.app";
const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const EDGE_USER_DATA = path.join(os.homedir(), "AppData", "Local", "Microsoft", "Edge", "User Data");
const EDGE_PROFILE = "Default";
const BUSINESS_ID = "carpentry"; // שנה ל "recruitment" עבור גיוס

const SKIP_IDS = new Set([
  "feed", "discover", "create", "joins", "membership", "requests",
  "search", "notifications", "invite", "category", "updates", "all",
  "archived", "suggested", "local", "explore", "buy", "sell",
]);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function waitForEnter() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("\n>>> גלול את הסרגל הימני בפייסבוק כדי לטעון את כל הקבוצות, ואז לחץ Enter כאן...\n", () => {
      rl.close();
      resolve();
    });
  });
}

async function syncGroups() {
  console.log("=== סנכרון קבוצות פייסבוק ===\n");

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    userDataDir: EDGE_USER_DATA,
    args: [`--profile-directory=${EDGE_PROFILE}`, "--no-first-run"],
    headless: false,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    await page.goto("https://www.facebook.com", { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(2000);

    if (page.url().includes("login")) {
      console.error("לא מחובר לפייסבוק.");
      await browser.close();
      return;
    }
    console.log("מחובר לפייסבוק\n");

    // כנס לפיד הקבוצות
    await page.goto("https://www.facebook.com/groups/feed/", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await sleep(2000);

    console.log("פייסבוק פתוח.");
    console.log("בסרגל הימני תראה את רשימת הקבוצות שלך.");
    console.log("גלול לאט בסרגל הימני עד לתחתית כדי לטעון את כל הקבוצות.");

    await waitForEnter();

    console.log("\nשולף קבוצות...");

    const groups = await page.evaluate((skipIds) => {
      const results = [];
      const seen = new Set();

      // שלוף את כל הקישורים לקבוצות
      document.querySelectorAll('a[href*="/groups/"]').forEach((link) => {
        const href = link.href || "";
        const match = href.match(/facebook\.com\/groups\/([^/?#\s]+)/);
        if (!match) return;

        const groupId = match[1];
        if (skipIds.includes(groupId)) return;

        // רק מזהים נומריים או slugs
        const isNumeric = /^\d+$/.test(groupId);
        const isSlug = /^[a-zA-Z0-9._-]{3,}$/.test(groupId);
        if (!isNumeric && !isSlug) return;

        if (seen.has(groupId)) return;
        seen.add(groupId);

        // שם הקבוצה - קח את הטקסט הראשון שנראה כמו שם
        let name = "";
        const allText = link.innerText?.trim() || "";
        const lines = allText.split("\n").map(l => l.trim()).filter(l => l.length > 2);

        for (const line of lines) {
          if (!line.includes("לפני") && !line.includes("פעילות") && !line.includes("דקות") && !line.includes("שעות") && !line.includes("ימים") && !line.includes("שנה") && line.length < 150) {
            name = line;
            break;
          }
        }

        if (name && name.length > 2) {
          results.push({ fbGroupId: groupId, name, url: href });
        }
      });

      return results;
    }, Array.from(SKIP_IDS));

    console.log(`נמצאו ${groups.length} קבוצות`);

    if (groups.length === 0) {
      console.log("לא נמצאו קבוצות. נסה לגלול יותר ולהריץ שוב.");
      await browser.close();
      return;
    }

    // הצג דוגמאות
    console.log("\nדוגמאות:");
    groups.slice(0, 8).forEach((g) => console.log(`  - ${g.name}`));
    if (groups.length > 8) console.log(`  ... ועוד ${groups.length - 8}`);

    // שלח לשרת
    console.log("\nמעלה לשרת...");
    const res = await fetch(`${API_BASE}/api/sync-groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groups, businessId: BUSINESS_ID }),
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`הועלו ${data.count} קבוצות בהצלחה!`);
    } else {
      console.error("שגיאה:", await res.text());
    }

  } catch (err) {
    console.error("שגיאה:", err.message);
  } finally {
    await browser.close();
  }
}

syncGroups();
