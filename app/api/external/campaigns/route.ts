import { prisma } from "@/lib/prisma";
import { createPostsForCampaign } from "@/lib/campaignPosts";
import { requireApiKey, getUserGroups } from "@/lib/externalAuth";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const MAX_GROUPS = 40;
const BUSINESSES = ["recruitment", "מטרה"];

function bad(error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status: 400 });
}

const isStrArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string" && x.trim() !== "");

async function existingResponse(externalId: string, userId: string) {
  const c = await prisma.campaign.findUnique({ where: { externalId }, include: { _count: { select: { posts: true } } } });
  if (!c || c.userId !== userId) return null;
  return NextResponse.json({ id: c.id, externalId: c.externalId, status: c.status, created: false, totalGroups: c._count.posts, scheduledAt: c.scheduledAt });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiKey(req);
  if ("error" in auth) return auth.error;
  const user = auth.user;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return bad("Invalid JSON"); }

  const { externalId, title, content, imageUrl, whatsappLink, whatsappMessage, emailLink, scheduledAt } = body as Record<string, unknown>;
  if (typeof externalId !== "string" || !externalId.trim() || externalId.length > 200) return bad("externalId חובה (עד 200 תווים)");
  if (typeof title !== "string" || !title.trim()) return bad("title חובה");
  if (typeof content !== "string" || !content.trim()) return bad("content חובה");

  // שליחה חוזרת עם אותו externalId מחזירה את הקיים
  const prior = await prisma.campaign.findUnique({ where: { externalId } });
  if (prior) {
    if (prior.userId !== user.id) return bad("externalId כבר בשימוש");
    return (await existingResponse(externalId, user.id))!;
  }

  const groupIds = body.groupIds ?? [];
  const templateIds = body.templateIds ?? [];
  if (!isStrArray(groupIds) || !isStrArray(templateIds)) return bad("groupIds / templateIds חייבים להיות מערך של מחרוזות");
  if (groupIds.length === 0 && templateIds.length === 0) return bad("חובה groupIds או templateIds");

  if (imageUrl != null && (typeof imageUrl !== "string" || !imageUrl.startsWith("https://"))) return bad("imageUrl חייב להתחיל ב-https://");
  if (whatsappLink != null && whatsappLink !== "") {
    if (typeof whatsappLink !== "string" || !/^https:\/\/wa\.me\/\d{8,15}$/.test(whatsappLink)) {
      return bad("whatsappLink בפורמט https://wa.me/972XXXXXXXXX, בלי ?");
    }
  }
  if (whatsappMessage != null && typeof whatsappMessage !== "string") return bad("whatsappMessage חייב להיות טקסט");
  if (emailLink != null && emailLink !== "" && (typeof emailLink !== "string" || !/^\S+@\S+\.\S+$/.test(emailLink))) return bad("emailLink לא תקין");

  let when: Date | null = null;
  if (scheduledAt != null && scheduledAt !== "") {
    when = new Date(String(scheduledAt));
    if (isNaN(when.getTime())) return bad("scheduledAt לא תקין (ISO 8601)");
  }

  const businessId = (body.businessId as string | undefined) || user.businessId || "מטרה";
  if (!BUSINESSES.includes(businessId)) return bad(`businessId רק ${BUSINESSES.join(" / ")}`);

  // בעלות: רק קבוצות ותבניות של המשתמש של המפתח
  const owned = await getUserGroups(user.id);
  const ownedIds = new Set(owned.map((g) => g.fbGroupId));
  const unknownGroups = groupIds.filter((id) => !ownedIds.has(id.trim().toLowerCase()));
  if (unknownGroups.length) return bad("קבוצות שלא שייכות לפרופיל", { invalidGroupIds: unknownGroups });

  const finalIds = new Set(groupIds.map((id) => id.trim().toLowerCase()));
  if (templateIds.length) {
    const templates = await prisma.groupTemplate.findMany({ where: { id: { in: templateIds }, userId: user.id }, include: { groups: { select: { fbGroupId: true } } } });
    const found = new Set(templates.map((t) => t.id));
    const unknownTemplates = templateIds.filter((id) => !found.has(id));
    if (unknownTemplates.length) return bad("תבניות שלא שייכות לפרופיל", { invalidTemplateIds: unknownTemplates });
    for (const t of templates) for (const g of t.groups) if (ownedIds.has(g.fbGroupId)) finalIds.add(g.fbGroupId);
  }
  if (finalIds.size === 0) return bad("אין קבוצות לפרסום");
  if (finalIds.size > MAX_GROUPS) return bad(`יותר מ-${MAX_GROUPS} קבוצות (${finalIds.size})`);

  let business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) business = await prisma.business.create({ data: { id: businessId, name: businessId, type: businessId } });

  let campaign;
  try {
    campaign = await prisma.campaign.create({
      data: {
        externalId,
        title: title.trim(),
        content,
        imageUrls: imageUrl ? [imageUrl as string] : [],
        whatsappLink: (whatsappLink as string) || null,
        whatsappMessage: (whatsappMessage as string) || null,
        emailLink: (emailLink as string) || null,
        businessId: business.id,
        // הקבוצות כבר מורחבות ומסוננות כאן - templateIds ריק כדי ש-createPostsForCampaign
        // לא יוסיף מחדש כפילויות מזהה-שם מתוך התבנית
        templateIds: "[]",
        groupIds: JSON.stringify(Array.from(finalIds)),
        scheduledAt: when,
        status: "approved",
        userId: user.id,
      },
    });
  } catch (e) {
    // שתי בקשות במקביל עם אותו externalId
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const r = await existingResponse(externalId, user.id);
      if (r) return r;
    }
    throw e;
  }

  await createPostsForCampaign(campaign.id);
  const totalGroups = await prisma.post.count({ where: { campaignId: campaign.id } });

  return NextResponse.json(
    { id: campaign.id, externalId, status: campaign.status, created: true, totalGroups, scheduledAt: campaign.scheduledAt },
    { status: 201 },
  );
}
