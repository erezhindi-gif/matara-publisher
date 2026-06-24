import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const fbGroupId = body.fbGroupId || `manual_${Date.now()}`;
  const group = await prisma.group.upsert({
    where: { fbGroupId },
    update: { name: body.name, memberCount: body.memberCount || null, templateId: id },
    create: {
      fbGroupId,
      name: body.name,
      memberCount: body.memberCount || null,
      templateId: id,
    },
  });

  return NextResponse.json(group);
}

export async function DELETE(req: NextRequest) {
  const { groupId } = await req.json();
  await prisma.group.delete({ where: { id: groupId } });
  return NextResponse.json({ ok: true });
}
