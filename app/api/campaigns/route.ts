import { prisma } from "@/lib/prisma";
import { sendApprovalEmail } from "@/lib/email";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { business: true, posts: true },
  });
  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  let business = await prisma.business.findFirst({
    where: { id: body.businessId },
  });

  if (!business) {
    const type = body.businessId === "recruitment" ? "recruitment" : "carpentry";
    const name = type === "recruitment" ? "מטרה - גיוס והשמה" : "נויה מטבחים";
    business = await prisma.business.create({
      data: { id: body.businessId, name, type },
    });
  }

  const campaign = await prisma.campaign.create({
    data: {
      title: body.title,
      content: body.content,
      whatsappLink: body.whatsappLink || null,
      emailLink: body.emailLink || null,
      imageUrls: body.imageUrls || [],
      businessId: business.id,
      templateIds: JSON.stringify(body.templateIds || []),
      groupIds: JSON.stringify(body.groupIds || []),
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      status: "pending_approval",
    },
  });

  // שלח מייל התראה
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
