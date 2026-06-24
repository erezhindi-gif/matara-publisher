"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBusinessFilter } from "@/lib/businessFilter";

type Profile = {
  id: string;
  name: string;
  fbUsername: string;
  edgeProfile: string;
  dailyLimit: number;
  postsToday: number;
  isActive: boolean;
  whatsappPhone: string | null;
  business: { name: string; type: string };
};

const BUSINESSES = [
  { id: "recruitment", name: "מטרה - גיוס והשמה" },
  { id: "carpentry", name: "נויה מטבחים" },
];

const EDGE_PROFILES = [
  { value: "Default",   label: "פרופיל ראשי (Default)" },
  { value: "Profile 1", label: "פרופיל 2 (Profile 1)" },
  { value: "Profile 2", label: "פרופיל 3 (Profile 2)" },
  { value: "Profile 3", label: "פרופיל 4 (Profile 3)" },
];

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", fbUsername: "", edgeProfile: "Default", businessId: "recruitment", dailyLimit: 150, whatsappPhone: "" });
  const [businessFilter, setBusinessFilterState] = useState("all");
  const [waStatus, setWaStatus] = useState<Record<string, { status: string; qrDataUrl: string | null }>>({});
  const [waQrProfile, setWaQrProfile] = useState<string | null>(null);

  useEffect(() => {
    const fetchWaStatus = () => {
      fetch("http://localhost:3333/whatsapp-status")
        .then((r) => r.json())
        .then(setWaStatus)
        .catch(() => {});
    };
    fetchWaStatus();
    const interval = setInterval(fetchWaStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  async function connectWhatsApp(profileId: string) {
    setWaQrProfile(profileId);
    await fetch("http://localhost:3333/whatsapp-connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId }),
    }).catch(() => {});
  }

  useEffect(() => {
    setBusinessFilterState(getBusinessFilter());
    const handler = () => setBusinessFilterState(getBusinessFilter());
    window.addEventListener("businessFilterChange", handler);
    return () => window.removeEventListener("businessFilterChange", handler);
  }, []);

  useEffect(() => { fetchProfiles(); }, []);

  function fetchProfiles() {
    fetch("/api/profiles").then((r) => r.json()).then((data) => {
      setProfiles(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }

  async function createProfile() {
    if (!form.name.trim() || !form.fbUsername.trim()) return;
    setSaving(true);
    await fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ name: "", fbUsername: "", edgeProfile: "Default", businessId: "recruitment", dailyLimit: 150, whatsappPhone: "" });
    setShowNew(false);
    setSaving(false);
    fetchProfiles();
  }

  async function toggleActive(p: Profile) {
    await fetch(`/api/profiles/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    fetchProfiles();
  }

  async function deleteProfile(id: string) {
    if (!confirm("למחוק פרופיל זה?")) return;
    await fetch(`/api/profiles/${id}`, { method: "DELETE" });
    fetchProfiles();
  }

  const filtered = businessFilter === "all" ? profiles : profiles.filter((p) => p.business.type === businessFilter);
  const active = filtered.filter((p) => p.isActive).length;
  const todayTotal = filtered.reduce((sum, p) => sum + (p.postsToday || 0), 0);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900" dir="rtl">
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-gray-700 text-sm">← ראשי</Link>
            <h1 className="text-xl font-bold">פרופילי פייסבוק</h1>
          </div>
          <button onClick={() => setShowNew(true)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors">
            + הוסף פרופיל
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{filtered.length}</div>
            <div className="text-xs text-gray-500 mt-1">פרופילים</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{active}</div>
            <div className="text-xs text-gray-500 mt-1">פעילים</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{todayTotal}</div>
            <div className="text-xs text-gray-500 mt-1">פרסומים היום</div>
          </div>
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 text-sm text-blue-700">
          כל פרופיל מחובר לפרופיל Edge שבו פייסבוק כבר מחובר. הסקריפט המקומי ישתמש בפרופיל הנכון לכל עסק.
        </div>

        {/* New profile form */}
        {showNew && (
          <div className="bg-white border border-blue-400 rounded-2xl p-5 mb-6 shadow-sm">
            <h2 className="font-semibold mb-4 text-gray-900">פרופיל חדש</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">שם לזיהוי</label>
                <input className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-gray-900" placeholder="למשל: אריאל - גיוס" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">שם משתמש פייסבוק</label>
                <input className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-gray-900" placeholder="ariel.cohen" value={form.fbUsername} onChange={(e) => setForm({ ...form, fbUsername: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">עסק</label>
                  <select className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-gray-900" value={form.businessId} onChange={(e) => setForm({ ...form, businessId: e.target.value })}>
                    {BUSINESSES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">פרופיל Edge</label>
                  <select className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-gray-900" value={form.edgeProfile} onChange={(e) => setForm({ ...form, edgeProfile: e.target.value })}>
                    {EDGE_PROFILES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">מגבלה יומית (קבוצות)</label>
                <input className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-gray-900" type="number" max={300} value={form.dailyLimit} onChange={(e) => setForm({ ...form, dailyLimit: parseInt(e.target.value) || 150 })} />
                <p className="text-xs text-gray-400 mt-1">מקסימום 300 ביום לפי מגבלת פייסבוק</p>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">מספר וואטסאפ לאישורים</label>
                <input
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-gray-900"
                  placeholder="050-0000000"
                  value={form.whatsappPhone}
                  onChange={(e) => setForm({ ...form, whatsappPhone: e.target.value })}
                  dir="ltr"
                />
                <p className="text-xs text-gray-400 mt-1">ההודעה תישלח למספר זה כשקמפיין מחכה לאישור</p>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowNew(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 rounded-xl p-3 text-sm transition-colors">ביטול</button>
                <button onClick={createProfile} disabled={!form.name.trim() || !form.fbUsername.trim() || saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl p-3 text-sm font-semibold transition-colors">
                  {saving ? "שומר..." : "הוסף פרופיל"}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && <div className="text-center text-gray-400 py-20">טוען...</div>}

        {!loading && filtered.length === 0 && (
          <div className="text-center text-gray-400 py-20">
            <div className="text-5xl mb-4">👤</div>
            <p className="font-medium">אין פרופילים עדיין</p>
            <p className="text-sm mt-1">הוסף את פרופילי הפייסבוק שישמשו לפרסום</p>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((p) => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <h2 className="font-semibold">{p.name}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {p.isActive ? "פעיל" : "מושבת"}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">@{p.fbUsername}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{p.business.name}</div>
                  {p.whatsappPhone && <div className="text-xs text-green-600 mt-0.5">📱 {p.whatsappPhone}</div>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleActive(p)} className={`text-xs rounded-lg px-3 py-1.5 transition-colors ${p.isActive ? "bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600" : "bg-green-50 hover:bg-green-100 text-green-600"}`}>
                    {p.isActive ? "השבת" : "הפעל"}
                  </button>
                  <button onClick={() => deleteProfile(p.id)} className="text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded-lg px-3 py-1.5 transition-colors">מחק</button>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>Edge: <span className="font-medium text-gray-700">{p.edgeProfile}</span></span>
                  <span>מגבלה: <span className="font-medium text-gray-700">{p.dailyLimit}</span>/יום</span>
                  <span>היום: <span className={`font-medium ${(p.postsToday || 0) > p.dailyLimit * 0.8 ? "text-red-600" : "text-gray-700"}`}>{p.postsToday || 0}</span></span>
                </div>
                {/* וואטסאפ */}
                {(() => {
                  const wa = waStatus[p.id];
                  const status = wa?.status;
                  if (status === "connected") return (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                      <span className="w-2 h-2 bg-green-500 rounded-full inline-block" /> וואטסאפ מחובר
                    </span>
                  );
                  if (status === "qr_ready" && wa?.qrDataUrl) return (
                    <div className="flex flex-col items-center gap-1">
                      <img src={wa.qrDataUrl} className="w-24 h-24 rounded-lg border border-gray-200" />
                      <span className="text-xs text-gray-500">סרוק עם הטלפון</span>
                    </div>
                  );
                  if (status === "connecting") return (
                    <span className="text-xs text-yellow-600">מתחבר...</span>
                  );
                  return (
                    <button onClick={() => connectWhatsApp(p.id)} className="flex items-center gap-1.5 text-xs bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg px-3 py-1.5 transition-colors">
                      📱 חבר וואטסאפ
                    </button>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
