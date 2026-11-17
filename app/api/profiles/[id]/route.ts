import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireUser, canAccess, notFound } from "@/lib/session";

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
