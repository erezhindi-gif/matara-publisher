import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8" dir="rtl">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2">מטרה Publisher</h1>
          <p className="text-gray-400 text-lg">מערכת ניהול פרסום חכמה</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/campaigns" className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-blue-500 transition-all">
            <div className="text-3xl mb-3">📋</div>
            <h2 className="text-xl font-semibold mb-1">קמפיינים</h2>
            <p className="text-gray-400 text-sm">יצירה וניהול קמפיינים לפרסום</p>
          </Link>

          <Link href="/schedule" className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-blue-500 transition-all">
            <div className="text-3xl mb-3">📅</div>
            <h2 className="text-xl font-semibold mb-1">לוח תזמונים</h2>
            <p className="text-gray-400 text-sm">צפייה בפרסומים המתוזמנים</p>
          </Link>

          <Link href="/templates" className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-blue-500 transition-all">
            <div className="text-3xl mb-3">📁</div>
            <h2 className="text-xl font-semibold mb-1">תבניות קבוצות</h2>
            <p className="text-gray-400 text-sm">ניהול תבניות פרסום לפי אזור ותחום</p>
          </Link>

          <Link href="/settings" className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-blue-500 transition-all">
            <div className="text-3xl mb-3">⚙️</div>
            <h2 className="text-xl font-semibold mb-1">הגדרות</h2>
            <p className="text-gray-400 text-sm">פרופילים, עסקים ומכסות</p>
          </Link>
        </div>

        <div className="mt-8 bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="font-semibold mb-4 text-gray-300">סטטוס היום</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-400">0</div>
              <div className="text-xs text-gray-500">קמפיינים פעילים</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">0</div>
              <div className="text-xs text-gray-500">פוסטים פורסמו היום</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-400">0</div>
              <div className="text-xs text-gray-500">ממתינים לאישור</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
