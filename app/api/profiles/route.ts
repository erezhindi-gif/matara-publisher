import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const profiles = await prisma.profile.findMany({
    include: { business: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(profiles);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const profile = await prisma.profile.create({
    data: {
      name: body.name,
      fbUsername: body.fbUsername,
      edgeProfile: body.edgeProfile || "Default",
      businessId: body.businessId,
      dailyLimit: body.dailyLimit || 150,
    },
    include: { business: true },
  });
  return NextResponse.json(profile);
}
