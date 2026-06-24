"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Profile = {
  id: string;
  name: string;
  fbUsername: string;
  businessId: string;
  isActive: boolean;
  business: { name: string; type: string };
};

type Campaign = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  scheduledAt: string | null;
  business: { name: string; type: string };
  posts: { status: string; publishedAt: string | null }[];
};

const DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

export default function AnalyticsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProfileId, setFilterProfileId] = useState<string>("all");

  useEffect(() => {
    Promise.all([
      fetch("/api/campaigns").then((r) => r.json()),
      fetch("/api/profiles").then((r) => r.json()),
    ]).then(([camp, prof]) => {
      setCampaigns(Array.isArray(camp) ? camp : []);
      setProfiles(Array.isArray(prof) ? prof : []);
      setLoading(false);
    });
  }, []);

  const selectedProfile = profiles.find((p) => p.id === filterProfileId);
  const filtered = filterProfileId === "all"
    ? campaigns
    : campaigns.filter((c) => c.business.type === selectedProfile?.business.type);

  const totalCampaigns = filtered.length;
  const totalPublished = filtered.filter((c) => c.status === "done").length;
  const totalPosts = filtered.reduce((sum, c) => sum + (c.posts?.filter((p) => p.status === "published").length || 0), 0);
  const pending = filtered.filter((c) => c.status === "pending_approval").length;
  const approved = filtered.filter((c) => c.status === "approved").length;

  // Posts per day (last 7 days)
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const postsPerDay = last7.map((day) => {
    const next = new Date(day); next.setDate(next.getDate() + 1);
    const count = filtered.reduce((sum, c) => {
      return sum + (c.posts?.filter((p) => {
        if (!p.publishedAt) return false;
        const d = new Date(p.publishedAt);
        return d >= day && d < next;
      }).length || 0);
    }, 0);
    return { day, count };
  });

  const maxCount = Math.max(...postsPerDay.map((d) => d.count), 1);

  // By business
  const byBusiness: Record<string, { name: string; campaigns: number; posts: number }> = {};
  filtered.forEach((c) => {
    if (!byBusiness[c.business.name]) byBusiness[c.business.name] = { name: c.business.name, campaigns: 0, posts: 0 };
    byBusiness[c.business.name].campaigns++;
    byBusiness[c.business.name].posts += c.posts?.filter((p) => p.status === "published").length || 0;
  });

  // Status breakdown
  const statusBreakdown = [
    { label: "הושלמו",         value: totalPublished, color: "bg-green-500"  },
    { label: "מאושרים",        value: approved,        color: "bg-blue-500"   },
    { label: "ממתינים לאישור", value: pending,          color: "bg-yellow-400" },
    { label: "טיוטות",         value: filtered.filter((c) => c.status === "draft").length, color: "bg-gray-400" },
  ];

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900" dir="rtl">
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-gray-700 text-sm">← ראשי</Link>
          <h1 className="text-xl font-bold">אנליטיקס</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-6">
        {/* Profile filter */}
        {!loading && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button onClick={() => setFilterProfileId("all")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filterProfileId === "all" ? "bg-blue-600 text-white" : "bg-white border border-gray-300 hover:border-gray-400"}`}>
              כל הפרופילים
            </button>
            {profiles.map((p) => (
              <button key={p.id} onClick={() => setFilterProfileId(p.id)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filterProfileId === p.id ? "bg-blue-600 text-white" : "bg-white border border-gray-300 hover:border-gray-400"}`}>
                <span className={`inline-block w-2 h-2 rounded-full ml-1.5 ${p.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                {p.name}
              </button>
            ))}
            {profiles.length === 0 && (
              <span className="text-sm text-gray-400">אין פרופילים - <a href="/profiles" className="text-blue-500 underline">הוסף פרופיל</a></span>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-400 py-20">טוען...</div>
        ) : (
          <>
            {/* Main stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "סה״כ קמפיינים", value: totalCampaigns, color: "text-purple-600", bg: "bg-purple-50" },
                { label: "הושלמו",         value: totalPublished,  color: "text-green-600",  bg: "bg-green-50"  },
                { label: "סה״כ פרסומים",  value: totalPosts,      color: "text-blue-600",   bg: "bg-blue-50"   },
                { label: "ממתינים לאישור",value: pending,          color: "text-yellow-600", bg: "bg-yellow-50" },
              ].map((s) => (
                <div key={s.label} className="bg-white border border-gray-200 rounded-2xl p-5">
                  <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center text-xl mb-3`}>📊</div>
                  <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Chart: posts last 7 days */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
              <h2 className="font-semibold text-gray-700 mb-4">פרסומים ב-7 ימים האחרונים</h2>
              <div className="flex items-end gap-3 h-32">
                {postsPerDay.map(({ day, count }, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-xs text-gray-500 font-medium">{count || ""}</div>
                    <div
                      className="w-full rounded-t-lg bg-blue-500 transition-all"
                      style={{ height: `${Math.max((count / maxCount) * 100, count > 0 ? 8 : 2)}%`, minHeight: "2px" }}
                    />
                    <div className="text-xs text-gray-400">{DAYS[day.getDay()]}</div>
                    <div className="text-xs text-gray-300">{day.getDate()}/{day.getMonth()+1}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* By business */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <h2 className="font-semibold text-gray-700 mb-4">לפי עסק</h2>
                {Object.values(byBusiness).length === 0 ? (
                  <div className="text-sm text-gray-400">אין נתונים</div>
                ) : (
                  <div className="space-y-3">
                    {Object.values(byBusiness).map((b) => (
                      <div key={b.name} className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">{b.name}</div>
                          <div className="text-xs text-gray-400">{b.campaigns} קמפיינים</div>
                        </div>
                        <div className="text-lg font-bold text-blue-600">{b.posts}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status breakdown */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <h2 className="font-semibold text-gray-700 mb-4">סטטוס קמפיינים</h2>
                <div className="space-y-3">
                  {statusBreakdown.map((s) => (
                    <div key={s.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{s.label}</span>
                        <span className="font-semibold">{s.value}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${s.color} rounded-full transition-all`}
                          style={{ width: `${totalCampaigns > 0 ? (s.value / totalCampaigns) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
