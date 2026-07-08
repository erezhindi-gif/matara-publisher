import { prisma } from "@/lib/prisma";
import { validateApiToken } from "@/lib/apiToken";
import { incrementPostsToday } from "@/lib/profileLimit";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get("token");
  const deviceId = req.nextUrl.searchParams.get("deviceId");

  const auth = await validateApiToken(token, deviceId);
  if ("error" in auth) return auth.error;
  const user = auth.user;

  const { status, error, note } = await req.json();

  // note בלבד - שמור ב-error field לצורך דיאגנוסטיקה, ללא שינוי סטטוס
  if (note && !status) {
    await prisma.post.update({ where: { id }, data: { error: note } });
    return NextResponse.json({ ok: true });
  }

  const post = await prisma.post.update({
    where: { id },
    data: {
      status,
      error: error || null,
      publishedAt: status === "published" ? new Date() : undefined,
    },
  });

  // עדכן מכסה יומית רק על פרסום שהצליח בפועל - לא על failed/group_suspended/וכו'
  if (status === "published") await incrementPostsToday(user.id);

  return NextResponse.json({ ok: true, post });
}
