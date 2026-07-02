const API_BASE = "https://matara-publisher.vercel.app";
const POLL_INTERVAL_MINUTES = 0.5;

// צור deviceId יחודי לכל התקנה
chrome.runtime.onInstalled.addListener(async () => {
  const { deviceId } = await chrome.storage.local.get("deviceId");
  if (!deviceId) {
    const id = "device_" + Math.random().toString(36).slice(2) + Date.now();
    await chrome.storage.local.set({ deviceId: id });
  }
  chrome.alarms.create("poll", { periodInMinutes: POLL_INTERVAL_MINUTES });
  autoLogin();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "poll") tick();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url?.includes("matara-publisher.vercel.app")) {
    autoLogin();
  }
});

async function autoLogin() {
  try {
    const res = await fetch(`${API_BASE}/api/extension/token`, { credentials: "include" });
    if (!res.ok) { await chrome.storage.local.remove(["apiToken", "userName", "userEmail"]); return; }
    const { token } = await res.json();
    if (!token) return;
    const { apiToken } = await chrome.storage.local.get("apiToken");
    if (apiToken !== token) {
      await chrome.storage.local.set({ apiToken: token });
      const { deviceId } = await chrome.storage.local.get("deviceId");
      const jobsRes = await fetch(`${API_BASE}/api/extension/jobs?token=${token}&deviceId=${deviceId || ""}`);
      if (jobsRes.ok) {
        const { user } = await jobsRes.json();
        if (user) await chrome.storage.local.set({ userName: user.name, userEmail: user.email });
      }
    }
  } catch {}
}

async function tick() {
  await autoLogin();
  const { apiToken, deviceId } = await chrome.storage.local.get(["apiToken", "deviceId"]);
  if (!apiToken) return;

  try {
    // בדוק פוסטים
    const jobsRes = await fetch(`${API_BASE}/api/extension/jobs?token=${apiToken}&deviceId=${deviceId || ""}`);
    if (jobsRes.ok) {
      const { posts } = await jobsRes.json();
      if (posts && posts.length > 0) {
        for (const post of posts) {
          await publishPost(post, apiToken);
          await sleep(5000);
        }
      }
    }

    // בדוק סנכרון
    const syncRes = await fetch(`${API_BASE}/api/extension/sync?token=${apiToken}&deviceId=${deviceId || ""}`);
    if (syncRes.ok) {
      const { job } = await syncRes.json();
      if (job) await syncGroups(job, apiToken);
    }
  } catch (err) {
    console.error("שגיאה:", err);
  }
}

async function publishPost(post, token) {
  const url = `https://www.facebook.com/groups/${post.fbGroupId}`;
  let tabId = null;
  try {
    const tab = await new Promise((resolve) => chrome.tabs.create({ url, active: false }, resolve));
    tabId = tab.id;
    await sleep(7000);

    // חבר debugger לשליחת קלט אמיתי (React מזהה Input.insertText)
    await new Promise((resolve) => chrome.debugger.attach({ tabId }, "1.3", resolve));

    // לחץ על אזור הכתיבה הראשי של הקבוצה (לא תגובה)
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // נסה למצוא את תיבת "כאן כותבים" / "כתוב משהו" - תמיד בחלק העליון של הדף
        // מחפש placeholder טקסט באזורי כתיבה ראשיים
        const PLACEHOLDERS = ["כאן כותבים", "כתוב משהו", "Write something", "What's on your mind", "מה תרצה לשתף"];

        // אפשרות 1: contenteditable עם placeholder
        let target = Array.from(document.querySelectorAll('[contenteditable]')).find(el => {
          const ph = el.getAttribute('aria-placeholder') || el.getAttribute('placeholder') || el.textContent || '';
          return PLACEHOLDERS.some(p => ph.includes(p));
        });

        // אפשרות 2: כפתור עם טקסט מתאים
        if (!target) {
          target = Array.from(document.querySelectorAll('[role="button"]')).find(el => {
            const t = el.textContent?.trim() || '';
            return PLACEHOLDERS.some(p => t.includes(p));
          });
        }

        if (target) target.click();
      },
    });
    await sleep(3000);

    // וודא שה-focus על תיבת הכתיבה בדיאלוג (לא תגובה)
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const dialog = document.querySelector('[role="dialog"]') || document.querySelector('[aria-modal="true"]');
        const box = dialog
          ? dialog.querySelector('[role="textbox"][contenteditable="true"]')
          : document.querySelector('[role="textbox"][contenteditable="true"]');
        if (box) { box.click(); box.focus(); }
      },
    });
    await sleep(600);

    // שלח טקסט שורה אחר שורה - Input.insertText לא מטפל ב-\n בפייסבוק
    const lines = post.campaign.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]) {
        await new Promise((resolve) => chrome.debugger.sendCommand({ tabId }, "Input.insertText", { text: lines[i] }, resolve));
      }
      if (i < lines.length - 1) {
        await new Promise((resolve) => chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", keyCode: 13, windowsVirtualKeyCode: 13 }, resolve));
        await new Promise((resolve) => chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", keyCode: 13, windowsVirtualKeyCode: 13 }, resolve));
      }
    }
    await sleep(2000);

    // חכה שכפתור פרסם יהיה פעיל ולחץ עליו (חיפוש בתוך הדיאלוג בלבד)
    let success = false;
    let error = null;
    for (let i = 0; i < 12; i++) {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const dialog = document.querySelector('[role="dialog"]') || document.querySelector('[aria-modal="true"]') || document;
          const btn = Array.from(dialog.querySelectorAll('[role="button"]'))
            .find(el => {
              const t = el.textContent?.trim();
              return (t === "פרסם" || t === "Post" || t === "שתף" || t === "Share")
                && el.getAttribute("aria-disabled") !== "true"
                && !el.closest('[aria-hidden="true"]');
            });
          if (btn) { btn.scrollIntoView(); btn.click(); return { clicked: true }; }
          return { clicked: false };
        },
      });
      if (results?.[0]?.result?.clicked) { success = true; break; }
      await sleep(500);
    }
    if (!success) error = "לא נמצא כפתור פרסם";
    await sleep(5000);
    await updatePostStatus(post.id, success ? "published" : "failed", error, token);
  } catch (err) {
    await updatePostStatus(post.id, "failed", err.message, token);
  } finally {
    try { await new Promise((resolve) => chrome.debugger.detach({ tabId }, resolve)); } catch {}
    if (tabId) {
      // נווט ל-about:blank לפני סגירה - מונע דיאלוג "האם לעזוב?"
      try { await new Promise((resolve) => chrome.debugger.sendCommand({ tabId }, "Page.navigate", { url: "about:blank" }, resolve)); } catch {}
      await sleep(1000);
      chrome.tabs.remove(tabId);
    }
  }
}

// סנכרון קבוצות ברמת רשת - לא תלוי במבנה ה-DOM של פייסבוק, עובד זהה על כל פרופיל
async function syncGroups(job, token) {
  let tabId = null;
  try {
    // נווט בדיוק כמו גלישה רגילה: בית → קבוצות → הקבוצות שלך → כל הקבוצות שהצטרפת אליהן
    const tab = await new Promise((resolve) =>
      chrome.tabs.create({ url: "https://www.facebook.com/", active: false }, resolve)
    );
    tabId = tab.id;

    const found = new Map();
    let lastReportedSize = 0;

    await new Promise((resolve) => chrome.debugger.attach({ tabId }, "1.3", resolve));
    await new Promise((resolve) => chrome.debugger.sendCommand({ tabId }, "Network.enable", {}, resolve));

    const pending = new Map(); // requestId -> true (graphql request)

    const onEvent = (source, method, params) => {
      if (source.tabId !== tabId) return;

      if (method === "Network.responseReceived") {
        const url = params.response?.url || "";
        if (url.includes("/api/graphql")) pending.set(params.requestId, true);
      }

      if (method === "Network.loadingFinished" && pending.has(params.requestId)) {
        const requestId = params.requestId;
        pending.delete(requestId);
        chrome.debugger.sendCommand({ tabId }, "Network.getResponseBody", { requestId }, (result) => {
          if (chrome.runtime.lastError || !result?.body) return;
          const text = result.base64Encoded ? atob(result.body) : result.body;
          extractGroupsFromGraphQL(text, found);
        });
      }
    };
    chrome.debugger.onEvent.addListener(onEvent);

    await sleep(4000);

    // לחץ על "קבוצות" בניווט הראשי
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const link = Array.from(document.querySelectorAll('a[href*="/groups/"]'))
          .find(a => /\/groups\/?($|\?)/.test(new URL(a.href).pathname));
        if (link) link.click();
      },
    });
    await sleep(4000);

    // לחץ על "הקבוצות שלך" / "כל הקבוצות שהצטרפת אליהן" - חיפוש לפי href
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const link = document.querySelector('a[href*="/groups/joins"]')
          || Array.from(document.querySelectorAll('a')).find(a => (a.textContent || "").includes("כל הקבוצות"));
        if (link) link.click();
      },
    });
    await sleep(6000);

    // ודא שהגענו לדף הנכון - אם לא, נווט ישירות
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        if (!location.pathname.includes("/groups/joins")) {
          location.href = "https://www.facebook.com/groups/joins/";
        }
      },
    });
    await sleep(6000);

    // גלול את הדף כדי לטעון עוד תוצאות (infinite scroll)
    let noNewCount = 0;
    for (let i = 0; i < 200; i++) {
      // סרוק כרטיסים גלויים לפני הגלילה הבאה
      const domResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: scrapeJoinedGroupCards,
      });
      for (const g of (domResult?.[0]?.result || [])) found.set(g.fbGroupId, g);

      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          window.scrollTo(0, document.body.scrollHeight);
          window.dispatchEvent(new Event("scroll"));
        },
      });
      await sleep(2500);

      if (found.size > lastReportedSize) {
        noNewCount = 0;
        lastReportedSize = found.size;
        await fetch(`${API_BASE}/api/extension/sync/${job.id}?token=${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "running", groupsFound: found.size }),
        });
      } else {
        noNewCount++;
        if (noNewCount >= 6) break;
      }
    }

    chrome.debugger.onEvent.removeListener(onEvent);
    await new Promise((resolve) => chrome.debugger.detach({ tabId }, resolve));

    const groups = Array.from(found.values());
    await fetch(`${API_BASE}/api/extension/sync/${job.id}?token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done", groups, groupsFound: groups.length }),
    });

    chrome.notifications.create({
      type: "basic", iconUrl: "icon48.png",
      title: "סנכרון הושלם",
      message: `נמצאו ${groups.length} קבוצות`,
    });
  } catch (err) {
    await fetch(`${API_BASE}/api/extension/sync/${job.id}?token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "failed", error: err.message }),
    });
  } finally {
    try { await new Promise((resolve) => chrome.debugger.detach({ tabId }, resolve)); } catch {}
    if (tabId) chrome.tabs.remove(tabId);
  }
}

// סורק כרטיסי קבוצות בדף groups/joins - מתבסס על כפתור "הצגת הקבוצה"/"View Group"
// שמקושר תמיד ישירות לקבוצה, ומתעלם מהסרגל הימני (התראות/שיתופים)
function scrapeJoinedGroupCards() {
  const SKIP_IDS = new Set(["feed", "joins", "joined", "discover", "create", "your_posts", "explore", "membership", "permalink", "category", "posts", "join"]);
  const BTN_TEXT = new Set(["הצגת הקבוצה", "View Group", "View group", "ראה קבוצה"]);
  const seen = new Set();
  const results = [];

  const buttons = Array.from(document.querySelectorAll("a")).filter((a) => {
    const t = (a.innerText || a.textContent || "").trim();
    return BTN_TEXT.has(t);
  });

  for (const btn of buttons) {
    // דלג על כל מה שבתוך הסרגל הימני / ניווט / כותרת
    if (btn.closest("aside") || btn.closest("nav") || btn.closest("header") || btn.closest('[role="navigation"]') || btn.closest('[role="banner"]')) continue;

    const m = (btn.href || "").match(/facebook\.com\/groups\/([^/?#\s]+)/);
    if (!m) continue;
    const id = m[1].toLowerCase().replace(/\/$/, "");
    if (SKIP_IDS.has(id) || !/^[\w.-]{2,80}$/.test(id) || seen.has(id)) continue;

    // עלה ב-DOM למצוא את כרטיס הקבוצה (עד 10 הורים) וחפש את השם - השורה הראשונה בכרטיס
    let card = btn;
    let name = null;
    for (let depth = 0; depth < 6 && card; depth++) {
      card = card.parentElement;
      if (!card) break;
      const lines = (card.innerText || "").split("\n").map((l) => l.trim()).filter(Boolean);
      const candidate = lines.find((l) =>
        l.length >= 2 && l.length <= 150 &&
        !BTN_TEXT.has(l) &&
        !l.includes("ביקור האחרון") &&
        !l.includes("לפני") &&
        l !== "..." && l !== "···"
      );
      if (candidate) { name = candidate; break; }
    }
    if (!name) continue;

    seen.add(id);
    results.push({ fbGroupId: id, name });
  }

  return results;
}

// סורק תשובת GraphQL גולמית (JSON) ומחפש אובייקטי קבוצה - לא תלוי במבנה DOM
function extractGroupsFromGraphQL(text, map) {
  // פייסבוק לפעמים מוסיפה תחילית הגנה לפני ה-JSON
  let cleaned = text.trim();
  if (cleaned.startsWith("for (;;);")) cleaned = cleaned.slice("for (;;);".length);
  if (cleaned.startsWith("for(;;);")) cleaned = cleaned.slice("for(;;);".length);

  for (const line of cleaned.split("\n")) {
    if (!line.trim()) continue;
    let data;
    try { data = JSON.parse(line); } catch { continue; }
    walkForGroups(data, map, 0);
  }
}

function walkForGroups(obj, map, depth) {
  if (!obj || typeof obj !== "object" || depth > 30) return;

  const typename = obj.__typename;
  if ((typename === "Group" || typename === "CometGroup" || typename === "GroupPage") && obj.id && typeof obj.name === "string") {
    map.set(obj.id, { fbGroupId: obj.id, name: obj.name });
  } else if (obj.url && typeof obj.url === "string" && typeof obj.name === "string") {
    const m = obj.url.match(/facebook\.com\/groups\/([^/?#\s]+)/);
    if (m) {
      const id = m[1].replace(/\/$/, "");
      const skip = new Set(["feed", "joins", "joined", "discover", "create", "your_posts", "explore", "membership", "permalink"]);
      if (!skip.has(id) && /^[\w.-]{2,80}$/.test(id) && obj.name.length >= 2 && obj.name.length <= 200) {
        map.set(id, { fbGroupId: id, name: obj.name });
      }
    }
  }

  if (Array.isArray(obj)) {
    for (const item of obj) if (item && typeof item === "object") walkForGroups(item, map, depth + 1);
    return;
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") walkForGroups(v, map, depth + 1);
  }
}

function injectPost(content) {
  return new Promise(async (resolve) => {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    try {
      await sleep(4000);

      // פתח את תיבת הכתיבה אם לא פתוחה
      let writeBox = document.querySelector('[role="textbox"][contenteditable="true"]');
      if (!writeBox) {
        const writeBtn = Array.from(document.querySelectorAll('[role="button"]'))
          .find(el => {
            const t = el.textContent?.trim();
            return t === "כתוב משהו..." || t === "Write something..." || t === "כתוב פוסט..." || t?.includes("כתוב");
          });
        if (writeBtn) { writeBtn.click(); await sleep(2500); }
        writeBox = document.querySelector('[role="textbox"][contenteditable="true"]');
      }

      if (!writeBox) { resolve({ success: false, error: "לא נמצאה תיבת כתיבה" }); return; }

      writeBox.click();
      await sleep(600);
      writeBox.focus();
      await sleep(400);

      // הדבקה דרך clipboard API - פייסבוק מזהה אותה כהקלדה אמיתית
      try {
        await navigator.clipboard.writeText(content);
        document.execCommand("paste");
      } catch {
        // fallback - DataTransfer
        const dt = new DataTransfer();
        dt.setData("text/plain", content);
        writeBox.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
      }
      await sleep(2000);

      // חכה שהכפתור יהיה enabled (עד 5 שניות)
      let submitBtn = null;
      for (let i = 0; i < 10; i++) {
        submitBtn = Array.from(document.querySelectorAll('[role="button"]'))
          .find(el => {
            const text = el.textContent?.trim();
            return (text === "פרסם" || text === "Post" || text === "שתף" || text === "Share")
              && !el.getAttribute("aria-disabled")
              && el.getAttribute("aria-disabled") !== "true";
          });
        if (submitBtn) break;
        await sleep(500);
      }

      if (!submitBtn) { resolve({ success: false, error: "לא נמצא כפתור פרסם (הטקסט אולי לא נכנס)" }); return; }
      submitBtn.click();
      await sleep(4000);
      resolve({ success: true });
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
}

async function updatePostStatus(postId, status, error, token) {
  const { deviceId } = await chrome.storage.local.get("deviceId");
  await fetch(`${API_BASE}/api/extension/jobs/${postId}?token=${token}&deviceId=${deviceId || ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, error }),
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
