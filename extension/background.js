const API_BASE = "https://matara-publisher.vercel.app";
const POLL_INTERVAL_MINUTES = 0.5;

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("poll", { periodInMinutes: POLL_INTERVAL_MINUTES });
  autoLogin();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "poll") tick();
});

// כשהמשתמש פותח טאב של האתר - ננסה להתחבר אוטומטית
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url?.includes("matara-publisher.vercel.app")) {
    autoLogin();
  }
});

async function autoLogin() {
  try {
    // שלח בקשה לאתר עם cookies של הדפדפן (המשתמש כבר מחובר)
    const res = await fetch(`${API_BASE}/api/extension/token`, {
      credentials: "include",
    });
    if (!res.ok) {
      await chrome.storage.local.remove(["apiToken", "userName", "userEmail"]);
      return;
    }
    const { token } = await res.json();
    if (!token) return;

    // שמור טוקן בשקט
    const { apiToken } = await chrome.storage.local.get("apiToken");
    if (apiToken !== token) {
      await chrome.storage.local.set({ apiToken: token });
      // קבל פרטי משתמש
      const jobsRes = await fetch(`${API_BASE}/api/extension/jobs?token=${token}`);
      if (jobsRes.ok) {
        const { user } = await jobsRes.json();
        if (user) await chrome.storage.local.set({ userName: user.name, userEmail: user.email });
      }
    }
  } catch {}
}

async function tick() {
  // נסה התחברות אוטומטית תחילה
  await autoLogin();

  const { apiToken } = await chrome.storage.local.get("apiToken");
  if (!apiToken) return;

  try {
    const res = await fetch(`${API_BASE}/api/extension/jobs?token=${apiToken}`);
    if (!res.ok) return;
    const { posts } = await res.json();
    if (!posts || posts.length === 0) return;

    for (const post of posts) {
      await publishPost(post, apiToken);
      await sleep(5000);
    }
  } catch (err) {
    console.error("שגיאה:", err);
  }
}

async function publishPost(post, token) {
  await updateStatus(post.id, "running", null, token);

  const url = `https://www.facebook.com/groups/${post.fbGroupId}`;

  return new Promise((resolve) => {
    chrome.tabs.create({ url, active: false }, async (tab) => {
      await sleep(6000);
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: injectPost,
          args: [post.campaign.content, post.campaign.imageUrls || []],
        });
        const result = results?.[0]?.result;
        if (result?.success) {
          await updateStatus(post.id, "published", null, token);
        } else {
          await updateStatus(post.id, "failed", result?.error || "שגיאה", token);
        }
      } catch (err) {
        await updateStatus(post.id, "failed", err.message, token);
      } finally {
        await sleep(2000);
        chrome.tabs.remove(tab.id);
        resolve();
      }
    });
  });
}

function injectPost(content, imageUrls) {
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

async function updateStatus(postId, status, error, token) {
  try {
    await fetch(`${API_BASE}/api/extension/jobs/${postId}?token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, error }),
    });
  } catch {}
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
