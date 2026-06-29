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

  // מצא או צור עסק לפי שם חופשי
  let businessId = body.businessId;
  if (body.businessName && body.businessName.trim()) {
    const slug = body.businessName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9֐-׿-]/g, "");
    let business = await prisma.business.findFirst({ where: { name: body.businessName.trim() } });
    if (!business) {
      business = await prisma.business.create({
        data: { id: slug || `business-${Date.now()}`, name: body.businessName.trim(), type: slug || "custom" },
      });
    }
    businessId = business.id;
  }

  // If admin provides worker credentials, create a user account linked to this profile
  let profileUserId: string | null = null;
  if (isAdmin && body.workerEmail && body.workerPassword) {
    const hashed = await bcrypt.hash(body.workerPassword, 10);
    const existing = await prisma.user.findUnique({ where: { email: body.workerEmail } });
    if (existing) {
      // עדכן סיסמה אם המשתמש כבר קיים
      await prisma.user.update({ where: { email: body.workerEmail }, data: { password: hashed, businessId: businessId || null } });
      profileUserId = existing.id;
    } else {
      const newUser = await prisma.user.create({
        data: { name: body.name, email: body.workerEmail, password: hashed, role: "user", businessId: businessId || null },
      });
      profileUserId = newUser.id;
    }
  }

  const profile = await prisma.profile.create({
    data: {
      name: body.name,
      fbUsername: body.fbUsername,
      edgeProfile: body.edgeProfile || "Default",
      businessId: businessId,
      dailyLimit: body.dailyLimit || 150,
      whatsappPhone: body.whatsappPhone || null,
      userId: profileUserId,
    },
    include: { business: true },
  });
  return NextResponse.json(profile);
}
