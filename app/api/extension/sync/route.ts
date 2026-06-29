import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const deviceId = req.nextUrl.searchParams.get("deviceId");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { apiToken: token } });
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  // תפוס משימה אטומית
  const job = await prisma.$transaction(async (tx) => {
    const pending = await tx.syncJob.findFirst({
      where: { userId: user.id, status: "pending" },
      orderBy: { createdAt: "asc" },
    });
    if (!pending) return null;

    await tx.syncJob.update({
      where: { id: pending.id },
      data: { status: "running", claimedBy: deviceId || "unknown" },
    });
    return pending;
  });

  return NextResponse.json({ job });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { businessId } = await req.json();

  await prisma.syncJob.updateMany({
    where: { userId, status: { in: ["pending", "running"] } },
    data: { status: "cancelled" },
  });

  const job = await prisma.syncJob.create({
    data: { userId, businessId, status: "pending" },
  });

  return NextResponse.json({ job });
}
