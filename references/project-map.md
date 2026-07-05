# מפת פרויקט - Matara Publisher
נוצר: 2026-07-03 | יש לעדכן בכל שינוי ארכיטקטורי

## 📋 TODO — סבב הבא (2026-07-05, מסודר לפי עדיפות)

1. ~~🔴 דחוף — חור אבטחה נוסף~~ **✅ תוקן ב-2026-07-05** — `app/api/campaigns/[id]/route.ts`
   ראה סעיף "🔒 תוקן" למעלה. **עדיין לא deployed** - צריך git push לשילוב.

2. **סריקה שיטתית של כל app/api/:** הבאג הקודם היה "ברירת מחדל שגויה"
   (`where={}` כשאין session). לעבור על **כל** ה-routes תחת `app/api/` ולוודא
   שאין עוד מקום עם אותה טעות, במקום לגלות כל אחד בנפרד כשמישהו ניזוק ממנו.

3. **apiToken — קשירה למכשיר:** כרגע `crypto.randomBytes(32).toString("hex")`
   בלי תוקף ובלי קשירה ל-device/installation. להוסיף תוקף (expiry) + קשירה
   ל-deviceId (שכבר קיים ב-storage אך לא נאכף), כדי שהעתקת token בין מכונות
   לא תיתן זהות חינם. כבר תועד ב"זהות פרופיל" למעלה כפריט משני.

4. **הפצת עדכוני extension:** לבדוק אפשרות ל-`update_url` עצמאי (חנות פרטית/
   self-hosted update manifest) במקום `edge://extensions` + טעינה ידנית בכל
   מחשב — כדי שתיקון עתידי יגיע אוטומטית לכולם. כבר תועד למעלה כפריט פתוח.

5. **מנגנון רמזור/קצב פרסום (כשיתחיל להיבנות):** הלוגיקה של מכסה יומית/קצב
   פרסום **חייבת לשבת במקום אחד משותף בשרת** (API route), לא משוכפלת בקוד
   התוסף — כדי לא לחזור על אותה בעיית "תיקון שלא מופץ" שכבר נראתה עם
   `local-server.js` מול `extension/background.js`. **לתעד כאן מיד כשמתחילים
   לבנות את זה**, לא בדיעבד.

## מי הם הפרופילים?

שני משתמשים (User records) נפרדים לחלוטין:
- **ארז-נגרות** — User עם apiToken X, businessId X
- **נועה-מטרה** — User עם apiToken Y, businessId Y

Extension אחד = apiToken אחד = משתמש אחד בכל זמן נתון.
כדי לפרסם משני פרופילים, יש להחזיק שתי התקנות extension (שני Chrome profiles).

## ארכיטקטורת DB

```
Business (owner)
  └── Profile[] (פייסבוק accounts)
  └── Campaign[] (userId + businessId)
  └── GroupTemplate[] (userId + businessId)
        └── Group[]

User (apiToken, businessId)
Post (campaignId → campaign.userId)
SyncJob (userId + businessId)
ContactLink (businessId)
```

**בידוד:** כל שאילתה מסוננת לפי `userId` — נתוני User A לעולם לא נגישים ל-User B.

## זרימת פרסום

```
tick() [כל 30 שניות]
  → GET /api/extension/jobs?token=X
    → טרנזקציה: pending → running (atomic claim per deviceId)
    → מחזיר posts עם campaign.content/imageUrls/whatsappLink
  → publishPost(post, token)
    → פותח טאב פייסבוק
    → drag-drop תמונה → re-render → הכנסת טקסט
    → לוחץ פרסום
  → POST /api/extension/jobs/[id]?token=X  { status: "published"|"failed" }
```

## זרימת סנכרון קבוצות

### ✅ ACTIVE — Extension Sync (החדש)
```
app/sync/page.tsx → POST /api/extension/sync  (יוצר SyncJob)
Extension tick() → GET /api/extension/sync?token=X  (מחזיר job)
  → syncGroups() — מנווט בפייסבוק, מגרד קבוצות
  → POST /api/extension/sync/[id] { status, groups }
    → שומר GroupTemplate "קבוצות מסונכרנות" per (userId+businessId)
```

### ⚠️ SUSPECTED DEAD — Local Server Sync (הישן) — עדיין לא טופל
```
sync-groups.js (node script) → local-server.js (proxy)
  → POST /api/sync-groups  (session auth, לא apiToken)
    → שומר GroupTemplate "🔄 מסונכרן מפייסבוק" per (userId+businessId)
```
**קבצים:** `local-server.js` (`syncGroups()`), `sync-groups.js`, `app/api/sync-groups/route.ts`
**סטטוס:** לא נקראים מה-UI הנוכחי (app/sync/page.tsx משתמש בנתיב החדש), אבל
**עדיין קיימים ופעילים בפועל אם מריצים אותם ידנית.** בשונה מ-publisherLoop
(ראה למטה) — זה **לא הוסר**, כי לא התבקש הסרה מפורשת עדיין. שיקול לבירור:
שווה למחוק גם את זה, כי אותה בעיית "שני צינורות מקבילים" חלה עליו באותה מידה.
**סיכון פתוח:** אם עדיין רץ במקביל לextension sync → שני GroupTemplates שונים לאותו user.

### 🗑️ נמחק במפורש ב-2026-07-05 — Publisher Loop (local-server.js)
```
local-server.js: setInterval(publisherLoop, 60*1000)  [שורות 399-400 לשעבר]
  → publisherLoop() → GET /api/campaigns (ללא auth!) → processCampaign()
    → postToFacebookGroup() דרך Puppeteer/Edge - צינור פרסום מלא, נפרד מהתוסף
```
**ממצא קריטי שהוביל להסרה:** local-server.js מותקן כ**שירות Windows קבוע**
(`install-service.js`, node-windows) — רץ ברקע תמידית, גם בלי חלון פתוח,
ומופעל מחדש עם כל אתחול מחשב. `publisherLoop` פעל **כל 60 שניות במקביל לתוסף
הדפדפן**, על אותן טבלאות `Campaign`/`Post`, **בלי claim אטומי בכלל** (רק
`Campaign.status==="approved"`, לא `Post` claim כמו שהתוסף עושה) — סיכון
פרסום כפול ממשי.

**מוחמר ע"י:** `GET /api/campaigns` (ראה למטה) שהחזיר את כל הקמפיינים של כל
היוזרים כש-local-server.js קרא לו בלי session — שילוב של שני הבאגים יחד יצר
תרחיש שבו local-server.js על מחשב של יוזר A יכול היה לפרסם קמפיין של יוזר B.

**מה נעשה:** `postToFacebookGroup`, `processCampaign`, `publisherLoop`,
`downloadImages`, `updateCampaignStatus`, `updatePostStatus` **נמחקו לגמרי**
מ-`local-server.js` (לא רק disabled) + הוסרו קריאות ה-`setTimeout`/`setInterval`.
**חלקי הוואטסאפ ו-`syncGroups()` נשארו פעילים ולא נגעתי בהם** — לא קשורים לבעיה.

**גיבוי לפני מחיקה:** הקובץ המקורי (718 שורות, לפני המחיקה) קיים בשני מקומות:
1. Git history — `git show ab09123:local-server.js` (הקומיט האחרון שהכיל את הגרסה המלאה)
2. עותק מפורש: `references/local-server.js.backup-before-publisherLoop-removal-2026-07-05`

**⚠️ לפני deploy/הפעלה מחדש של השירות — checklist:**
- [ ] לוודא ש-`GET /api/campaigns` **עדיין עובד תקין ליוזר מחובר** (session תקין) —
      נבדק בקוד: `lib/auth.ts` ה-jwt/session callbacks ממלאים `session.user.id`
      ו-`session.user.role` לכל יוזר מחובר, כך שה-`where` זהה למה שהיה קודם
      עבור בקשות עם session תקין. **השתנה רק המקרה של אין session בכלל.**
      בכל זאת — מומלץ קליק-טסט ידני אחרי deploy (להתחבר ולראות שהקמפיינים נטענים).
- [ ] להפעיל מחדש את שירות ה-Windows **בזמן שאין פרסום מתוזמן פעיל** (לא באמצע חלון פרסום)
- [ ] אחרי הפעלה מחדש: לוודא שהוואטסאפ מתחבר כרגיל (`app/profiles/page.tsx` → `localhost:3333/whatsapp-status`)
- [ ] אחרי הפעלה מחדש: לבדוק ב-`matara-logs.txt` שאין יותר שורות `[PUBLISH]` — סימן ש-publisherLoop באמת נעלם

### 🔒 תוקן ב-2026-07-05 — חור אבטחה ב-GET /api/campaigns
`app/api/campaigns/route.ts` — היה:
```ts
const where = (!session || isAdmin) ? {} : { userId };  // אין session ⇒ "{}" ⇒ הכל!
```
**זה לא רק גרם ל-local-server.js לדלוף** — זה היה חור אבטחה עצמאי: **כל בקשה
ללא session** (לא רק מ-local-server.js, מכל מקור) קיבלה את **כל הקמפיינים
של כל המשתמשים**, ללא הגבלה. תוקן לברירת מחדל של דחייה (401):
```ts
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const where = isAdmin ? {} : { userId };
```

### 🔒 תוקן ב-2026-07-05 — auth ב-GET/PATCH/DELETE של /api/campaigns/[id]
`app/api/campaigns/[id]/route.ts` — נוספה `requireOwnedCampaign(id)`: דוחה
(401) כשאין session, ומוודאת (404 - לא 403, כדי לא לחשוף קיום) ש-`campaign.userId`
תואם ל-`session.user.id` (אלא אם admin). מיושמת בכל שלוש הפעולות.
**אומת שלא שובר את זרימת האישור** — קישור המייל (`lib/email.ts:21`) מפנה
ל-`/campaigns/[id]` (עמוד רגיל שדורש login), לא ל-API ישירות בלי session.

## שדות nullable בעייתיים

- `Campaign.userId` — nullable! קמפיינים ישנים ללא userId לא יתפסו על ידי jobs API.
  **תיקון נדרש:** הוסף migration שממלא userId ל-campaigns ישנים.

## קוד מת שזוהה

| קובץ | סיבה | פעולה |
|---|---|---|
| `extension/background.js:injectPost()` | הוסר ב-2.23.0 | ✅ נמחק |
| `extension/background.js:downloadImageToLocal()` | הוסר ב-2.23.0 | ✅ נמחק |
| `app/api/sync-groups/route.ts` | נתיב סנכרון ישן | SUSPECTED DEAD - לא טופל |
| `local-server.js` — publisherLoop/processCampaign/postToFacebookGroup | צינור פרסום מקביל לתוסף, ללא claim אטומי | ✅ נמחק ב-2026-07-05 |
| `local-server.js` — syncGroups() | סנכרון קבוצות ישן | SUSPECTED DEAD - לא טופל |
| `sync-groups.js` | סקריפט סנכרון ישן | SUSPECTED DEAD - לא טופל |

## נקודות concurrency

- Post claim: `updateMany where status="pending"` — atomic, בטוח
- deviceId isolation: כל extension ייחודי, לא יתנגשו
- שני Users על אותה device: בלתי אפשרי (apiToken יחיד ב-storage)

## זהות פרופיל - איך הקוד "יודע" עבור מי הוא פועל (2026-07-05)

**נבדק בפועל בקוד, לא בזיכרון:**

1. **מאיפה נשאבת זהות המשתמש בכל tick()?**
   `chrome.storage.local.get("apiToken")` — token יחיד לכל התקנת extension.
   **אין שום בדיקה קריפטוגרפית שמונעת מאותו apiToken לפעול משתי התקנות שונות.**
   הקוד מניח בעיוורון שהסשן הפעיל בדפדפן תואם לapiToken.

   **v2.36.0**: נוספה בדיקת זהות best-effort (התרעה בלבד, לא חוסמת).

### 🚨 ממצא קריטי (2026-07-05) — "published" לא אומת שהפוסט אכן פורסם
עד v2.40.0 (כולל), `success=true` נקבע **מיד אחרי שליחת הקליק** על כפתור
"פרסום" ([background.js:329 בגרסה הישנה]) — **בלי שום אימות שהפרסום בפועל
הצליח.** אומת בפועל: ריצת קמפיין ל-13 קבוצות (מפרופיל נועה) — **11 מתוך 13
סומנו "published" ב-DB, אבל בבדיקה ידנית של המשתמש באף אחת מה-11 הקבוצות
הפוסט לא הופיע בפועל.** 0/11 הצליחו למרות ✓ בדשבורד.

**v2.41.0 — תוקן:** אחרי הקליק, ממתינים ובודקים בפועל אם הדיאלוג נסגר
(`!!document.querySelector('[role="dialog"]').querySelector('[role="textbox"]')`).
אם הדיאלוג עדיין פתוח → `status="failed"` עם הודעה מפורשת, לא "published".

**אומת בפועל (2026-07-05):** 2 פוסטים שהיו "failed" נוסו מחדש (retry) דרך
v2.41.0, סומנו "published", **והמשתמש אישר ידנית שהם באמת הופיעו בקבוצות.**
זו הוכחה ראשונה שהבדיקה החדשה עובדת נכון במציאות, לא רק בתיאוריה.
**עדיין לא נבדק:** 11 הפוסטים שסומנו "published" תחת v2.40.0 (הקוד הישן, ללא
אימות) **לא רצו מחדש** — retry מאפס רק פוסטים ב-status="failed", לא נוגע
בפוסטים שכבר "published" (גם אם ידוע שזה false positive). כדי לבדוק את כל
13 הקבוצות תחת v2.41.0 צריך "שכפל" קמפיין מלא, לא "נסה שוב".
   **v2.37.0**: הפכה לחסימה קשיחה — `throw Error` עוצר את הפרסום לגמרי אם
   זוהתה אי-התאמה חיובית בין שם היוזר הצפוי לשם שזוהה בעמוד (fail-closed).
   **v2.38.0 — הוחזרה להתרעה בלבד, לאחר false positive מאומת בפרודקשן:**
   הסלקטור `[aria-label*="חשבון"], [aria-label*="Your profile"], [aria-label*="profile"]`
   תפס בפועל את כפתור **"אפשרויות והגדרות של חשבון"** (תפריט כללי של פייסבוק,
   לא שם המשתמש) וחסם פרסום תקין לגמרי אצל ארז (`error: 'חסימת זהות: צפוי
   "ארז הנדי" אך זוהה "אפשרויות והגדרות של חשבון"'`). **לקח:** אל תחזירו את זה
   לחסימה קשיחה עד שנמצא סלקטור שבאמת מזהה שם חשבון מחובר (לא תפריט/כפתור
   כללי) ואומת ידנית מול ה-DOM האמיתי בכמה תרחישים.
   **אם הסלקטור לא מוצא כלום** (למשל: מבנה עמוד שונה, כמה חשבונות מחוברים) —
   **לא חוסמים** (fail-open), כי הסלקטור לא אומת מול כל המצבים האפשריים.

   **⚠️ סטטוס אמיתי: מזוהה, לא סגור.** שתי בעיות מבניות עדיין פתוחות:
   - **הסלקטור עצמו לא אומת ידנית** מול DOM אמיתי של פייסבוק בכל התרחישים
     (כמה חשבונות מחוברים בו-זמנית, אחרי ריענון עמוד, מובייל web וכו').
     כרגע זו רשת ביטחון חלקית, לא הוכחה.
   - **אין קשירה מבנית בין token למכשיר** — `apiToken` הוא
     `crypto.randomBytes(32).toString("hex")` פר-User, בלי תוקף, בלי JWT,
     בלי טבלת Device/Installation בסכימה בכלל (`prisma/schema.prisma`).
     `deviceId` קיים אך משמש רק לתיוג bookkeeping — לא אוכף כלום. שום דבר
     לא מונע היתכנות של אותו apiToken בשתי התקנות Chrome/Edge בו-זמנית.
     **תעדוף:** אחרי שהוסר צינור הפרסום הכפול (local-server.js) ותוקן
     חור ה-auth ב-GET /api/campaigns, זו הופכת לשכבת הגנה משנית ולא לגורם
     דחוף — עדיין שווה טיפול (device fingerprint / JWT עם תוקף), אך
     **לא הדבר הראשון שצריך.** **לא טופל.**

2. **האם יש מצב מרוץ (race condition) בין שתי עבודות פרסום?**
   נבדק: `tick()` מריץ `for (const post of posts) { await publishPost(...) }`
   — **סדרתי לחלוטין, אין מקבילות בתוך אותה התקנת extension.**
   אין משתנה גלובלי כמו `currentProfile`/`currentJob` ב-service worker —
   `apiToken` ו-`post` מועברים כפרמטרים לכל קריאה, לא נשמרים כמצב משותף.
   **המסקנה: אין סיכון race condition בקוד הקיים.** התערבבות היוצרים שקרתה
   בפועל (2026-07-03) הייתה תקלת תצורה — שני Edge profiles עם אותו apiToken
   מאוחסן ב-storage, לא באג בקוד.

3. **תיקון אחד ליוזר אחד, לא מופץ לכולם?**
   `publishPost()`, `syncGroups()` וכל שאר הלוגיקה הם **פונקציות גנריות יחידות**
   ב-`background.js` — משותפות לכל היוזרים דרך אותו קובץ extension. אין
   קונפיג ספציפי-ליוזר בקוד. תיקון בקובץ חל אוטומטית על כולם — **בתנאי שמעדכנים
   ידנית את כל ההתקנות** (`edge://extensions` → טען מחדש) בכל דפדפן.

   **⚠️ סטטוס אמיתי: מזוהה, לא סגור.** הסיכון האמיתי הוא לא כפילות קוד —
   זה תהליך ה-**deploy**. עדכון ידני הוא בדיוק אותו סוג באג "לא מופץ",
   רק ברמת ההפצה במקום ברמת הקוד: אם שוכחים לרענן פרופיל אחד, הוא ממשיך
   לרוץ על גרסה ישנה בלי שאף אחד ידע. **אין מנגנון auto-update** (extension
   נטען כ-unpacked/dev, לא מותקן מחנות).
   **לא טופל** — אפשרות לבדיקה: פרסום ה-extension עם `update_url` (חנות
   פרטית / self-hosted update manifest) כדי שכל ההתקנות יתעדכנו אוטומטית.
