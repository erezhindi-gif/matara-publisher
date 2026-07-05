---
name: working-snapshot
description: יש להשתמש בסקיל הזה בכל פעם שמשהו עובד לראשונה - תכונה חדשה, תיקון באג, זרימה מלאה. מטרת הסקיל היא לשמר את ה"מה שעבד" ולמנוע רגרסיה. הסקיל קיים כי בפרויקט הזה תיקון אחד שבר תיקון קודם (הוספת תמונה שברה את הטקסט, תיקון beforeunload שבר את סגירת הטאב, active:true שתיקן rendering הוסף מאוחר). כל פעם שנכנסים לפיצ'ר "שבור" ומגלים שהוא "עבד פעם" - הסקיל הזה אמור לספק את ה-snapshot שמסביר למה.
---

# שמירת Snapshot של קוד עובד (Working Snapshot)

## למה הסקיל הזה קיים

בפרויקט הזה, תיקון אחד נוטה לשבור תיקון אחר:
- הוספת drag-drop תמונה → טקסט נמחק (React re-render)
- תיקון `beforeunload` → סדר הפעולות השתנה
- `active: false` → `getBoundingClientRect()` החזיר 0 לכל אלמנט
- הסרת קוד מת → פונקציה פעילה נמחקה בטעות

**לסקיל יש שני שלבים:**
1. **שמירה (Save)** — כשמשהו עובד, שומרים snapshot
2. **שחזור (Restore)** — כשמשהו נשבר, בודקים מה השתנה מה-snapshot האחרון

---

## שלב 1 — מתי לשמור Snapshot

שמור snapshot בכל אחד מהמקרים הבאים:
- זרימה מלאה עבדה מקצה לקצה (פתיחת פייסבוק → תמונה → טקסט → פרסום → סגירה)
- תיקון באג אחד הושלם ואומת
- גרסה חדשה הועלתה ל-Edge ואומתה ידנית
- לפני כל שינוי גדול (כ"snapshot לפני")

---

## שלב 2 — איך שומרים Snapshot

### 2א. Git tag
```bash
git add -A
git commit -m "working: <תיאור קצר של מה עובד>"
git tag working-<תאריך>-<תיאור> HEAD
# למשל: git tag working-2026-07-03-text-only HEAD
```

### 2ב. עדכן WORKING-STATES.md
קובץ זה נמצא ב-`references/WORKING-STATES.md`. צור אותו אם לא קיים.

פורמט של כל רשומה:
```markdown
## [תאריך] — [תיאור]
- **גרסה:** 2.X.X
- **git tag:** working-2026-07-03-text-only
- **מה עבד:** רשימה מפורטת של כל מה שעבד בפועל
- **מה לא עבד:** כל מה שעוד לא תוקן באותו snapshot
- **ממצאים קריטיים:** הגילויים הטכניים שגרמו לזה לעבוד (למשל: "active:true חיוני - בלעדיו getBoundingClientRect מחזיר 0")
- **מה שבר את הגרסה הקודמת:** (אם רלוונטי)
```

### 2ג. עדכן גרסה ב-manifest.json
```json
"version": "2.X.X"
```
גרסה = major.minor.patch — הגדל patch על כל שינוי קטן, minor על תיקון משמעותי.

---

## שלב 3 — מתי ואיך משתמשים ב-Snapshot לשחזור

כשמשהו מפסיק לעבוד:

### 3א. בדוק מה השתנה
```bash
git log --oneline working-<snapshot-אחרון>..HEAD
git diff working-<snapshot-אחרון> -- extension/background.js
```

### 3ב. קרא את WORKING-STATES.md
- מה ה-snapshot האחרון שבו הפיצ'ר הזה עבד?
- מה היו "הממצאים הקריטיים" של אותו snapshot?
- מה השתנה מאז?

### 3ג. ממצא vs. שינוי
אם השינוי ב-diff לא מסביר את השבירה → ייתכן שרגרסיה נכנסה מבלי שהכרנו בה.
במקרה כזה: השווה את הקוד הנוכחי ל-snapshot עובד, שורה אחרי שורה.

---

## שלב 4 — רשימת הדברים שחייבים לעבוד בכל snapshot

לפני שמירת snapshot, אמת ידנית שכל אלה עובדים:

| # | פעולה | אמצעי אימות |
|---|--------|-------------|
| 1 | Extension נטען ב-Edge | `edge://extensions` → Matara Publisher פעיל |
| 2 | Extension מתחבר ל-API | Popup מציג "מחובר" |
| 3 | טאב פייסבוק נפתח בforeground | `active: true` בקוד |
| 4 | תיבת כתיבה נפתחת | בלי timeout error |
| 5 | תמונה מתווספת | `photo-testid=true` בלוג / נראית ב-composer |
| 6 | טקסט מוכנס (אחרי תמונה) | נראה ב-composer |
| 7 | כרטיס wa.me מוסר | הפס האפור נעלם |
| 8 | כפתור פרסום נלחץ | בלי `aria-disabled=true`, dimensions > 0 |
| 9 | הפוסט מתפרסם | נראה בקבוצה |
| 10 | טאב נסגר | בלי dialog "האם לעזוב?" |
| 11 | סטטוס ב-DB = "published" | בדשבורד |

---

## ממצאים קריטיים שחייבים לשרוד בין גרסאות

**אלה הגילויים שעלו בכאב — אסור לשכוח אותם:**

### A. active: true — חיוני לרינדור
```js
chrome.tabs.create({ url, active: true })  // NEVER active: false
```
**למה:** טאב ב-background לא מרונדר. `getBoundingClientRect()` מחזיר `{width:0, height:0}` לכל אלמנט. הכפתור לא ייפגש לעולם.

### B. סדר: תמונה לפני טקסט
```
drag-drop תמונה → sleep(6000) → הכנס טקסט
```
**למה:** Facebook React מעשה re-render של כל ה-composer אחרי drop. textbox ישן → טקסט שהוכנס לפני drop נמחק.

### C. Page.navigate לפני chrome.debugger.detach
```js
// נווט בזמן debugger מחובר → CDP מדלג על beforeunload
await chrome.debugger.sendCommand({ tabId }, "Page.navigate", { url: "about:blank" })
// רק אז:
await chrome.debugger.detach({ tabId })
chrome.tabs.remove(tabId)
```
**למה:** `chrome.tabs.remove` עם דף פייסבוק פעיל → dialog "האם לעזוב?". CDP מדלג על זה.

### D. כפתור פרסום: רק חיפוש טקסט + dimensions
```js
// לא: document.querySelector('[type="submit"]') — מוצא כפתורים נסתרים
// כן: textContent + getBoundingClientRect() > 0
```

### E. Input.insertText דרך CDP — לא dispatchEvent
```js
chrome.debugger.sendCommand({ tabId }, "Input.insertText", { text: fullText })
```
**למה:** `document.execCommand` ו-`dispatchEvent(new KeyboardEvent)` לא עובדים ב-Facebook contenteditable.

---

## נוהל לפני כל שינוי גדול

1. **שמור snapshot** (git tag + WORKING-STATES.md)
2. **תאר בדיוק** מה אתה משנה ולמה
3. **בדוק** את "ממצאים קריטיים" — האם השינוי עלול לשבור אחד מהם?
4. **לאחר השינוי** — אמת את כל 11 הפעולות בטבלה
5. **שמור snapshot חדש** אם הכל עובד

---

## WORKING-STATES.md — מיקום

`C:\Projects\matara-publisher\references\WORKING-STATES.md`

---

## קיצור דרך — פקודות git

```bash
# ראה כל snapshots
git tag | grep working

# ראה מה השתנה מ-snapshot
git diff working-2026-07-03-text-only -- extension/background.js

# חזור ל-snapshot (זהירות — ידרוש branch חדש)
git checkout -b restore/snapshot working-2026-07-03-text-only
```
