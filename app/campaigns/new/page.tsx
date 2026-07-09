"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { getBusinessFilter } from "@/lib/businessFilter";


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

type ProfileOption = {
  id: string;
  name: string;
  businessId: string;
  userId: string | null;
};

const BG_GRADIENTS: Record<number, string> = {
  1:  "linear-gradient(135deg,#1a1a2e,#16213e)",
  2:  "linear-gradient(135deg,#c94b8a,#e8a0b4)",
  3:  "linear-gradient(135deg,#f5e6d3,#e8d5c0)",
  4:  "linear-gradient(135deg,#a8d8f0,#7ec8e3)",
  5:  "linear-gradient(135deg,#d4b4f0,#f0b4d4)",
  6:  "linear-gradient(135deg,#fff8f0,#ffeedd)",
  7:  "linear-gradient(135deg,#90ee90,#32cd32)",
  8:  "linear-gradient(135deg,#dc143c,#8b0000)",
  9:  "linear-gradient(135deg,#ff7f7f,#ffb6c1,#87ceeb)",
  10: "linear-gradient(135deg,#b0b0b0,#d3d3d3)",
  11: "linear-gradient(135deg,#7b2d8b,#4a90d9)",
  12: "linear-gradient(135deg,#1a0a00,#4a1a00)",
  13: "linear-gradient(135deg,#ffd700,#ffa500)",
  14: "linear-gradient(135deg,#90e0d0,#b0f0e0)",
  15: "linear-gradient(135deg,#c8c8f0,#d8d8ff)",
};

// מסגרת אייפון סביב התצוגה המקדימה - כדי שזה ייראה כמו שהפוסט באמת יופיע
// במסך טלפון, לא רק כרטיס פייסבוק שטוח בתוך הדף.
function IPhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-[340px] relative">
      {/* כפתורי צד - נותנים תחושה ריאליסטית יותר */}
      <div className="absolute -right-[3px] top-28 w-[3px] h-16 bg-[#0a0e17] rounded-l" />
      <div className="absolute -left-[3px] top-24 w-[3px] h-8 bg-[#0a0e17] rounded-r" />
      <div className="absolute -left-[3px] top-36 w-[3px] h-12 bg-[#0a0e17] rounded-r" />

      <div className="relative rounded-[3rem] bg-[#0a0e17] p-3 shadow-2xl shadow-cyan-500/20">
        <div className="relative rounded-[2.4rem] bg-white overflow-hidden">
          {/* פס סטטוס */}
          <div className="absolute top-0 inset-x-0 h-11 flex items-end justify-between px-7 pb-1.5 text-[13px] font-semibold text-gray-900 z-10">
            <span>10:10</span>
            <span className="flex items-center gap-1 text-[11px]">📶 🛜 🔋</span>
          </div>
          {/* מחריץ המצלמה (Dynamic Island) */}
          <div className="absolute top-2.5 inset-x-0 flex justify-center z-10">
            <div className="w-28 h-7 bg-[#0a0e17] rounded-full" />
          </div>

          {/* שורת אפליקציית פייסבוק */}
          <div className="pt-11 px-4 pb-2 flex items-center justify-between border-b border-gray-100">
            <div className="flex items-center gap-3 text-gray-800">
              <span className="text-lg">💬</span>
              <span className="text-lg">🔍</span>
              <span className="text-lg">➕</span>
            </div>
            <div className="text-xl font-bold text-blue-600" style={{ fontFamily: "Georgia, serif" }}>facebook</div>
          </div>

          <div className="px-2 pt-2 pb-6 max-h-[520px] overflow-y-auto">
            {children}
          </div>

          {/* פס הבית התחתון */}
          <div className="pb-2 pt-1 flex justify-center">
            <div className="w-32 h-1.5 bg-gray-900/80 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FacebookPreview({ content, whatsappLink, whatsappMessage, imagePreviews, backgroundIndex }: { content: string; whatsappLink: string; whatsappMessage?: string; imagePreviews: string[]; backgroundIndex?: number | null }) {
  const bg = backgroundIndex && !imagePreviews.length ? BG_GRADIENTS[backgroundIndex] : null;
  const isDark = backgroundIndex && [1, 8, 11, 12].includes(backgroundIndex);
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full brand-gradient flex items-center justify-center text-white font-bold text-sm">M</div>
          <div>
            <div className="font-semibold text-sm text-gray-900">Matara Publisher</div>
            <div className="text-xs text-gray-500">עכשיו · 🌍</div>
          </div>
        </div>
      </div>
      <div
        className="p-4"
        style={bg ? { background: bg, minHeight: "120px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" } : {}}
      >
        <pre
          className="whitespace-pre-wrap font-sans text-sm leading-relaxed w-full"
          style={bg ? { color: isDark ? "#fff" : "#000", fontWeight: 600, textAlign: "center" } : { color: "#111827" }}
        >
          {content || "תוכן הפוסט יופיע כאן..."}
        </pre>
        {whatsappMessage && (
          <div className="mt-3 pt-3 border-t border-gray-100 w-full">
            <span className="inline-flex items-center gap-2 bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-full">📱 שלח הודעה בוואטסאפ</span>
            <div className="text-xs text-gray-400 mt-1 truncate">&ldquo;{whatsappMessage}&rdquo;</div>
          </div>
        )}
        {whatsappLink && !whatsappMessage && !bg && (
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
  dayTimes, setDayTimes, backgroundIndex,
}: {
  form: { content: string; whatsappLink: string; whatsappMessage?: string };
  imagePreviews: string[];
  scheduleDays: number[];
  setScheduleDays: (fn: (prev: number[]) => number[]) => void;
  scheduleTime: string;
  setScheduleTime: (t: string) => void;
  scheduleStartDate: string;
  setScheduleStartDate: (d: string) => void;
  existingCampaigns: { scheduledAt: string; title: string; templateIds: string; status: string; posts: { status: string }[] }[];
  templates: Template[];
  selectedTemplates: string[];
  loading: boolean;
  onBack: () => void;
  onSave: () => void;
  dayTimes: Record<number, string>;
  setDayTimes: (fn: (prev: Record<number, string>) => Record<number, string>) => void;
  backgroundIndex: number | null;
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

  // פוסטים שפורסמו בפועל לפי תאריך
  function publishedPostsOnDate(date: Date): number {
    return existingCampaigns
      .filter((c) => new Date(c.scheduledAt).toDateString() === date.toDateString())
      .reduce((sum, c) => sum + (c.posts?.filter(p => p.status === "published").length || groupsFromTemplateIds(c.templateIds)), 0);
  }

  function isDayFull(date: Date): boolean {
    return publishedPostsOnDate(date) >= 300;
  }

  // Get busy ranges for the selected date
  const refDate = scheduleStartDate ? new Date(scheduleStartDate) : new Date();
  const busyRanges = existingCampaigns
    .filter((c) => new Date(c.scheduledAt).toDateString() === refDate.toDateString())
    .map((c) => {
      const start = new Date(c.scheduledAt);
      const startMin = start.getHours() * 60 + start.getMinutes();
      const groups = groupsFromTemplateIds(c.templateIds);
      const durationMin = Math.ceil(Math.max(groups, 1) * 1.5);
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
            {DAY_NAMES.map((day, i) => {
              // בדוק אם היום הקרוב של יום זה מלא (300 פוסטים)
              const nextDate = new Date(scheduleStartDate || new Date());
              const diff = (i - nextDate.getDay() + 7) % 7;
              nextDate.setDate(nextDate.getDate() + diff);
              const full = isDayFull(nextDate);
              const selected = scheduleDays.includes(i);
              return (
                <div key={i} className="relative">
                  <button
                    onClick={() => !full && setScheduleDays((prev) => prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i])}
                    disabled={full}
                    title={full ? "היום מלא - 300 פוסטים כבר תוזמנו" : ""}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      full ? "bg-red-100 text-red-400 border border-red-200 cursor-not-allowed" :
                      selected ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-gray-700 hover:border-blue-400"
                    }`}
                  >
                    {day}
                    {full && <span className="text-xs block">מלא</span>}
                  </button>
                </div>
              );
            })}
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

              // בדיקת 300 פוסטים ביום
              const dayNextDate = new Date(scheduleStartDate || new Date());
              const dayDiff = (dayIdx - dayNextDate.getDay() + 7) % 7;
              dayNextDate.setDate(dayNextDate.getDate() + dayDiff);
              const dayFull = isDayFull(dayNextDate);
              const publishedCount = publishedPostsOnDate(dayNextDate);

              return (
                <div key={dayIdx} className={`rounded-2xl p-4 border ${dayFull ? "bg-red-50 border-red-300" : "bg-white border-gray-200"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-medium text-sm text-gray-700">{DAY_NAMES[dayIdx]}</div>
                    <div className={`text-xs px-2 py-0.5 rounded-full ${dayFull ? "bg-red-200 text-red-700 font-bold" : publishedCount > 200 ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                      {publishedCount}/300 פוסטים
                    </div>
                  </div>
                  {dayFull && (
                    <div className="text-center py-4 text-red-600 font-medium text-sm">
                      🚫 היום חסום - הגעת למגבלת 300 פוסטים
                    </div>
                  )}
                  {!dayFull && (<>

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
                </>)}
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
          <button onClick={onBack} className="flex-1 bg-gray-200 hover:bg-gray-300 rounded-full p-3 transition-colors">חזרה</button>
          <button
            onClick={onSave}
            disabled={loading || (scheduleDays.length > 0 && !scheduleStartDate) || scheduleDays.some(d => { const nd = new Date(scheduleStartDate || new Date()); nd.setDate(nd.getDate() + (d - nd.getDay() + 7) % 7); return isDayFull(nd); })}
            className="flex-1 brand-gradient hover:opacity-90 disabled:opacity-40 disabled:bg-gray-300 text-white rounded-full p-3 font-semibold transition-opacity brand-glow"
          >
            {loading ? "שומר..." : "✓ שמור קמפיין"}
          </button>
        </div>
      </div>

      <div className="lg:sticky lg:top-8 lg:self-start">
        <div className="text-sm text-gray-500 mb-3 font-medium text-center">תצוגה מקדימה</div>
        <IPhoneFrame>
          <FacebookPreview content={form.content} whatsappLink={form.whatsappLink} whatsappMessage={form.whatsappMessage} imagePreviews={imagePreviews} backgroundIndex={backgroundIndex} />
        </IPhoneFrame>
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
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "admin";
  const userBusinessId = (session?.user as { businessId?: string })?.businessId || "recruitment";
  const [step, setStep] = useState<"form" | "templates" | "schedule">("form");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [contactLinks, setContactLinks] = useState<ContactLink[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [profileOptions, setProfileOptions] = useState<ProfileOption[]>([]);
  const sidebarFilter = getBusinessFilter(); // userId של הפרופיל הנבחר בסיידבר, או "all"
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [templateMode, setTemplateMode] = useState<"template" | "groups">("template");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [allGroups, setAllGroups] = useState<{ id: string; fbGroupId: string; name: string; memberCount: number | null }[]>([]);
  const [groupSearch, setGroupSearch] = useState("");
  const [backgroundIndex, setBackgroundIndex] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setContactLinks);
    fetch("/api/profiles").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) {
        setProfileOptions(data);
        // אם יש פרופיל נבחר בסיידבר, הגדר את businessId שלו
        if (sidebarFilter !== "all") {
          const selected = data.find((p: ProfileOption) => (p.userId || p.id) === sidebarFilter);
          if (selected) setForm((f) => ({ ...f, businessId: selected.businessId }));
        }
      }
    });
    fetch("/api/templates").then((r) => r.json()).then((data) => {
      const filter = getBusinessFilter();
      const filtered = filter === "all" ? data : data.filter((t: { userId: string | null }) => t.userId === filter);
      setTemplates(filtered);
      // אסוף את כל הקבוצות מהתבניות המסוננות
      const seen = new Set<string>();
      const groups: { id: string; fbGroupId: string; name: string; memberCount: number | null }[] = [];
      for (const t of filtered) {
        for (const g of t.groups as { id: string; fbGroupId: string; name: string; memberCount: number | null }[]) {
          if (!seen.has(g.fbGroupId)) { seen.add(g.fbGroupId); groups.push(g); }
        }
      }
      setAllGroups(groups);
    });
    fetch("/api/campaigns").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setExistingCampaigns(
        data.filter((c) => c.scheduledAt && ["approved", "publishing", "done"].includes(c.status))
      );
    });
  }, []);

  const [form, setForm] = useState({
    businessId: userBusinessId,
    jobTitle: "",
    location: "",
    whatsappLink: "",
    whatsappMessage: "",
    emailLink: "",
    content: "",
  });

  // עדכן whatsappLink אוטומטי כשמשתנה businessId או contactLinks
  useEffect(() => {
    if (!contactLinks.length) return;
    const waLink = contactLinks.find((l) => l.type === "whatsapp" && l.businessId === form.businessId)
      || contactLinks.find((l) => l.type === "whatsapp");
    if (waLink) setForm((f) => ({ ...f, whatsappLink: waLink.value }));
  }, [form.businessId, contactLinks]);

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
  const [existingCampaigns, setExistingCampaigns] = useState<{ scheduledAt: string; title: string; templateIds: string; status: string; posts: { status: string }[] }[]>([]);

  const selectedProfile = profileOptions.find((p) => p.businessId === form.businessId) || profileOptions[0];;

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
          businessType: selectedProfile?.businessId || form.businessId,
          businessName: selectedProfile?.name || "",
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
      // אם אדמין בחר פרופיל ספציפי בסרגל - הקמפיין ישויך לאותו פרופיל
      const sidebarFilter = getBusinessFilter();
      const ownerUserId = (isAdmin && sidebarFilter !== "all") ? sidebarFilter : undefined;
      for (const scheduledAt of scheduledDates) {
        await fetch("/api/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId: form.businessId,
            title: form.jobTitle,
            content: form.content,
            whatsappLink: form.whatsappLink,
            whatsappMessage: form.whatsappMessage || null,
            emailLink: form.emailLink,
            imageUrls,
            scheduledAt,
            templateIds: templateMode === "template" ? selectedTemplates : [],
            groupIds: templateMode === "groups" ? selectedGroupIds : [],
            backgroundIndex,
            ownerUserId,
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
              {isAdmin && profileOptions.length > 0 && sidebarFilter === "all" && (
                <div>
                  <label className="block text-sm text-gray-700 mb-1">פרופיל</label>
                  <select
                    className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900"
                    value={form.businessId}
                    onChange={(e) => setForm({ ...form, businessId: e.target.value })}
                  >
                    {profileOptions.map((p) => <option key={p.id} value={p.businessId}>{p.name}</option>)}
                  </select>
                </div>
              )}
              {isAdmin && sidebarFilter !== "all" && (
                <div>
                  <label className="block text-sm text-gray-700 mb-1">פרופיל</label>
                  <div className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-gray-700">
                    {profileOptions.find((p) => (p.userId || p.id) === sidebarFilter)?.name || ""}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  תיאור / שם תפקיד
                </label>
                <input
                  className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900"
                  placeholder="למשל: מנהל/ת חשבונות, מטבח בנתניה..."
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
                <label className="block text-sm text-gray-700 mb-1">📱 כפתור וואטסאפ בפוסט</label>
                <textarea
                  className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900 text-sm resize-none"
                  rows={2}
                  placeholder={'היי, אשמח לפרטים בנוגע למודעת מנהל/ת חשבונות'}
                  value={form.whatsappMessage}
                  onChange={(e) => setForm({ ...form, whatsappMessage: e.target.value })}
                />
                <p className="text-xs text-gray-400 mt-1">הטקסט שיישלח אוטומטית כשמישהו לוחץ על קישור הוואטסאפ בפוסט. ימספר הטלפון נלקח מהפרופיל.</p>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">מייל (אופציונלי)</label>
                {contactLinks.filter((l) => l.type === "email" && true).length > 0 ? (
                  <select
                    className="w-full bg-white border border-gray-300 rounded-xl p-3 text-gray-900"
                    value={form.emailLink}
                    onChange={(e) => setForm({ ...form, emailLink: e.target.value })}
                  >
                    <option value="">ללא מייל</option>
                    {contactLinks.filter((l) => l.type === "email" && true)
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
                className="w-full brand-gradient hover:opacity-90 disabled:opacity-40 disabled:bg-gray-300 text-white rounded-full p-4 font-semibold transition-opacity brand-glow"
              >
                המשך לתבניות →
              </button>
            </div>

            {/* Preview */}
            <div className="lg:sticky lg:top-8 lg:self-start">
              <div className="text-sm text-gray-500 mb-3 font-medium text-center">תצוגה מקדימה</div>
              <IPhoneFrame>
                <FacebookPreview content={form.content} whatsappLink={form.whatsappLink} whatsappMessage={form.whatsappMessage} imagePreviews={imagePreviews} backgroundIndex={backgroundIndex} />
              </IPhoneFrame>
            </div>
          </div>
        )}

        {/* Step 2: Templates / Groups */}
        {step === "templates" && (
          <div className="max-w-2xl space-y-5">
            {/* טאבים */}
            <div className="flex bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setTemplateMode("template")}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${templateMode === "template" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              >תבנית קבוצות</button>
              <button
                onClick={() => setTemplateMode("groups")}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${templateMode === "groups" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
              >בחירת קבוצות ידנית</button>
            </div>

            {/* מצב תבנית */}
            {templateMode === "template" && (
              <>
                <p className="text-gray-700">בחר תבניות קבוצות לפרסום:</p>
                {templates.filter((t) => true).length === 0 ? (
                  <div className="text-center text-gray-500 bg-white rounded-2xl p-8 border border-gray-200">
                    <p>אין תבניות לעסק זה עדיין</p>
                    <a href="/templates" target="_blank" className="text-blue-500 hover:underline text-sm mt-2 inline-block">צור תבנית חדשה</a>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {templates.filter((t) => true).map((t) => (
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
              </>
            )}

            {/* מצב קבוצות ידנית */}
            {templateMode === "groups" && (
              <>
                <div className="flex items-center gap-3">
                  <input
                    className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm"
                    placeholder="חפש קבוצה..."
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                  />
                  {selectedGroupIds.length > 0 && (
                    <div className="text-sm text-blue-600 font-medium whitespace-nowrap">{selectedGroupIds.length} נבחרו</div>
                  )}
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {allGroups.length === 0 ? (
                    <div className="text-center text-gray-500 bg-white rounded-2xl p-8 border border-gray-200">
                      אין קבוצות - <a href="/templates" target="_blank" className="text-blue-500 hover:underline">הוסף קבוצות לתבנית</a>
                    </div>
                  ) : allGroups.filter((g) => !groupSearch.trim() || g.name.toLowerCase().includes(groupSearch.toLowerCase())).map((g) => (
                    <div
                      key={g.fbGroupId}
                      onClick={() => setSelectedGroupIds((prev) => prev.includes(g.fbGroupId) ? prev.filter((id) => id !== g.fbGroupId) : [...prev, g.fbGroupId])}
                      className={`border rounded-xl p-3 cursor-pointer transition-all flex items-center gap-3 ${selectedGroupIds.includes(g.fbGroupId) ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-400"}`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center ${selectedGroupIds.includes(g.fbGroupId) ? "border-blue-500 bg-blue-500" : "border-gray-400"}`}>
                        {selectedGroupIds.includes(g.fbGroupId) && <span className="text-white text-xs">✓</span>}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{g.name}</div>
                        {g.memberCount && <div className="text-xs text-gray-500">{g.memberCount.toLocaleString()} חברים</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep("form")} className="flex-1 bg-gray-200 hover:bg-gray-300 rounded-full p-3 transition-colors">חזרה</button>
              <button
                onClick={() => setStep("schedule")}
                disabled={templateMode === "template" ? selectedTemplates.length === 0 : selectedGroupIds.length === 0}
                className="flex-1 brand-gradient hover:opacity-90 disabled:opacity-40 disabled:bg-gray-300 text-white rounded-full p-3 font-semibold transition-opacity brand-glow"
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
            backgroundIndex={backgroundIndex}
          />
        )}
      </div>
    </main>
  );
}
