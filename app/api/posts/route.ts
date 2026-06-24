import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { campaignId, groupName, status, error } = body;

  const post = await prisma.post.upsert({
    where: {
      campaignId_groupName: { campaignId, groupName },
    },
    update: {
      status,
      error: error || null,
      publishedAt: status === "published" ? new Date() : null,
    },
    create: {
      campaignId,
      fbGroupId: `group_${Date.now()}`,
      groupName,
      status,
      error: error || null,
      publishedAt: status === "published" ? new Date() : null,
    },
  });

  return NextResponse.json(post);
}
