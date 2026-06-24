/**
 * local-server.js - שרת מקומי
 * מפעיל שרת על המחשב שמקבל פקודות מהאתר
 *
 * הפעלה: node local-server.js
 * הפעל פעם אחת בבוקר - השרת ירוץ ברקע
 */

const http = require("http");
const puppeteer = require("puppeteer-core");
const { execSync, exec } = require("child_process");
const path = require("path");
const os = require("os");

const PORT = 3333;
const API_BASE = "https://matara-publisher.vercel.app";
const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const EDGE_USER_DATA = path.join(os.homedir(), "AppData", "Local", "Microsoft", "Edge", "User Data");

const SKIP_IDS = new Set([
  "feed", "discover", "create", "joins", "membership", "requests",
  "search", "notifications", "invite", "category", "updates", "all",
  "archived", "suggested", "local", "explore", "buy", "sell",
]);

let isRunning = false;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function syncGroups(businessId = "carpentry") {
  // סגור Edge אם פתוח, פתח מחדש עם puppeteer, וסיים בפתיחה מחדש
  let edgeWasOpen = false;
  try {
    execSync("tasklist /FI \"IMAGENAME eq msedge.exe\" 2>nul", { encoding: "utf8" }).includes("msedge.exe") && (edgeWasOpen = true);
    execSync("taskkill /F /IM msedge.exe 2>nul", { encoding: "utf8" });
  } catch {}
  await sleep(1500);

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    userDataDir: EDGE_USER_DATA,
    args: ["--profile-directory=Default", "--no-first-run"],
    headless: false,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    await page.goto("https://www.facebook.com/groups/feed/", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await sleep(3000);

    if (page.url().includes("login")) {
      await browser.close();
      return { ok: false, error: "לא מחובר לפייסבוק" };
    }

    // מצא את הסרגל הצדדי עם רשימת הקבוצות וגלול אותו
    for (let i = 0; i < 40; i++) {
      await page.evaluate(() => {
        // מצא את הרכיב הגלילה שמכיל קישורים לקבוצות
        const allLinks = Array.from(document.querySelectorAll('a[href*="/groups/"]'));
        if (allLinks.length === 0) return;

        // מצא את האב הגלילה של הקישורים
        const findScrollable = (el) => {
          while (el && el !== document.body) {
            const style = window.getComputedStyle(el);
            const overflow = style.overflow + style.overflowY;
            if (overflow.includes("scroll") || overflow.includes("auto")) {
              if (el.scrollHeight > el.clientHeight) return el;
            }
            el = el.parentElement;
          }
          return null;
        };

        // נסה כל קישור עד שנמצא רכיב גלילה
        for (const link of allLinks) {
          const scrollable = findScrollable(link.parentElement);
          if (scrollable && scrollable !== document.documentElement) {
            scrollable.scrollTop += 600;
            return;
          }
        }

        // גיבוי - גלול לפי pagelet
        const pagelet = document.querySelector('[data-pagelet="LeftRail"], [data-pagelet="GroupsLeftColumn"]');
        if (pagelet) {
          const scrollable = findScrollable(pagelet);
          if (scrollable) scrollable.scrollTop += 600;
        }
      });
      await sleep(700);
    }

    const groups = await page.evaluate((skipIds) => {
      const results = [];
      const seen = new Set();

      document.querySelectorAll('a[href*="/groups/"]').forEach((link) => {
        const href = link.href || "";
        const match = href.match(/facebook\.com\/groups\/([^/?#\s]+)/);
        if (!match) return;

        const groupId = match[1];
        if (skipIds.includes(groupId)) return;

        const isNumeric = /^\d+$/.test(groupId);
        const isSlug = /^[a-zA-Z0-9._-]{3,}$/.test(groupId);
        if (!isNumeric && !isSlug) return;
        if (seen.has(groupId)) return;
        seen.add(groupId);

        let name = "";
        const lines = (link.innerText || "").split("\n").map(l => l.trim()).filter(l => l.length > 2);
        for (const line of lines) {
          if (!line.includes("לפני") && !line.includes("פעילות") && !line.includes("דקות") && !line.includes("שעות") && line.length < 150) {
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

    await browser.close();

    // פתח Edge מחדש
    exec(`"${EDGE_PATH}"`);

    if (groups.length === 0) {
      return { ok: false, error: "לא נמצאו קבוצות" };
    }

    const res = await fetch(`${API_BASE}/api/sync-groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groups, businessId }),
    });

    const data = await res.json();
    return { ok: true, count: data.count };

  } catch (err) {
    await browser.close().catch(() => {});
    exec(`"${EDGE_PATH}"`);
    return { ok: false, error: err.message };
  }
}

// שרת HTTP
const server = http.createServer(async (req, res) => {
  // CORS - מאפשר גישה מהאתר
  res.setHeader("Access-Control-Allow-Origin", "https://matara-publisher.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // בדיקת חיים
  if (req.url === "/ping") {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, message: "השרת המקומי פעיל" }));
    return;
  }

  // סנכרון קבוצות
  if (req.url === "/sync-groups" && req.method === "POST") {
    if (isRunning) {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: false, error: "כבר רץ סנכרון, אנא המתן" }));
      return;
    }

    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", async () => {
      isRunning = true;
      console.log("מתחיל סנכרון קבוצות...");

      try {
        const { businessId } = JSON.parse(body || "{}");
        const result = await syncGroups(businessId || "carpentry");
        console.log("סנכרון הסתיים:", result);
        res.writeHead(200);
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ ok: false, error: err.message }));
      } finally {
        isRunning = false;
      }
    });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log("=== שרת מקומי של מטרה Publisher ===");
  console.log(`פועל על פורט ${PORT}`);
  console.log("השאר חלון זה פתוח כדי שהאתר יוכל לתקשר עם המחשב שלך\n");
});
