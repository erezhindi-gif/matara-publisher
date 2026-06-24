"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Group = {
  id: string;
  name: string;
  memberCount: number | null;
  fbGroupId: string;
};

type Template = {
  id: string;
  name: string;
  business: { name: string };
  groups: Group[];
};

export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", memberCount: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchTemplate(); }, [id]);

  function fetchTemplate() {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => {
        const t = data.find((t: Template) => t.id === id);
        setTemplate(t || null);
        setLoading(false);
      });
  }

  async function addGroup() {
    if (!form.name.trim()) return;
    setSaving(true);
    await fetch(`/api/templates/${id}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        memberCount: form.memberCount ? parseInt(form.memberCount) : null,
      }),
    });
    setForm({ name: "", memberCount: "" });
    setShowAdd(false);
    setSaving(false);
    fetchTemplate();
  }

  async function removeGroup(groupId: string) {
    await fetch(`/api/templates/${id}/groups`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId }),
    });
    fetchTemplate();
  }

  if (loading) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">טוען...</div>;
  if (!template) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">לא נמצא</div>;

  const totalMembers = template.groups.reduce((sum, g) => sum + (g.memberCount || 0), 0);

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/templates" className="text-gray-400 hover:text-white">← תבניות</Link>
          <div>
            <h1 className="text-2xl font-bold">{template.name}</h1>
            <span className="text-sm text-gray-500">{template.business.name}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{template.groups.length}</div>
            <div className="text-xs text-gray-500">קבוצות</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{totalMembers.toLocaleString()}</div>
            <div className="text-xs text-gray-500">סה"כ חברים</div>
          </div>
        </div>

        {/* Add group */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold">קבוצות בתבנית</h2>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-blue-600 hover:bg-blue-700 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
          >
            + הוסף קבוצה
          </button>
        </div>

        {showAdd && (
          <div className="bg-gray-900 border border-blue-500 rounded-2xl p-5 mb-4 space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">שם הקבוצה</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white"
                placeholder="למשל: דרושים נתניה והסביבה"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">מספר חברים (אופציונלי)</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white"
                placeholder="למשל: 15000"
                type="number"
                value={form.memberCount}
                onChange={(e) => setForm({ ...form, memberCount: e.target.value })}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 rounded-xl p-3 transition-colors">
                ביטול
              </button>
              <button
                onClick={addGroup}
                disabled={!form.name.trim() || saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-xl p-3 font-semibold transition-colors"
              >
                {saving ? "שומר..." : "הוסף"}
              </button>
            </div>
          </div>
        )}

        {template.groups.length === 0 ? (
          <div className="text-center text-gray-500 py-16 bg-gray-900 rounded-2xl border border-gray-800">
            <p>אין קבוצות עדיין</p>
            <p className="text-sm mt-1">הוסף קבוצות פייסבוק לתבנית זו</p>
          </div>
        ) : (
          <div className="space-y-2">
            {template.groups.map((g) => (
              <div key={g.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{g.name}</div>
                  {g.memberCount && (
                    <div className="text-xs text-gray-500">{g.memberCount.toLocaleString()} חברים</div>
                  )}
                </div>
                <button
                  onClick={() => removeGroup(g.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors text-lg"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
