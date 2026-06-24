"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Stats = {
  pending: number;
  approved: number;
  publishedToday: number;
  totalCampaigns: number;
};

export default function Home() {
  const [stats, setStats] = useState<Stats>({ pending: 0, approved: 0, publishedToday: 0, totalCampaigns: 0 });

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((campaigns) => {
        if (!Array.isArray(campaigns)) return;
        const today = new Date().toDateString();
        setStats({
          pending: campaigns.filter((c) => c.status === "pending_approval").length,
          approved: campaigns.filter((c) => c.status === "approved").length,
          publishedToday: campaigns.filter((c) => c.status === "done" && new Date(c.createdAt).toDateString() === today).length,
          totalCampaigns: campaigns.length,
        });
      })
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white" dir="rtl">
      {/* Header */}
      <div className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold">M</div>
            <span className="font-semibold text-lg">Matara Publisher</span>
          </div>
          <Link href="/campaigns/new" className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-xl px-5 py-2 text-sm font-semibold transition-all shadow-lg shadow-blue-500/20">
            + קמפיין חדש
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-12">
        {/* Hero Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { label: "ממתינים לאישור", value: stats.pending, color: "from-yellow-500/20 to-orange-500/10", text: "text-yellow-400", border: "border-yellow-500/20", icon: "⏳" },
            { label: "מאושרים לפרסום", value: stats.approved, color: "from-blue-500/20 to-cyan-500/10", text: "text-blue-400", border: "border-blue-500/20", icon: "✅" },
            { label: "פורסמו היום", value: stats.publishedToday, color: "from-green-500/20 to-emerald-500/10", text: "text-green-400", border: "border-green-500/20", icon: "🚀" },
            { label: "סה״כ קמפיינים", value: stats.totalCampaigns, color: "from-purple-500/20 to-pink-500/10", text: "text-purple-400", border: "border-purple-500/20", icon: "📊" },
          ].map((s) => (
            <div key={s.label} className={`bg-gradient-to-br ${s.color} border ${s.border} rounded-2xl p-5`}>
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className={`text-3xl font-bold ${s.text} mb-1`}>{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Alert for pending */}
        {stats.pending > 0 && (
          <Link href="/campaigns" className="block mb-8 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 hover:bg-yellow-500/15 transition-all">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🔔</div>
              <div>
                <div className="font-semibold text-yellow-300">יש {stats.pending} קמפיין{stats.pending > 1 ? "ים" : ""} שממתינים לאישורך</div>
                <div className="text-sm text-gray-400">לחץ כדי לאשר או לדחות</div>
              </div>
              <div className="mr-auto text-yellow-500">←</div>
            </div>
          </Link>
        )}

        {/* Nav Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link href="/campaigns" className="group bg-white/3 hover:bg-white/6 border border-white/8 hover:border-blue-500/40 rounded-2xl p-6 transition-all">
            <div className="text-3xl mb-4">📋</div>
            <h2 className="text-lg font-semibold mb-1 group-hover:text-blue-300 transition-colors">קמפיינים</h2>
            <p className="text-sm text-gray-500">יצירה, אישור וניהול קמפיינים</p>
          </Link>

          <Link href="/templates" className="group bg-white/3 hover:bg-white/6 border border-white/8 hover:border-purple-500/40 rounded-2xl p-6 transition-all">
            <div className="text-3xl mb-4">📁</div>
            <h2 className="text-lg font-semibold mb-1 group-hover:text-purple-300 transition-colors">תבניות קבוצות</h2>
            <p className="text-sm text-gray-500">ארגון קבוצות לפי אזור ותחום</p>
          </Link>

          <Link href="/profiles" className="group bg-white/3 hover:bg-white/6 border border-white/8 hover:border-green-500/40 rounded-2xl p-6 transition-all">
            <div className="text-3xl mb-4">👤</div>
            <h2 className="text-lg font-semibold mb-1 group-hover:text-green-300 transition-colors">פרופילי פייסבוק</h2>
            <p className="text-sm text-gray-500">חשבונות פייסבוק לפרסום</p>
          </Link>

          <Link href="/schedule" className="group bg-white/3 hover:bg-white/6 border border-white/8 hover:border-cyan-500/40 rounded-2xl p-6 transition-all">
            <div className="text-3xl mb-4">📅</div>
            <h2 className="text-lg font-semibold mb-1 group-hover:text-cyan-300 transition-colors">לוח תזמונים</h2>
            <p className="text-sm text-gray-500">פרסומים מתוזמנים</p>
          </Link>

          <Link href="/settings" className="group bg-white/3 hover:bg-white/6 border border-white/8 hover:border-gray-400/40 rounded-2xl p-6 transition-all">
            <div className="text-3xl mb-4">⚙️</div>
            <h2 className="text-lg font-semibold mb-1 group-hover:text-gray-300 transition-colors">הגדרות</h2>
            <p className="text-sm text-gray-500">קישורי וואטסאפ ומייל</p>
          </Link>

          {/* Sync button */}
          <div className="group bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-6">
            <div className="text-3xl mb-4">🔄</div>
            <h2 className="text-lg font-semibold mb-1">סנכרון קבוצות</h2>
            <p className="text-sm text-gray-500 mb-3">הפעל סקריפט על המחשב שלך</p>
            <code className="text-xs bg-black/40 text-green-400 px-2 py-1 rounded-lg block">
              node sync-groups.js
            </code>
          </div>
        </div>
      </div>
    </main>
  );
}
