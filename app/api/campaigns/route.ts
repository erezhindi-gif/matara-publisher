import { prisma } from "@/lib/prisma";
import { sendApprovalEmail } from "@/lib/email";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const isAdmin = (session?.user as { role?: string })?.role === "admin";
    const userId = (session?.user as { id?: string })?.id;

    const where = (!session || isAdmin) ? {} : { userId };

    const campaigns = await prisma.campaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { business: true, posts: true },
    });
    return NextResponse.json(campaigns);
  } catch (e) {
    console.error("GET /api/campaigns error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const body = await req.json();

  let business = await prisma.business.findFirst({
    where: { id: body.businessId },
  });

  if (!business) {
    business = await prisma.business.create({
      data: { id: body.businessId, name: body.businessName || body.businessId, type: body.businessId },
    });
  }

  const campaign = await prisma.campaign.create({
    data: {
      title: body.title,
      content: body.content,
      whatsappLink: body.whatsappLink || null,
      whatsappMessage: body.whatsappMessage || null,
      emailLink: body.emailLink || null,
      imageUrls: body.imageUrls || [],
      businessId: business.id,
      templateIds: JSON.stringify(body.templateIds || []),
      groupIds: JSON.stringify(body.groupIds || []),
      backgroundIndex: body.backgroundIndex ?? null,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      status: "pending_approval",
      userId: userId || null,
    },
  });

  try {
    await sendApprovalEmail({
      id: campaign.id,
      title: campaign.title,
      content: campaign.content,
      business: { id: business.id, name: business.name, type: business.type },
      scheduledAt: campaign.scheduledAt,
    });
  } catch (e) {
    console.error("Failed to send email:", e);
  }

  return NextResponse.json(campaign);
}
