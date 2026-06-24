import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { groups, businessId } = body;

  // שמור קבוצות ב"בנק הקבוצות" - כרגע נשמור כתבנית זמנית
  let count = 0;

  // מצא או צור תבנית "כל הקבוצות" לעסק זה
  let template = await prisma.groupTemplate.findFirst({
    where: { businessId, name: "🔄 מסונכרן מפייסבוק" },
  });

  if (!template) {
    template = await prisma.groupTemplate.create({
      data: { name: "🔄 מסונכרן מפייסבוק", businessId },
    });
  }

  // הוסף קבוצות חדשות
  for (const g of groups) {
    try {
      await prisma.group.upsert({
        where: { fbGroupId: g.fbGroupId },
        update: { name: g.name },
        create: {
          fbGroupId: g.fbGroupId,
          name: g.name,
          templateId: template.id,
        },
      });
      count++;
    } catch {
      // דלג על כפולות
    }
  }

  return NextResponse.json({ count, templateId: template.id });
}
