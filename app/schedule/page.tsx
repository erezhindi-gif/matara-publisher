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
  pending_approval: "bg-yellow-400",
  approved: "bg-blue-500",
  publishing: "bg-purple-500",
  done: "bg-green-500",
  paused: "bg-red-500",
  draft: "bg-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  pending_approval: "ממתין לאישור",
  approved: "מאושר",
  publishing: "מפרסם",
  done: "הושלם",
  paused: "מושהה",
  draft: "טיוטה",
};

export default function SchedulePage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "week">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchCampaigns(); }, []);

  function fetchCampaigns() {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((data) => { setCampaigns(data); setLoading(false); });
  }

  function startEdit(c: Campaign) {
    setEditingId(c.id);
    if (c.scheduledAt) {
      const d = new Date(c.scheduledAt);
      const pad = (n: number) => String(n).padStart(2, "0");
      setEditDate(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    } else {
      setEditDate("");
    }
  }

  async function saveEdit(id: string) {
    setSaving(true);
    await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: editDate ? new Date(editDate).toISOString() : null }),
    });
    setSaving(false);
    setEditingId(null);
    fetchCampaigns();
  }

  async function deleteCampaign(id: string) {
    if (!confirm("למחוק את הקמפיין?")) return;
    await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    fetchCampaigns();
  }

  const byDay: Record<number, Campaign[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  campaigns.forEach((c) => {
    if (c.scheduledAt) {
      const day = new Date(c.scheduledAt).getDay();
      byDay[day] = [...(byDay[day] || []), c];
    }
  });

  const totalToday = campaigns.filter((c) => {
    if (!c.scheduledAt) return false;
    return new Date(c.scheduledAt).toDateString() === new Date().toDateString();
  }).length;

  const pendingApproval = campaigns.filter((c) => c.status === "pending_approval").length;
  const active = campaigns.filter((c) => c.status === "publishing").length;

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-8" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-500 hover:text-gray-900">← ראשי</Link>
            <h1 className="text-2xl font-bold">לוח תזמונים</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setView("week")} className={`px-4 py-2 rounded-xl text-sm transition-colors ${view === "week" ? "bg-blue-600 text-white" : "bg-white border border-gray-300 hover:border-gray-400"}`}>שבועי</button>
            <button onClick={() => setView("list")} className={`px-4 py-2 rounded-xl text-sm transition-colors ${view === "list" ? "bg-blue-600 text-white" : "bg-white border border-gray-300 hover:border-gray-400"}`}>רשימה</button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{active}</div>
            <div className="text-xs text-gray-500 mt-1">קמפיינים פעילים</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{totalToday}</div>
            <div className="text-xs text-gray-500 mt-1">מתוזמנים להיום</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{pendingApproval}</div>
            <div className="text-xs text-gray-500 mt-1">ממתינים לאישור</div>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-20">טוען...</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center text-gray-500 py-20">
            <div className="text-5xl mb-4">📅</div>
            <p>אין קמפיינים</p>
            <Link href="/campaigns/new" className="text-blue-500 hover:underline mt-2 inline-block">צור קמפיין חדש</Link>
          </div>
        ) : view === "week" ? (
          <div className="grid grid-cols-7 gap-2">
            {DAYS.map((day, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 min-h-[200px]">
                <div className="text-xs font-semibold text-gray-600 mb-3 text-center">{day}</div>
                <div className="space-y-2">
                  {byDay[i].map((c) => (
                    <div key={c.id} className="text-xs p-2 rounded-lg bg-gray-50 border border-gray-200">
                      <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[c.status] || "bg-gray-400"} mb-1`} />
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
              <div key={c.id} className="bg-white border border-gray-200 rounded-2xl p-4">
                {editingId === c.id ? (
                  <div className="space-y-3">
                    <div className="font-semibold">{c.title}</div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">תאריך ושעה חדשים</label>
                      <input
                        type="datetime-local"
                        className="w-full bg-gray-100 border border-gray-300 rounded-xl p-2 text-gray-900"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingId(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 rounded-xl p-2 text-sm transition-colors">ביטול</button>
                      <button onClick={() => saveEdit(c.id)} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-2 text-sm font-semibold transition-colors">
                        {saving ? "שומר..." : "שמור"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${STATUS_COLORS[c.status] || "bg-gray-400"}`} />
                    <div className="flex-1">
                      <div className="font-semibold">{c.title}</div>
                      <div className="text-xs text-gray-500">{c.business.name} · {STATUS_LABELS[c.status] || c.status}</div>
                    </div>
                    <div className="text-sm text-gray-600">
                      {c.scheduledAt ? new Date(c.scheduledAt).toLocaleString("he-IL") : "לא מתוזמן"}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(c)} className="text-xs bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-1.5 transition-colors">✏️ ערוך</button>
                      <button onClick={() => deleteCampaign(c.id)} className="text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded-lg px-3 py-1.5 transition-colors">🗑️ מחק</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
