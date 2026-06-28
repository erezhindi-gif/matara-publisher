"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBusinessFilter } from "@/lib/businessFilter";

type Template = {
  id: string;
  name: string;
  business: { name: string; type: string };
  groups: { id: string; name: string; memberCount: number | null }[];
  userId: string | null;
};

const BUSINESSES = [
  { id: "recruitment", name: "מטרה - גיוס והשמה" },
  { id: "carpentry", name: "נויה מטבחים" },
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBusiness, setNewBusiness] = useState("recruitment");
  const [saving, setSaving] = useState(false);
  const [businessFilter, setBusinessFilterState] = useState("all");

  useEffect(() => {
    setBusinessFilterState(getBusinessFilter());
    const handler = () => setBusinessFilterState(getBusinessFilter());
    window.addEventListener("businessFilterChange", handler);
    return () => window.removeEventListener("businessFilterChange", handler);
  }, []);

  useEffect(() => { fetchTemplates(); }, []);

  function fetchTemplates() {
    fetch("/api/templates").then((r) => r.json()).then((data) => {
      setTemplates(data);
      setLoading(false);
    });
  }

  async function createTemplate() {
    if (!newName.trim()) return;
    setSaving(true);
    await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, businessId: newBusiness }),
    });
    setNewName("");
    setShowNew(false);
    setSaving(false);
    fetchTemplates();
  }

  return (
    <main className="min-h-screen bg-white text-gray-900 p-8" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-700 hover:text-gray-900">← ראשי</Link>
            <h1 className="text-2xl font-bold">תבניות קבוצות</h1>
          </div>
          <button onClick={() => setShowNew(true)} className="bg-blue-600 hover:bg-blue-700 rounded-xl px-5 py-2.5 font-semibold transition-colors">
            + תבנית חדשה
          </button>
        </div>

        {showNew && (
          <div className="bg-gray-100 border border-blue-500 rounded-2xl p-5 mb-6">
            <h2 className="font-semibold mb-4">תבנית חדשה</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">שם התבנית</label>
                <input
                  className="w-full bg-gray-200 border border-gray-300 rounded-xl p-3 text-gray-900"
                  placeholder="למשל: כפר סבא, חשמלאים, מרכז"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">עסק</label>
                <select
                  className="w-full bg-gray-200 border border-gray-300 rounded-xl p-3 text-gray-900"
                  value={newBusiness}
                  onChange={(e) => setNewBusiness(e.target.value)}
                >
                  {BUSINESSES.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowNew(false)} className="flex-1 bg-gray-200 hover:bg-gray-300 rounded-xl p-3 transition-colors">
                  ביטול
                </button>
                <button onClick={createTemplate} disabled={!newName.trim() || saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 rounded-xl p-3 font-semibold transition-colors">
                  {saving ? "שומר..." : "צור תבנית"}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && <div className="text-center text-gray-500 py-20">טוען...</div>}

        {!loading && (() => {
          const filtered = businessFilter === "all" ? templates : templates.filter((t) => t.userId === businessFilter);
          return filtered.length === 0 ? (
            <div className="text-center text-gray-500 py-20">
              <div className="text-5xl mb-4">📁</div>
              <p>אין תבניות עדיין</p>
              <p className="text-sm mt-2">צור תבנית לפי אזור או תחום מקצועי</p>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((t) => (
              <Link key={t.id} href={`/templates/${t.id}`} className="block bg-gray-100 border border-gray-200 rounded-2xl p-5 hover:border-gray-600 transition-all">
                <div className="flex items-start justify-between mb-2">
                  <h2 className="font-semibold text-lg">{t.name}</h2>
                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">{t.business.name}</span>
                </div>
                <p className="text-gray-700 text-sm">
                  {t.groups.length > 0 ? `${t.groups.length} קבוצות` : "אין קבוצות עדיין"}
                </p>
                {t.groups.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {t.groups.slice(0, 3).map((g) => (
                      <div key={g.id} className="text-xs text-gray-500 flex justify-between">
                        <span>{g.name}</span>
                        {g.memberCount && <span>{g.memberCount.toLocaleString()} חברים</span>}
                      </div>
                    ))}
                    {t.groups.length > 3 && (
                      <div className="text-xs text-gray-700">+{t.groups.length - 3} נוספות</div>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
          );
        })()}
      </div>
    </main>
  );
}
