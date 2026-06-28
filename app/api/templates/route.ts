import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  const isAdmin = (session?.user as { role?: string })?.role === "admin";
  const userId = (session?.user as { id?: string })?.id;

  const where = (!session || isAdmin) ? {} : { userId };

  const templates = await prisma.groupTemplate.findMany({
    where,
    include: { business: true, groups: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const body = await req.json();

  let business = await prisma.business.findFirst({ where: { id: body.businessId } });
  if (!business) {
    const type = body.businessId === "recruitment" ? "recruitment" : "carpentry";
    const name = type === "recruitment" ? "מטרה - גיוס והשמה" : "נויה מטבחים";
    business = await prisma.business.create({ data: { id: body.businessId, name, type } });
  }

  const template = await prisma.groupTemplate.create({
    data: { name: body.name, businessId: business.id, userId: userId || null },
  });
  return NextResponse.json(template);
}
