/**
 * sync-groups.js - סנכרון קבוצות פייסבוק
 * שולף את כל הקבוצות שאתה חבר בהן ומעלה למערכת
 *
 * הפעלה: node sync-groups.js
 */

const puppeteer = require("puppeteer-core");
const path = require("path");
const os = require("os");

const API_BASE = "https://matara-publisher.vercel.app";
const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const EDGE_USER_DATA = path.join(os.homedir(), "AppData", "Local", "Microsoft", "Edge", "User Data");

// שנה את זה לפי הפרופיל שרוצים לסנכרן
const EDGE_PROFILE = "Default";
const BUSINESS_ID = "carpentry"; // "carpentry" או "recruitment"

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function syncGroups() {
  console.log("=== סנכרון קבוצות פייסבוק ===\n");

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    userDataDir: EDGE_USER_DATA,
    args: [
      `--profile-directory=${EDGE_PROFILE}`,
      "--no-first-run",
      "--no-default-browser-check",
    ],
    headless: false,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    // בדוק חיבור לפייסבוק
    console.log("נכנס לפייסבוק...");
    await page.goto("https://www.facebook.com", { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(2000);

    if (page.url().includes("login")) {
      console.error("❌ לא מחובר לפייסבוק. פתח את Edge והתחבר ידנית.");
      await browser.close();
      return;
    }
    console.log("✓ מחובר לפייסבוק\n");

    // נכנס לדף הקבוצות
    console.log("טוען רשימת קבוצות...");
    await page.goto("https://www.facebook.com/groups/feed/", { waitUntil: "networkidle2", timeout: 30000 });
    await sleep(3000);

    // גלול כדי לטעון יותר קבוצות
    console.log("גולל כדי לטעון את כל הקבוצות...");
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(2000);
    }

    // שלוף את הקבוצות מהסרגל הצדדי
    const groups = await page.evaluate(() => {
      const results = [];
      const seen = new Set();

      // חפש קישורי קבוצות
      const links = document.querySelectorAll('a[href*="/groups/"]');

      for (const link of links) {
        const href = link.href;
        const match = href.match(/facebook\.com\/groups\/([^/?]+)/);
        if (!match) continue;

        const groupId = match[1];
        if (seen.has(groupId) || groupId === "feed" || groupId === "discover" || groupId === "create" || groupId === "joins" || /^\d{5,}$/.test(groupId) === false && !/^[a-zA-Z]/.test(groupId)) {
          // נסה בכל מקרה
        }
        if (seen.has(groupId)) continue;
        seen.add(groupId);

        // מצא את שם הקבוצה
        const nameEl = link.querySelector("span, div");
        const name = nameEl?.innerText?.trim() || link.innerText?.trim();

        if (name && name.length > 2 && name.length < 100) {
          results.push({
            fbGroupId: groupId,
            name: name,
            url: href,
          });
        }
      }

      return results;
    });

    console.log(`נמצאו ${groups.length} קבוצות\n`);

    if (groups.length === 0) {
      // נסה דרך אחרת - דף הקבוצות שלי
      console.log("מנסה דרך אחרת...");
      await page.goto("https://www.facebook.com/groups/?category=joined", { waitUntil: "networkidle2" });
      await sleep(3000);

      for (let i = 0; i < 8; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await sleep(1500);
      }

      const groups2 = await page.evaluate(() => {
        const results = [];
        const seen = new Set();
        const cards = document.querySelectorAll('[role="article"], [data-testid="groups-join-button"]');

        document.querySelectorAll('a[href*="/groups/"]').forEach((link) => {
          const href = link.href;
          const match = href.match(/facebook\.com\/groups\/([^/?#]+)/);
          if (!match) return;
          const groupId = match[1];
          if (["feed", "discover", "create", "joins", "membership", "requests"].includes(groupId)) return;
          if (seen.has(groupId)) return;
          seen.add(groupId);

          const text = link.innerText?.trim();
          if (text && text.length > 2 && text.length < 120) {
            results.push({ fbGroupId: groupId, name: text, url: href });
          }
        });
        return results;
      });

      if (groups2.length > 0) {
        groups.push(...groups2);
        console.log(`נמצאו ${groups2.length} קבוצות בדרך השנייה\n`);
      }
    }

    if (groups.length === 0) {
      console.log("❌ לא נמצאו קבוצות. נסה להריץ שוב כשהעמוד טעון.");
      await browser.close();
      return;
    }

    // שלח לשרת
    console.log("מעלה קבוצות לשרת...");
    const res = await fetch(`${API_BASE}/api/sync-groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groups, businessId: BUSINESS_ID }),
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`✓ הועלו ${data.count} קבוצות בהצלחה!`);
      console.log("\nעכשיו כנס לאתר ותארגן את הקבוצות לתבניות.");
    } else {
      console.error("❌ שגיאה בהעלאה:", await res.text());
    }

  } catch (err) {
    console.error("שגיאה:", err.message);
  } finally {
    await browser.close();
  }
}

syncGroups();
