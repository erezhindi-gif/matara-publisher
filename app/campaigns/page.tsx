"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBusinessFilter } from "@/lib/businessFilter";

type Campaign = {
  id: string;
  title: string;
  content: string;
  status: string;
  createdAt: string;
  scheduledAt: string | null;
  templateIds: string;
  business: { name: string; type: string };
  posts: { status: string }[];
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  draft:            { label: "טיוטה",          color: "text-gray-600",  bg: "bg-gray-100" },
  pending_approval: { label: "ממתין לאישור",   color: "text-yellow-700", bg: "bg-yellow-100" },
  approved:         { label: "מאושר",           color: "text-blue-700",  bg: "bg-blue-100" },
  publishing:       { label: "מפרסם...",        color: "text-purple-700", bg: "bg-purple-100" },
  done:             { label: "הושלם",           color: "text-green-700", bg: "bg-green-100" },
  paused:           { label: "מושהה",           color: "text-red-700",   bg: "bg-red-100" },
};

const DAY_SHORT = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [businessFilter, setBusinessFilterState] = useState("all");

  useEffect(() => {
    setBusinessFilterState(getBusinessFilter());
    const handler = () => setBusinessFilterState(getBusinessFilter());
    window.addEventListener("businessFilterChange", handler);
    return () => window.removeEventListener("businessFilterChange", handler);
  }, []);

  useEffect(() => {
    function fetchCampaigns() {
      fetch("/api/campaigns")
        .then((r) => r.json())
        .then((data) => { setCampaigns(Array.isArray(data) ? data : []); setLoading(false); });
    }
    fetchCampaigns();
    const interval = setInterval(fetchCampaigns, 15000);
    return () => clearInterval(interval);
  }, []);

  const filtered = campaigns.filter((c) => {
    const matchSearch = !search || c.title.includes(search) || c.content.includes(search);
    const matchStatus = filterStatus === "all" || c.status === filterStatus;
    const matchBusiness = businessFilter === "all" || c.userId === businessFilter;
    return matchSearch && matchStatus && matchBusiness;
  });

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-500 hover:text-gray-900 text-sm">← ראשי</Link>
            <h1 className="text-xl font-bold">קמפיינים</h1>
          </div>
          <Link href="/campaigns/new" className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors">
            + קמפיין חדש
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-6">
        {/* Search + Filter */}
        <div className="flex gap-3 mb-6">
          <input
            type="text"
            placeholder="חפש קמפיינים לפי שם, תבנית או תוכן..."
            className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">כל הסטטוסים</option>
            <option value="draft">טיוטה</option>
            <option value="pending_approval">ממתין לאישור</option>
            <option value="approved">מאושר</option>
            <option value="publishing">מפרסם</option>
            <option value="done">הושלם</option>
            <option value="paused">מושהה</option>
          </select>
        </div>

        {loading && <div className="text-center text-gray-400 py-20">טוען...</div>}

        {!loading && filtered.length === 0 && (
          <div className="text-center text-gray-400 py-20">
            <div className="text-5xl mb-4">📋</div>
            <p>{search ? "לא נמצאו קמפיינים" : "אין קמפיינים עדיין"}</p>
            {!search && (
              <Link href="/campaigns/new" className="text-blue-500 hover:underline mt-2 inline-block text-sm">
                צור קמפיין ראשון
              </Link>
            )}
          </div>
        )}

        {/* Grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((c) => {
              const statusInfo = STATUS_LABELS[c.status] || { label: c.status, color: "text-gray-600", bg: "bg-gray-100" };
              const published = c.posts.filter((p) => p.status === "published").length;
              const total = c.posts.length;
              let templateCount = 0;
              try { templateCount = JSON.parse(c.templateIds || "[]").length; } catch { templateCount = 0; }
              const scheduledDate = c.scheduledAt ? new Date(c.scheduledAt) : null;

              return (
                <Link
                  key={c.id}
                  href={`/campaigns/${c.id}`}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md hover:border-blue-300 transition-all group"
                >
                  {/* Color bar by business */}
                  <div className={`h-1.5 w-full ${c.business.type === "recruitment" ? "bg-blue-500" : "bg-orange-400"}`} />

                  <div className="p-4">
                    {/* Status badge */}
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusInfo.bg} ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                      <span className="text-xs text-gray-400">{c.business.name.split(" ")[0]}</span>
                    </div>

                    {/* Title */}
                    <h2 className="font-semibold text-sm leading-tight mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {c.title}
                    </h2>

                    {/* Content preview */}
                    <p className="text-xs text-gray-500 line-clamp-3 mb-4 leading-relaxed">
                      {c.content}
                    </p>

                    {/* Footer */}
                    <div className="border-t border-gray-100 pt-3 space-y-1.5">
                      {scheduledDate ? (
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span className="font-medium">
                            {DAY_SHORT[scheduledDate.getDay()]}׳ {scheduledDate.toLocaleDateString("he-IL")}
                          </span>
                          <span className="font-semibold text-gray-700">
                            {scheduledDate.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400">לא מתוזמן</div>
                      )}
                      <div className="text-xs text-gray-400">
                        {total > 0
                          ? <span>{total} קבוצות · {published} פורסמו</span>
                          : templateCount > 0
                            ? <span className="text-gray-500">{templateCount} תבניות</span>
                            : <span className="text-orange-500">טרם הוקצו קבוצות</span>
                        }
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
