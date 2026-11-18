import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireUser, canAccess, notFound } from "@/lib/session";
import bcrypt from "bcryptjs";

// רק השדות שהדשבורד עורך. לא userId/businessId - אחרת אפשר להעביר פרופיל למשתמש אחר
const EDITABLE = ["name", "fbUsername", "edgeProfile", "dailyLimit", "whatsappPhone", "isActive"] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const existing = await prisma.profile.findUnique({ where: { id } });
  if (!existing || !canAccess(auth.user, existing.userId)) return notFound();

  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const key of EDITABLE) if (key in body) data[key] = body[key];
  // תקרה קשיחה: 200 פוסטים ביום לפרופיל (הגנה מחסימת פייסבוק)
  if ("dailyLimit" in data) data.dailyLimit = Math.min(200, Math.max(1, parseInt(String(data.dailyLimit)) || 150));

  // שינוי סיסמת הכניסה של המשתמש המקושר - מנהל בלבד
  if (body.newPassword) {
    if (!auth.user.isAdmin) return NextResponse.json({ error: "רק מנהל יכול לשנות סיסמה" }, { status: 403 });
    if (typeof body.newPassword !== "string" || body.newPassword.length < 8) {
      return NextResponse.json({ error: "סיסמה חייבת להיות לפחות 8 תווים" }, { status: 400 });
    }
    if (!existing.userId) return NextResponse.json({ error: "לפרופיל אין משתמש מקושר" }, { status: 400 });
    await prisma.user.update({ where: { id: existing.userId }, data: { password: await bcrypt.hash(body.newPassword, 10) } });
  }

  const profile = await prisma.profile.update({ where: { id }, data });
  return NextResponse.json(profile);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const existing = await prisma.profile.findUnique({ where: { id } });
  if (!existing || !canAccess(auth.user, existing.userId)) return notFound();

  await prisma.profile.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
