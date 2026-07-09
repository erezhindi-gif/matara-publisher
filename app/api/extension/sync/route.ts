import { prisma } from "@/lib/prisma";
import { validateApiToken } from "@/lib/apiToken";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const deviceId = req.nextUrl.searchParams.get("deviceId");

  const auth = await validateApiToken(token, deviceId);
  if ("error" in auth) return auth.error;
  const user = auth.user;

  // תפוס משימה אטומית
  const job = await prisma.$transaction(async (tx) => {
    const pending = await tx.syncJob.findFirst({
      where: { userId: user.id, status: "pending" },
      orderBy: { createdAt: "asc" },
    });
    if (!pending) return null;

    await tx.syncJob.update({
      where: { id: pending.id },
      data: { status: "running", claimedBy: deviceId || "unknown" },
    });
    return pending;
  });

  return NextResponse.json({ job, user: { name: user.name, email: user.email } });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionUserId = (session.user as { id: string }).id;
  const isAdmin = (session.user as { role?: string })?.role === "admin";
  const { businessId, profileId } = await req.json();

  // userId חייב להיות בעל הפרופיל שנבחר - לא המשתמש המחובר לדשבורד.
  // באג שגרם לג'וב תמיד לרוץ תחת זהות המנהל (session), גם כשנבחר פרופיל
  // אחר בתפריט - התוסף שהריץ את זה תמיד היה זה שמחזיק בטוקן של אותו
  // session.user.id, בלי שום קשר לפרופיל שהוצג ב-UI.
  let userId = sessionUserId;
  if (profileId) {
    const profile = await prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    if (!profile.userId) return NextResponse.json({ error: "Profile has no linked user" }, { status: 400 });
    // רק המנהל, או בעל הפרופיל עצמו, יכולים להפעיל סנכרון בשם הפרופיל הזה
    if (!isAdmin && profile.userId !== sessionUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    userId = profile.userId;
  }

  await prisma.syncJob.updateMany({
    where: { userId, status: { in: ["pending", "running"] } },
    data: { status: "cancelled" },
  });

  const job = await prisma.syncJob.create({
    data: { userId, businessId, status: "pending" },
  });

  return NextResponse.json({ job });
}
