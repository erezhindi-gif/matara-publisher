import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { business: true, posts: true },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(campaign);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = { ...body };
  if (body.scheduledAt) data.scheduledAt = new Date(body.scheduledAt);
  if (Array.isArray(body.templateIds)) data.templateIds = JSON.stringify(body.templateIds);
  if (Array.isArray(body.groupIds)) data.groupIds = JSON.stringify(body.groupIds);

  // אפס פוסטים נכשלים אם ביקשו retry
  if (body.retryFailed) {
    await prisma.post.updateMany({
      where: { campaignId: id, status: "failed" },
      data: { status: "pending", claimedBy: null, error: null },
    });
  }

  const campaign = await prisma.campaign.update({ where: { id }, data: Object.fromEntries(Object.entries(data).filter(([k]) => k !== "retryFailed")), include: { posts: true } });

  // כשמאשרים קמפיין - צור Post לכל קבוצה אם עדיין אין
  if (body.status === "approved" && campaign.posts.length === 0) {
    const groupIds: string[] = (() => {
      try { return JSON.parse(campaign.groupIds || "[]"); } catch { return []; }
    })();
    const templateIds: string[] = (() => {
      try { return JSON.parse(campaign.templateIds || "[]"); } catch { return []; }
    })();

    const groupsFromTemplates = templateIds.length > 0
      ? await prisma.group.findMany({ where: { templateId: { in: templateIds } } })
      : [];

    const directGroups = groupIds.length > 0
      ? await prisma.group.findMany({ where: { fbGroupId: { in: groupIds } } })
      : [];

    const allGroups = [...groupsFromTemplates, ...directGroups];
    const seen = new Set<string>();
    const unique = allGroups.filter((g) => {
      if (seen.has(g.fbGroupId)) return false;
      seen.add(g.fbGroupId);
      return true;
    });

    if (unique.length > 0) {
      await prisma.post.createMany({
        data: unique.map((g) => ({
          campaignId: id,
          fbGroupId: g.fbGroupId,
          groupName: g.name,
          status: "pending",
        })),
        skipDuplicates: true,
      });
    }
  }

  return NextResponse.json(campaign);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.post.deleteMany({ where: { campaignId: id } });
  await prisma.campaign.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
