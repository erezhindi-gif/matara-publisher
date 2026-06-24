/**
 * publisher.js - סקריפט פרסום מקומי
 * מריץ על המחשב שלך ומפרסם לפייסבוק אוטומטית
 *
 * הפעלה: node publisher.js
 */

const puppeteer = require("puppeteer-core");
const path = require("path");
const os = require("os");

// כתובת האתר שלך ב-Vercel
const API_BASE = "https://matara-publisher.vercel.app";

// נתיב לפרופילי Edge
const EDGE_USER_DATA = path.join(os.homedir(), "AppData", "Local", "Microsoft", "Edge", "User Data");

// נתיב להרצת Edge
const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

// המתנה בין פרסומים (בשניות) - כדי לא להיות מזוהה כבוט
const DELAY_BETWEEN_POSTS_MIN = 30;
const DELAY_BETWEEN_POSTS_MAX = 90;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(minSec, maxSec) {
  const ms = (Math.random() * (maxSec - minSec) + minSec) * 1000;
  return sleep(ms);
}

async function fetchApprovedCampaigns() {
  const res = await fetch(`${API_BASE}/api/campaigns`);
  const campaigns = await res.json();
  return campaigns.filter((c) => c.status === "approved");
}

async function fetchProfiles() {
  const res = await fetch(`${API_BASE}/api/profiles`);
  return res.json();
}

async function updateCampaignStatus(id, status) {
  await fetch(`${API_BASE}/api/campaigns/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

async function updatePostStatus(campaignId, groupName, status, error = null) {
  await fetch(`${API_BASE}/api/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ campaignId, groupName, status, error }),
  });
}

async function postToFacebookGroup(page, groupName, content) {
  try {
    console.log(`  מחפש קבוצה: ${groupName}`);

    // חיפוש הקבוצה
    await page.goto(`https://www.facebook.com/search/groups/?q=${encodeURIComponent(groupName)}`, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await sleep(3000);

    // לחיצה על הקבוצה הראשונה בתוצאות
    const groupLink = await page.$('a[href*="/groups/"]');
    if (!groupLink) {
      throw new Error("קבוצה לא נמצאה");
    }

    await groupLink.click();
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 });
    await sleep(2000);

    // לחיצה על שדה הכתיבה
    const writeBox = await page.$('[aria-label="כתוב משהו..."], [aria-label="Write something..."], [data-testid="status-attachment-mentions-input"]');
    if (!writeBox) {
      // נסה למצוא לפי placeholder
      const altWriteBox = await page.$('[role="textbox"]');
      if (!altWriteBox) throw new Error("לא נמצא שדה כתיבה");
      await altWriteBox.click();
    } else {
      await writeBox.click();
    }

    await sleep(1500);

    // כתיבת התוכן
    await page.keyboard.type(content, { delay: 30 });
    await sleep(2000);

    // לחיצה על כפתור פרסום
    const publishBtn = await page.$('[aria-label="פרסם"], [aria-label="Post"]');
    if (!publishBtn) throw new Error("לא נמצא כפתור פרסום");

    await publishBtn.click();
    await sleep(3000);

    console.log(`  ✓ פורסם בהצלחה: ${groupName}`);
    return true;
  } catch (err) {
    console.error(`  ✗ שגיאה בקבוצה ${groupName}: ${err.message}`);
    throw err;
  }
}

async function processCampaign(campaign, profiles) {
  console.log(`\nמעבד קמפיין: ${campaign.title}`);
  console.log(`עסק: ${campaign.business.name}`);

  // מצא פרופיל מתאים לעסק
  const profile = profiles.find(
    (p) => p.businessId === campaign.businessId && p.isActive
  );

  if (!profile) {
    console.error("לא נמצא פרופיל פעיל לעסק זה");
    return;
  }

  console.log(`פרופיל: ${profile.name} (Edge: ${profile.edgeProfile})`);

  // פתח Edge עם הפרופיל הנכון
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: EDGE_PATH,
      userDataDir: EDGE_USER_DATA,
      args: [
        `--profile-directory=${profile.edgeProfile}`,
        "--no-first-run",
        "--no-default-browser-check",
      ],
      headless: false, // נראה מה קורה
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // בדוק שמחוברים לפייסבוק
    await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
    await sleep(2000);

    const url = page.url();
    if (url.includes("login")) {
      console.error("לא מחובר לפייסבוק - פתח את Edge והתחבר לפייסבוק ידנית");
      await browser.close();
      return;
    }

    console.log("מחובר לפייסבוק ✓");

    // עדכן סטטוס ל-publishing
    await updateCampaignStatus(campaign.id, "publishing");

    // פרסם לכל קבוצה
    const templateIds = JSON.parse(campaign.templateIds || "[]");

    // קבל רשימת קבוצות מהתבניות
    const templatesRes = await fetch(`${API_BASE}/api/templates`);
    const allTemplates = await templatesRes.json();
    const selectedTemplates = allTemplates.filter((t) => templateIds.includes(t.id));

    const groups = selectedTemplates.flatMap((t) => t.groups);
    console.log(`סה"כ ${groups.length} קבוצות לפרסום`);

    let published = 0;
    let failed = 0;

    for (const group of groups) {
      try {
        await postToFacebookGroup(page, group.name, campaign.content);
        await updatePostStatus(campaign.id, group.name, "published");
        published++;
        console.log(`  התקדמות: ${published}/${groups.length}`);

        // המתנה רנדומלית בין פרסומים
        if (published < groups.length) {
          const delay = Math.floor(Math.random() * (DELAY_BETWEEN_POSTS_MAX - DELAY_BETWEEN_POSTS_MIN) + DELAY_BETWEEN_POSTS_MIN);
          console.log(`  ממתין ${delay} שניות...`);
          await sleep(delay * 1000);
        }
      } catch (err) {
        await updatePostStatus(campaign.id, group.name, "failed", err.message);
        failed++;
      }
    }

    // עדכן סטטוס סופי
    await updateCampaignStatus(campaign.id, "done");
    console.log(`\nקמפיין הושלם: ${published} הצליחו, ${failed} נכשלו`);

  } finally {
    if (browser) await browser.close();
  }
}

async function main() {
  console.log("=== מטרה Publisher ===");
  console.log("בודק קמפיינים מאושרים...\n");

  try {
    const [campaigns, profiles] = await Promise.all([
      fetchApprovedCampaigns(),
      fetchProfiles(),
    ]);

    if (campaigns.length === 0) {
      console.log("אין קמפיינים מאושרים כרגע.");
      return;
    }

    console.log(`נמצאו ${campaigns.length} קמפיינים מאושרים`);

    for (const campaign of campaigns) {
      await processCampaign(campaign, profiles);
      await sleep(5000);
    }

    console.log("\n=== סיום ===");
  } catch (err) {
    console.error("שגיאה:", err.message);
  }
}

main();
