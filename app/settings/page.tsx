"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBusinessFilter } from "@/lib/businessFilter";

type ContactLink = {
  id: string;
  label: string;
  type: "whatsapp" | "email";
  value: string;
  businessId: string;
  isDefault: boolean;
};

type Business = { id: string; name: string; type: string };

export default function SettingsPage() {
  const [links, setLinks] = useState<ContactLink[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [businessFilter, setBusinessFilterState] = useState(() => getBusinessFilter());
  const [form, setForm] = useState({ label: "", type: "whatsapp", value: "", businessId: "", isDefault: false });
  const [saving, setSaving] = useState(false);
  const [apiToken, setApiToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  useEffect(() => {
    const handler = () => setBusinessFilterState(getBusinessFilter());
    window.addEventListener("businessFilterChange", handler);
    return () => window.removeEventListener("businessFilterChange", handler);
  }, []);

  useEffect(() => {
    fetch("/api/extension/token").then((r) => r.json()).then((d) => {
      if (d.token) setApiToken(d.token);
    });
  }, []);

  async function regenerateToken() {
    const res = await fetch("/api/extension/token", { method: "POST" });
    const d = await res.json();
    if (d.token) setApiToken(d.token);
  }

  async function copyToken() {
    if (!apiToken) return;
    await navigator.clipboard.writeText(apiToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/businesses").then((r) => r.json()),
    ]).then(([l, b]) => {
      setLinks(Array.isArray(l) ? l : []);
      const bList = Array.isArray(b) ? b : [];
      setBusinesses(bList);
      if (bList.length > 0) setForm((f) => ({ ...f, businessId: bList[0].id }));
      setLoading(false);
    });
  }, []);

  // filter businesses by sidebar selection
  const visibleBusinesses = businessFilter === "all"
    ? businesses
    : businesses.filter((b) => b.type === businessFilter);

  function fetchLinks() {
    fetch("/api/settings").then((r) => r.json()).then((d) => setLinks(Array.isArray(d) ? d : []));
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

  const byBusiness = visibleBusinesses.map((b) => ({
    ...b,
    links: links.filter((l) => l.businessId === b.id),
  }));

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-8" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="text-gray-500 hover:text-gray-900">← ראשי</Link>
          <h1 className="text-2xl font-bold">הגדרות</h1>
        </div>

        {/* Contact Links */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">קישורי וואטסאפ ומייל</h2>
            <button
              onClick={() => { setShowNew(true); if (visibleBusinesses.length > 0) setForm((f) => ({ ...f, businessId: visibleBusinesses[0].id })); }}
              className="brand-gradient hover:opacity-90 text-white rounded-full px-4 py-2 text-sm font-semibold transition-opacity"
            >
              + הוסף קישור
            </button>
          </div>

          {showNew && (
            <div className="bg-white border border-blue-300 rounded-2xl p-5 mb-4 space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">שם תצוגה</label>
                <input
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-gray-900"
                  placeholder='למשל: "וואטסאפ גיוס ראשי"'
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">סוג</label>
                  <select
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-gray-900"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    <option value="whatsapp">וואטסאפ</option>
                    <option value="email">מייל</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">עסק</label>
                  <select
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-gray-900"
                    value={form.businessId}
                    onChange={(e) => setForm({ ...form, businessId: e.target.value })}
                  >
                    {visibleBusinesses.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  {form.type === "whatsapp" ? "קישור וואטסאפ" : "כתובת מייל"}
                </label>
                <input
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-gray-900"
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
                <span className="text-sm text-gray-600">ברירת מחדל לעסק זה</span>
              </label>
              <div className="flex gap-3">
                <button onClick={() => setShowNew(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 rounded-xl p-3 transition-colors">
                  ביטול
                </button>
                <button
                  onClick={createLink}
                  disabled={!form.label || !form.value || saving}
                  className="flex-1 brand-gradient hover:opacity-90 disabled:opacity-40 text-white rounded-full p-3 font-semibold transition-opacity"
                >
                  {saving ? "שומר..." : "שמור"}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-gray-400 text-center py-10">טוען...</div>
          ) : (
            <div className="space-y-6">
              {byBusiness.map((b) => (
                <div key={b.id}>
                  {visibleBusinesses.length > 1 && (
                    <div className="text-sm font-semibold text-gray-600 mb-2">{b.name}</div>
                  )}
                  {b.links.length === 0 ? (
                    <div className="text-sm text-gray-400 bg-white border border-gray-200 rounded-xl p-4">אין קישורים עדיין</div>
                  ) : (
                    <div className="space-y-2">
                      {b.links.map((l) => (
                        <div key={l.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{l.label}</span>
                              {l.isDefault && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">ברירת מחדל</span>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded-full ${l.type === "whatsapp" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                                {l.type === "whatsapp" ? "וואטסאפ" : "מייל"}
                              </span>
                            </div>
                            <div className="text-xs text-gray-400 mt-1" dir="ltr">{l.value}</div>
                          </div>
                          <button onClick={() => deleteLink(l.id)} className="text-gray-300 hover:text-red-500 transition-colors text-lg">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Extension Token */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-2">תוסף Chrome - קוד אישי</h2>
          <p className="text-sm text-gray-500 mb-4">העתק את הקוד הזה והדבק בתוסף Matara Publisher בדפדפן שלך.</p>
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            {apiToken ? (
              <div className="space-y-3">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 font-mono text-xs text-gray-700 break-all" dir="ltr">
                  {apiToken}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={copyToken}
                    className="flex-1 brand-gradient hover:opacity-90 text-white rounded-full p-3 font-semibold text-sm transition-opacity"
                  >
                    {tokenCopied ? "✓ הועתק!" : "העתק קוד"}
                  </button>
                  <button
                    onClick={regenerateToken}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl p-3 text-sm transition-colors"
                  >
                    צור קוד חדש
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-gray-400 text-sm text-center py-4">טוען...</div>
            )}
          </div>
        </div>

        {/* Profiles shortcut */}
        <div>
          <h2 className="text-lg font-semibold mb-4">פרופילי פייסבוק</h2>
          <Link href="/profiles" className="block bg-white border border-gray-200 rounded-2xl p-5 text-center text-blue-600 hover:border-blue-300 transition-colors">
            ניהול פרופילי פייסבוק ←
          </Link>
        </div>
      </div>
    </main>
  );
}
