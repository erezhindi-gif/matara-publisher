import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/externalAuth";
import { NextRequest, NextResponse } from "next/server";

const STATUSES = ["pending", "running", "published", "failed", "group_suspended", "needs_membership_answer"] as const;

// קריאה בלבד. {id} = ה-id שחזר מ-POST (או externalId)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiKey(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { OR: [{ id }, { externalId: id }], userId: auth.user.id },
    include: { posts: { select: { groupName: true, fbGroupId: true, status: true, publishedAt: true, error: true }, orderBy: { groupName: "asc" } } },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const totals: Record<string, number> = { total: campaign.posts.length };
  for (const s of STATUSES) totals[s] = 0;
  for (const p of campaign.posts) totals[p.status] = (totals[p.status] || 0) + 1;

  return NextResponse.json({
    id: campaign.id,
    externalId: campaign.externalId,
    scheduledAt: campaign.scheduledAt,
    totals,
    done: totals.pending === 0 && totals.running === 0,
    posts: campaign.posts,
  });
}
