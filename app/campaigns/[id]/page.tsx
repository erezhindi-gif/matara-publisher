"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Campaign = {
  id: string;
  title: string;
  content: string;
  status: string;
  whatsappLink: string | null;
  emailLink: string | null;
  scheduledAt: string | null;
  createdAt: string;
  business: { name: string; type: string };
  posts: { id: string; groupName: string; status: string; publishedAt: string | null }[];
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "טיוטה", color: "text-gray-400" },
  pending_approval: { label: "ממתין לאישור", color: "text-yellow-400" },
  approved: { label: "מאושר", color: "text-blue-400" },
  publishing: { label: "מפרסם...", color: "text-purple-400" },
  done: { label: "הושלם", color: "text-green-400" },
  paused: { label: "מושהה", color: "text-red-400" },
};

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectNote, setRejectNote] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/campaigns/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setCampaign(data);
        setLoading(false);
      });
  }, [id]);

  async function updateStatus(status: string, note?: string) {
    setSaving(true);
    await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...(note ? { rejectNote: note } : {}) }),
    });
    setSaving(false);
    router.refresh();
    const updated = await fetch(`/api/campaigns/${id}`).then((r) => r.json());
    setCampaign(updated);
    setShowReject(false);
    setRejectNote("");
  }

  if (loading) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">טוען...</div>;
  if (!campaign) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">לא נמצא</div>;

  const statusInfo = STATUS_LABELS[campaign.status] || { label: campaign.status, color: "text-gray-400" };

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/campaigns" className="text-gray-400 hover:text-white">← קמפיינים</Link>
          <h1 className="text-2xl font-bold">{campaign.title}</h1>
        </div>

        {/* Status bar */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-5 flex items-center justify-between">
          <div>
            <span className="text-sm text-gray-400">סטטוס: </span>
            <span className={`font-semibold ${statusInfo.color}`}>{statusInfo.label}</span>
          </div>
          <div className="text-sm text-gray-500">{campaign.business.name}</div>
        </div>

        {/* Post content */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-5">
          <div className="text-sm text-gray-400 mb-3">תוכן הפוסט</div>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{campaign.content}</pre>

          {(campaign.whatsappLink || campaign.emailLink) && (
            <div className="mt-4 pt-4 border-t border-gray-800 space-y-1">
              {campaign.whatsappLink && (
                <div className="text-xs text-gray-500">
                  וואטסאפ: <span className="text-green-400">{campaign.whatsappLink}</span>
                </div>
              )}
              {campaign.emailLink && (
                <div className="text-xs text-gray-500">
                  מייל: <span className="text-blue-400">{campaign.emailLink}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Schedule info */}
        {campaign.scheduledAt && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-5 text-sm">
            <span className="text-gray-400">מתוזמן ל: </span>
            <span>{new Date(campaign.scheduledAt).toLocaleString("he-IL")}</span>
          </div>
        )}

        {/* Approval actions */}
        {campaign.status === "pending_approval" && (
          <div className="space-y-3 mb-5">
            {showReject ? (
              <div className="bg-gray-900 border border-red-800 rounded-2xl p-5 space-y-3">
                <div className="text-sm text-gray-400">הערה לדחייה (אופציונלי)</div>
                <textarea
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white text-sm min-h-[80px]"
                  placeholder="למה דחית? מה לשנות?"
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowReject(false)}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 rounded-xl p-3 transition-colors"
                  >
                    ביטול
                  </button>
                  <button
                    onClick={() => updateStatus("draft", rejectNote)}
                    disabled={saving}
                    className="flex-1 bg-red-700 hover:bg-red-600 rounded-xl p-3 font-semibold transition-colors"
                  >
                    {saving ? "שומר..." : "דחה קמפיין"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => setShowReject(true)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 border border-red-800 rounded-xl p-4 font-semibold transition-colors text-red-400"
                >
                  ✗ דחה
                </button>
                <button
                  onClick={() => updateStatus("approved")}
                  disabled={saving}
                  className="flex-1 bg-green-600 hover:bg-green-700 rounded-xl p-4 font-semibold transition-colors"
                >
                  {saving ? "שומר..." : "✓ אשר ופרסם"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Approved - pause option */}
        {(campaign.status === "approved" || campaign.status === "publishing") && (
          <button
            onClick={() => updateStatus("paused")}
            className="w-full bg-gray-800 hover:bg-gray-700 border border-yellow-800 text-yellow-400 rounded-xl p-4 font-semibold transition-colors mb-5"
          >
            ⏸ השהה קמפיין
          </button>
        )}

        {/* Paused - resume option */}
        {campaign.status === "paused" && (
          <button
            onClick={() => updateStatus("approved")}
            className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl p-4 font-semibold transition-colors mb-5"
          >
            ▶ המשך פרסום
          </button>
        )}

        {/* Posts list */}
        {campaign.posts.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="text-sm text-gray-400 mb-3">
              {campaign.posts.filter(p => p.status === "published").length}/{campaign.posts.length} קבוצות פורסמו
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {campaign.posts.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">{p.groupName}</span>
                  <span className={p.status === "published" ? "text-green-400" : p.status === "failed" ? "text-red-400" : "text-gray-500"}>
                    {p.status === "published" ? "✓ פורסם" : p.status === "failed" ? "✗ נכשל" : "ממתין"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
