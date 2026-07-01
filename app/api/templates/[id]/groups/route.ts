import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
  const { id } = await params;
  const body = await req.json();

  if (body.all) {
    await prisma.group.deleteMany({ where: { templateId: id } });
    return NextResponse.json({ ok: true });
  }

  await prisma.group.delete({ where: { id: body.groupId } });
  return NextResponse.json({ ok: true });
}
