# Working States — Matara Publisher Extension

מסמך זה מתעד כל snapshot של מה שעבד, לפי סדר כרונולוגי.
נוצר: 2026-07-03

---

## [2026-07-03] — v2.26.1 — טקסט בלבד (Partial)

- **גרסה:** 2.26.1
- **git tag:** (טרם נוצר — הדיאגנוסטיקה עדיין בעיצומה)

### מה עובד ✅
- Extension נטען ב-Edge
- טאב פייסבוק נפתח בforeground (`active: true`)
- תיבת כתיבה נפתחת
- טקסט מוכנס דרך `Input.insertText` (CDP)
- קישור WhatsApp מוכנס לטקסט
- לוג דיאגנוסטי נשמר ל-DB (שדה `error` בפוסט)
- סגירת טאב על כישלון ללא dialog (Page.navigate לפני detach)

### מה לא עובד ❌
- תמונה לא מתווספת (drag-drop לא עובד — אין אימות)
- כרטיס wa.me לא מוסר (X button לא נמצא)
- כפתור "פרסום" לא נלחץ (ממצאי דיאגנוסטיקה טרם נקראו)
- dialog "האם לעזוב?" מופיע על הצלחה (רק כישלון מטופל)

### ממצאים קריטיים שגילינו עד כה
- `active: false` → `getBoundingClientRect()` מחזיר 0 לכל אלמנט → כפתור לא נלחץ
- סדר חשוב: drag-drop תמונה ראשון → sleep(6000) → הכנסת טקסט (React re-render אחרי drop)
- `Page.navigate` בזמן debugger מחובר → CDP מדלג על beforeunload dialog
- `window.onbeforeunload = null` לא מסיר `addEventListener('beforeunload')` — לא עוזר
- `[type="submit"]` עלול לתפוס כפתורים נסתרים (dimensions=0) — לא להשתמש

### מה שבר גרסאות קודמות
- **2.23.0**: הוסר `injectPost()` ו-`downloadImageToLocal()` (קוד מת)
- **2.24.x**: שינוי סדר (טקסט לפני תמונה) → טקסט נמחק אחרי React re-render
- **2.25.x**: `active: false` → `getBoundingClientRect()` = 0 → כפתור לא נמצא לעולם

---

## [2026-07-05] — v2.40.0 — זרימה מלאה עובדת מקצה לקצה ✅

- **גרסה:** 2.40.0
- **git tag:** `working-2026-07-05-full-flow`
- **commit:** `50f8328`

### מה עובד ✅ (אומת ידנית ע"י המשתמש בפרודקשן)
1. Extension נטען ב-Edge, מתחבר ל-API
2. טאב פייסבוק נפתח בforeground
3. תיבת כתיבה נפתחת
4. **תמונה מתווספת** — `DOM.setFileInputFiles` על input הממוקד בתוך הדיאלוג
   הפתוח בלבד (לא global querySelector - זה תפס input שגוי)
5. טקסט מוכנס אחרי התמונה (React re-render survival)
6. **קישור WhatsApp** מוכנס כטקסט רגיל - פייסבוק הופך אותו אוטומטית לקישור +
   כרטיס תצוגה (WA.ME) - לא מנסים להסיר את הכרטיס, זה גרם רק לבעיות
7. כפתור "פרסום" נמצא ונלחץ (`scrollIntoView` + CDP `Input.dispatchMouseEvent`)
8. **טאב נסגר בלי dialog "האם לעזוב?"** — `Page.javascriptDialogOpening`
   listener דוחה אוטומטית כל דיאלוג ברגע שהוא נפתח

### מה לא עובד ❌
כלום שנבדק - כל 8 השלבים בטבלת האימות (ראה SKILL.md) עברו.

### ממצאים קריטיים חדשים מאז v2.26.1
- **תמונה: CDP `DOM.setFileInputFiles` עם path מקומי** (לא drag-drop, לא
  native file picker) — אבל **חייב להיות ממוקד ל-nodeId בתוך הדיאלוג הפתוח**,
  לא global querySelector על כל document (פייסבוק מחזיקה כמה `input[type=file]`
  נסתרים - תמונת פרופיל, תמונת קבוצה וכו')
- **תמונה מגיעה מ-URL מרוחק** (לא קובץ מקומי קיים) - חובה להוריד תחילה עם
  `chrome.downloads.download` לקובץ זמני, ואז להזין ל-CDP, ואז למחוק (`removeFile`+`erase`)
- **אימות "תמונה נטענה" חייב להיות `img[src^="blob:"]`** בתוך הדיאלוג, לא
  `img[src*="scontent"]` (זה תופס גם תמונת פרופיל קיימת - false positive)
- **כפתור פרסום: לא לסנן לפי `getBoundingClientRect() > 0`** — מחזיר 0
  בscroll containers גם כשהכפתור אמיתי וקליק. `scrollIntoView` לפני קליק במקום
- **סגירת טאב: מאזין `Page.javascriptDialogOpening` + `Page.handleJavaScriptDialog({accept:true})`**
  לפני שהדיאלוג נתקע - לא לנסות "לעקוף" אותו אחרי שהוא כבר פתוח
- **wa.me card: לא לגעת בו בכלל** — ניסיונות קודמים להסיר אותו (חיפוש X
  button) היו שבירים וגרמו לבעיות נוספות. השארתו כמו שהיא = 0 קוד, 0 בעיות.
- **בדיקת זהות (חסימת פרסום למשתמש לא נכון): נשארת "warning בלבד"** —
  ניסיון לחסימה קשיחה (v2.37.0) גרם ל-false positive אמיתי בפרודקשן
  (תפס כפתור "אפשרויות והגדרות של חשבון" בטעות). הסלקטור עדיין לא אומת.

### מה שבר גרסאות קודמות (מאז v2.26.1)
- **v2.32-2.33**: drag-drop הוחלף ב-file input injection, אך querySelector
  גלובלי תפס input לא נכון
- **v2.37.0**: חסימת זהות קשיחה חסמה פרסום תקין (false positive מאומת)
- **v2.38.0**: הוחזרה לwarning-only - התיקון הנכון

### תלות חיצונית שהוסרה באותו סבב (לא קשור לתוסף עצמו)
- `local-server.js`: הוסר `publisherLoop`/`processCampaign`/`postToFacebookGroup` -
  צינור פרסום מקביל שרץ כשירות Windows כל 60 שניות, בלי claim אטומי, וגרם
  לסיכון פרסום כפול. ראה `project-map.md`.
- `app/api/campaigns/route.ts`: תוקן חור אבטחה (ברירת מחדל הייתה "הכל" כשאין
  session, עכשיו 401).

---

## סטטוס נוכחי (2026-07-05)

**עובד:** הכל — תמונה, טקסט, WhatsApp, לחיצת פרסום, סגירת טאב.  
**פתוח (לא דחוף):** בדיקת זהות משתמש (warning בלבד, לא חוסמת - סלקטור לא
מאומת); `apiToken` לא קשור למכשיר; `local-server.js` `syncGroups()` +
`app/api/sync-groups/route.ts` (SUSPECTED DEAD, לא טופל);
`app/api/campaigns/[id]/route.ts` בלי auth בכלל.  
**צעד הבא:** לתאם עם המשתמש מתי להפעיל מחדש את שירות ה-Windows (local-server.js)
כדי שהסרת publisherLoop תיכנס לתוקף בפועל.
