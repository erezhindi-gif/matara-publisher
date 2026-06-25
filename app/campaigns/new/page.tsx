"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const BUSINESSES = [
  { id: "recruitment", name: "מטרה - גיוס והשמה", type: "recruitment" },
  { id: "carpentry", name: "נויה מטבחים", type: "carpentry" },
];

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי"];

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

function FacebookPreview({ content, whatsappLink, imagePreviews }: { content: string; whatsappLink: string; imagePreviews: string[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">M</div>
          <div>
            <div className="font-semibold text-sm text-gray-900">Matara Publisher</div>
            <div className="text-xs text-gray-500">עכשיו · 🌍</div>
          </div>
        </div>
      </div>
      <div className="p-4">
        <pre className="whitespace-pre-wrap font-sans text-sm text-gray-900 leading-relaxed">
          {content || "תוכן הפוסט יופיע כאן..."}
        </pre>
        {whatsappLink && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <span className="text-green-600 text-sm">📱 {whatsappLink}</span>
          </div>
        )}
        {imagePreviews.length > 0 && (
          <div className={`mt-3 grid gap-1 ${imagePreviews.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
            {imagePreviews.map((src, i) => (
              <img key={i} src={src} className="w-full object-cover rounded-lg max-h-48" />
            ))}
          </div>
        )}
      </div>
      <div className="px-4 py-2 border-t border-gray-100 flex gap-4 text-xs text-gray-400">
        <span>👍 אהבתי</span>
        <span>💬 תגובה</span>
        <span>↗️ שתף</span>
      </div>
    </div>
  );
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7:00-20:00

function ScheduleStep({
  form, imagePreviews, scheduleDays, setScheduleDays, scheduleTime, setScheduleTime,
  scheduleStartDate, setScheduleStartDate, existingCampaigns, templates, selectedTemplates, loading, onBack, onSave,
  dayTimes, setDayTimes,
}: {
  form: { content: string; whatsappLink: string };
  imagePreviews: string[];
  scheduleDays: number[];
  setScheduleDays: (fn: (prev: number[]) => number[]) => void;
  scheduleTime: string;
  setScheduleTime: (t: string) => void;
  scheduleStartDate: string;
  setScheduleStartDate: (d: string) => void;
  existingCampaigns: { scheduledAt: string; title: string; templateIds: string }[];
  templates: Template[];
  selectedTemplates: string[];
  loading: boolean;
  onBack: () => void;
  onSave: () => void;
  dayTimes: Record<number, string>;
  setDayTimes: (fn: (prev: Record<number, string>) => Record<number, string>) => void;
}) {
  // How many groups in selected templates (for THIS campaign)
  const myGroupCount = selectedTemplates.reduce((sum, tid) => {
    const t = templates.find((t) => t.id === tid);
    return sum + (t?.groups.length || 0);
  }, 0);
  // Duration in minutes: avg 60s per group
  const myDurationMin = Math.ceil(Math.max(myGroupCount, 1) * 1.5); // 90s max per group = 1.5 min

  // Helper: get group count from templateIds string
  function groupsFromTemplateIds(templateIdsStr: string): number {
    try {
      const ids: string[] = JSON.parse(templateIdsStr || "[]");
      return ids.reduce((sum, tid) => {
        const t = templates.find((t) => t.id === tid);
        return sum + (t?.groups.length || 0);
      }, 0);
    } catch { return 0; }
  }

  const [selH, selM] = scheduleTime.split(":").map(Number);
  const selectedHour = selH;
  const selectedMinutes = selH * 60 + selM; // minutes since midnight
  const myEndMinutes = selectedMinutes + myDurationMin;

  // Get busy ranges for the selected date
  const refDate = scheduleStartDate ? new Date(scheduleStartDate) : new Date();
  const busyRanges = existingCampaigns
    .filter((c) => new Date(c.scheduledAt).toDateString() === refDate.toDateString())
    .map((c) => {
      const start = new Date(c.scheduledAt);
      const startMin = start.getHours() * 60 + start.getMinutes();
      const groups = groupsFromTemplateIds(c.templateIds);
      const durationMin = Math.ceil(Math.max(groups, 1) * 1.5); // 90s worst case
      return { startMin, endMin: startMin + durationMin, title: c.title };
    });

  // Check if a given hour slot overlaps any busy range
  function isBusy(h: number): boolean {
    const hStart = h * 60;
    const hEnd = hStart + 60;
    return busyRanges.some((r) => r.startMin < hEnd && r.endMin > hStart);
  }

  // Check if OUR selected time conflicts
  const conflict = busyRanges.some((r) => selectedMinutes < r.endMin && myEndMinutes > r.startMin);

  function suggestFreeHour() {
    for (const h of [8,9,10,11,12,13,14,15,16,17,18,19]) {
      const hStartMin = h * 60;
      const hEndMin = hStartMin + myDurationMin;
      const free = !busyRanges.some((r) => hStartMin < r.endMin && hEndMin > r.startMin);
      if (free) {
        setScheduleTime(`${String(h).padStart(2, "0")}:00`);
        return;
      }
    }
  }

  function fmtRange(startMin: number, endMin: number) {
    const fmt = (m: number) => `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
    return `${fmt(startMin)}–${fmt(endMin)}`;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-5">

        {/* פרסם עכשיו */}
        <div
          className={`rounded-2xl p-4 border cursor-pointer transition-all ${scheduleDays.length === 0 ? "bg-orange-100 border-orange-400" : "bg-orange-50 border-orange-200 hover:border-orange-400"}`}
          onClick={() => setScheduleDays(() => [])}
        >
          <div className="font-medium text-orange-800 mb-1">⚡ פרסם עכשיו</div>
          <p className="text-sm text-orange-700">
            {scheduleDays.length === 0 ? "✓ מצב פרסום מיידי פעיל - יפורסם מיד לאחר אישור" : "לחץ כאן לביטול הימים ופרסום מיידי"}
          </p>
        </div>

        {/* Days selector */}
        <div>
          <label className="block text-sm text-gray-700 mb-2">או בחר ימי פרסום קבועים</label>
          <div className="flex flex-wrap gap-2">
            {DAY_NAMES.map((day, i) => (
              <button
                key={i}
                onClick={() => setScheduleDays((prev) => prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i])}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${scheduleDays.includes(i) ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-gray-700 hover:border-blue-400"}`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        {/* Start date */}
        {scheduleDays.length > 0 && (
          <div>
            <label className="block text-sm text-gray-700 mb-1">החל מתאריך</label>
            <input
              type="date"
              className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900"
              value={scheduleStartDate}
              onChange={(e) => setScheduleStartDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>
        )}

        {/* שעה לכל יום בנפרד */}
        {scheduleDays.length > 0 && (
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">שעת פרסום לכל יום</label>
            {scheduleDays.sort((a,b)=>a-b).map((dayIdx) => {
              const timeStr = dayTimes[dayIdx] || scheduleTime;
              const [selH] = timeStr.split(":").map(Number);
              const startMin = selH * 60 + parseInt(timeStr.split(":")[1]);
              const endMin = startMin + myDurationMin;

              // שעות עמוסות ביום זה
              const dayBusyRanges = existingCampaigns
                .filter((c) => new Date(c.scheduledAt).getDay() === dayIdx)
                .map((c) => {
                  const cd = new Date(c.scheduledAt);
                  const cs = cd.getHours() * 60 + cd.getMinutes();
                  const ce = cs + Math.ceil(Math.max(groupsFromTemplateIds(c.templateIds), 1) * 1.5);
                  return { startMin: cs, endMin: ce, title: c.title };
                });

              const dayConflict = dayBusyRanges.some(r => startMin < r.endMin && endMin > r.startMin);

              return (
                <div key={dayIdx} className="bg-white border border-gray-200 rounded-2xl p-4">
                  <div className="font-medium text-sm text-gray-700 mb-3">{DAY_NAMES[dayIdx]}</div>

                  {/* טבלת שעות */}
                  <div className="flex gap-0.5 mb-2 overflow-x-auto pb-1">
                    {HOURS.map((h) => {
                      const hStart = h * 60, hEnd = hStart + 60;
                      const busy = dayBusyRanges.some(r => r.startMin < hEnd && r.endMin > hStart);
                      const selected = h === selH;
                      return (
                        <button
                          key={h}
                          onClick={() => setDayTimes((prev) => ({ ...prev, [dayIdx]: `${String(h).padStart(2,"0")}:00` }))}
                          title={busy ? (dayBusyRanges.find(r => r.startMin < hEnd && r.endMin > hStart)?.title ?? "תפוס") : "פנוי"}
                          className={`flex-1 min-w-[30px] text-xs py-2 rounded transition-all font-medium ${
                            selected
                              ? busy ? "bg-red-500 text-white" : "bg-blue-600 text-white"
                              : busy ? "bg-red-100 text-red-600 hover:bg-red-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >{h}</button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-3 mb-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-600 inline-block" /> נבחר</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" /> תפוס</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 inline-block" /> פנוי</span>
                  </div>

                  <input
                    type="time"
                    className={`w-full border rounded-xl p-2 text-gray-900 bg-white text-sm ${dayConflict ? "border-red-400 bg-red-50" : "border-gray-300"}`}
                    value={timeStr}
                    onChange={(e) => setDayTimes((prev) => ({ ...prev, [dayIdx]: e.target.value }))}
                  />
                  {dayConflict && (
                    <p className="text-xs text-red-600 mt-1">⚠️ התנגשות עם קמפיין קיים ביום זה</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Smart time picker - only when no days selected */}
        {scheduleDays.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">שעה חכמה</label>
              <button onClick={suggestFreeHour} className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 rounded-lg px-3 py-1 transition-colors">
                ⚡ הצע שעה פנויה
              </button>
            </div>
            <div className="flex gap-0.5 mb-3 overflow-x-auto pb-1">
              {HOURS.map((h) => {
                const busy = isBusy(h);
                const selected = h === selectedHour;
                return (
                  <button
                    key={h}
                    onClick={() => setScheduleTime(`${String(h).padStart(2, "0")}:00`)}
                    className={`flex-1 min-w-[36px] text-xs py-2 rounded transition-all font-medium ${
                      selected ? busy ? "bg-red-500 text-white" : "bg-blue-600 text-white"
                      : busy ? "bg-red-100 text-red-600 hover:bg-red-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >{h}</button>
                );
              })}
            </div>
            {conflict && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 mb-3">
                ⚠️ התנגשות! קמפיין קיים פועל בטווח הזמן הזה.
              </div>
            )}
            <input
              type="time"
              className={`w-full border rounded-xl p-3 text-gray-900 ${conflict ? "border-red-400 bg-red-50" : "border-gray-300 bg-white"}`}
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
            />
          </div>
        )}

        {scheduleDays.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
            יווצרו {scheduleDays.length} קמפיינים - אחד לכל יום שנבחר, כל אחד בשעה שלו
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-700">
          הקמפיין ייצא לאישור לפני פרסום. תקבל הודעה במייל ובוואטסאפ.
        </div>

        <div className="flex gap-3">
          <button onClick={onBack} className="flex-1 bg-gray-200 hover:bg-gray-300 rounded-xl p-3 transition-colors">חזרה</button>
          <button
            onClick={onSave}
            disabled={loading || (scheduleDays.length > 0 && !scheduleStartDate)}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-xl p-3 font-semibold transition-colors"
          >
            {loading ? "שומר..." : "✓ שמור קמפיין"}
          </button>
        </div>
      </div>

      <div className="lg:sticky lg:top-8 lg:self-start">
        <div className="text-sm text-gray-500 mb-3 font-medium">תצוגה מקדימה</div>
        <FacebookPreview content={form.content} whatsappLink={form.whatsappLink} imagePreviews={imagePreviews} />
        {busyRanges.length > 0 && (
          <div className="mt-4 bg-white border border-gray-200 rounded-2xl p-4">
            <div className="text-xs font-medium text-gray-500 mb-2">קמפיינים מתוזמנים ביום זה:</div>
            {busyRanges.map((b, i) => (
              <div key={i} className={`text-xs py-1.5 border-b border-gray-100 last:border-0 flex items-center gap-2 ${conflict && selectedMinutes < b.endMin && myEndMinutes > b.startMin ? "text-red-600" : "text-gray-700"}`}>
                <span className="font-medium">{fmtRange(b.startMin, b.endMin)}</span>
                <span className="text-gray-400">·</span>
                <span className="truncate">{b.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "templates" | "schedule">("form");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [contactLinks, setContactLinks] = useState<ContactLink[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setContactLinks);
    fetch("/api/templates").then((r) => r.json()).then(setTemplates);
    fetch("/api/campaigns").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setExistingCampaigns(data.filter((c) => c.scheduledAt));
    });
  }, []);

  const [form, setForm] = useState({
    businessId: "recruitment",
    jobTitle: "",
    location: "",
    whatsappLink: "",
    emailLink: "",
    content: "",
  });

  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setImages((prev) => [...prev, ...files]);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreviews((prev) => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(file);
    });
  }

  function removeImage(i: number) {
    setImages((prev) => prev.filter((_, idx) => idx !== i));
    setImagePreviews((prev) => prev.filter((_, idx) => idx !== i));
  }

  // Multi-day scheduling
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);
  const [scheduleTime, setScheduleTime] = useState("10:00");
  const [scheduleStartDate, setScheduleStartDate] = useState("");
  const [dayTimes, setDayTimes] = useState<Record<number, string>>({});
  const [existingCampaigns, setExistingCampaigns] = useState<{ scheduledAt: string; title: string; templateIds: string }[]>([]);

  const selectedBusiness = BUSINESSES.find((b) => b.id === form.businessId)!;

  async function generateWithAI() {
    if (!form.jobTitle) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: form.jobTitle,
          location: form.location,
          whatsappLink: form.whatsappLink,
          emailLink: form.emailLink,
          businessType: selectedBusiness.type,
        }),
      });
      const data = await res.json();
      if (data.versionA) {
        setForm((f) => ({ ...f, content: data.versionA }));
      }
    } catch {
      alert("שגיאה ביצירת תוכן AI");
    } finally {
      setAiLoading(false);
    }
  }

  // Build scheduled dates from selected days
  function buildScheduledDates(): string[] {
    if (scheduleDays.length === 0) return [new Date().toISOString()];
    if (!scheduleStartDate) return [new Date().toISOString()];

    const dates: string[] = [];
    const start = new Date(scheduleStartDate);
    scheduleDays.forEach((day) => {
      const d = new Date(start);
      const diff = (day - d.getDay() + 7) % 7;
      d.setDate(d.getDate() + diff);
      // שעה ספציפית לכל יום, או ברירת מחדל
      const timeStr = dayTimes[day] || scheduleTime;
      const [h, m] = timeStr.split(":").map(Number);
      d.setHours(h, m, 0, 0);
      dates.push(d.toISOString());
    });
    return dates.sort();
  }

  async function saveCampaign() {
    setLoading(true);
    try {
      // Upload images first
      let imageUrls: string[] = [];
      if (images.length > 0) {
        setUploadingImages(true);
        const fd = new FormData();
        images.forEach((img) => fd.append("files", img));
        const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
        const uploadData = await uploadRes.json();
        imageUrls = uploadData.urls || [];
        setUploadingImages(false);
      }

      const scheduledDates = buildScheduledDates();
      for (const scheduledAt of scheduledDates) {
        await fetch("/api/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId: form.businessId,
            title: form.jobTitle,
            content: form.content,
            whatsappLink: form.whatsappLink,
            emailLink: form.emailLink,
            imageUrls,
            scheduledAt,
            templateIds: selectedTemplates,
          }),
        });
      }
      router.push("/campaigns");
    } catch {
      alert("שגיאה בשמירת הקמפיין");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 p-8" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900">← חזרה</button>
          <h1 className="text-2xl font-bold">קמפיין חדש</h1>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 mb-8">
          {["פרטים ותוכן", "תבניות", "תזמון"].map((s, i) => {
            const stepIdx = ["form", "templates", "schedule"].indexOf(step);
            return (
              <div key={i} className={`flex-1 h-1 rounded-full ${i === stepIdx ? "bg-blue-500" : i < stepIdx ? "bg-green-500" : "bg-gray-300"}`} />
            );
          })}
        </div>

        {/* Step 1: Form + Preview */}
        {step === "form" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Form */}
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-gray-700 mb-1">עסק</label>
                <select
                  className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900"
                  value={form.businessId}
                  onChange={(e) => setForm({ ...form, businessId: e.target.value })}
                >
                  {BUSINESSES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  {selectedBusiness.type === "recruitment" ? "שם התפקיד" : "תיאור העבודה / מוצר"}
                </label>
                <input
                  className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900"
                  placeholder={selectedBusiness.type === "recruitment" ? "למשל: מנהל/ת חשבונות" : "למשל: מטבח שהושלם בנתניה"}
                  value={form.jobTitle}
                  onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">מיקום</label>
                <input
                  className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900"
                  placeholder="למשל: נתניה"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">קישור וואטסאפ</label>
                {contactLinks.filter((l) => l.type === "whatsapp" && l.businessId === form.businessId).length > 0 ? (
                  <select
                    className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900"
                    value={form.whatsappLink}
                    onChange={(e) => setForm({ ...form, whatsappLink: e.target.value })}
                  >
                    <option value="">ללא קישור וואטסאפ</option>
                    {contactLinks.filter((l) => l.type === "whatsapp" && l.businessId === form.businessId)
                      .map((l) => <option key={l.id} value={l.value}>{l.label}</option>)}
                  </select>
                ) : (
                  <div className="text-sm text-gray-500 bg-white border border-gray-300 rounded-xl p-3">
                    אין קישורים שמורים - <a href="/settings" className="text-blue-500 hover:underline">הוסף בהגדרות</a>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">מייל (אופציונלי)</label>
                {contactLinks.filter((l) => l.type === "email" && l.businessId === form.businessId).length > 0 ? (
                  <select
                    className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900"
                    value={form.emailLink}
                    onChange={(e) => setForm({ ...form, emailLink: e.target.value })}
                  >
                    <option value="">ללא מייל</option>
                    {contactLinks.filter((l) => l.type === "email" && l.businessId === form.businessId)
                      .map((l) => <option key={l.id} value={l.value}>{l.label}</option>)}
                  </select>
                ) : (
                  <input
                    className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900"
                    placeholder="jobs@example.com"
                    value={form.emailLink}
                    onChange={(e) => setForm({ ...form, emailLink: e.target.value })}
                  />
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm text-gray-700">תוכן הפוסט</label>
                  <button
                    onClick={generateWithAI}
                    disabled={!form.jobTitle || aiLoading}
                    className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:text-gray-400 text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-medium"
                  >
                    {aiLoading ? (
                      <><span className="animate-spin">⟳</span> יוצר...</>
                    ) : (
                      <>✨ כתוב עם AI</>
                    )}
                  </button>
                </div>
                <textarea
                  className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900 min-h-[220px] font-sans text-sm"
                  placeholder="כתוב כאן את תוכן הפוסט, או לחץ 'כתוב עם AI'..."
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm text-gray-700 mb-2">תמונות (אופציונלי)</label>
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <span className="text-2xl mb-1">🖼️</span>
                  <span className="text-sm text-gray-500">לחץ להעלאת תמונות</span>
                  <span className="text-xs text-gray-400">JPG, PNG, GIF עד 10MB</span>
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageSelect} />
                </label>
                {imagePreviews.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {imagePreviews.map((src, i) => (
                      <div key={i} className="relative">
                        <img src={src} className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                        <button
                          onClick={() => removeImage(i)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-600"
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setStep("templates")}
                disabled={!form.jobTitle || !form.content}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-400 text-white rounded-xl p-4 font-semibold transition-colors"
              >
                המשך לתבניות →
              </button>
            </div>

            {/* Preview */}
            <div className="lg:sticky lg:top-8 lg:self-start">
              <div className="text-sm text-gray-500 mb-3 font-medium">תצוגה מקדימה</div>
              <FacebookPreview content={form.content} whatsappLink={form.whatsappLink} imagePreviews={imagePreviews} />
            </div>
          </div>
        )}

        {/* Step 2: Templates */}
        {step === "templates" && (
          <div className="max-w-2xl space-y-5">
            <p className="text-gray-700">בחר תבניות קבוצות לפרסום:</p>

            {templates.filter((t) => t.businessId === form.businessId).length === 0 ? (
              <div className="text-center text-gray-500 bg-white rounded-2xl p-8 border border-gray-200">
                <p>אין תבניות לעסק זה עדיין</p>
                <a href="/templates" target="_blank" className="text-blue-500 hover:underline text-sm mt-2 inline-block">צור תבנית חדשה</a>
              </div>
            ) : (
              <div className="space-y-3">
                {templates.filter((t) => t.businessId === form.businessId).map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTemplates((prev) => prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id])}
                    className={`border rounded-xl p-4 cursor-pointer transition-all ${selectedTemplates.includes(t.id) ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-400"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-gray-500">{t.groups.length} קבוצות</div>
                      </div>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selectedTemplates.includes(t.id) ? "border-blue-500 bg-blue-500" : "border-gray-400"}`}>
                        {selectedTemplates.includes(t.id) && <span className="text-white text-xs">✓</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep("form")} className="flex-1 bg-gray-200 hover:bg-gray-300 rounded-xl p-3 transition-colors">חזרה</button>
              <button
                onClick={() => setStep("schedule")}
                disabled={selectedTemplates.length === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-400 text-white rounded-xl p-3 font-semibold transition-colors"
              >
                המשך לתזמון →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Schedule */}
        {step === "schedule" && (
          <ScheduleStep
            form={form}
            imagePreviews={imagePreviews}
            scheduleDays={scheduleDays}
            setScheduleDays={setScheduleDays}
            scheduleTime={scheduleTime}
            setScheduleTime={setScheduleTime}
            scheduleStartDate={scheduleStartDate}
            setScheduleStartDate={setScheduleStartDate}
            existingCampaigns={existingCampaigns}
            templates={templates}
            selectedTemplates={selectedTemplates}
            loading={loading}
            onBack={() => setStep("templates")}
            onSave={saveCampaign}
            dayTimes={dayTimes}
            setDayTimes={setDayTimes}
          />
        )}
      </div>
    </main>
  );
}
