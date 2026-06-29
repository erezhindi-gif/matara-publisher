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
  return new Promise((resolve) => {
    chrome.tabs.create({ url, active: false }, async (tab) => {
      await sleep(6000);
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: injectPost,
          args: [post.campaign.content],
        });
        const result = results?.[0]?.result;
        await updatePostStatus(post.id, result?.success ? "published" : "failed", result?.error || null, token);
      } catch (err) {
        await updatePostStatus(post.id, "failed", err.message, token);
      } finally {
        await sleep(2000);
        chrome.tabs.remove(tab.id);
        resolve();
      }
    });
  });
}

async function syncGroups(job, token) {
  return new Promise((resolve) => {
    chrome.tabs.create({ url: "https://www.facebook.com/groups/feed/", active: false }, async (tab) => {
      await sleep(10000);
      try {
        const allGroups = new Map();

        // שלב 1: מצא את קונטיינר הקבוצות הנכון ע"י בדיקה איזה אלמנט באמת מעלה קישורים חדשים
        const findResult = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: findGroupsContainer,
        });
        const debug = findResult?.[0]?.result || [];
        console.log("Debug containers:", JSON.stringify(debug));

        // שלב 2: גלול וסרוק
        let noNewCount = 0;
        for (let i = 0; i < 400; i++) {
          const prevSize = allGroups.size;

          const scrollResult = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: scrollAndExtract,
          });
          const groups = scrollResult?.[0]?.result || [];
          for (const g of groups) allGroups.set(g.fbGroupId, g);

          await sleep(2000);

          if (allGroups.size > prevSize) {
            noNewCount = 0;
            await fetch(`${API_BASE}/api/extension/sync/${job.id}?token=${token}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "running", groupsFound: allGroups.size }),
            });
          } else {
            noNewCount++;
            if (noNewCount >= 10) break;
          }
        }

        const groups = Array.from(allGroups.values());
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
        await sleep(1000);
        chrome.tabs.remove(tab.id);
        resolve();
      }
    });
  });
}

// מוצא את קונטיינר הקבוצות ע"י בדיקה: מגלל 500px ובודק אם עלו קישורים חדשים
function findGroupsContainer() {
  const SKIP_IDS = new Set(["feed","joins","joined","discover","create","your_posts","explore","membership","permalink","category","posts","join"]);
  const debug = [];

  function countGroupLinks(el) {
    const seen = new Set();
    el.querySelectorAll('a[href*="/groups/"]').forEach(a => {
      const m = a.href.match(/facebook\.com\/groups\/([^/?#\s]+)/);
      if (m && !SKIP_IDS.has(m[1]) && /^[\w.-]{2,80}$/.test(m[1])) seen.add(m[1]);
    });
    return seen.size;
  }

  const candidates = Array.from(document.querySelectorAll("*")).filter(el => {
    if (el.scrollHeight <= el.clientHeight + 50) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 50 || rect.height < 100) return false;
    return true;
  });

  let bestEl = null;
  let bestGain = 0;

  candidates.forEach((el, idx) => {
    const before = countGroupLinks(el);
    if (before === 0) return; // אין קישורי קבוצות בכלל - לא רלוונטי
    const prevTop = el.scrollTop;
    el.scrollTop += 500;
    const after = countGroupLinks(el);
    const gain = after - before;
    const rect = el.getBoundingClientRect();

    debug.push({
      idx,
      tag: el.tagName,
      role: el.getAttribute("role") || "",
      clientH: Math.round(el.clientHeight),
      scrollH: Math.round(el.scrollHeight),
      linksBefore: before,
      linksAfter: after,
      gain,
      x: Math.round(rect.x),
      w: Math.round(rect.width),
    });

    if (gain > bestGain) {
      bestGain = gain;
      bestEl = el;
    } else {
      el.scrollTop = prevTop; // חזור אם לא הקונטיינר הנכון
    }
  });

  if (bestEl) {
    window.__syncContainer = bestEl;
  }

  return debug;
}

// גולל את הקונטיינר שנמצא ומחזיר קישורי קבוצות
function scrollAndExtract() {
  const SKIP_IDS = new Set(["feed","joins","joined","discover","create","your_posts","explore","membership","permalink","category","posts","join"]);
  const SKIP_TEXT = new Set(["הצגת הקבוצה","View Group","View group","הצטרף","Join"]);

  const container = window.__syncContainer;
  if (container) {
    container.scrollTop += 500;
  }

  const scope = container || document;
  const seen = new Set();
  const results = [];

  scope.querySelectorAll('a[href*="/groups/"]').forEach(a => {
    const m = a.href.match(/facebook\.com\/groups\/([^/?#\s]+)/);
    if (!m) return;
    const id = m[1].toLowerCase().replace(/\/$/, "");
    if (SKIP_IDS.has(id) || !/^[\w.-]{2,80}$/.test(id)) return;
    if (seen.has(id)) return;
    const raw = (a.innerText || a.textContent || "").trim();
    const name = raw.split("\n").map(l => l.trim()).find(l => l.length >= 2 && l.length <= 150 && !SKIP_TEXT.has(l));
    if (!name) return;
    seen.add(id);
    results.push({ fbGroupId: id, name });
  });

  return results;
}

function injectPost(content) {
  return new Promise(async (resolve) => {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    try {
      await sleep(3000);
      let writeBox = document.querySelector('[role="textbox"][contenteditable="true"]')
        || document.querySelector('div[contenteditable="true"]');

      if (!writeBox) {
        const writeBtn = Array.from(document.querySelectorAll('[role="button"]'))
          .find(el => el.textContent?.includes("כתוב") || el.textContent?.includes("Write"));
        if (writeBtn) { writeBtn.click(); await sleep(2000); }
        writeBox = document.querySelector('[role="textbox"][contenteditable="true"]')
          || document.querySelector('div[contenteditable="true"]');
      }

      if (!writeBox) { resolve({ success: false, error: "לא נמצאה תיבת כתיבה" }); return; }

      writeBox.click();
      await sleep(500);
      writeBox.focus();
      document.execCommand("insertText", false, content);
      await sleep(1500);

      const submitBtn = Array.from(document.querySelectorAll('[role="button"]'))
        .find(el => {
          const text = el.textContent?.trim();
          return (text === "פרסם" || text === "Post" || text === "שתף" || text === "Share")
            && !el.hasAttribute("disabled");
        });

      if (!submitBtn) { resolve({ success: false, error: "לא נמצא כפתור פרסם" }); return; }
      submitBtn.click();
      await sleep(3000);
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
