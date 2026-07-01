import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { apiToken: token } });
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const { status, error, groups, groupsFound } = await req.json();

  await prisma.syncJob.update({
    where: { id },
    data: {
      status,
      error: error || null,
      groupCount: groups?.length ?? null,
      groupsFound: groupsFound ?? groups?.length ?? undefined,
    },
  });

  if (groups && groups.length > 0) {
    const job = await prisma.syncJob.findUnique({ where: { id } });
    if (!job) return NextResponse.json({ ok: true });

    // Find or create a template scoped to THIS user (not shared across users)
    let template = await prisma.groupTemplate.findFirst({
      where: { businessId: job.businessId, userId: user.id },
    });
    if (!template) {
      template = await prisma.groupTemplate.create({
        data: { name: "קבוצות מסונכרנות", businessId: job.businessId, userId: user.id },
      });
    }

    const now = new Date();
    let newCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const g of groups) {
      if (!g.fbGroupId || !g.name) { skippedCount++; continue; }
      const normalized = g.fbGroupId.trim().toLowerCase();
      if (!normalized.match(/^[\w.-]{2,}$/)) { skippedCount++; continue; }
      if (!g.name || g.name.length < 2 || g.name.length > 200) { skippedCount++; continue; }

      // Unique per (fbGroupId, templateId) - same group can exist in multiple users' templates
      const existing = await prisma.group.findUnique({
        where: { fbGroupId_templateId: { fbGroupId: normalized, templateId: template.id } },
      });
      if (existing) {
        await prisma.group.update({
          where: { fbGroupId_templateId: { fbGroupId: normalized, templateId: template.id } },
          data: { name: g.name, lastSeenAt: now },
        });
        updatedCount++;
      } else {
        await prisma.group.create({
          data: { fbGroupId: normalized, name: g.name, templateId: template.id, lastSeenAt: now },
        });
        newCount++;
      }
    }

    await prisma.syncJob.update({
      where: { id },
      data: { groupCount: newCount + updatedCount },
    });

    return NextResponse.json({ ok: true, summary: { new: newCount, updated: updatedCount, skipped: skippedCount } });
  }

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.syncJob.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ job });
}
