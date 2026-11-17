import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireUser, canAccess, notFound } from "@/lib/session";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const template = await prisma.groupTemplate.findUnique({ where: { id } });
  if (!template || !canAccess(auth.user, template.userId)) return notFound();

  await prisma.group.deleteMany({ where: { templateId: id } });
  await prisma.groupTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
