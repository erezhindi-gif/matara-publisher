import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { apiToken: token } });
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const now = new Date();

  const posts = await prisma.post.findMany({
    where: {
      status: "pending",
      campaign: {
        userId: user.id,
        OR: [
          { scheduledAt: null },
          { scheduledAt: { lte: now } },
        ],
      },
    },
    include: {
      campaign: {
        select: {
          title: true,
          content: true,
          imageUrls: true,
          whatsappLink: true,
          emailLink: true,
        },
      },
    },
    take: 5,
  });

  return NextResponse.json({ posts, user: { name: user.name, email: user.email } });
}
