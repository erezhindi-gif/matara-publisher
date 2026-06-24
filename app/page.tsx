"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Stats = {
  pending: number;
  approved: number;
  publishedToday: number;
  totalCampaigns: number;
  totalPosts: number;
};

export default function Home() {
  const [stats, setStats] = useState<Stats>({ pending: 0, approved: 0, publishedToday: 0, totalCampaigns: 0, totalPosts: 0 });

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((campaigns) => {
        if (!Array.isArray(campaigns)) return;
        const today = new Date().toDateString();
        const totalPosts = campaigns.reduce((sum: number, c: { posts: { status: string }[] }) => sum + (c.posts?.filter((p) => p.status === "published").length || 0), 0);
        setStats({
          pending: campaigns.filter((c) => c.status === "pending_approval").length,
          approved: campaigns.filter((c) => c.status === "approved").length,
          publishedToday: campaigns.filter((c) => c.status === "done" && new Date(c.createdAt).toDateString() === today).length,
          totalCampaigns: campaigns.length,
          totalPosts,
        });
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">ברוך הבא, נועה הינדי</h1>
          <p className="text-sm text-gray-500 mt-1">כאן אפשר לנהל את הקמפיינים שלך</p>
        </div>
        <Link
          href="/campaigns/new"
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors"
        >
          + יצירת קמפיין חדש
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "סה״כ קמפיינים",     value: stats.totalCampaigns, icon: "📋", color: "text-purple-600", bg: "bg-purple-50" },
          { label: "פורסמו היום",        value: stats.publishedToday, icon: "🚀", color: "text-green-600",  bg: "bg-green-50"  },
          { label: "מאושרים לפרסום",    value: stats.approved,        icon: "✅", color: "text-blue-600",  bg: "bg-blue-50"   },
          { label: "ממתינים לאישור",    value: stats.pending,         icon: "⏳", color: "text-yellow-600", bg: "bg-yellow-50" },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center text-xl mb-3`}>{s.icon}</div>
            <div className={`text-3xl font-bold ${s.color} mb-1`}>{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Alert */}
      {stats.pending > 0 && (
        <Link href="/campaigns" className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-8 hover:bg-yellow-100 transition-colors">
          <span className="text-2xl">🔔</span>
          <div className="flex-1">
            <div className="font-semibold text-yellow-800">יש {stats.pending} קמפיין{stats.pending > 1 ? "ים" : ""} שממתינים לאישורך</div>
            <div className="text-sm text-yellow-600">לחץ כדי לאשר או לדחות</div>
          </div>
          <span className="text-yellow-500">←</span>
        </Link>
      )}

      {/* Total posts stat */}
      {stats.totalPosts > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-8">
          <div className="text-sm text-gray-500 mb-1">סה״כ פוסטים שפורסמו</div>
          <div className="text-4xl font-bold text-blue-600">{stats.totalPosts.toLocaleString()}</div>
        </div>
      )}
    </div>
  );
}
