import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await getServerSession(authOptions);
  const isAdmin = (session?.user as { role?: string })?.role === "admin";
  const userId = (session?.user as { id?: string })?.id;

  const where = (!session || isAdmin) ? {} : { userId };

  const profiles = await prisma.profile.findMany({
    where,
    include: { business: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(profiles);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const isAdmin = (session?.user as { role?: string })?.role === "admin";
  const body = await req.json();

  // If admin provides worker credentials, create a user account linked to this profile
  let profileUserId: string | null = null;
  if (isAdmin && body.workerEmail && body.workerPassword) {
    const hashed = await bcrypt.hash(body.workerPassword, 10);
    const newUser = await prisma.user.create({
      data: {
        name: body.name,
        email: body.workerEmail,
        password: hashed,
        role: "user",
        businessId: body.businessId || null,
      },
    });
    profileUserId = newUser.id;
  }

  const profile = await prisma.profile.create({
    data: {
      name: body.name,
      fbUsername: body.fbUsername,
      edgeProfile: body.edgeProfile || "Default",
      businessId: body.businessId,
      dailyLimit: body.dailyLimit || 150,
      whatsappPhone: body.whatsappPhone || null,
      userId: profileUserId,
    },
    include: { business: true },
  });
  return NextResponse.json(profile);
}
