"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Profile = {
  id: string;
  name: string;
  fbUsername: string;
  edgeProfile: string;
  dailyLimit: number;
  postsToday: number;
  isActive: boolean;
  business: { name: string; type: string };
};

const BUSINESSES = [
  { id: "recruitment", name: "מטרה - גיוס והשמה" },
  { id: "carpentry", name: "נויה מטבחים" },
];

const EDGE_PROFILES = [
  { value: "Default", label: "פרופיל ראשי (Default)" },
  { value: "Profile 1", label: "פרופיל 2 (Profile 1)" },
  { value: "Profile 2", label: "פרופיל 3 (Profile 2)" },
  { value: "Profile 3", label: "פרופיל 4 (Profile 3)" },
];

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    fbUsername: "",
    edgeProfile: "Default",
    businessId: "recruitment",
    dailyLimit: 150,
  });

  useEffect(() => { fetchProfiles(); }, []);

  function fetchProfiles() {
    fetch("/api/profiles").then((r) => r.json()).then((data) => {
      setProfiles(data);
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
    setForm({ name: "", fbUsername: "", edgeProfile: "Default", businessId: "recruitment", dailyLimit: 150 });
    setShowNew(false);
    setSaving(false);
    fetchProfiles();
  }

  async function deleteProfile(id: string) {
    if (!confirm("למחוק פרופיל זה?")) return;
    await fetch(`/api/profiles/${id}`, { method: "DELETE" });
    fetchProfiles();
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8" dir="rtl">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-white">← ראשי</Link>
            <h1 className="text-2xl font-bold">פרופילי פייסבוק</h1>
          </div>
          <button onClick={() => setShowNew(true)} className="bg-blue-600 hover:bg-blue-700 rounded-xl px-5 py-2.5 font-semibold transition-colors">
            + הוסף פרופיל
          </button>
        </div>

        <div className="bg-blue-950/20 border border-blue-800/40 rounded-2xl p-4 mb-6 text-sm text-blue-300">
          כל פרופיל מחובר לפרופיל Edge שבו פייסבוק כבר מחובר.
          <br />
          הסקריפט המקומי ישתמש בפרופיל הנכון לכל עסק.
        </div>

        {showNew && (
          <div className="bg-gray-900 border border-blue-500 rounded-2xl p-5 mb-6">
            <h2 className="font-semibold mb-4">פרופיל חדש</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">שם (לזיהוי)</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white"
                  placeholder="למשל: אריאל - גיוס"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">שם משתמש פייסבוק</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white"
                  placeholder="למשל: ariel.cohen"
                  value={form.fbUsername}
                  onChange={(e) => setForm({ ...form, fbUsername: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">עסק</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white"
                  value={form.businessId}
                  onChange={(e) => setForm({ ...form, businessId: e.target.value })}
                >
                  {BUSINESSES.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">פרופיל Edge</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white"
                  value={form.edgeProfile}
                  onChange={(e) => setForm({ ...form, edgeProfile: e.target.value })}
                >
                  {EDGE_PROFILES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  בחר את פרופיל Edge שבו פייסבוק מחובר לחשבון הרלוונטי
                </p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">מגבלה יומית (קבוצות)</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white"
                  type="number"
                  value={form.dailyLimit}
                  onChange={(e) => setForm({ ...form, dailyLimit: parseInt(e.target.value) || 150 })}
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowNew(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 rounded-xl p-3 transition-colors">
                  ביטול
                </button>
                <button
                  onClick={createProfile}
                  disabled={!form.name.trim() || !form.fbUsername.trim() || saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-xl p-3 font-semibold transition-colors"
                >
                  {saving ? "שומר..." : "הוסף פרופיל"}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && <div className="text-center text-gray-500 py-20">טוען...</div>}

        {!loading && profiles.length === 0 && (
          <div className="text-center text-gray-500 py-20">
            <div className="text-5xl mb-4">👤</div>
            <p>אין פרופילים עדיין</p>
            <p className="text-sm mt-2">הוסף את פרופילי הפייסבוק שישמשו לפרסום</p>
          </div>
        )}

        {!loading && profiles.length > 0 && (
          <div className="space-y-3">
            {profiles.map((p) => (
              <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="font-semibold">{p.name}</h2>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.isActive ? "bg-green-900/50 text-green-400" : "bg-gray-800 text-gray-500"}`}>
                        {p.isActive ? "פעיל" : "מושבת"}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400">@{p.fbUsername}</div>
                    <div className="text-xs text-gray-500 mt-1">{p.business.name}</div>
                  </div>
                  <button onClick={() => deleteProfile(p.id)} className="text-gray-600 hover:text-red-400 transition-colors text-lg">
                    ✕
                  </button>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-800 flex gap-4 text-xs text-gray-500">
                  <span>Edge: {p.edgeProfile}</span>
                  <span>מגבלה: {p.dailyLimit} קבוצות/יום</span>
                  <span>היום: {p.postsToday}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
