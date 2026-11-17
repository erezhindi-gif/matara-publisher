import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export type SessionUser = { id: string; isAdmin: boolean; businessId: string | null };

// כל route של הדשבורד חייב לקרוא לזה ראשון: middleware.ts לא עובר על /api,
// ולכן route שלא בודק בעצמו פתוח לכל העולם. דחייה כברירת מחדל - בלי session אין תוצאה.
export async function requireUser(): Promise<{ user: SessionUser } | { error: NextResponse }> {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string; businessId?: string } | undefined;
  if (!u?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { user: { id: u.id, isAdmin: u.role === "admin", businessId: u.businessId ?? null } };
}

// 404 ולא 403 כשהאובייקט שייך למשתמש אחר - כדי לא לאשר שהוא קיים
export function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export function canAccess(user: SessionUser, ownerUserId: string | null | undefined) {
  return user.isAdmin || (!!ownerUserId && ownerUserId === user.id);
}
