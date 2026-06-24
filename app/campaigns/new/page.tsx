"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const BUSINESSES = [
  { id: "recruitment", name: "מטרה - גיוס והשמה", type: "recruitment" },
  { id: "carpentry", name: "נויה מטבחים", type: "carpentry" },
];

type ContactLink = {
  id: string;
  label: string;
  type: string;
  value: string;
  businessId: string;
  isDefault: boolean;
};

type Template = {
  id: string;
  name: string;
  businessId: string;
  groups: { id: string }[];
};

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "versions" | "templates" | "schedule">("form");
  const [loading, setLoading] = useState(false);
  const [contactLinks, setContactLinks] = useState<ContactLink[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setContactLinks);
    fetch("/api/templates").then((r) => r.json()).then(setTemplates);
  }, []);

  const [form, setForm] = useState({
    businessId: "recruitment",
    jobTitle: "",
    location: "",
    whatsappLink: "",
    emailLink: "",
    rawContent: "",
  });

  const [versions, setVersions] = useState<{ versionA: string; versionB: string } | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<"A" | "B" | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const selectedBusiness = BUSINESSES.find((b) => b.id === form.businessId)!;

  async function generateVersions() {
    // כרגע כותבים ידנית - בעתיד יחליף סוכן AI
    setVersions({
      versionA: form.rawContent,
      versionB: form.rawContent,
    });
    setStep("versions");
  }

  function selectVersion(v: "A" | "B") {
    setSelectedVersion(v);
    setEditedContent(v === "A" ? versions!.versionA : versions!.versionB);
  }

  async function saveCampaign() {
    setLoading(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: form.businessId,
          title: form.jobTitle,
          content: editedContent,
          whatsappLink: form.whatsappLink,
          emailLink: form.emailLink,
          scheduledAt: scheduledAt || null,
          templateIds: selectedTemplates,
        }),
      });
      if (res.ok) {
        router.push("/campaigns");
      }
    } catch {
      alert("שגיאה בשמירת הקמפיין");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white">
            ← חזרה
          </button>
          <h1 className="text-2xl font-bold">קמפיין חדש</h1>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 mb-8">
          {["פרטים", "בחירת גרסה", "תבניות", "תזמון"].map((s, i) => (
            <div key={i} className={`flex-1 h-1 rounded-full ${i === ["form", "versions", "templates", "schedule"].indexOf(step) ? "bg-blue-500" : i < ["form", "versions", "templates", "schedule"].indexOf(step) ? "bg-green-500" : "bg-gray-700"}`} />
          ))}
        </div>

        {/* Step 1: Form */}
        {step === "form" && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm text-gray-400 mb-1">עסק</label>
              <select
                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white"
                value={form.businessId}
                onChange={(e) => setForm({ ...form, businessId: e.target.value })}
              >
                {BUSINESSES.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                {selectedBusiness.type === "recruitment" ? "שם התפקיד" : "תיאור העבודה / מוצר"}
              </label>
              <input
                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white"
                placeholder={selectedBusiness.type === "recruitment" ? "למשל: מנהל/ת חשבונות" : "למשל: מטבח שהושלם בנתניה"}
                value={form.jobTitle}
                onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">מיקום</label>
              <input
                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white"
                placeholder="למשל: נתניה"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">קישור וואטסאפ</label>
              {contactLinks.filter((l) => l.type === "whatsapp" && l.businessId === form.businessId).length > 0 ? (
                <select
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white"
                  value={form.whatsappLink}
                  onChange={(e) => setForm({ ...form, whatsappLink: e.target.value })}
                >
                  <option value="">ללא קישור וואטסאפ</option>
                  {contactLinks
                    .filter((l) => l.type === "whatsapp" && l.businessId === form.businessId)
                    .map((l) => (
                      <option key={l.id} value={l.value}>{l.label}</option>
                    ))}
                </select>
              ) : (
                <div className="text-sm text-gray-500 bg-gray-900 border border-gray-700 rounded-xl p-3">
                  אין קישורים שמורים - <a href="/settings" className="text-blue-400 hover:underline">הוסף בהגדרות</a>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">מייל (אופציונלי)</label>
              {contactLinks.filter((l) => l.type === "email" && l.businessId === form.businessId).length > 0 ? (
                <select
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white"
                  value={form.emailLink}
                  onChange={(e) => setForm({ ...form, emailLink: e.target.value })}
                >
                  <option value="">ללא מייל</option>
                  {contactLinks
                    .filter((l) => l.type === "email" && l.businessId === form.businessId)
                    .map((l) => (
                      <option key={l.id} value={l.value}>{l.label}</option>
                    ))}
                </select>
              ) : (
                <input
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white"
                  placeholder="jobs@example.com"
                  value={form.emailLink}
                  onChange={(e) => setForm({ ...form, emailLink: e.target.value })}
                />
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">תוכן הפוסט</label>
              <textarea
                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white min-h-[180px] font-sans text-sm"
                placeholder="כתוב כאן את תוכן הפוסט..."
                value={form.rawContent}
                onChange={(e) => setForm({ ...form, rawContent: e.target.value })}
              />
            </div>

            <button
              onClick={generateVersions}
              disabled={!form.jobTitle || !form.rawContent}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl p-4 font-semibold transition-colors"
            >
              המשך לבחירת תבניות →
            </button>
          </div>
        )}

        {/* Step 2: Choose version */}
        {step === "versions" && versions && (
          <div className="space-y-5">
            <p className="text-gray-400">בחר גרסה או ערוך לפי הטעם שלך:</p>

            {(["A", "B"] as const).map((v) => (
              <div
                key={v}
                onClick={() => selectVersion(v)}
                className={`border rounded-xl p-4 cursor-pointer transition-all ${selectedVersion === v ? "border-blue-500 bg-blue-950/30" : "border-gray-700 hover:border-gray-500"}`}
              >
                <div className="text-xs text-gray-500 mb-2">גרסה {v}</div>
                <pre className="whitespace-pre-wrap text-sm font-sans">
                  {v === "A" ? versions.versionA : versions.versionB}
                </pre>
              </div>
            ))}

            {selectedVersion && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">עריכה חופשית</label>
                <textarea
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white min-h-[200px] font-sans text-sm"
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                />
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep("form")} className="flex-1 bg-gray-800 hover:bg-gray-700 rounded-xl p-3 transition-colors">
                חזרה
              </button>
              <button
                onClick={() => setStep("templates")}
                disabled={!selectedVersion}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl p-3 font-semibold transition-colors"
              >
                המשך לתבניות →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Templates */}
        {step === "templates" && (
          <div className="space-y-5">
            <p className="text-gray-400">בחר תבניות קבוצות לפרסום:</p>

            {templates.filter((t) => t.businessId === form.businessId).length === 0 ? (
              <div className="text-center text-gray-500 bg-gray-900 rounded-2xl p-8 border border-gray-800">
                <p>אין תבניות לעסק זה עדיין</p>
                <a href="/templates" target="_blank" className="text-blue-400 hover:underline text-sm mt-2 inline-block">
                  צור תבנית חדשה
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                {templates
                  .filter((t) => t.businessId === form.businessId)
                  .map((t) => (
                    <div
                      key={t.id}
                      onClick={() => {
                        setSelectedTemplates((prev) =>
                          prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                        );
                      }}
                      className={`border rounded-xl p-4 cursor-pointer transition-all ${
                        selectedTemplates.includes(t.id)
                          ? "border-blue-500 bg-blue-950/30"
                          : "border-gray-700 hover:border-gray-500"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{t.name}</div>
                          <div className="text-xs text-gray-500">{t.groups.length} קבוצות</div>
                        </div>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          selectedTemplates.includes(t.id) ? "border-blue-500 bg-blue-500" : "border-gray-600"
                        }`}>
                          {selectedTemplates.includes(t.id) && <span className="text-white text-xs">✓</span>}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {selectedTemplates.length > 0 && (
              <div className="bg-blue-950/20 border border-blue-800/50 rounded-xl p-3 text-sm text-blue-300">
                נבחרו {selectedTemplates.length} תבניות
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep("versions")} className="flex-1 bg-gray-800 hover:bg-gray-700 rounded-xl p-3 transition-colors">
                חזרה
              </button>
              <button
                onClick={() => setStep("schedule")}
                disabled={selectedTemplates.length === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl p-3 font-semibold transition-colors"
              >
                המשך לתזמון →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Schedule */}
        {step === "schedule" && (
          <div className="space-y-5">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-2">הפוסט שנבחר</div>
              <pre className="whitespace-pre-wrap text-sm font-sans text-gray-200">
                {editedContent}
              </pre>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">תזמון (אופציונלי - ריק = עכשיו)</label>
              <input
                type="datetime-local"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>

            <div className="bg-yellow-950/30 border border-yellow-700/50 rounded-xl p-4 text-sm text-yellow-300">
              הקמפיין ייצא לאישור לפני פרסום. תקבל הודעה בוואטסאפ.
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep("versions")} className="flex-1 bg-gray-800 hover:bg-gray-700 rounded-xl p-3 transition-colors">
                חזרה
              </button>
              <button
                onClick={saveCampaign}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 rounded-xl p-3 font-semibold transition-colors"
              >
                {loading ? "שומר..." : "✓ שמור קמפיין"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
