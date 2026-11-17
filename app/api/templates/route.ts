import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const templates = await prisma.groupTemplate.findMany({
    where: user.isAdmin ? {} : { userId: user.id },
    include: { business: true, groups: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const userId = auth.user.id;
  const body = await req.json();

  let business = await prisma.business.findFirst({ where: { id: body.businessId } });
  if (!business) {
    business = await prisma.business.create({ data: { id: body.businessId, name: body.businessName || body.businessId, type: body.businessId } });
  }

  const template = await prisma.groupTemplate.create({
    data: { name: body.name, businessId: business.id, userId: userId || null },
  });
  return NextResponse.json(template);
}
