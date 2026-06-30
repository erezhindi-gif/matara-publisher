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

// סנכרון קבוצות ברמת רשת - לא תלוי במבנה ה-DOM של פייסבוק, עובד זהה על כל פרופיל
async function syncGroups(job, token) {
  let tabId = null;
  try {
    const tab = await new Promise((resolve) =>
      chrome.tabs.create({ url: "https://www.facebook.com/groups/joins/", active: false }, resolve)
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
          extractGroupsFromGraphQL(result.body, found);
        });
      }
    };
    chrome.debugger.onEvent.addListener(onEvent);

    // המתן לטעינה הראשונית
    await sleep(8000);

    // גלול את הדף כדי לטעון עוד תוצאות (infinite scroll)
    let noNewCount = 0;
    for (let i = 0; i < 200; i++) {
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

// סורק תשובת GraphQL גולמית (JSON) ומחפש אובייקטי קבוצה - לא תלוי במבנה DOM
function extractGroupsFromGraphQL(text, map) {
  for (const line of text.split("\n")) {
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
