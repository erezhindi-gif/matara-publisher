import { prisma } from "@/lib/prisma";
import { validateApiToken } from "@/lib/apiToken";
import { getProfileWithRollingReset } from "@/lib/profileLimit";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const deviceId = req.nextUrl.searchParams.get("deviceId");

  const auth = await validateApiToken(token, deviceId);
  if ("error" in auth) return auth.error;
  const user = auth.user;

  const now = new Date();

  // מכסה יומית (חלון מתגלגל 24 שעות, לא איפוס-חצות) - נבדק לפני שתופסים
  // עבודות בכלל, כדי לא לתפוס פוסט ואז לנטוש אותו ב-status="running"
  const profile = await getProfileWithRollingReset(user.id);
  const remaining = profile ? Math.max(0, profile.dailyLimit - profile.postsToday) : 3;
  const profileInfo = profile
    ? { dailyLimit: profile.dailyLimit, postsToday: profile.postsToday, remaining }
    : null;

  if (remaining <= 0) {
    return NextResponse.json({ posts: [], user: { name: user.name, email: user.email }, profile: profileInfo });
  }

  // מצא פוסט ממתין ותפוס אותו אטומית - לא יותר מהמכסה שנותרה היום
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
      take: Math.min(3, remaining),
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

  return NextResponse.json({ posts, user: { name: user.name, email: user.email }, profile: profileInfo });
}
