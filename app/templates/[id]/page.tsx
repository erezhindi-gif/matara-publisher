"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
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
  business: { name: string; id: string };
  groups: Group[];
};

export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
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

  async function openPicker() {
    setShowPicker(true);
    setLoadingGroups(true);
    setSearch("");
    setSelected(new Set());
    // טען את כל התבניות כדי לשלוף את כל הקבוצות
    const res = await fetch("/api/templates");
    const templates: Template[] = await res.json();
    const seen = new Set<string>();
    const groups: Group[] = [];
    for (const t of templates) {
      for (const g of t.groups) {
        if (!seen.has(g.fbGroupId)) {
          seen.add(g.fbGroupId);
          groups.push(g);
        }
      }
    }
    // הסר קבוצות שכבר בתבנית
    const inTemplate = new Set(template?.groups.map((g) => g.fbGroupId) || []);
    setAllGroups(groups.filter((g) => !inTemplate.has(g.fbGroupId)));
    setLoadingGroups(false);
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return allGroups;
    const q = search.toLowerCase();
    return allGroups.filter((g) => g.name.toLowerCase().includes(q));
  }, [allGroups, search]);

  function toggleGroup(fbGroupId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fbGroupId)) next.delete(fbGroupId);
      else next.add(fbGroupId);
      return next;
    });
  }

  async function addSelected() {
    if (selected.size === 0) return;
    setSaving(true);
    const toAdd = allGroups.filter((g) => selected.has(g.fbGroupId));
    for (const g of toAdd) {
      await fetch(`/api/templates/${id}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: g.name, memberCount: g.memberCount, fbGroupId: g.fbGroupId }),
      });
    }
    setSaving(false);
    setShowPicker(false);
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

        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold">קבוצות בתבנית</h2>
          <button
            onClick={openPicker}
            className="bg-blue-600 hover:bg-blue-700 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
          >
            + הוסף קבוצות
          </button>
        </div>

        {/* Picker מודאל */}
        {showPicker && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: "80vh" }}>
              <div className="p-4 border-b border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">בחר קבוצות להוספה</h3>
                  <button onClick={() => setShowPicker(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
                </div>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white text-sm"
                  placeholder="חפש קבוצה..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
                {selected.size > 0 && (
                  <div className="text-xs text-blue-400 mt-2">נבחרו {selected.size} קבוצות</div>
                )}
              </div>

              <div className="overflow-y-auto flex-1 p-2">
                {loadingGroups ? (
                  <div className="text-center text-gray-500 py-8">טוען קבוצות...</div>
                ) : filtered.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">לא נמצאו קבוצות</div>
                ) : (
                  filtered.map((g) => (
                    <div
                      key={g.fbGroupId}
                      onClick={() => toggleGroup(g.fbGroupId)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors mb-1 ${
                        selected.has(g.fbGroupId) ? "bg-blue-600/30 border border-blue-500/50" : "hover:bg-gray-800"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                        selected.has(g.fbGroupId) ? "bg-blue-600 border-blue-600" : "border-gray-600"
                      }`}>
                        {selected.has(g.fbGroupId) && <span className="text-xs">✓</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{g.name}</div>
                        {g.memberCount && <div className="text-xs text-gray-500">{g.memberCount.toLocaleString()} חברים</div>}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 border-t border-gray-800 flex gap-3">
                <button onClick={() => setShowPicker(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 rounded-xl p-3 text-sm transition-colors">
                  ביטול
                </button>
                <button
                  onClick={addSelected}
                  disabled={selected.size === 0 || saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl p-3 text-sm font-semibold transition-colors"
                >
                  {saving ? "מוסיף..." : `הוסף ${selected.size > 0 ? selected.size : ""} קבוצות`}
                </button>
              </div>
            </div>
          </div>
        )}

        {template.groups.length === 0 ? (
          <div className="text-center text-gray-500 py-16 bg-gray-900 rounded-2xl border border-gray-800">
            <p>אין קבוצות עדיין</p>
            <p className="text-sm mt-1">לחץ על "הוסף קבוצות" כדי לבחור מהקבוצות המסונכרנות</p>
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
