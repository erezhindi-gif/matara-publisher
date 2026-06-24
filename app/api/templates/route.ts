import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const templates = await prisma.groupTemplate.findMany({
    include: { business: true, groups: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  let business = await prisma.business.findFirst({
    where: { id: body.businessId },
  });

  if (!business) {
    const type = body.businessId === "recruitment" ? "recruitment" : "carpentry";
    const name = type === "recruitment" ? "מטרה - גיוס והשמה" : "נויה מטבחים";
    business = await prisma.business.create({
      data: { id: body.businessId, name, type },
    });
  }

  const template = await prisma.groupTemplate.create({
    data: {
      name: body.name,
      businessId: business.id,
    },
  });

  return NextResponse.json(template);
}
