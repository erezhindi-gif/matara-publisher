import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id || null;

  const body = await req.json();
  const { groups, businessId } = body;

  let template = await prisma.groupTemplate.findFirst({
    where: { businessId, name: "🔄 מסונכרן מפייסבוק", userId },
  });

  if (!template) {
    template = await prisma.groupTemplate.create({
      data: { name: "🔄 מסונכרן מפייסבוק", businessId, userId },
    });
  }

  let count = 0;
  for (const g of groups) {
    try {
      await prisma.group.upsert({
        where: { fbGroupId: g.fbGroupId },
        update: { name: g.name, templateId: template.id },
        create: { fbGroupId: g.fbGroupId, name: g.name, templateId: template.id },
      });
      count++;
    } catch {
      // דלג על כפולות
    }
  }

  return NextResponse.json({ count, templateId: template.id });
}
