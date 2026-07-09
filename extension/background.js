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

// מוריד תמונה מ-URL לקובץ זמני בדיסק - נדרש כי DOM.setFileInputFiles (CDP)
// מקבל רק path מקומי, לא Blob/URL. הורדה עוקפת גם CORS.
async function downloadToTempFile(url) {
  const downloadId = await new Promise((resolve, reject) => {
    chrome.downloads.download(
      { url, filename: `matara_tmp_${Date.now()}.jpg`, conflictAction: "uniquify", saveAs: false },
      (id) => (chrome.runtime.lastError || !id) ? reject(new Error(chrome.runtime.lastError?.message || "download failed")) : resolve(id)
    );
  });
  const filename = await new Promise((resolve, reject) => {
    const listener = (delta) => {
      if (delta.id !== downloadId) return;
      if (delta.state?.current === "complete") {
        chrome.downloads.onChanged.removeListener(listener);
        chrome.downloads.search({ id: downloadId }, (results) => resolve(results[0]?.filename));
      } else if (delta.state?.current === "interrupted") {
        chrome.downloads.onChanged.removeListener(listener);
        reject(new Error("download interrupted"));
      }
    };
    chrome.downloads.onChanged.addListener(listener);
    // ייתכן שההורדה כבר הושלמה לפני שהתחברנו למאזין
    chrome.downloads.search({ id: downloadId }, (results) => {
      if (results[0]?.state === "complete") {
        chrome.downloads.onChanged.removeListener(listener);
        resolve(results[0].filename);
      }
    });
  });
  return { downloadId, filename };
}

// עוטף chrome.debugger.sendCommand - קורא chrome.runtime.lastError בתוך ה-callback
// (חובה! אחרי await הערך כבר מתאפס ותמיד יראה "תקין" גם כשיש שגיאה)
function sendDebuggerCommand(tabId, method, params = {}) {
  return new Promise((resolve) => {
    chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
      const err = chrome.runtime.lastError?.message || null;
      resolve({ result, err });
    });
  });
}

// נעילה נגד הרצות tick() חופפות. ה-alarm יורה כל 30 שניות, אבל publishPost()
// בודד לוקח בקלות 20-40+ שניות (המתנות מובנות) - בלי הנעילה הזו, tick() הבא
// יכול להתחיל בזמן שהקודם עדיין באמצע, ולפתוח כמה טאבים שמפרסמים במקביל
// מאותו חשבון פייסבוק - בדיוק הדפוס שגורם ל-FB לחסום/לחשוד בספאם.
let isTicking = false;

async function tick() {
  if (isTicking) return;
  isTicking = true;
  try {
    await autoLogin();
    const { apiToken, deviceId } = await chrome.storage.local.get(["apiToken", "deviceId"]);
    if (!apiToken) return;

    try {
      // בדוק פוסטים
      const jobsRes = await fetch(`${API_BASE}/api/extension/jobs?token=${apiToken}&deviceId=${deviceId || ""}`);
      if (jobsRes.ok) {
        const { posts, user, profile } = await jobsRes.json();
        if (profile && profile.remaining <= 0) {
          console.log(`[רמזור] מכסה יומית מוצתה (${profile.postsToday}/${profile.dailyLimit}) - לא מקבלים עבודות חדשות`);
        }
        if (posts && posts.length > 0) {
          for (const post of posts) {
            await publishPost(post, apiToken, user);
            // עיכוב אקראי 20-60 שניות בין פרסומים לאותו פרופיל - לא מרווח קבוע.
            // (היה 2-5 דקות - קוצר כי תבנית של 60 קבוצות הייתה לוקחת 3-4 שעות)
            const delayMs = (20 + Math.random() * 40) * 1000;
            await sleep(delayMs);
          }
        }
      }

      // בדוק סנכרון
      const syncRes = await fetch(`${API_BASE}/api/extension/sync?token=${apiToken}&deviceId=${deviceId || ""}`);
      if (syncRes.ok) {
        const { job, user: syncUser } = await syncRes.json();
        if (job && job.type === "dedup") await mergeDuplicateGroups(job, apiToken, deviceId, syncUser);
        else if (job) await syncGroups(job, apiToken, deviceId, syncUser);
      }
    } catch (err) {
      console.error("שגיאה:", err);
    }
  } finally {
    isTicking = false;
  }
}

async function publishPost(post, token, expectedUser) {
  const url = `https://www.facebook.com/groups/${post.fbGroupId}`;
  let tabId = null;
  let success = false;
  let publishError = null;
  let dialogListener = null; // מוצהר כאן (לא בתוך try) כדי שה-finally יוכל להסיר אותו

  // Keepalive ל-service worker: ריצת פרסום בודדת לוקחת 30-60+ שניות עם הרבה
  // sleep() (setTimeout רגיל) - Chrome MV3 הורג service workers שלא "פעילים"
  // כ-30 שניות, גם באמצע Promise שעדיין ממתין. setTimeout לא נחשב פעילות.
  // קריאת API טריוויאלית (chrome.storage) כל 20 שניות מאפסת את טיימר ה-idle
  // ומונעת את זה. בלי זה - הרצה נהרגת בשקט: אין שגיאה, אין טאב, "לא קורה כלום".
  const keepAlive = setInterval(() => { chrome.storage.local.get("deviceId", () => {}); }, 20000);
  try {
    const tab = await new Promise((resolve) => chrome.tabs.create({ url, active: true }, resolve));
    tabId = tab.id;
    await sleep(7000);

    await new Promise((resolve) => chrome.debugger.attach({ tabId }, "1.3", resolve));
    await updatePostNote(post.id, "v2.56.0 - debugger attached", token);

    // דוחה אוטומטית כל דיאלוג "האם לעזוב את האתר?" (beforeunload) לפני שהוא נתקע.
    // חייבים להאזין ל-Page.javascriptDialogOpening ולהגיב לפני שמנווטים/סוגרים,
    // לא אחרי - אחרת הדיאלוג כבר תפוס ומחכה לקלט אנושי.
    dialogListener = (source, method) => {
      if (source.tabId !== tabId) return;
      if (method === "Page.javascriptDialogOpening") {
        chrome.debugger.sendCommand({ tabId }, "Page.handleJavaScriptDialog", { accept: true });
      }
    };
    chrome.debugger.onEvent.addListener(dialogListener);
    await new Promise((resolve) => chrome.debugger.sendCommand({ tabId }, "Page.enable", {}, resolve));

    // בדיקה מוקדמת: קבוצה מושהית ע"י מנהל (לא באג - החלטה של מנהלי הקבוצה,
    // כמו שאלון חברות). מוצג כבאנר בראש דף הקבוצה, עוד לפני פתיחת תיבת
    // הכתיבה - עוצרים כאן כדי לא לבזבז זמן על תמונה/טקסט לקבוצה שחסומה ממילא.
    const suspendedCheck = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.body?.innerText?.includes("הקבוצה מושהית") || document.body?.innerText?.includes("Group paused"),
    });
    if (suspendedCheck?.[0]?.result) {
      await updatePostStatus(post.id, "group_suspended", "🛑 הקבוצה מושהית ע\"י מנהל - לא ניתן לפרסם", token);
      return;
    }

    // 1. פתח תיבת כתיבה
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const PLACEHOLDERS = ["כאן כותבים", "כתוב משהו", "Write something", "What's on your mind", "מה תרצה לשתף"];
        let target = Array.from(document.querySelectorAll('[contenteditable]')).find(el => {
          const ph = el.getAttribute('aria-placeholder') || el.getAttribute('placeholder') || el.textContent || '';
          return PLACEHOLDERS.some(p => ph.includes(p));
        });
        if (!target) {
          target = Array.from(document.querySelectorAll('[role="button"]')).find(el =>
            PLACEHOLDERS.some(p => (el.textContent?.trim() || '').includes(p))
          );
        }
        if (target) target.click();
      },
    });
    await sleep(3000);

    // בדיקת בטיחות: מי מחובר לפייסבוק בפועל, לעומת מי אמור להיות מחובר.
    // הוחזר להתרעה בלבד ב-2026-07-05 (בפעם השנייה) - הניסיון "גרסה 2" (חיפוש
    // img[alt] בתוך הדיאלוג) תפס בטעות אלמנט img עם alt="קבוצה ציבורית" (תג
    // הפרטיות של הקבוצה, לא תמונת הפרופיל) וחסם 0/3 פרסומים תקינים. זו הפעם
    // השנייה שניסיון "לתקן את הסלקטור" בלי ראייה חיה על ה-DOM האמיתי נכשל
    // באופן שונה. לא לנסות שוב לחסימה קשיחה בלי לבדוק בפועל מול Facebook
    // (למשל דרך browser tooling חי) אילו img/alt קיימים בדיאלוג בפועל.
    if (expectedUser?.name) {
      const identityCheck = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const dialog = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"]')).find(d => d.querySelector('[role="textbox"]'));
          if (!dialog) return null;
          const GENERIC_ALTS = ["תמונת פרופיל", "profile picture", "profile photo", "avatar", "קבוצה ציבורית", "קבוצה פרטית", "public group", "private group"];
          const avatarImgs = Array.from(dialog.querySelectorAll('img[alt]'));
          const candidate = avatarImgs.map(img => img.getAttribute('alt')?.trim()).find(alt => {
            if (!alt) return false;
            if (GENERIC_ALTS.some(g => alt.toLowerCase().includes(g.toLowerCase()))) return false;
            const words = alt.split(/\s+/);
            return words.length >= 2 && words.length <= 4 && /^[֐-׿a-zA-Z\s'’-]+$/.test(alt);
          });
          return candidate || null;
        },
      });
      const detectedIdentity = identityCheck?.[0]?.result;
      const nameMatches = detectedIdentity && detectedIdentity.includes(expectedUser.name.split(' ')[0]);
      if (detectedIdentity && !nameMatches) {
        await updatePostNote(post.id, `אזהרת זהות (לא חוסם): צפוי "${expectedUser.name}" אך זוהה "${detectedIdentity}"`, token);
      }
    }

    // 2. תמונה - הורדה לדיסק זמנית + הזרקה דרך CDP DOM.setFileInputFiles
    // חשוב: לא לוחצים על כפתור "העלאה ממחשב" - זה פותח בורר קבצים של מערכת ההפעלה
    // וחוסם את כל התהליך. setFileInputFiles מזריק ישירות ל-input בלי לפתוח כלום.
    let imageDiagnostics = ""; // נשמר גם אם הפרסום מצליח - סטטוס "published" מוחק את שדה error
    if (post.campaign.imageUrls?.length > 0) {
      let tempDownloadId = null;
      try {
        const imageUrl = post.campaign.imageUrls[0];
        const { downloadId, filename } = await downloadToTempFile(imageUrl);
        tempDownloadId = downloadId;
        if (!filename) throw new Error("הורדה נכשלה - אין filename");
        imageDiagnostics += `הורדה: OK (${filename.split(/[\\/]/).pop()}) | `;

        const domEnable = await sendDebuggerCommand(tabId, "DOM.enable");
        if (domEnable.err) imageDiagnostics += `DOM.enable שגיאה: ${domEnable.err} | `;
        await sendDebuggerCommand(tabId, "Runtime.enable");
        await sendDebuggerCommand(tabId, "DOM.getDocument", { depth: -1, pierce: true }); // מפעיל מעקב DOM, נדרש לפני requestNode

        // מוצאים את ה-nodeId של הדיאלוג הפתוח (תיבת הכתיבה) דרך Runtime.evaluate
        // (מחזיר objectId) ואז DOM.requestNode - כדי לחפש file input *בתוכו בלבד*.
        // בדף פייסבוק יש כמה input[type=file] נסתרים (תמונת פרופיל, תמונת קבוצה
        // וכו') - querySelector גלובלי על כל המסמך עלול לתפוס את הלא-נכון.
        const evalDialog = await sendDebuggerCommand(tabId, "Runtime.evaluate", {
          expression: `(function(){
            const d = Array.from(document.querySelectorAll('[role="dialog"],[aria-modal="true"]'))
              .find(x => x.querySelector('[role="textbox"]'));
            return d || document.body;
          })()`,
          returnByValue: false,
        });
        const dialogObjectId = evalDialog.result?.result?.objectId;
        if (evalDialog.err) imageDiagnostics += `Runtime.evaluate שגיאה: ${evalDialog.err} | `;

        let dialogNodeId = null;
        if (dialogObjectId) {
          const reqNode = await sendDebuggerCommand(tabId, "DOM.requestNode", { objectId: dialogObjectId });
          dialogNodeId = reqNode.result?.nodeId || null;
          if (!dialogNodeId && reqNode.err) imageDiagnostics += `requestNode שגיאה: ${reqNode.err} | `;
        }

        let nodeId = null;
        if (dialogNodeId) {
          const q = await sendDebuggerCommand(tabId, "DOM.querySelector", { nodeId: dialogNodeId, selector: 'input[type="file"]' });
          nodeId = q.result?.nodeId || null;
          if (!nodeId && q.err) imageDiagnostics += `querySelector שגיאה: ${q.err} | `;
        }

        if (!nodeId) {
          imageDiagnostics += "לא נמצא file input בתוך הדיאלוג";
        } else {
          const setFiles = await sendDebuggerCommand(tabId, "DOM.setFileInputFiles", { files: [filename], nodeId });
          imageDiagnostics += setFiles.err ? `setFileInputFiles שגיאה: ${setFiles.err}` : "setFileInputFiles: OK";
          await sleep(5000); // המתן לפייסבוק לעבד את התמונה

          // אימות: img[src^="blob:"] הוא סימן אמין (URL מקומי שנוצר ברגע ההעלאה) -
          // לא scontent (זה יתפוס גם תמונת פרופיל קיימת - false positive)
          const verify = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
              const dialog = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"]')).find(d => d.querySelector('[role="textbox"]'));
              return !!dialog?.querySelector('img[src^="blob:"]');
            },
          });
          imageDiagnostics += ` | blob-preview בדיאלוג: ${verify?.[0]?.result ? "כן" : "לא"}`;
        }
      } catch (e) {
        imageDiagnostics += `חריגה: ${e.message}`;
      } finally {
        if (tempDownloadId != null) {
          try { chrome.downloads.removeFile(tempDownloadId, () => {}); } catch {}
          try { chrome.downloads.erase({ id: tempDownloadId }); } catch {}
        }
      }
      await updatePostNote(post.id, `תמונה: ${imageDiagnostics}`, token);
    }

    // 3. פוקוס על textbox בדיאלוג (אחרי re-render - תיבה חדשה וריקה)
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const dialog = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"]')).find(d => d.querySelector('[role="textbox"]')) || document.querySelector('[role="dialog"]') || document.querySelector('[aria-modal="true"]');
        const box = dialog?.querySelector('[role="textbox"][contenteditable="true"]');
        if (box) { box.click(); box.focus(); }
      },
    });
    await sleep(600);

    // 4. הכנס טקסט מלא - תוכן + WhatsApp + email - אחרי ה-re-render, לתיבה נקייה
    // הקישור מוכנס כטקסט רגיל בתוך התוכן - פייסבוק הופך אותו אוטומטית לקישור
    // כחול לחיץ. לא מנסים ליצור/להסיר כרטיס תצוגה מקדימה - זה גרם לבעיות
    // (קליק על אלמנט לא נכון, טעינה חלקית) בלי תועלת אמיתית.
    let fullText = post.campaign.content;
    if (post.campaign.whatsappLink) fullText += `\n\n📱 ליצירת קשר בוואטסאפ: ${post.campaign.whatsappLink}`;
    if (post.campaign.emailLink)    fullText += `\n✉️ שלח קו"ח: ${post.campaign.emailLink}`;

    // ממצא 2026-07-05: בריצות מרובות ברצף, הטקסט לפעמים לא נכנס בפועל -
    // הדיאלוג נשאר עם ה-placeholder הריק ("יצירת פוסט ציבורי...") במקום
    // התוכן, וכפתור "פרסום" לא עושה כלום כי אין מה לפרסם. במקום לגלות את
    // זה רק בסוף (הדיאלוג "נשאר פתוח"), מאמתים מיד שהטקסט באמת נכנס,
    // ומנסים שוב פעם אחת אם לא - לפני שממשיכים לשלב הכפתור.
    const contentSnippet = post.campaign.content.slice(0, 20);
    let textInserted = false;
    for (let attempt = 0; attempt < 2 && !textInserted; attempt++) {
      await new Promise((resolve) => chrome.debugger.sendCommand({ tabId }, "Input.insertText", { text: fullText }, resolve));
      await sleep(2000);
      const check = await chrome.scripting.executeScript({
        target: { tabId },
        func: (snippet) => {
          const dialog = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"]')).find(d => d.querySelector('[role="textbox"]'));
          const box = dialog?.querySelector('[role="textbox"][contenteditable="true"]');
          return !!box?.textContent?.includes(snippet);
        },
        args: [contentSnippet],
      });
      textInserted = !!check?.[0]?.result;
      if (!textInserted && attempt === 0) {
        // נסיון שני: מיקוד מחדש לפני הכנסה חוזרת (ייתכן שהפוקוס אבד)
        await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            const dialog = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"]')).find(d => d.querySelector('[role="textbox"]'));
            const box = dialog?.querySelector('[role="textbox"][contenteditable="true"]');
            if (box) { box.click(); box.focus(); }
          },
        });
        await sleep(500);
      }
    }
    if (!textInserted) {
      throw new Error("הטקסט לא נכנס לתיבת הכתיבה אחרי 2 נסיונות - עוצרים לפני לחיצת פרסום על תיבה ריקה");
    }

    // 5. מצא ולחץ כפתור פרסום
    // הערה: aria-disabled=true בזמן טעינת תצוגת wa.me - ממתינים עד שמופיע enabled
    let lastButtonDebug = '';
    for (let i = 0; i < 20; i++) {
      const clicked = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          // חיפוש בכל המסמך - לא רק בdialog (הdialog הראשון עלול להיות לוח התראות!)
          const allBtns = Array.from(document.querySelectorAll('[role="button"], button'));
          // סנן כפתורים שיש להם טקסט (לא ריק)
          const namedBtns = allBtns.filter(el => el.textContent?.trim().length > 0);
          const debug = namedBtns.slice(0, 15).map(el => {
            const r = el.getBoundingClientRect();
            return `"${el.textContent?.trim().slice(0,15)}" dis=${el.getAttribute('aria-disabled')} w=${Math.round(r.width)}`;
          }).join(' | ');

          // ניסיון ראשון: כפתור enabled
          let btn = allBtns.find(el => {
            const t = el.textContent?.trim() || '';
            if (!["פרסם","פרסום","Post","שתף","Share"].some(w => t === w || t.startsWith(w))) return false;
            if (el.getAttribute("aria-disabled") === "true") return false;
            if (el.closest('[aria-hidden="true"]')) return false;
            return true;
          });
          // ניסיון שני: גם אם disabled
          if (!btn) btn = allBtns.find(el => {
            const t = el.textContent?.trim() || '';
            return ["פרסם","פרסום","Post","שתף","Share"].some(w => t === w || t.startsWith(w)) && !el.closest('[aria-hidden="true"]');
          });

          if (!btn) return { found: false, debug };
          btn.scrollIntoView({ block: 'center', behavior: 'instant' });
          const r = btn.getBoundingClientRect();
          const disabled = btn.getAttribute('aria-disabled');
          return { found: true, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height), disabled, debug };
        },
      });
      const res = clicked?.[0]?.result;
      if (res?.debug) lastButtonDebug = res.debug.slice(0, 400);
      if (res?.found) {
        await updatePostNote(post.id, `כפתור נמצא: x=${res.x} y=${res.y} w=${res.w} disabled=${res.disabled}`, token);
        await sleep(300);
        if (res.x > 0 && res.y > 0) {
          await new Promise((resolve) => chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", { type: "mousePressed", x: res.x, y: res.y, button: "left", clickCount: 1, buttons: 1 }, resolve));
          await sleep(50);
          await new Promise((resolve) => chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", { type: "mouseReleased", x: res.x, y: res.y, button: "left", clickCount: 1, buttons: 0 }, resolve));
        } else {
          await new Promise((resolve) => chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 }, resolve));
          await sleep(50);
          await new Promise((resolve) => chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 }, resolve));
        }
        // הקליק נשלח - זה עדיין לא הוכחה שהפרסום הצליח. מאמתים בפועל שהדיאלוג
        // נסגר (אם הפרסום נכשל - הדיאלוג בד"כ נשאר פתוח). בדיקה יחידה אחרי
        // 4 שניות הייתה לפעמים מוקדמת מדי (קבוצה גדולה/רשת איטית) - עכשיו
        // בודקים כמה פעמים על פני עד 10 שניות לפני שמסמנים כישלון.
        let dialogClosed = false;
        let dr = null;
        for (let closeCheck = 0; closeCheck < 5; closeCheck++) {
          await sleep(2000);
          const dialogStillOpen = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
              const dialog = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"]')).find(d => d.querySelector('[role="textbox"]'));
              if (!dialog) return { open: false };
              // דיאגנוסטיקה: קרא את כל הטקסט בדיאלוג + חפש הודעות שגיאה/הגבלה
              // נפוצות של פייסבוק (rate limit / spam block / זמני)
              const fullText = dialog.textContent?.slice(0, 800) || "";
              const RATE_LIMIT_HINTS = [
                "זמנית", "חסום", "חסומה", "הגבל", "later", "temporarily", "blocked",
                "try again", "נסה שוב", "מוגבל", "too many", "unusual activity",
                "פעילות חריגה", "spam", "ספאם",
              ];
              const matchedHints = RATE_LIMIT_HINTS.filter(h => fullText.includes(h));
              // זיהוי שאלון חברות של הקבוצה (לא באג - דורש מענה אנושי חד-פעמי)
              const MEMBERSHIP_HINTS = ["בדיקת השתתפות", "שאלות אלה יעזרו למנהלים", "מקבל את כללי הקבוצה"];
              const isMembershipGate = MEMBERSHIP_HINTS.some(h => fullText.includes(h));
              // חפש גם באנר/toast מיוחד שפייסבוק מציגה מחוץ לדיאלוג (למשל חסימה זמנית)
              const toastEl = document.querySelector('[role="alert"], [data-testid*="toast"], [data-testid*="error"]');
              const toastText = toastEl?.textContent?.slice(0, 300) || null;
              return { open: true, fullText, matchedHints, isMembershipGate, toastText };
            },
          });
          dr = dialogStillOpen?.[0]?.result;
          if (!dr?.open) { dialogClosed = true; break; }
          if (dr.isMembershipGate) break; // אין טעם להמשיך לבדוק - זה לא ישתנה
        }
        if (!dialogClosed) {
          if (dr?.isMembershipGate) {
            // לא כישלון טכני - הקבוצה דורשת מענה אנושי על שאלות הצטרפות/פרסום
            publishError = "🔒 קבוצה דורשת מענה על שאלות הצטרפות - יש לענות ידנית בפייסבוק ואז לנסות שוב";
            await updatePostStatus(post.id, "needs_membership_answer", publishError, token);
            return; // יוצאים לגמרי מ-publishPost - לא ממשיכים לupdatePostStatus הרגיל בסוף
          }
          const hintsStr = dr?.matchedHints?.length ? `רמזי הגבלה: ${dr.matchedHints.join(",")} | ` : "אין רמזי הגבלה בטקסט | ";
          publishError = `הדיאלוג נשאר פתוח אחרי 10 שניות מהקליק | ${hintsStr}toast: ${dr?.toastText || "אין"} | טקסט דיאלוג: ${dr?.fullText?.slice(0, 400)}`;
          await updatePostNote(post.id, publishError, token);
          break; // לא מסמנים success
        }
        success = true;
        break;
      }
      await sleep(500);
    }
    if (!success && !publishError) publishError = `לא נמצא כפתור פרסום | כפתורים: ${lastButtonDebug}`;
    if (success) await sleep(3000); // הדיאלוג כבר נסגר בפועל - שיירי המתנה קצרה בלבד
    // גם בהצלחה שומרים את דיאגנוסטיקת התמונה בשדה error - אחרת updatePostStatus מוחק אותה
    const finalNote = success
      ? (imageDiagnostics ? `הצליח | תמונה: ${imageDiagnostics}` : null)
      : `${publishError} | תמונה: ${imageDiagnostics}`;
    await updatePostStatus(post.id, success ? "published" : "failed", finalNote, token);
  } catch (err) {
    await updatePostStatus(post.id, "failed", err.message, token);
  } finally {
    clearInterval(keepAlive);
    if (tabId) {
      // נווט ל-about:blank - dialogListener עדיין פעיל בשלב הזה, אז כל
      // beforeunload שנפתח כתוצאה מהניווט נדחה אוטומטית מיד, לא אחרי שהוא כבר תקוע
      try { await new Promise((resolve) => chrome.debugger.sendCommand({ tabId }, "Page.navigate", { url: "about:blank" }, resolve)); } catch {}
      await sleep(2000);
    }
    // מסירים את המאזין רק אחרי הניווט - זה השלב היחיד שעלול להפעיל beforeunload
    if (dialogListener) { try { chrome.debugger.onEvent.removeListener(dialogListener); } catch {} }
    try { await new Promise((resolve) => chrome.debugger.detach({ tabId }, resolve)); } catch {}
    if (tabId) chrome.tabs.remove(tabId);
  }
}

// סנכרון קבוצות ברמת רשת - לא תלוי במבנה ה-DOM של פייסבוק, עובד זהה על כל פרופיל
async function syncGroups(job, token, deviceId, expectedUser) {
  let tabId = null;
  // Keepalive - ראה הסבר מפורט ב-publishPost(). סנכרון על חשבון גדול
  // (2026-07-10: הועלה ל-500 גלילות) יכול לקחת עד ~20 דקות - בלי keepalive
  // ה-service worker עלול להיהרג באמצע בלי אף שגיאה, בדיוק כמו שקרה ל-publishPost.
  const keepAlive = setInterval(() => { chrome.storage.local.get("deviceId", () => {}); }, 20000);
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

    // בדיקת זהות - חסימה קשיחה (לא warning) לפי החלטה מפורשת ב-2026-07-09:
    // בשונה מ-publishPost, כישלון-שקט כאן לא רק מפרסם פוסט למקום הלא נכון -
    // הוא כותב בפועל את הקבוצות של פרופיל א' לתוך GroupTemplate של פרופיל ב'
    // (זיהום נתונים קשה לביטול). המשתמש תפס את זה ידנית פעמיים ברצף -
    // warning-only לא מספיק אם הוא לא רואה את המסך באותו רגע.
    // אותה שיטת זיהוי (img[alt] + GENERIC_ALTS) כמו publishPost, אך על עמוד
    // facebook.com הראשי (אין דיאלוג כתיבה כאן) - סורקים את סרגל הניווט
    // העליון בלבד (לא כל הדף) כדי לצמצם false positives.
    if (expectedUser?.name) {
      const identityCheck = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const nav = document.querySelector('[role="banner"]') || document.querySelector('nav') || document;
          const GENERIC_ALTS = ["תמונת פרופיל", "profile picture", "profile photo", "avatar", "קבוצה ציבורית", "קבוצה פרטית", "public group", "private group", "facebook"];
          const imgs = Array.from(nav.querySelectorAll('img[alt]'));
          const candidate = imgs.map(img => img.getAttribute('alt')?.trim()).find(alt => {
            if (!alt) return false;
            if (GENERIC_ALTS.some(g => alt.toLowerCase().includes(g.toLowerCase()))) return false;
            const words = alt.split(/\s+/);
            return words.length >= 2 && words.length <= 4 && /^[֐-׿a-zA-Z\s'’-]+$/.test(alt);
          });
          return candidate || null;
        },
      });
      const detectedIdentity = identityCheck?.[0]?.result;
      const nameMatches = detectedIdentity && detectedIdentity.includes(expectedUser.name.split(' ')[0]);
      if (detectedIdentity && !nameMatches) {
        throw new Error(`חסימת זהות בסנכרון: צפוי "${expectedUser.name}" אך זוהה "${detectedIdentity}" - הסנכרון נעצר לפני שנכתב שום נתון`);
      }
    }

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
    // ממצא 2026-07-10: על רשימות ענקיות (~2500 קבוצות) 200 גלילות / 6 גלילות
    // "בלי חדש" (15 שניות) עצרו מוקדם מדי - הועלו ל-500/15 (37.5 שניות
    // סבלנות) כדי לתת לרשימה הוירטואלית של פייסבוק זמן לטעון על חשבונות גדולים.
    let noNewCount = 0;
    for (let i = 0; i < 500; i++) {
      // סרוק כרטיסים גלויים לפני הגלילה הבאה
      const domResult = await chrome.scripting.executeScript({
        target: { tabId },
        func: scrapeJoinedGroupCards,
      });
      for (const g of (domResult?.[0]?.result || [])) {
        found.set(g.fbGroupId, g);
      }

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
        await fetch(`${API_BASE}/api/extension/sync/${job.id}?token=${token}&deviceId=${deviceId || ""}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "running", groupsFound: found.size }),
        });
      } else {
        noNewCount++;
        if (noNewCount >= 15) break;
      }
    }

    chrome.debugger.onEvent.removeListener(onEvent);
    await new Promise((resolve) => chrome.debugger.detach({ tabId }, resolve));

    // דה-דופ לפי שם הוסר לגמרי ב-2026-07-10 (לא רק צומצם) - הכלל "בדיוק 2
    // רשומות, אחת מספרית אחת slug" נבדק מול נתונים אמיתיים ומחק בטעות ~88
    // קבוצות אמיתיות אצל ארז (701 בפועל אחרי מחיקה, מול 789 אמיתי - יותר
    // מדי נמחק, לא פחות מדי). אין כרגע דרך אמינה להבחין "אותה קבוצה, href
    // שונה" מ"שתי קבוצות אמיתיות עם שם דומה/גנרי" רק לפי (שם + פורמט ID).
    // עדיף לספור כפילות מדי (בעיה קוסמטית) מאשר למחוק קבוצות אמיתיות (בעיה
    // הרבה יותר גרועה וקשה לזיהוי). ראה project-map.md לניתוח מלא.

    const groups = Array.from(found.values());
    await fetch(`${API_BASE}/api/extension/sync/${job.id}?token=${token}&deviceId=${deviceId || ""}`, {
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
    await fetch(`${API_BASE}/api/extension/sync/${job.id}?token=${token}&deviceId=${deviceId || ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "failed", error: err.message }),
    });
  } finally {
    clearInterval(keepAlive);
    try { await new Promise((resolve) => chrome.debugger.detach({ tabId }, resolve)); } catch {}
    if (tabId) chrome.tabs.remove(tabId);
  }
}

// חילוץ מספר חברים מעמוד קבוצה בודד (לא מרשימת "הקבוצות שלי") - אימות שנייה
// למיזוג כפילויות. תואם "‏55.3K‏‏ חברים בקבוצה" ו-"41.5K members" כאחד.
function extractMemberCountText() {
  const text = document.body.innerText || "";
  const m = text.match(/([\d.,]+\s*[KMkm]?)\s*(?:חברים בקבוצה|members)/);
  return m ? m[1].replace(/\s/g, "") : null;
}

// מיזוג כפילויות חד-פעמי (backfill) - מוחק כפילות רק אחרי אימות חי בדפדפן
// (לא ניחוש לפי שם, בדיוק כמו הלקח מ-2026-07-10 project-map.md): לכל זוג
// חשוד פותחים את שני עמודי הקבוצה בפועל ומשווים מספר חברים. תואם בדיוק ->
// מיזוג אוטומטי לגרסה המספרית (יציבה יותר מ-slug). לא תואם/לא נטען -> משאירים
// את שתי הרשומות כמו שהן (ברירת מחדל בטוחה, לא מנחשים).
async function mergeDuplicateGroups(job, token, deviceId, expectedUser) {
  let tabId = null;
  const keepAlive = setInterval(() => { chrome.storage.local.get("deviceId", () => {}); }, 20000);
  try {
    const res = await fetch(`${API_BASE}/api/extension/groups/dedup-suspects?token=${token}&deviceId=${deviceId || ""}&businessId=${job.businessId}`);
    if (!res.ok) throw new Error("שגיאה בטעינת רשימת הכפילויות החשודות");
    const { suspects } = await res.json();

    const tab = await new Promise((resolve) => chrome.tabs.create({ url: "https://www.facebook.com/", active: false }, resolve));
    tabId = tab.id;
    await sleep(3000);

    if (expectedUser?.name) {
      const identityCheck = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const nav = document.querySelector('[role="banner"]') || document.querySelector('nav') || document;
          const GENERIC_ALTS = ["תמונת פרופיל", "profile picture", "profile photo", "avatar", "קבוצה ציבורית", "קבוצה פרטית", "public group", "private group", "facebook"];
          const imgs = Array.from(nav.querySelectorAll('img[alt]'));
          const candidate = imgs.map(img => img.getAttribute('alt')?.trim()).find(alt => {
            if (!alt) return false;
            if (GENERIC_ALTS.some(g => alt.toLowerCase().includes(g.toLowerCase()))) return false;
            const words = alt.split(/\s+/);
            return words.length >= 2 && words.length <= 4 && /^[֐-׿a-zA-Z\s'’-]+$/.test(alt);
          });
          return candidate || null;
        },
      });
      const detectedIdentity = identityCheck?.[0]?.result;
      const nameMatches = detectedIdentity && detectedIdentity.includes(expectedUser.name.split(' ')[0]);
      if (detectedIdentity && !nameMatches) {
        throw new Error(`חסימת זהות בניקוי כפילויות: צפוי "${expectedUser.name}" אך זוהה "${detectedIdentity}" - הפעולה נעצרה`);
      }
    }

    let mergedCount = 0, skippedCount = 0, processed = 0;
    for (const s of suspects) {
      await chrome.scripting.executeScript({ target: { tabId }, func: (id) => { location.href = `https://www.facebook.com/groups/${id}`; }, args: [s.numericFbGroupId] });
      await sleep(4000 + Math.random() * 1500);
      const rA = await chrome.scripting.executeScript({ target: { tabId }, func: extractMemberCountText });
      const countA = rA?.[0]?.result;

      await chrome.scripting.executeScript({ target: { tabId }, func: (id) => { location.href = `https://www.facebook.com/groups/${id}`; }, args: [s.slugFbGroupId] });
      await sleep(4000 + Math.random() * 1500);
      const rB = await chrome.scripting.executeScript({ target: { tabId }, func: extractMemberCountText });
      const countB = rB?.[0]?.result;

      const verified = !!countA && !!countB && countA === countB;
      if (verified) mergedCount++; else skippedCount++;

      await fetch(`${API_BASE}/api/extension/groups/dedup-resolve?token=${token}&deviceId=${deviceId || ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: s.templateId, keepFbGroupId: s.numericFbGroupId, removeFbGroupId: s.slugFbGroupId, verified }),
      }).catch(() => {});

      processed++;
      await fetch(`${API_BASE}/api/extension/sync/${job.id}?token=${token}&deviceId=${deviceId || ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "running", groupsFound: processed }),
      }).catch(() => {});

      // עיכוב אקראי 4-7 שניות בין זוגות + פאוזה של דקה כל 50 קבוצות (לא להיראות רובוטי)
      await sleep(4000 + Math.random() * 3000);
      if (processed % 50 === 0) await sleep(60000);
    }

    await fetch(`${API_BASE}/api/extension/sync/${job.id}?token=${token}&deviceId=${deviceId || ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done", groupsFound: processed }),
    });

    chrome.notifications.create({
      type: "basic", iconUrl: "icon48.png",
      title: "ניקוי כפילויות הושלם",
      message: `${mergedCount} כפילויות אומתו ומוזגו, ${skippedCount} לא אומתו (נשארו ללא שינוי)`,
    });
  } catch (err) {
    await fetch(`${API_BASE}/api/extension/sync/${job.id}?token=${token}&deviceId=${deviceId || ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "failed", error: err.message }),
    });
  } finally {
    clearInterval(keepAlive);
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

async function updatePostNote(postId, note, token) {
  const { deviceId } = await chrome.storage.local.get("deviceId");
  await fetch(`${API_BASE}/api/extension/jobs/${postId}?token=${token}&deviceId=${deviceId || ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  }).catch(() => {});
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
