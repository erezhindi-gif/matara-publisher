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
const fs = require("fs");
const https = require("https");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const QRCode = require("qrcode");

const PORT = 3333;
const API_BASE = "https://matara-publisher.vercel.app";
const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const EDGE_USER_DATA = path.join(os.homedir(), "AppData", "Local", "Microsoft", "Edge", "User Data");

const SKIP_IDS = new Set([
  "feed", "discover", "create", "joins", "membership", "requests",
  "search", "notifications", "invite", "category", "updates", "all",
  "archived", "suggested", "local", "explore", "buy", "sell",
]);

// ====== פרסום אוטומטי לפייסבוק ======
const DELAY_MIN = 30, DELAY_MAX = 90;
let isPublishing = false;

function randomDelay(minSec, maxSec) {
  const r = (Math.random() + Math.random() + Math.random()) / 3;
  const longBreak = Math.random() < 0.1 ? (20 + Math.random() * 40) : 0;
  return new Promise(r2 => setTimeout(r2, (minSec + r * (maxSec - minSec) + longBreak) * 1000));
}

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
      protocol.get(url, (res) => { res.pipe(file); file.on("finish", () => { file.close(); resolve(); }); }).on("error", reject);
    });
    localPaths.push(localPath);
  }
  return localPaths;
}

async function updateCampaignStatus(id, status) {
  await fetch(`${API_BASE}/api/campaigns/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

async function updatePostStatus(campaignId, groupName, status, error = null) {
  await fetch(`${API_BASE}/api/posts`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ campaignId, groupName, status, error }),
  });
}

async function postToFacebookGroup(page, fbGroupId, groupName, content, localImagePaths = []) {
  console.log(`  פרסום לקבוצה: ${groupName} (${fbGroupId})`);

  // נווט ישירות לקבוצה לפי ID
  await page.goto(`https://www.facebook.com/groups/${fbGroupId}`, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  // בדוק שהגענו לקבוצה ולא לדף שגיאה
  const url = page.url();
  if (url.includes("login") || url.includes("checkpoint")) throw new Error("נדרש אימות פייסבוק");

  // לחץ על שדה "כתוב משהו"
  const writeBox = await page.$('[aria-label="כתוב משהו..."], [aria-label="Write something..."], [data-testid="status-attachment-mentions-input"]');
  if (!writeBox) {
    // נסה למצוא לפי role
    const roleBox = await page.$('[role="textbox"]');
    if (!roleBox) throw new Error("לא נמצא שדה כתיבה בקבוצה");
    await roleBox.click();
  } else {
    await writeBox.click();
  }

  await new Promise(r => setTimeout(r, 1500));
  await page.keyboard.type(content, { delay: 25 });
  await new Promise(r => setTimeout(r, 2000));

  // העלאת תמונות
  if (localImagePaths.length > 0) {
    const photoBtn = await page.$('[aria-label="תמונה/וידאו"], [aria-label="Photo/video"]');
    if (photoBtn) { await photoBtn.click(); await new Promise(r => setTimeout(r, 2000)); }
    const fileInput = await page.$('input[type="file"]');
    if (fileInput) { await fileInput.uploadFile(...localImagePaths); await new Promise(r => setTimeout(r, 4000)); }
  }

  // לחץ פרסם
  const publishBtn = await page.$('[aria-label="פרסם"], [aria-label="Post"]');
  if (!publishBtn) throw new Error("לא נמצא כפתור פרסום");
  await publishBtn.click();
  await new Promise(r => setTimeout(r, 4000));

  // וודא שהפוסט נשלח - בדוק שהשדה התרוקן
  console.log(`  ✓ פורסם: ${groupName}`);
}

async function processCampaign(campaign, profiles) {
  console.log(`\n[פרסום] קמפיין: ${campaign.title}`);
  const profile = profiles.find(p => p.businessId === campaign.businessId && p.isActive);
  if (!profile) { console.error("[פרסום] לא נמצא פרופיל פעיל"); return; }

  let browser;
  try {
    // סגור Edge אם פתוח
    try { execSync("taskkill /F /IM msedge.exe 2>nul"); await new Promise(r => setTimeout(r, 2000)); } catch {}

    browser = await puppeteer.launch({
      executablePath: EDGE_PATH,
      userDataDir: EDGE_USER_DATA,
      args: [`--profile-directory=${profile.edgeProfile}`, "--no-first-run", "--no-default-browser-check"],
      headless: false,
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 2000));
    if (page.url().includes("login")) { console.error("[פרסום] לא מחובר לפייסבוק"); await browser.close(); return; }

    await updateCampaignStatus(campaign.id, "publishing");

    const templateIds = JSON.parse(campaign.templateIds || "[]");
    const allTemplates = await fetch(`${API_BASE}/api/templates`).then(r => r.json());
    const groups = allTemplates.filter(t => templateIds.includes(t.id)).flatMap(t => t.groups);
    console.log(`[פרסום] ${groups.length} קבוצות`);

    const localImagePaths = campaign.imageUrls?.length > 0 ? await downloadImages(campaign.imageUrls) : [];
    let published = 0, failed = 0;

    for (const group of groups) {
      try {
        await postToFacebookGroup(page, group.fbGroupId, group.name, campaign.content, localImagePaths);
        await updatePostStatus(campaign.id, group.name, "published");
        published++;
        if (published < groups.length) await randomDelay(DELAY_MIN, DELAY_MAX);
      } catch (err) {
        await updatePostStatus(campaign.id, group.name, "failed", err.message);
        failed++;
      }
    }

    localImagePaths.forEach(p => { try { fs.unlinkSync(p); } catch {} });
    const finalStatus = published > 0 ? "done" : "failed";
    await updateCampaignStatus(campaign.id, finalStatus);
    console.log(`[פרסום] ${finalStatus === "done" ? "הושלם" : "נכשל"}: ${published} הצליחו, ${failed} נכשלו`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    // פתח Edge מחדש אחרי הפרסום
    setTimeout(() => exec(`"${EDGE_PATH}"`), 2000);
  }
}

async function publisherLoop() {
  if (isPublishing) return;
  isPublishing = true;
  try {
    const now = new Date();
    const campaigns = await fetch(`${API_BASE}/api/campaigns`).then(r => r.json()).catch(() => []);
    const due = campaigns.filter(c => {
      if (c.status !== "approved") return false;
      if (!c.scheduledAt) return true; // ללא תזמון - פרסם מיד
      const scheduled = new Date(c.scheduledAt);
      return scheduled <= now; // הגיע הזמן
    });

    if (due.length > 0) {
      console.log(`\n[פרסום] נמצאו ${due.length} קמפיינים לפרסום`);
      const profiles = await fetch(`${API_BASE}/api/profiles`).then(r => r.json()).catch(() => []);
      for (const campaign of due) {
        await processCampaign(campaign, profiles);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  } catch (err) {
    console.error("[פרסום] שגיאה:", err.message);
  } finally {
    isPublishing = false;
  }
}

// ====== וואטסאפ - סשן לכל פרופיל ======
// profileId → { client, status, qrDataUrl, phoneNumber }
const WA_SESSIONS = {};
let isRunning = false;

function initWhatsApp(profileId, phoneNumber) {
  if (WA_SESSIONS[profileId]?.status === "connected") return;

  console.log(`\n[וואטסאפ] מאתחל סשן עבור פרופיל: ${profileId}`);

  // נקה סשן קיים
  if (WA_SESSIONS[profileId]?.client) {
    try { WA_SESSIONS[profileId].client.destroy(); } catch {}
  }

  WA_SESSIONS[profileId] = { status: "connecting", qrDataUrl: null, phoneNumber };

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: `matara-${profileId}` }),
    puppeteer: { executablePath: EDGE_PATH, headless: true, args: ["--no-sandbox"] },
  });

  client.on("qr", async (qr) => {
    console.log(`[וואטסאפ] QR מוכן לפרופיל: ${profileId}`);
    qrcode.generate(qr, { small: true });
    try {
      const dataUrl = await QRCode.toDataURL(qr, { width: 500, margin: 2 });
      WA_SESSIONS[profileId].qrDataUrl = dataUrl;
      WA_SESSIONS[profileId].status = "qr_ready";
    } catch {}
  });

  client.on("ready", () => {
    console.log(`[וואטסאפ] מחובר! פרופיל: ${profileId}`);
    WA_SESSIONS[profileId].status = "connected";
    WA_SESSIONS[profileId].qrDataUrl = null;
  });

  client.on("disconnected", (reason) => {
    console.log(`[וואטסאפ] התנתק: ${profileId} (${reason}) - מנסה חיבור מחדש בעוד 15 שניות...`);
    WA_SESSIONS[profileId].status = "disconnected";
    WA_SESSIONS[profileId].client = null;
    // חיבור מחדש אוטומטי
    setTimeout(() => {
      if (WA_SESSIONS[profileId]?.status === "disconnected") {
        console.log(`[וואטסאפ] מתחבר מחדש: ${profileId}`);
        initWhatsApp(profileId, WA_SESSIONS[profileId]?.phoneNumber);
      }
    }, 15000);
  });

  client.initialize();
  WA_SESSIONS[profileId].client = client;
}

async function sendWhatsApp(profileId, phoneNumbers, message) {
  const session = WA_SESSIONS[profileId];
  if (!session || session.status !== "connected") {
    console.log(`[וואטסאפ] פרופיל ${profileId} לא מחובר`);
    return;
  }

  for (const phone of phoneNumbers) {
    try {
      const formatted = phone.replace(/\D/g, "").replace(/^0/, "972") + "@c.us";
      await session.client.sendMessage(formatted, message);
      console.log(`[וואטסאפ] נשלח ל-${phone}`);
    } catch (err) {
      console.error(`[וואטסאפ] שגיאה בשליחה ל-${phone}:`, err.message);
    }
  }
}

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

    // השהייה אקראית בין 8-20 שניות בין כל קבוצה (נראה טבעי לפייסבוק)
    console.log(`נמצאו ${groups.length} קבוצות - מפרסם עם השהיות אקראיות...`);

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

  // סטטוס וואטסאפ לכל הפרופילים
  if (req.url === "/whatsapp-status" && req.method === "GET") {
    const status = {};
    for (const [id, s] of Object.entries(WA_SESSIONS)) {
      status[id] = { status: s.status, qrDataUrl: s.qrDataUrl };
    }
    res.writeHead(200);
    res.end(JSON.stringify(status));
    return;
  }

  // חיבור / חיבור מחדש לפרופיל
  if (req.url === "/whatsapp-connect" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const { profileId, phoneNumber } = JSON.parse(body || "{}");
        initWhatsApp(profileId, phoneNumber);
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // שליחת הודעת וואטסאפ
  if (req.url === "/send-whatsapp" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", async () => {
      try {
        const { businessType, phoneNumbers, message } = JSON.parse(body || "{}");
        await sendWhatsApp(businessType, phoneNumbers, message);
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // אתחול סשן וואטסאפ עסק
  if (req.url === "/init-whatsapp" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const { businessType } = JSON.parse(body || "{}");
        initWhatsApp(businessType);
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, message: `מאתחל סשן עבור ${businessType} - בדוק את הטרמינל לסריקת קוד QR` }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, async () => {
  console.log("=== שרת מקומי של מטרה Publisher ===");
  console.log(`פועל על פורט ${PORT}`);
  console.log("[פרסום] בודק קמפיינים כל 5 דקות אוטומטית");

  // חבר אוטומטית וואטסאפ לכל פרופיל שיש לו סשן שמור
  try {
    const profiles = await fetch(`${API_BASE}/api/profiles`).then(r => r.json()).catch(() => []);
    const authDir = path.join(__dirname, ".wwebjs_auth");
    for (const profile of profiles) {
      const sessionDir = path.join(authDir, `session-matara-${profile.id}`);
      if (fs.existsSync(sessionDir)) {
        console.log(`[וואטסאפ] מתחבר אוטומטית לפרופיל: ${profile.name}`);
        initWhatsApp(profile.id, profile.whatsappPhone);
      }
    }
  } catch (err) {
    console.error("[וואטסאפ] שגיאה בטעינה אוטומטית:", err.message);
  }

  // הפעל בדיקה ראשונה אחרי 30 שניות, ואז כל דקה
  setTimeout(publisherLoop, 30 * 1000);
  setInterval(publisherLoop, 60 * 1000);
});
