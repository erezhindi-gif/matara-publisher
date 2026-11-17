import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireUser, canAccess, notFound, type SessionUser } from "@/lib/session";

async function ownedTemplate(user: SessionUser, id: string) {
  const template = await prisma.groupTemplate.findUnique({ where: { id } });
  return template && canAccess(user, template.userId) ? template : null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!(await ownedTemplate(auth.user, id))) return notFound();

  const body = await req.json();

  const fbGroupId = body.fbGroupId || `manual_${Date.now()}`;
  const group = await prisma.group.upsert({
    where: { fbGroupId_templateId: { fbGroupId, templateId: id } },
    update: { name: body.name, memberCount: body.memberCount || null },
    create: {
      fbGroupId,
      name: body.name,
      memberCount: body.memberCount || null,
      templateId: id,
    },
  });

  return NextResponse.json(group);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!(await ownedTemplate(auth.user, id))) return notFound();

  const body = await req.json();

  if (body.all) {
    await prisma.group.deleteMany({ where: { templateId: id } });
    return NextResponse.json({ ok: true });
  }

  // מוחקים רק קבוצה ששייכת לתבנית הזו - לא כל קבוצה במערכת לפי מזהה
  await prisma.group.deleteMany({ where: { id: body.groupId, templateId: id } });
  return NextResponse.json({ ok: true });
}
