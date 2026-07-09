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


export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBusiness, setNewBusiness] = useState("");
  const [saving, setSaving] = useState(false);
  const [businessFilter, setBusinessFilterState] = useState(() => getBusinessFilter());
  const [deleting, setDeleting] = useState<string | null>(null);

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

  async function deleteTemplate(t: Template) {
    if (!confirm(`למחוק את התבנית "${t.name}" ואת כל ${t.groups.length} הקבוצות שלה?`)) return;
    setDeleting(t.id);
    await fetch(`/api/templates/${t.id}`, { method: "DELETE" });
    setDeleting(null);
    fetchTemplates();
  }

  async function deleteAll(filtered: Template[]) {
    if (!confirm(`למחוק את כל ${filtered.length} התבניות וכל הקבוצות שלהן? פעולה זו לא ניתנת לביטול.`)) return;
    for (const t of filtered) {
      await fetch(`/api/templates/${t.id}`, { method: "DELETE" });
    }
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
          <button onClick={() => setShowNew(true)} className="brand-gradient hover:opacity-90 text-white rounded-full px-5 py-2.5 font-semibold transition-opacity">
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
                <label className="block text-sm text-gray-700 mb-1">שם העסק</label>
                <input
                  className="w-full bg-gray-200 border border-gray-300 rounded-xl p-3 text-gray-900"
                  placeholder="לדוגמה: נויה מטבחים"
                  value={newBusiness}
                  onChange={(e) => setNewBusiness(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowNew(false)} className="flex-1 bg-gray-200 hover:bg-gray-300 rounded-xl p-3 transition-colors">
                  ביטול
                </button>
                <button onClick={createTemplate} disabled={!newName.trim() || saving} className="flex-1 brand-gradient hover:opacity-90 text-white disabled:opacity-40 rounded-full p-3 font-semibold transition-opacity">
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
            <>
              <div className="flex justify-end mb-3">
                <button
                  onClick={() => deleteAll(filtered)}
                  className="text-sm text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded-xl px-4 py-2 transition-colors"
                >
                  🗑 מחק הכל ({filtered.length})
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map((t) => (
                  <div key={t.id} className="relative group bg-gray-100 border border-gray-200 rounded-2xl p-5 hover:border-gray-400 transition-all">
                    <Link href={`/templates/${t.id}`} className="block">
                      <div className="flex items-start justify-between mb-2 pr-6">
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
                    <button
                      onClick={(e) => { e.preventDefault(); deleteTemplate(t); }}
                      disabled={deleting === t.id}
                      className="absolute top-3 left-3 text-gray-400 hover:text-red-500 transition-colors text-lg leading-none opacity-0 group-hover:opacity-100 disabled:opacity-50"
                      title="מחק תבנית"
                    >
                      {deleting === t.id ? "⏳" : "🗑"}
                    </button>
                  </div>
                ))}
              </div>
            </>
          );
        })()}
      </div>
    </main>
  );
}
