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
  console.log("מתחיל סנכרון...");
  return new Promise((resolve) => {
    chrome.tabs.create({ url: "https://www.facebook.com/groups/?category=joined", active: false }, async (tab) => {
      await sleep(7000);
      try {
        const allGroups = new Map();
        let noNewCount = 0;

        // גלול עד שאין קבוצות חדשות 5 פעמים ברציפות
        for (let i = 0; i < 100; i++) {
          const prevSize = allGroups.size;

          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: scrapeGroups,
          });
          const found = results?.[0]?.result || [];
          for (const g of found) allGroups.set(g.fbGroupId, g);

          // גלול
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: scrollGroupsSidebar,
          });
          await sleep(800);

          // דווח progress
          if (allGroups.size !== prevSize) {
            noNewCount = 0;
            await fetch(`${API_BASE}/api/extension/sync/${job.id}?token=${token}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "running", groupsFound: allGroups.size }),
            });
          } else {
            noNewCount++;
            if (noNewCount >= 5) break; // אין קבוצות חדשות - סיים
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

function scrollGroupsSidebar() {
  // בדף /groups/?category=joined הגלילה היא של הדף הראשי
  window.scrollBy(0, 800);
  // גם גלול לכרטיס האחרון
  const links = Array.from(document.querySelectorAll('a[href*="/groups/"]'));
  if (links.length > 0) {
    links[links.length - 1].scrollIntoView({ block: "end" });
  }
  return true;
}

function scrapeGroups() {
  const results = [];
  const seen = new Set();
  const skipIds = ["feed", "discover", "create", "joins", "joined", "category", "membership", "permalink", "posts"];

  document.querySelectorAll('a[href*="/groups/"]').forEach((link) => {
    const href = link.href || "";
    const match = href.match(/facebook\.com\/groups\/([^/?#\s]+)/);
    if (!match) return;
    const groupId = match[1];
    if (skipIds.includes(groupId)) return;
    if (seen.has(groupId)) return;
    const isValid = /^\d+$/.test(groupId) || /^[a-zA-Z0-9._-]{3,}$/.test(groupId);
    if (!isValid) return;

    let name = "";

    // 1. aria-label של הקישור - הכי נקי
    const ariaLabel = link.getAttribute("aria-label");
    if (ariaLabel && ariaLabel.length > 1 && ariaLabel.length < 100) {
      name = ariaLabel.trim();
    }

    // 2. heading בתוך הקישור
    if (!name) {
      const heading = link.querySelector("h2, h3, h4, [role='heading']");
      if (heading) name = (heading.innerText || "").trim();
    }

    // 3. span ישיר בתוך הקישור - הכי קצר ונקי
    if (!name) {
      const spans = Array.from(link.querySelectorAll("span"))
        .map(s => (s.innerText || "").trim())
        .filter(t => t.length > 1 && t.length < 80 && !/^\d+$/.test(t) && !t.includes("לפני") && !t.includes("ago") && !t.includes("חבר"));
      if (spans.length > 0) name = spans.sort((a, b) => a.length - b.length)[0];
    }

    if (name && name.length > 1) {
      seen.add(groupId);
      results.push({ fbGroupId: groupId, name });
    }
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
