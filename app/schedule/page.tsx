"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Campaign = {
  id: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
  business: { name: string; type: string };
  posts: { status: string }[];
};

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const STATUS_COLORS: Record<string, string> = {
  pending_approval: "bg-yellow-500",
  approved: "bg-blue-500",
  publishing: "bg-purple-500",
  done: "bg-green-500",
  paused: "bg-red-500",
  draft: "bg-gray-500",
};

export default function SchedulePage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "week">("week");

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((data) => {
        setCampaigns(data);
        setLoading(false);
      });
  }, []);

  // Group campaigns by day of week
  const byDay: Record<number, Campaign[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  campaigns.forEach((c) => {
    if (c.scheduledAt) {
      const day = new Date(c.scheduledAt).getDay();
      byDay[day] = [...(byDay[day] || []), c];
    }
  });

  const totalToday = campaigns.filter((c) => {
    if (!c.scheduledAt) return false;
    const d = new Date(c.scheduledAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  const pendingApproval = campaigns.filter((c) => c.status === "pending_approval").length;
  const active = campaigns.filter((c) => c.status === "publishing").length;

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-white">← ראשי</Link>
            <h1 className="text-2xl font-bold">לוח תזמונים</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setView("week")}
              className={`px-4 py-2 rounded-xl text-sm transition-colors ${view === "week" ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"}`}
            >
              שבועי
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-4 py-2 rounded-xl text-sm transition-colors ${view === "list" ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"}`}
            >
              רשימה
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{active}</div>
            <div className="text-xs text-gray-500 mt-1">קמפיינים פעילים</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{totalToday}</div>
            <div className="text-xs text-gray-500 mt-1">מתוזמנים להיום</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">{pendingApproval}</div>
            <div className="text-xs text-gray-500 mt-1">ממתינים לאישור</div>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-20">טוען...</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center text-gray-500 py-20">
            <div className="text-5xl mb-4">📅</div>
            <p>אין קמפיינים מתוזמנים</p>
            <Link href="/campaigns/new" className="text-blue-400 hover:underline mt-2 inline-block">
              צור קמפיין חדש
            </Link>
          </div>
        ) : view === "week" ? (
          <div className="grid grid-cols-7 gap-2">
            {DAYS.map((day, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-3 min-h-[200px]">
                <div className="text-xs font-semibold text-gray-400 mb-3 text-center">{day}</div>
                <div className="space-y-2">
                  {byDay[i].map((c) => (
                    <div
                      key={c.id}
                      className="text-xs p-2 rounded-lg bg-gray-800 border border-gray-700"
                    >
                      <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[c.status] || "bg-gray-500"} mb-1`} />
                      <div className="font-medium line-clamp-2">{c.title}</div>
                      {c.scheduledAt && (
                        <div className="text-gray-500 mt-1">
                          {new Date(c.scheduledAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => (
              <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${STATUS_COLORS[c.status] || "bg-gray-500"}`} />
                <div className="flex-1">
                  <div className="font-semibold">{c.title}</div>
                  <div className="text-xs text-gray-500">{c.business.name}</div>
                </div>
                <div className="text-sm text-gray-400">
                  {c.scheduledAt
                    ? new Date(c.scheduledAt).toLocaleString("he-IL")
                    : "לא מתוזמן"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
