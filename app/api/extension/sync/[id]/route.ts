import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { apiToken: token } });
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const { status, error, groups } = await req.json();

  await prisma.syncJob.update({
    where: { id },
    data: { status, error: error || null, groupCount: groups?.length || null },
  });

  // שמור את הקבוצות אם התקבלו
  if (groups && groups.length > 0) {
    const job = await prisma.syncJob.findUnique({ where: { id } });
    if (!job) return NextResponse.json({ ok: true });

    // מצא תבנית קיימת לעסק זה או צור אחת
    let template = await prisma.groupTemplate.findFirst({
      where: { businessId: job.businessId },
    });
    if (!template) {
      template = await prisma.groupTemplate.create({
        data: { name: "קבוצות מסונכרנות", businessId: job.businessId, userId: user.id },
      });
    }

    // הוסף קבוצות חדשות
    for (const g of groups) {
      await prisma.group.upsert({
        where: { fbGroupId: g.fbGroupId },
        update: { name: g.name, memberCount: g.memberCount || null },
        create: { fbGroupId: g.fbGroupId, name: g.name, memberCount: g.memberCount || null, templateId: template.id },
      });
    }
  }

  return NextResponse.json({ ok: true });
}

// GET - בדיקת סטטוס משימה (דף הסנכרון מצ'לל)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.syncJob.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ job });
}
