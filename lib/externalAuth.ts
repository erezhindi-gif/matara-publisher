import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// אימות למערכות חיצוניות (שירה AI): Authorization: Bearer <key>.
// ה-DB שומר רק sha256 של המפתח. המשתמש נקבע לפי המפתח בלבד - אין שדה
// בבקשה שמאפשר לבחור משתמש/פרופיל אחר.
export function hashKey(key: string) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export type ExternalUser = { id: string; businessId: string | null };

export async function requireApiKey(req: NextRequest): Promise<{ user: ExternalUser } | { error: NextResponse }> {
  const header = req.headers.get("authorization") || "";
  const m = header.match(/^Bearer\s+(\S+)$/i);
  if (!m) return { error: NextResponse.json({ error: "Missing API key" }, { status: 401 }) };

  const apiKey = await prisma.apiKey.findUnique({ where: { keyHash: hashKey(m[1]) } });
  if (!apiKey || apiKey.revokedAt) return { error: NextResponse.json({ error: "Invalid API key" }, { status: 401 }) };

  const user = await prisma.user.findUnique({ where: { id: apiKey.userId }, select: { id: true, businessId: true } });
  if (!user) return { error: NextResponse.json({ error: "Invalid API key" }, { status: 401 }) };

  // לא חוסם את הבקשה אם העדכון נכשל
  prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return { user };
}

// כל הקבוצות של המשתמש, בלי כפילויות: לפי fbGroupId, ובנוסף מסתירים מזהה-שם
// (slug, למשל "haifajobs") כשיש קבוצה עם מזהה מספרי ובדיוק אותו שם - בסנכרון
// אותה קבוצה נקלטת לפעמים פעמיים (2026-11-19: 233 מתוך 2,364 אצל שני AI).
export async function getUserGroups(userId: string) {
  const rows = await prisma.group.findMany({
    where: { template: { userId } },
    select: { id: true, fbGroupId: true, name: true, memberCount: true, lastSeenAt: true },
    orderBy: { name: "asc" },
  });
  const byId = new Map<string, (typeof rows)[number]>();
  for (const g of rows) if (!byId.has(g.fbGroupId)) byId.set(g.fbGroupId, g);
  const all = Array.from(byId.values());
  const numericNames = new Set(all.filter((g) => /^\d+$/.test(g.fbGroupId)).map((g) => g.name));
  return all.filter((g) => /^\d+$/.test(g.fbGroupId) || !numericNames.has(g.name));
}
