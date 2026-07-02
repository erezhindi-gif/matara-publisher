import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { apiToken: token } });
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

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

  return NextResponse.json({ ok: true, post });
}
