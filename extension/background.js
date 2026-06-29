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
  // בממשק עברית הסרגל בצד ימין, באנגלית בצד שמאל
  // מחפשים כל אלמנט גלילה שמכיל קישורי קבוצות
  const allScrollable = Array.from(document.querySelectorAll("*")).filter((el) => {
    if (el.scrollHeight <= el.clientHeight + 50) return false;
    const style = window.getComputedStyle(el);
    const overflow = style.overflow + style.overflowY;
    return overflow.includes("auto") || overflow.includes("scroll");
  });

  // מחפש את הסרגל שמכיל קישורי קבוצות
  for (const el of allScrollable) {
    if (el.querySelector('a[href*="/groups/"]')) {
      el.scrollTop += 600;
      return true;
    }
  }

  // גיבוי - גלול לקישור האחרון של קבוצה
  const links = document.querySelectorAll('a[href*="/groups/"]');
  if (links.length > 0) {
    links[links.length - 1].scrollIntoView({ behavior: "smooth", block: "end" });
  }
  window.scrollBy(0, 600);
  return true;
}

function scrapeGroups() {
  const results = [];
  const seen = new Set();
  const badWords = ["לפני", "פעילות", "ago", "לא נקרא", "חברים חדשים", "פוסט", "תמונה", "עדכון", "הצטרף", "הצטרפ", "מנהל", "אישר", "notifications", "notification"];

  document.querySelectorAll('a[href*="/groups/"]').forEach((link) => {
    const href = link.href || "";
    const match = href.match(/facebook\.com\/groups\/([^/?#\s]+)/);
    if (!match) return;
    const groupId = match[1];
    if (seen.has(groupId)) return;
    const isNumeric = /^\d+$/.test(groupId);
    const isSlug = /^[a-zA-Z0-9._-]{3,}$/.test(groupId);
    if (!isNumeric && !isSlug) return;
    if (["feed", "discover", "create", "joins", "joined", "category"].includes(groupId)) return;
    seen.add(groupId);

    // חפש שם - קח את הטקסט הקצר ביותר בלי מילים רעות
    const lines = (link.innerText || "").split("\n").map(l => l.trim()).filter(l => l.length > 1 && l.length < 100);
    let name = "";
    for (const line of lines) {
      const hasBadWord = badWords.some(w => line.includes(w));
      if (!hasBadWord) { name = line; break; }
    }
    // אם לא מצאנו שם טוב - קח את השורה הקצרה ביותר
    if (!name && lines.length > 0) {
      name = lines.sort((a, b) => a.length - b.length)[0];
    }
    if (name && name.length > 1) results.push({ fbGroupId: groupId, name });
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
