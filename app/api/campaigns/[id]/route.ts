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
  const campaign = await prisma.campaign.update({ where: { id }, data });
  return NextResponse.json(campaign);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.post.deleteMany({ where: { campaignId: id } });
  await prisma.campaign.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
