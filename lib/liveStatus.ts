// סטטוס תצוגה של קמפיין, מחושב ממצב הפוסטים בפועל.
// Campaign.status נשאר "approved" לאורך כל הפרסום ואף אחד לא מעדכן אותו,
// ולכן כל מסך שמציג סטטוס קמפיין צריך להשתמש בזה ולא ב-c.status ישירות.

export type LiveInfo = { label: string; color: string; bg: string; dot: string };

export const LIVE_STATUS: Record<string, LiveInfo> = {
  draft:            { label: "טיוטה",             color: "text-gray-600",   bg: "bg-gray-100",   dot: "bg-gray-400" },
  pending_approval: { label: "ממתין לאישור",      color: "text-yellow-700", bg: "bg-yellow-100", dot: "bg-yellow-400" },
  paused:           { label: "מושהה",             color: "text-red-700",    bg: "bg-red-100",    dot: "bg-red-400" },
  no_groups:        { label: "מאושר, אין קבוצות", color: "text-gray-600",   bg: "bg-gray-100",   dot: "bg-gray-400" },
  scheduled:        { label: "⏰ מתוזמן",          color: "text-blue-700",   bg: "bg-blue-100",   dot: "bg-blue-500" },
  queued:           { label: "⏳ בתהליך פרסום",    color: "text-purple-700", bg: "bg-purple-100", dot: "bg-purple-500" },
  done:             { label: "✓ הושלם",            color: "text-green-700",  bg: "bg-green-100",  dot: "bg-green-500" },
  partial:          { label: "⚠ הושלם עם תקלות",   color: "text-orange-700", bg: "bg-orange-100", dot: "bg-orange-500" },
  failed:           { label: "✗ נכשל",             color: "text-red-700",    bg: "bg-red-100",    dot: "bg-red-500" },
  cancelled:        { label: "⊘ בוטל",             color: "text-gray-600",   bg: "bg-gray-100",   dot: "bg-gray-400" },
};

type C = { status: string; scheduledAt: string | Date | null; posts?: { status: string }[] | null };

export function liveStatus(c: C): string {
  if (c.status === "draft" || c.status === "pending_approval" || c.status === "paused") return c.status;
  const ps = c.posts || [];
  if (ps.length === 0) return "no_groups";
  const n = (s: string) => ps.filter((p) => p.status === s).length;
  const active = n("pending") + n("running");
  if (active > 0) {
    if (n("running") === 0 && active === ps.length && c.scheduledAt && new Date(c.scheduledAt) > new Date()) return "scheduled";
    return "queued";
  }
  if (n("cancelled") === ps.length) return "cancelled";
  const ok = n("published") + n("pending_admin");
  if (ok === 0) return "failed";
  return ok + n("cancelled") === ps.length ? "done" : "partial";
}

export function liveInfo(c: C): LiveInfo {
  const s = liveStatus(c);
  return LIVE_STATUS[s] || { label: s, color: "text-gray-600", bg: "bg-gray-100", dot: "bg-gray-400" };
}
