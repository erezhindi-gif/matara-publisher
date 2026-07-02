import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const deviceId = req.nextUrl.searchParams.get("deviceId");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { apiToken: token } });
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const now = new Date();

  // מצא פוסט ממתין ותפוס אותו אטומית
  const posts = await prisma.$transaction(async (tx) => {
    const pending = await tx.post.findMany({
      where: {
        status: "pending",
        campaign: {
          userId: user.id,
          OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
        },
      },
      include: {
        campaign: {
          select: { title: true, content: true, imageUrls: true, whatsappLink: true, emailLink: true },
        },
      },
      take: 3,
    });

    if (pending.length === 0) return [];

    // תפוס רק אם עדיין pending (מניעת כפל)
    const claimed = [];
    for (const post of pending) {
      const result = await tx.post.updateMany({
        where: { id: post.id, status: "pending" },
        data: { status: "running", claimedBy: deviceId || "unknown" },
      });
      if (result.count > 0) claimed.push(post);
    }
    return claimed;
  });

  return NextResponse.json({ posts, user: { name: user.name, email: user.email } });
}
