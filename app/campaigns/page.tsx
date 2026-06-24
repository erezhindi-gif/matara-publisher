"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Campaign = {
  id: string;
  title: string;
  content: string;
  status: string;
  createdAt: string;
  scheduledAt: string | null;
  business: { name: string; type: string };
  posts: { status: string }[];
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "טיוטה", color: "text-gray-400" },
  pending_approval: { label: "ממתין לאישור", color: "text-yellow-400" },
  approved: { label: "מאושר", color: "text-blue-400" },
  publishing: { label: "מפרסם...", color: "text-purple-400" },
  done: { label: "הושלם", color: "text-green-400" },
  paused: { label: "מושהה", color: "text-red-400" },
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((data) => {
        setCampaigns(data);
        setLoading(false);
      });
  }, []);

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-white">← ראשי</Link>
            <h1 className="text-2xl font-bold">קמפיינים</h1>
          </div>
          <Link href="/campaigns/new" className="bg-blue-600 hover:bg-blue-700 rounded-xl px-5 py-2.5 font-semibold transition-colors">
            + קמפיין חדש
          </Link>
        </div>

        {loading && <div className="text-center text-gray-500 py-20">טוען...</div>}

        {!loading && campaigns.length === 0 && (
          <div className="text-center text-gray-500 py-20">
            <div className="text-5xl mb-4">📋</div>
            <p>אין קמפיינים עדיין</p>
            <Link href="/campaigns/new" className="text-blue-400 hover:underline mt-2 inline-block">
              צור קמפיין ראשון
            </Link>
          </div>
        )}

        {!loading && campaigns.length > 0 && (
          <div className="space-y-4">
            {campaigns.map((c) => {
              const statusInfo = STATUS_LABELS[c.status] || { label: c.status, color: "text-gray-400" };
              const published = c.posts.filter((p) => p.status === "published").length;
              const total = c.posts.length;
              return (
                <Link key={c.id} href={`/campaigns/${c.id}`} className="block bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-600 transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h2 className="font-semibold text-lg">{c.title}</h2>
                      <span className="text-xs text-gray-500">{c.business.name}</span>
                    </div>
                    <span className={`text-sm font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                  </div>
                  <p className="text-sm text-gray-400 line-clamp-2 mb-3">{c.content}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{total > 0 ? `${published}/${total} קבוצות פורסמו` : "טרם הוקצו קבוצות"}</span>
                    <span>
                      {c.scheduledAt
                        ? `מתוזמן: ${new Date(c.scheduledAt).toLocaleString("he-IL")}`
                        : new Date(c.createdAt).toLocaleDateString("he-IL")}
                    </span>
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
