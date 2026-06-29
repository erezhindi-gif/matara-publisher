import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = (session.user as { role?: string })?.role === "admin";
  const userId = (session.user as { id?: string })?.id;

  const templates = await prisma.groupTemplate.findMany({
    where: isAdmin ? {} : { userId },
    include: { groups: true },
  });

  const seen = new Set<string>();
  const groups = [];
  for (const t of templates) {
    for (const g of t.groups) {
      if (!seen.has(g.fbGroupId)) {
        seen.add(g.fbGroupId);
        groups.push(g);
      }
    }
  }

  return NextResponse.json(groups);
}
