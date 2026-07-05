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

## סטטוס נוכחי (2026-07-03)

**עובד:** טקסט + WhatsApp link  
**לא עובד:** תמונה, הסרת wa.me card, לחיצת פרסום, סגירת טאב  
**צעד הבא:** לקרוא output של דיאגנוסטיקה v2.26.1, לתקן את שלושת הבעיות, לשמור snapshot חדש
