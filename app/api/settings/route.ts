import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const links = await prisma.contactLink.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(links);
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const link = await prisma.contactLink.create({
    data: {
      label: body.label,
      type: body.type,
      value: body.value,
      businessId: body.businessId,
      isDefault: body.isDefault || false,
    },
  });
  return NextResponse.json(link);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await req.json();
  await prisma.contactLink.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
