/**
 * local-server.js - שרת מקומי
 * מפעיל שרת על המחשב שמקבל פקודות מהאתר
 *
 * הפעלה: node local-server.js
 * הפעל פעם אחת בבוקר - השרת ירוץ ברקע
 */

const http = require("http");
const fs = require("fs");

const PORT = 3333;
const API_BASE = "https://matara-publisher.vercel.app";
const LOG_FILE = "C:\\Projects\\matara-publisher\\matara-logs.txt";

function log(msg) {
  const line = `[${new Date().toLocaleTimeString("he-IL")}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + "\n"); } catch {}
}

// ====== פרסום אוטומטי לפייסבוק - הוסר במפורש ב-2026-07-05 ======
// היה כאן צינור פרסום מלא (publisherLoop + processCampaign + postToFacebookGroup,
// כ-290 שורות) שרץ ב-setInterval כל 60 שניות במקביל לתוסף הדפדפן
// (extension/background.js), על אותן טבלאות Campaign/Post, בלי claim אטומי -
// גרם לסיכון פרסום כפול וערבוב בין יוזרים (במיוחד בשילוב עם הבאג ב-
// GET /api/campaigns שהחזיר את כל הקמפיינים של כל היוזרים כשאין session).
// הוסר במפורש (לא disabled/מוער) כדי שלא יתעורר שוב בטעות.
// פירוט מלא: references/project-map.md.
// (הוואטסאפ שהיה מתועד כאן בעבר הוסר בנפרד - ראה הערה למטה)

// ====== וואטסאפ - הוסר במפורש ב-2026-07-05 ======
// כל ניהול סשן WhatsApp-Web.js (initWhatsApp/sendWhatsApp/WA_SESSIONS +
// המסלולים whatsapp-status/whatsapp-connect/send-whatsapp/init-whatsapp)
// הוסר כי לא היה בשימוש בפועל: קישורי wa.me בפוסטים נשמרים כמחרוזת רגילה
// על Campaign.whatsappLink, ולא תלויים בכלל בסשן WhatsApp-Web מחובר.
// הסיבה הישירה להסרה: launch של Puppeteer/Edge (ש-WhatsApp-Web.js דורש
// מאחורי הקלעים) נכשל תמיד כששירות Windows רץ ב-Session 0 (אין desktop
// אינטראקטיבי) - "Failed to launch the browser process: Code: 1002".
// הסרת התלות הזו פותרת את בעיית ההתקנה כשירות 24/7 בבת אחת.

// ====== סנכרון קבוצות (syncGroups) - הוסר במפורש ב-2026-07-05 ======
// היה כאן צינור סנכרון ישן דרך Puppeteer/Edge (syncGroups + endpoint
// POST /sync-groups + app/api/sync-groups/route.ts + sync-groups.js CLI),
// שסימן GroupTemplate בשם "🔄 מסונכרן מפייסבוק". נבדק בפועל בקוד - אימות
// לפני מחיקה (לא ניחוש):
//   - אין שום קובץ TypeScript חי בריפו שמכיל אזכור לפורט 3333 בכלל
//     (grep -rn "3333" --include=*.ts --include=*.tsx . | grep -v node_modules
//     | grep -v .next → אפס תוצאות).
//   - app/sync/page.tsx (המסך החי) קורא אך ורק ל-/api/extension/sync/[jobId] -
//     המסלול החדש דרך התוסף, לא לlocalhost:3333 בכלל.
//   - app/api/sync-groups/route.ts נקרא רק מ-local-server.js ו-sync-groups.js
//     עצמם - אין UI שקורא לו.
//   - sync-groups.js לא מופעל משום npm script/scheduled task/batch file.
//   - המסלול החדש (extension/background.js syncGroups() + app/api/extension/sync)
//     אומת עובד בפועל: SyncJob עם status="done" וספירות קבוצות אמיתיות
//     (938, 233, 1866) לאחרונה ב-1.7.2026.
// הוסר במפורש (לא disabled) - קוד מת מאומת, לא רק חשוד.
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

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, async () => {
  console.log("=== שרת מקומי של מטרה Publisher ===");
  console.log(`פועל על פורט ${PORT}`);
  // חיבור אוטומטי לוואטסאפ ו-publisherLoop הוסרו ב-2026-07-05 - ראה הערות למעלה ו-project-map.md
});
