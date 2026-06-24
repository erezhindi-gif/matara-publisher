/**
 * publisher.js - סקריפט פרסום מקומי
 * מריץ על המחשב שלך ומפרסם לפייסבוק אוטומטית
 *
 * הפעלה: node publisher.js
 */

const puppeteer = require("puppeteer-core");
const path = require("path");
const os = require("os");
const fs = require("fs");
const https = require("https");
const http = require("http");

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
  // Add gaussian-like noise: average of 3 random numbers feels more natural than uniform
  const r = (Math.random() + Math.random() + Math.random()) / 3;
  const sec = minSec + r * (maxSec - minSec);
  // Occasionally (10% chance) take a longer break - like a human distracted
  const longBreak = Math.random() < 0.1 ? (20 + Math.random() * 40) : 0;
  return sleep((sec + longBreak) * 1000);
}

// הורדת תמונות לתיקייה זמנית
async function downloadImages(imageUrls) {
  if (!imageUrls || imageUrls.length === 0) return [];
  const tmpDir = path.join(os.tmpdir(), "matara-publisher");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const localPaths = [];
  for (const url of imageUrls) {
    const ext = url.split(".").pop().split("?")[0] || "jpg";
    const filename = `img-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const localPath = path.join(tmpDir, filename);

    await new Promise((resolve, reject) => {
      const protocol = url.startsWith("https") ? https : http;
      const file = fs.createWriteStream(localPath);
      protocol.get(url, (res) => {
        res.pipe(file);
        file.on("finish", () => { file.close(); resolve(); });
      }).on("error", reject);
    });

    localPaths.push(localPath);
    console.log(`  הורדתי תמונה: ${filename}`);
  }
  return localPaths;
}

// מחיקת תמונות זמניות אחרי פרסום
function cleanupImages(localPaths) {
  for (const p of localPaths) {
    try { fs.unlinkSync(p); } catch { /* ignore */ }
  }
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

async function postToFacebookGroup(page, groupName, content, localImagePaths = []) {
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

    // העלאת תמונות אם יש
    if (localImagePaths.length > 0) {
      // לחיצה על כפתור תמונה/וידאו
      const photoBtn = await page.$('[aria-label="תמונה/וידאו"], [aria-label="Photo/video"], [data-testid="photo-video-button"]');
      if (photoBtn) {
        await photoBtn.click();
        await sleep(2000);
      }

      // מציאת שדה העלאת קובץ
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        await fileInput.uploadFile(...localImagePaths);
        await sleep(4000); // המתן לטעינת התמונות
        console.log(`  העלתי ${localImagePaths.length} תמונות`);
      } else {
        console.warn("  לא נמצא שדה העלאת תמונה - ממשיך בלי תמונה");
      }
    }

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

    // הורד תמונות פעם אחת לפני הלולאה
    let localImagePaths = [];
    if (campaign.imageUrls && campaign.imageUrls.length > 0) {
      console.log(`מוריד ${campaign.imageUrls.length} תמונות...`);
      localImagePaths = await downloadImages(campaign.imageUrls);
    }

    let published = 0;
    let failed = 0;

    for (const group of groups) {
      try {
        await postToFacebookGroup(page, group.name, campaign.content, localImagePaths);
        await updatePostStatus(campaign.id, group.name, "published");
        published++;
        console.log(`  התקדמות: ${published}/${groups.length}`);

        // המתנה טבעית בין פרסומים
        if (published < groups.length) {
          console.log(`  ממתין...`);
          await randomDelay(DELAY_BETWEEN_POSTS_MIN, DELAY_BETWEEN_POSTS_MAX);
        }
      } catch (err) {
        await updatePostStatus(campaign.id, group.name, "failed", err.message);
        failed++;
      }
    }

    // מחק תמונות זמניות
    cleanupImages(localImagePaths);

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
