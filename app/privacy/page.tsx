export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-8" dir="rtl">
      <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-2xl p-8">
        <h1 className="text-2xl font-bold mb-1">מדיניות פרטיות - Matara Publisher</h1>
        <p className="text-sm text-gray-500 mb-6">עודכן לאחרונה: יולי 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-gray-800">
          <section>
            <h2 className="font-semibold text-base mb-2">מהו Matara Publisher</h2>
            <p>
              Matara Publisher הוא כלי פנימי (תוסף דפדפן + מערכת ניהול) לפרסום אוטומטי של קמפיינים לקבוצות
              פייסבוק, ולסנכרון רשימת הקבוצות שהמשתמש חבר בהן. התוסף מיועד לשימוש פנימי בלבד ואינו מופץ
              לציבור הרחב.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">אילו נתונים התוסף ניגש אליהם</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>תוכן דף פייסבוק בזמן שהתוסף פועל - שמות ומזהי קבוצות, ותוכן פוסטים שהתוסף עצמו מפרסם.</li>
              <li>טוקן הזדהות (apiToken) ומזהה מכשיר (deviceId) - מאוחסנים מקומית בדפדפן בלבד, לצורך התחברות בין התוסף לשרת הפנימי.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">מה נעשה עם הנתונים</h2>
            <p>
              המידע שנאסף (שמות קבוצות ותוכן פוסטים) נשלח אך ורק לשרת הפנימי של Matara Publisher
              (matara-publisher.vercel.app), ומשמש לתפעול המערכת בלבד - הצגת רשימת קבוצות, מעקב אחרי
              סטטוס פרסום, ותזמון קמפיינים. אנחנו לא מוכרים, משתפים או מעבירים את הנתונים לצד שלישי, ולא
              משתמשים בהם למטרה שאינה תפעול המערכת.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">מה התוסף לא עושה</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>לא ניגש לסיסמת הפייסבוק של המשתמש - הוא פועל מול סשן שכבר מחובר בדפדפן.</li>
              <li>לא עוקב אחרי גלישה, היסטוריית אתרים או פעילות במקומות אחרים ברשת.</li>
              <li>לא אוסף מידע אישי מזהה (שם, אימייל, טלפון) על משתמשי פייסבוק אחרים.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">יצירת קשר</h2>
            <p>שאלות לגבי מדיניות זו ניתן להפנות אל erezhindi@gmail.com.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
