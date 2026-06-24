import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const links = await prisma.contactLink.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(links);
}

export async function POST(req: NextRequest) {
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
  const { id } = await req.json();
  await prisma.contactLink.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
