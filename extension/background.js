const API_BASE = "https://matara-publisher.vercel.app";
const POLL_INTERVAL_MINUTES = 0.5; // כל 30 שניות

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("poll", { periodInMinutes: POLL_INTERVAL_MINUTES });
  console.log("Matara Publisher installed");
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "poll") pollForJobs();
});

// גם בהפעלה ראשונה
pollForJobs();

async function pollForJobs() {
  const { apiToken } = await chrome.storage.local.get("apiToken");
  if (!apiToken) return;

  try {
    const res = await fetch(`${API_BASE}/api/extension/jobs?token=${apiToken}`);
    if (!res.ok) return;
    const { posts } = await res.json();
    if (!posts || posts.length === 0) return;

    console.log(`נמצאו ${posts.length} פוסטים לפרסום`);
    for (const post of posts) {
      await publishPost(post, apiToken);
      // המתן בין פוסטים
      await sleep(5000);
    }
  } catch (err) {
    console.error("שגיאה בשאילתת jobs:", err);
  }
}

async function publishPost(post, token) {
  // סמן כ"בביצוע"
  await updateStatus(post.id, "running", null, token);

  const url = `https://www.facebook.com/groups/${post.fbGroupId}`;

  return new Promise((resolve) => {
    chrome.tabs.create({ url, active: false }, async (tab) => {
      // המתן לטעינת הדף
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
          chrome.notifications.create({
            type: "basic",
            iconUrl: "icon48.png",
            title: "פורסם בהצלחה",
            message: `${post.groupName}`,
          });
        } else {
          await updateStatus(post.id, "failed", result?.error || "שגיאה לא ידועה", token);
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

// פונקציה שרצה בתוך דף הפייסבוק
function injectPost(content, imageUrls) {
  return new Promise(async (resolve) => {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    try {
      // מצא את כפתור "כתוב משהו"
      await sleep(3000);

      // חפש תיבת כתיבה
      let writeBox = document.querySelector('[data-testid="status-attachment-mentions-input"]')
        || document.querySelector('[role="textbox"][contenteditable="true"]')
        || document.querySelector('div[contenteditable="true"]');

      if (!writeBox) {
        // נסה ללחוץ על כפתור "כתוב משהו" תחילה
        const writeBtn = Array.from(document.querySelectorAll('[role="button"]'))
          .find(el => el.textContent?.includes("כתוב") || el.textContent?.includes("Write") || el.textContent?.includes("share"));

        if (writeBtn) {
          writeBtn.click();
          await sleep(2000);
          writeBox = document.querySelector('[role="textbox"][contenteditable="true"]')
            || document.querySelector('div[contenteditable="true"]');
        }
      }

      if (!writeBox) {
        resolve({ success: false, error: "לא נמצאה תיבת כתיבה" });
        return;
      }

      // לחץ על תיבת הכתיבה
      writeBox.click();
      await sleep(500);

      // הכנס טקסט
      writeBox.focus();
      document.execCommand("insertText", false, content);
      await sleep(1000);

      // אם אין טקסט - נסה clipboard
      if (!writeBox.textContent?.trim()) {
        const clipData = new DataTransfer();
        clipData.setData("text/plain", content);
        writeBox.dispatchEvent(new ClipboardEvent("paste", { clipboardData: clipData, bubbles: true }));
        await sleep(1000);
      }

      // המתן לכפתור פרסם
      await sleep(1500);

      const submitBtn = Array.from(document.querySelectorAll('[role="button"]'))
        .find(el => {
          const text = el.textContent?.trim();
          return (text === "פרסם" || text === "Post" || text === "שתף" || text === "Share")
            && !el.hasAttribute("disabled");
        });

      if (!submitBtn) {
        resolve({ success: false, error: "לא נמצא כפתור פרסם" });
        return;
      }

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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
