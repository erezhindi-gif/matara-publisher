"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBusinessFilter } from "@/lib/businessFilter";

type Campaign = {
  id: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  templateIds: string;
  business: { name: string; type: string };
};

type Template = {
  id: string;
  groups: { id: string }[];
};

const DAY_NAMES = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const DAY_FULL = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const STATUS: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending_approval: { label: "ממתין לאישור", bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-400" },
  approved:         { label: "מאושר",        bg: "bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-500"  },
  publishing:       { label: "מפרסם",        bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500"},
  done:             { label: "הושלם",        bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500" },
  paused:           { label: "מושהה",        bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-400"   },
  draft:            { label: "טיוטה",        bg: "bg-gray-50",   text: "text-gray-600",   dot: "bg-gray-400"  },
};

function getWeekStart(date: Date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function fmt(d: Date) {
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function fmtTimeStr(iso: string) {
  return fmtTime(new Date(iso));
}

function getEndTime(campaign: Campaign, templates: Template[]): Date | null {
  if (!campaign.scheduledAt) return null;
  try {
    const ids: string[] = JSON.parse(campaign.templateIds || "[]");
    const groups = ids.reduce((sum, tid) => {
      const t = templates.find((t) => t.id === tid);
      return sum + (t?.groups.length || 0);
    }, 0);
    const durationMs = Math.max(groups, 1) * 90 * 1000; // 90s max delay per group (worst case)
    return new Date(new Date(campaign.scheduledAt).getTime() + durationMs);
  } catch { return null; }
}

export default function SchedulePage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessFilter, setBusinessFilterState] = useState("all");

  useEffect(() => {
    setBusinessFilterState(getBusinessFilter());
    const handler = () => setBusinessFilterState(getBusinessFilter());
    window.addEventListener("businessFilterChange", handler);
    return () => window.removeEventListener("businessFilterChange", handler);
  }, []);
  const [view, setView] = useState<"week" | "list">("week");
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCampaigns();
    fetch("/api/templates").then((r) => r.json()).then((data) => setTemplates(Array.isArray(data) ? data : []));
  }, []);

  function fetchCampaigns() {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((data) => { setCampaigns(Array.isArray(data) ? data : []); setLoading(false); });
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

  function startEdit(c: Campaign) {
    setEditingId(c.id);
    if (c.scheduledAt) {
      const d = new Date(c.scheduledAt);
      const pad = (n: number) => String(n).padStart(2, "0");
      setEditDate(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    } else setEditDate("");
  }

  const today = new Date();
  today.setHours(0,0,0,0);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const filteredCampaigns = campaigns.filter((c) =>
    businessFilter === "all" || c.business.type === businessFilter
  );

  function campaignsForDay(day: Date) {
    return filteredCampaigns.filter((c) => {
      if (!c.scheduledAt) return false;
      const d = new Date(c.scheduledAt);
      d.setHours(0,0,0,0);
      return d.getTime() === day.getTime();
    }).sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
  }

  const pendingApproval = filteredCampaigns.filter((c) => c.status === "pending_approval").length;
  const totalToday = campaignsForDay(today).length;
  const totalWeek = weekDays.reduce((sum, d) => sum + campaignsForDay(d).length, 0);

  const scheduled = campaigns.filter((c) => c.scheduledAt).sort((a, b) =>
    new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime()
  );
  const unscheduled = campaigns.filter((c) => !c.scheduledAt);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-gray-700 text-sm">← ראשי</Link>
            <h1 className="text-xl font-bold">לוח תזמונים</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setView("week")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${view === "week" ? "bg-blue-600 text-white" : "bg-white border border-gray-300 hover:border-gray-400"}`}>שבועי</button>
            <button onClick={() => setView("list")} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${view === "list" ? "bg-blue-600 text-white" : "bg-white border border-gray-300 hover:border-gray-400"}`}>רשימה</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "ממתינים לאישור", value: pendingApproval, color: "text-yellow-600" },
            { label: "מתוזמנים להיום",  value: totalToday,      color: "text-blue-600"   },
            { label: "השבוע",           value: totalWeek,        color: "text-green-600"  },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-20">טוען...</div>
        ) : view === "week" ? (
          <>
            {/* Week nav */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setWeekStart(w => addDays(w, -7))} className="bg-white border border-gray-300 hover:border-gray-400 rounded-xl px-4 py-2 text-sm transition-colors">← שבוע קודם</button>
              <div className="text-sm font-semibold text-gray-700">
                {fmt(weekStart)} – {fmt(addDays(weekStart, 6))}
              </div>
              <button onClick={() => setWeekStart(w => addDays(w, 7))} className="bg-white border border-gray-300 hover:border-gray-400 rounded-xl px-4 py-2 text-sm transition-colors">שבוע הבא ←</button>
            </div>

            {/* Week grid */}
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day, i) => {
                const isToday = day.getTime() === today.getTime();
                const dayCampaigns = campaignsForDay(day);
                return (
                  <div key={i} className={`rounded-2xl border min-h-[180px] overflow-hidden ${isToday ? "border-blue-400 ring-1 ring-blue-400" : "border-gray-200"}`}>
                    {/* Day header */}
                    <div className={`px-3 py-2 text-center border-b ${isToday ? "bg-blue-600 border-blue-500" : "bg-white border-gray-100"}`}>
                      <div className={`text-xs font-bold ${isToday ? "text-white" : "text-gray-600"}`}>{DAY_FULL[i]}</div>
                      <div className={`text-lg font-bold ${isToday ? "text-white" : "text-gray-900"}`}>{day.getDate()}</div>
                      <div className={`text-xs ${isToday ? "text-blue-100" : "text-gray-400"}`}>
                        {dayCampaigns.length > 0 ? `${dayCampaigns.length} פוסטים` : ""}
                      </div>
                    </div>
                    {/* Campaigns */}
                    <div className="bg-white p-2 space-y-1.5 min-h-[120px]">
                      {dayCampaigns.length === 0 && (
                        <div className="text-xs text-gray-300 text-center pt-4">ריק</div>
                      )}
                      {dayCampaigns.map((c) => {
                        const s = STATUS[c.status] || STATUS.draft;
                        return (
                          <Link key={c.id} href={`/campaigns/${c.id}`} className={`block rounded-lg p-2 ${s.bg} border border-opacity-50 hover:opacity-80 transition-opacity`} style={{ borderColor: "currentColor" }}>
                            <div className="flex items-center gap-1 mb-0.5">
                              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                              <span className="text-xs font-semibold text-blue-700">
                                {fmtTime(new Date(c.scheduledAt!))}
                                {(() => { const e = getEndTime(c, templates); return e ? `–${fmtTime(e)}` : ""; })()}
                              </span>
                            </div>
                            <div className="text-xs text-gray-800 line-clamp-2 leading-tight">{c.title}</div>
                            <div className={`text-xs mt-0.5 ${s.text}`}>{s.label}</div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* List view */
          <div className="space-y-6">
            {scheduled.length === 0 && unscheduled.length === 0 && (
              <div className="text-center text-gray-500 py-20">
                <div className="text-5xl mb-4">📅</div>
                <p>אין קמפיינים</p>
                <Link href="/campaigns/new" className="text-blue-500 hover:underline mt-2 inline-block text-sm">צור קמפיין חדש</Link>
              </div>
            )}

            {scheduled.length > 0 && (
              <div>
                <div className="text-sm font-semibold text-gray-500 mb-3">מתוזמנים</div>
                <div className="space-y-2">
                  {scheduled.map((c) => {
                    const s = STATUS[c.status] || STATUS.draft;
                    const d = new Date(c.scheduledAt!);
                    return (
                      <div key={c.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                        {editingId === c.id ? (
                          <div className="p-4 space-y-3">
                            <div className="font-semibold text-sm">{c.title}</div>
                            <input
                              type="datetime-local"
                              className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 text-sm text-gray-900"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <button onClick={() => setEditingId(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 rounded-xl p-2 text-sm">ביטול</button>
                              <button onClick={() => saveEdit(c.id)} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-2 text-sm font-semibold">
                                {saving ? "שומר..." : "שמור"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-4 p-4">
                            {/* Date block */}
                            <div className="text-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 flex-shrink-0">
                              <div className="text-xs text-gray-500">{DAY_NAMES[d.getDay()]}</div>
                              <div className="text-xl font-bold text-gray-900">{d.getDate()}</div>
                              <div className="text-xs text-gray-500">{d.getMonth() + 1}/{d.getFullYear().toString().slice(2)}</div>
                            </div>
                            {/* Time */}
                            <div className="text-lg font-bold text-gray-700 flex-shrink-0 w-14">
                              {fmtTimeStr(c.scheduledAt!)}{(() => { const e = getEndTime(c, templates); return e ? `–${fmtTime(e)}` : ""; })()}
                            </div>
                            {/* Status dot */}
                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm truncate">{c.title}</div>
                              <div className="text-xs text-gray-500">{c.business.name} · <span className={s.text}>{s.label}</span></div>
                            </div>
                            {/* Actions */}
                            <div className="flex gap-2 flex-shrink-0">
                              <button onClick={() => startEdit(c)} className="text-xs bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-1.5 transition-colors">✏️ ערוך</button>
                              <button onClick={() => deleteCampaign(c.id)} className="text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded-lg px-3 py-1.5 transition-colors">מחק</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {unscheduled.length > 0 && (
              <div>
                <div className="text-sm font-semibold text-gray-500 mb-3">ללא תזמון</div>
                <div className="space-y-2">
                  {unscheduled.map((c) => {
                    const s = STATUS[c.status] || STATUS.draft;
                    return (
                      <div key={c.id} className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4">
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{c.title}</div>
                          <div className="text-xs text-gray-500">{c.business.name} · <span className={s.text}>{s.label}</span></div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => startEdit(c)} className="text-xs bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-1.5 transition-colors">✏️ קבע זמן</button>
                          <button onClick={() => deleteCampaign(c.id)} className="text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded-lg px-3 py-1.5 transition-colors">מחק</button>
                        </div>
                        {editingId === c.id && (
                          <div className="absolute inset-0 bg-white rounded-2xl p-4 space-y-3 z-10 border border-blue-400">
                            <input type="datetime-local" className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 text-sm text-gray-900" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                            <div className="flex gap-2">
                              <button onClick={() => setEditingId(null)} className="flex-1 bg-gray-100 rounded-xl p-2 text-sm">ביטול</button>
                              <button onClick={() => saveEdit(c.id)} disabled={saving} className="flex-1 bg-blue-600 text-white rounded-xl p-2 text-sm font-semibold">{saving ? "..." : "שמור"}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
