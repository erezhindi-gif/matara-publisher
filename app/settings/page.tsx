"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ContactLink = {
  id: string;
  label: string;
  type: "whatsapp" | "email";
  value: string;
  businessId: string;
  isDefault: boolean;
};

const BUSINESSES = [
  { id: "recruitment", name: "מטרה - גיוס והשמה" },
  { id: "carpentry", name: "נויה מטבחים" },
];

export default function SettingsPage() {
  const [links, setLinks] = useState<ContactLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ label: "", type: "whatsapp", value: "", businessId: "recruitment", isDefault: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchLinks(); }, []);

  function fetchLinks() {
    fetch("/api/settings").then((r) => r.json()).then((d) => { setLinks(d); setLoading(false); });
  }

  async function createLink() {
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setShowNew(false);
    setForm({ label: "", type: "whatsapp", value: "", businessId: "recruitment", isDefault: false });
    fetchLinks();
  }

  async function deleteLink(id: string) {
    await fetch("/api/settings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchLinks();
  }

  const byBusiness = BUSINESSES.map((b) => ({
    ...b,
    links: links.filter((l) => l.businessId === b.id),
  }));

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="text-gray-400 hover:text-white">← ראשי</Link>
          <h1 className="text-2xl font-bold">הגדרות</h1>
        </div>

        {/* Contact Links */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">קישורי וואטסאפ ומייל</h2>
            <button
              onClick={() => setShowNew(true)}
              className="bg-blue-600 hover:bg-blue-700 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
            >
              + הוסף קישור
            </button>
          </div>

          {showNew && (
            <div className="bg-gray-900 border border-blue-500 rounded-2xl p-5 mb-4 space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">שם תצוגה</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white"
                  placeholder='למשל: "וואטסאפ גיוס ראשי"'
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">סוג</label>
                  <select
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    <option value="whatsapp">וואטסאפ</option>
                    <option value="email">מייל</option>
                  </select>
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
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  {form.type === "whatsapp" ? "קישור וואטסאפ" : "כתובת מייל"}
                </label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white"
                  placeholder={form.type === "whatsapp" ? "https://wa.me/972..." : "jobs@example.com"}
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  dir="ltr"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-400">ברירת מחדל לעסק זה</span>
              </label>
              <div className="flex gap-3">
                <button onClick={() => setShowNew(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 rounded-xl p-3 transition-colors">
                  ביטול
                </button>
                <button
                  onClick={createLink}
                  disabled={!form.label || !form.value || saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-xl p-3 font-semibold transition-colors"
                >
                  {saving ? "שומר..." : "שמור"}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-gray-500 text-center py-10">טוען...</div>
          ) : (
            <div className="space-y-6">
              {byBusiness.map((b) => (
                <div key={b.id}>
                  <div className="text-sm font-semibold text-gray-400 mb-2">{b.name}</div>
                  {b.links.length === 0 ? (
                    <div className="text-sm text-gray-600 bg-gray-900 rounded-xl p-4">אין קישורים עדיין</div>
                  ) : (
                    <div className="space-y-2">
                      {b.links.map((l) => (
                        <div key={l.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{l.label}</span>
                              {l.isDefault && (
                                <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">ברירת מחדל</span>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded-full ${l.type === "whatsapp" ? "bg-green-900 text-green-300" : "bg-blue-900 text-blue-300"}`}>
                                {l.type === "whatsapp" ? "וואטסאפ" : "מייל"}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1 dir-ltr text-left">{l.value}</div>
                          </div>
                          <button
                            onClick={() => deleteLink(l.id)}
                            className="text-gray-600 hover:text-red-400 transition-colors text-lg"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Profiles section - placeholder */}
        <div>
          <h2 className="text-lg font-semibold mb-4">פרופילי פייסבוק</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-center text-gray-500">
            <p>ניהול פרופילי פייסבוק יתווסף בשלב הבא</p>
          </div>
        </div>
      </div>
    </main>
  );
}
