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
  business: { id: string; name: string; type: string };
  imageUrls: string[];
  posts: { id: string; groupName: string; status: string; publishedAt: string | null }[];
};

type Template = {
  id: string;
  name: string;
  businessId: string;
  groups: { id: string; fbGroupId: string; name: string; memberCount: number | null }[];
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "טיוטה", color: "text-gray-500" },
  pending_approval: { label: "ממתין לאישור", color: "text-yellow-600" },
  approved: { label: "מאושר", color: "text-blue-600" },
  publishing: { label: "מפרסם...", color: "text-purple-600" },
  done: { label: "הושלם", color: "text-green-600" },
  paused: { label: "מושהה", color: "text-red-600" },
};

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי"];

function toLocalDatetime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"view" | "edit" | "duplicate">("view");
  const [rejectNote, setRejectNote] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editContent, setEditContent] = useState("");
  const [editScheduledAt, setEditScheduledAt] = useState("");
  const [editRecurring, setEditRecurring] = useState(false);
  const [editDays, setEditDays] = useState<number[]>([]);
  const [editTime, setEditTime] = useState("10:00");
  const [editWeeks, setEditWeeks] = useState(4);
  const [editImages, setEditImages] = useState<File[]>([]);
  const [editImagePreviews, setEditImagePreviews] = useState<string[]>([]);
  const [editTemplateIds, setEditTemplateIds] = useState<string[]>([]);
  const [keepImageUrls, setKeepImageUrls] = useState<string[]>([]);

  function handleEditImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setEditImages((prev) => [...prev, ...files]);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => setEditImagePreviews((prev) => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(file);
    });
  }

  function removeEditImage(i: number) {
    setEditImages((prev) => prev.filter((_, idx) => idx !== i));
    setEditImagePreviews((prev) => prev.filter((_, idx) => idx !== i));
  }

  // AI state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiVersions, setAiVersions] = useState<{ versionA: string; versionB: string } | null>(null);

  async function generateAI() {
    if (!campaign) return;
    setAiLoading(true);
    setAiVersions(null);
    try {
      const res = await fetch("/api/ai/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: campaign.title,
          location: "",
          whatsappLink: campaign.whatsappLink || "",
          emailLink: campaign.emailLink || "",
          businessType: campaign.business.type,
        }),
      });
      const data = await res.json();
      setAiVersions(data);
    } catch { /* ignore */ }
    setAiLoading(false);
  }

  // Duplicate state
  const [dupTemplates, setDupTemplates] = useState<string[]>([]);
  const [dupGroupIds, setDupGroupIds] = useState<string[]>([]);
  const [dupMode, setDupMode] = useState<"template" | "groups">("template");
  const [dupContent, setDupContent] = useState("");
  const [dupScheduledAt, setDupScheduledAt] = useState("");
  const [allGroups, setAllGroups] = useState<{ id: string; fbGroupId: string; name: string; memberCount: number | null }[]>([]);

  useEffect(() => {
    fetchCampaign();
    // רענון אוטומטי כשמפרסם
    const interval = setInterval(() => {
      setCampaign(prev => {
        if (prev && (prev.status === "publishing" || prev.status === "approved")) {
          fetchCampaign();
        }
        return prev;
      });
    }, 10000);
    fetch("/api/templates").then((r) => r.json()).then((data) => {
      setTemplates(Array.isArray(data) ? data : []);
      const groups = (Array.isArray(data) ? data : []).flatMap((t: Template & { groups: { id: string; fbGroupId: string; name: string; memberCount: number | null }[] }) => t.groups);
      const unique = groups.filter((g, i, arr) => arr.findIndex(x => x.id === g.id) === i);
      setAllGroups(unique);
    });
    return () => clearInterval(interval);
  }, [id]);

  function fetchCampaign() {
    fetch(`/api/campaigns/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setCampaign(data);
        setLoading(false);
        setEditContent(data.content || "");
        setEditScheduledAt(data.scheduledAt ? toLocalDatetime(data.scheduledAt) : "");
      });
  }

  function startEdit() {
    if (!campaign) return;
    setEditContent(campaign.content || "");
    setEditScheduledAt(campaign.scheduledAt ? toLocalDatetime(campaign.scheduledAt) : "");
    setEditRecurring(false);
    setEditDays([]);
    setEditTime("10:00");
    setEditWeeks(4);
    try { setEditTemplateIds(JSON.parse((campaign as Campaign & { templateIds?: string }).templateIds || "[]")); } catch { setEditTemplateIds([]); }
    setKeepImageUrls(campaign.imageUrls || []);
    setMode("edit");
  }

  async function saveEdit() {
    setSaving(true);
    let newImageUrls: string[] = keepImageUrls;
    if (editImages.length > 0) {
      const fd = new FormData();
      editImages.forEach((img) => fd.append("files", img));
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      newImageUrls = [...newImageUrls, ...(data.urls || [])];
    }
    const body: Record<string, unknown> = {
      content: editContent,
      imageUrls: newImageUrls,
      templateIds: editTemplateIds,
    };
    if (editScheduledAt) {
      body.scheduledAt = new Date(editScheduledAt).toISOString();
    }
    await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // If recurring - create additional campaigns
    if (editRecurring && editDays.length > 0 && campaign) {
      const startDate = editScheduledAt ? new Date(editScheduledAt) : new Date();
      for (let week = 1; week < editWeeks; week++) {
        for (const day of editDays) {
          const d = new Date(startDate);
          d.setDate(d.getDate() + week * 7 + ((day - startDate.getDay() + 7) % 7));
          const [h, m] = editTime.split(":").map(Number);
          d.setHours(h, m, 0, 0);
          await fetch("/api/campaigns", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              businessId: campaign.business.id,
              title: campaign.title,
              content: editContent,
              whatsappLink: campaign.whatsappLink,
              emailLink: campaign.emailLink,
              scheduledAt: d.toISOString(),
              templateIds: [],
            }),
          });
        }
      }
    }

    setSaving(false);
    setMode("view");
    fetchCampaign();
  }

  async function duplicateCampaign() {
    if (!campaign) return;
    if (dupMode === "template" && dupTemplates.length === 0) return;
    if (dupMode === "groups" && dupGroupIds.length === 0) return;
    setSaving(true);
    await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: campaign.business.id,
        title: campaign.title,
        content: dupContent || campaign.content,
        whatsappLink: campaign.whatsappLink,
        emailLink: campaign.emailLink,
        imageUrls: campaign.imageUrls,
        scheduledAt: dupScheduledAt ? new Date(dupScheduledAt).toISOString() : campaign.scheduledAt,
        templateIds: dupMode === "template" ? dupTemplates : [],
        groupIds: dupMode === "groups" ? dupGroupIds : [],
      }),
    });
    setSaving(false);
    setMode("view");
    alert("הקמפיין שוכפל בהצלחה");
  }

  function startDuplicate() {
    if (!campaign) return;
    setDupContent(campaign.content || "");
    setDupScheduledAt(campaign.scheduledAt ? toLocalDatetime(campaign.scheduledAt) : "");
    setDupTemplates([]);
    setDupGroupIds([]);
    setDupMode("template");
    setMode("duplicate");
  }

  async function deleteCampaign() {
    if (!confirm("למחוק את הקמפיין לצמיתות?")) return;
    await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    router.push("/campaigns");
  }

  async function updateStatus(status: string, note?: string) {
    setSaving(true);
    await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...(note ? { rejectNote: note } : {}) }),
    });
    setSaving(false);
    fetchCampaign();
    setShowReject(false);
    setRejectNote("");
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">טוען...</div>;
  if (!campaign) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">לא נמצא</div>;

  const statusInfo = STATUS_LABELS[campaign.status] || { label: campaign.status, color: "text-gray-500" };
  const businessTemplates = templates.filter((t) => t.businessId === campaign.business.id);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-8" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/campaigns" className="text-gray-500 hover:text-gray-900">← קמפיינים</Link>
          <h1 className="text-2xl font-bold flex-1">{campaign.title}</h1>
          {mode === "view" && (
            <div className="flex gap-2">
              <button onClick={startEdit} className="text-sm bg-white border border-gray-300 hover:border-gray-400 rounded-xl px-4 py-2 transition-colors">✏️ ערוך</button>
              <button onClick={startDuplicate} className="text-sm bg-white border border-gray-300 hover:border-gray-400 rounded-xl px-4 py-2 transition-colors">📋 שכפל</button>
              <button onClick={deleteCampaign} className="text-sm bg-white border border-red-300 hover:bg-red-50 text-red-600 rounded-xl px-4 py-2 transition-colors">🗑️</button>
            </div>
          )}
        </div>

        {/* VIEW MODE */}
        {mode === "view" && (
          <>
            <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-5 flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-500">סטטוס: </span>
                <span className={`font-semibold ${statusInfo.color}`}>{statusInfo.label}</span>
              </div>
              <div className="text-sm text-gray-500">{campaign.business.name}</div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5">
              <div className="text-sm text-gray-500 mb-3">תוכן הפוסט</div>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{campaign.content}</pre>
              {(campaign.whatsappLink || campaign.emailLink) && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-1">
                  {campaign.whatsappLink && <div className="text-xs text-gray-500">וואטסאפ: <span className="text-green-600">{campaign.whatsappLink}</span></div>}
                  {campaign.emailLink && <div className="text-xs text-gray-500">מייל: <span className="text-blue-600">{campaign.emailLink}</span></div>}
                </div>
              )}
            </div>

            {campaign.scheduledAt && (
              <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-5 text-sm">
                <span className="text-gray-500">מתוזמן ל: </span>
                <span>{new Date(campaign.scheduledAt).toLocaleString("he-IL")}</span>
              </div>
            )}

            {campaign.status === "pending_approval" && (
              <div className="space-y-3 mb-5">
                {showReject ? (
                  <div className="bg-white border border-red-300 rounded-2xl p-5 space-y-3">
                    <div className="text-sm text-gray-500">הערה לדחייה (אופציונלי)</div>
                    <textarea
                      className="w-full bg-gray-100 border border-gray-300 rounded-xl p-3 text-gray-900 text-sm min-h-[80px]"
                      placeholder="למה דחית? מה לשנות?"
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                    />
                    <div className="flex gap-3">
                      <button onClick={() => setShowReject(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 rounded-xl p-3 transition-colors">ביטול</button>
                      <button onClick={() => updateStatus("draft", rejectNote)} disabled={saving} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl p-3 font-semibold transition-colors">
                        {saving ? "שומר..." : "דחה קמפיין"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button onClick={() => setShowReject(true)} className="flex-1 bg-white hover:bg-gray-100 border border-red-300 rounded-xl p-4 font-semibold transition-colors text-red-600">✗ דחה</button>
                    <button onClick={() => updateStatus("approved")} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl p-4 font-semibold transition-colors">
                      {saving ? "שומר..." : "✓ אשר ופרסם"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {(campaign.status === "approved" || campaign.status === "publishing") && (
              <button onClick={() => updateStatus("paused")} className="w-full bg-white hover:bg-gray-100 border border-yellow-400 text-yellow-600 rounded-xl p-4 font-semibold transition-colors mb-5">
                ⏸ השהה קמפיין
              </button>
            )}

            {campaign.status === "paused" && (
              <div className="mb-5 space-y-3">
                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                  <label className="block text-sm text-gray-500 mb-2">תאריך ושעה לפרסום</label>
                  <input
                    type="datetime-local"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-gray-900"
                    value={editScheduledAt}
                    onChange={(e) => setEditScheduledAt(e.target.value)}
                  />
                </div>
                <button onClick={async () => {
                  setSaving(true);
                  await fetch(`/api/campaigns/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      status: "approved",
                      ...(editScheduledAt ? { scheduledAt: new Date(editScheduledAt).toISOString() } : {}),
                    }),
                  });
                  setSaving(false);
                  fetchCampaign();
                }} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-4 font-semibold transition-colors">
                  {saving ? "שומר..." : "▶ המשך פרסום"}
                </button>
              </div>
            )}

            {campaign.posts.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-gray-500">
                    {campaign.posts.filter(p => p.status === "published").length}/{campaign.posts.length} קבוצות פורסמו
                  </div>
                  {campaign.posts.some(p => p.status === "failed") && (
                    <button
                      onClick={async () => {
                        await fetch(`/api/campaigns/${id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ retryFailed: true }),
                        });
                        fetchCampaign();
                      }}
                      className="text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      🔄 נסה שוב נכשלים
                    </button>
                  )}
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {campaign.posts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{p.groupName}</span>
                      <span className={p.status === "published" ? "text-green-600" : p.status === "failed" ? "text-red-600" : p.status === "running" ? "text-purple-600" : "text-gray-400"}>
                        {p.status === "published" ? "✓ פורסם" : p.status === "failed" ? "✗ נכשל" : p.status === "running" ? "⏳ מפרסם..." : "ממתין"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* EDIT MODE */}
        {mode === "edit" && (
          <div className="space-y-5">
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-500">תוכן הפוסט</label>
                <button
                  onClick={generateAI}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                >
                  {aiLoading ? "מייצר..." : "✨ צור עם AI"}
                </button>
              </div>
              <textarea
                className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-gray-900 text-sm min-h-[200px]"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
              {aiVersions && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs text-gray-500 font-medium">בחר גרסה:</div>
                  {[aiVersions.versionA, aiVersions.versionB].map((v, i) => (
                    <div key={i} className="border border-purple-200 rounded-xl p-3 bg-purple-50">
                      <pre className="whitespace-pre-wrap text-xs text-gray-800 font-sans leading-relaxed">{v}</pre>
                      <button
                        onClick={() => { setEditContent(v); setAiVersions(null); }}
                        className="mt-2 text-xs bg-purple-600 text-white px-3 py-1 rounded-lg hover:bg-purple-700"
                      >
                        השתמש בגרסה {i === 0 ? "א" : "ב"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <label className="block text-sm text-gray-500 mb-2">תאריך ושעה</label>
              <input
                type="datetime-local"
                className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-gray-900"
                value={editScheduledAt}
                onChange={(e) => setEditScheduledAt(e.target.value)}
              />
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <label className="flex items-center gap-3 cursor-pointer mb-4">
                <input type="checkbox" checked={editRecurring} onChange={(e) => setEditRecurring(e.target.checked)} className="w-4 h-4" />
                <span className="text-sm font-medium">תזמון חוזר (שבועי)</span>
              </label>
              {editRecurring && (
                <div className="space-y-4 pt-2 border-t border-gray-200">
                  <div>
                    <div className="text-sm text-gray-500 mb-2">ימים בשבוע</div>
                    <div className="flex flex-wrap gap-2">
                      {DAY_NAMES.map((name, i) => (
                        <button
                          key={i}
                          onClick={() => setEditDays(d => d.includes(i) ? d.filter(x => x !== i) : [...d, i])}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${editDays.includes(i) ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">שעה</label>
                      <input
                        type="time"
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 text-gray-900"
                        value={editTime}
                        onChange={(e) => setEditTime(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">מספר שבועות</label>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 text-gray-900"
                        value={editWeeks}
                        onChange={(e) => setEditWeeks(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  {editDays.length > 0 && (
                    <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                      יוצר {editDays.length * (editWeeks - 1)} קמפיינים נוספים
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <label className="block text-sm text-gray-500 mb-2">תמונות</label>
              {keepImageUrls.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {keepImageUrls.map((url, i) => (
                    <div key={i} className="relative">
                      <img src={url} className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                      <button
                        onClick={() => setKeepImageUrls(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-600"
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <span className="text-xl mb-1">🖼️</span>
                <span className="text-sm text-gray-500">הוסף תמונות נוספות</span>
                <input type="file" multiple accept="image/*" className="hidden" onChange={handleEditImageSelect} />
              </label>
              {editImagePreviews.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {editImagePreviews.map((src, i) => (
                    <div key={i} className="relative">
                      <img src={src} className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                      <button onClick={() => removeEditImage(i)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <label className="block text-sm text-gray-500 mb-3">תבניות קבוצות</label>
              <div className="space-y-2">
                {businessTemplates.length === 0 && <div className="text-sm text-gray-400">אין תבניות לעסק זה</div>}
                {businessTemplates.map((t) => (
                  <label key={t.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100">
                    <input
                      type="checkbox"
                      checked={editTemplateIds.includes(t.id)}
                      onChange={(e) => setEditTemplateIds(prev => e.target.checked ? [...prev, t.id] : prev.filter(x => x !== t.id))}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium flex-1">{t.name}</span>
                    <span className="text-xs text-gray-400">{t.groups.length} קבוצות</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setMode("view")} className="flex-1 bg-gray-100 hover:bg-gray-200 rounded-xl p-3 transition-colors">ביטול</button>
              <button onClick={saveEdit} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-3 font-semibold transition-colors">
                {saving ? "שומר..." : "שמור שינויים"}
              </button>
            </div>
          </div>
        )}

        {/* DUPLICATE MODE */}
        {mode === "duplicate" && (
          <div className="space-y-5">
            {/* Content */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <label className="block text-sm text-gray-500 mb-2">תוכן הפוסט</label>
              <textarea
                className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-gray-900 text-sm min-h-[160px]"
                value={dupContent}
                onChange={(e) => setDupContent(e.target.value)}
              />
            </div>

            {/* Date/time */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <label className="block text-sm text-gray-500 mb-2">תאריך ושעה</label>
              <input
                type="datetime-local"
                className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-gray-900"
                value={dupScheduledAt}
                onChange={(e) => setDupScheduledAt(e.target.value)}
              />
            </div>

            {/* Groups / Templates */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setDupMode("template")}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${dupMode === "template" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                >
                  תבניות
                </button>
                <button
                  onClick={() => setDupMode("groups")}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${dupMode === "groups" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                >
                  קבוצות בודדות
                </button>
              </div>

              {dupMode === "template" ? (
                <div className="space-y-2">
                  {businessTemplates.length === 0 && <div className="text-sm text-gray-400">אין תבניות לעסק זה</div>}
                  {businessTemplates.map((t) => (
                    <label key={t.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100">
                      <input
                        type="checkbox"
                        checked={dupTemplates.includes(t.id)}
                        onChange={(e) => setDupTemplates(d => e.target.checked ? [...d, t.id] : d.filter(x => x !== t.id))}
                        className="w-4 h-4"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{t.name}</div>
                        <div className="text-xs text-gray-500">{t.groups.length} קבוצות</div>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {allGroups.length === 0 && <div className="text-sm text-gray-400">אין קבוצות</div>}
                  {allGroups.map((g) => (
                    <label key={g.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100">
                      <input
                        type="checkbox"
                        checked={dupGroupIds.includes(g.id)}
                        onChange={(e) => setDupGroupIds(d => e.target.checked ? [...d, g.id] : d.filter(x => x !== g.id))}
                        className="w-4 h-4"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{g.name}</div>
                        {g.memberCount && <div className="text-xs text-gray-400">{g.memberCount.toLocaleString()} חברים</div>}
                      </div>
                    </label>
                  ))}
                </div>
              )}

              <div className="mt-3 text-xs text-gray-400">
                {dupMode === "template" ? `${dupTemplates.length} תבניות נבחרו` : `${dupGroupIds.length} קבוצות נבחרו`}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setMode("view")} className="flex-1 bg-gray-100 hover:bg-gray-200 rounded-xl p-3 transition-colors">ביטול</button>
              <button
                onClick={duplicateCampaign}
                disabled={saving || (dupMode === "template" ? dupTemplates.length === 0 : dupGroupIds.length === 0)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl p-3 font-semibold transition-colors"
              >
                {saving ? "משכפל..." : "שכפל קמפיין"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
