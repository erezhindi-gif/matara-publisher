import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/externalAuth";
import { parseRepeatDays } from "@/lib/repeat";
import { NextRequest, NextResponse } from "next/server";

const STATUSES = ["pending", "running", "published", "failed", "group_suspended", "needs_membership_answer", "pending_admin", "cancelled"] as const;

// {id} = ה-id שחזר מ-POST, או ה-externalId
async function findOwned(req: NextRequest, id: string) {
  const auth = await requireApiKey(req);
  if ("error" in auth) return { error: auth.error };
  const campaign = await prisma.campaign.findFirst({ where: { OR: [{ id }, { externalId: id }], userId: auth.user.id } });
  if (!campaign) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { campaign };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await findOwned(req, (await params).id);
  if (r.error) return r.error;
  const campaign = r.campaign;

  const posts = await prisma.post.findMany({
    where: { campaignId: campaign.id },
    select: { groupName: true, fbGroupId: true, status: true, publishedAt: true, error: true },
    orderBy: { groupName: "asc" },
  });
  // imageAttached: התוסף אימת שהתמונה הופיעה בחלון הפוסט לפני הפרסום
  const postsOut = posts.map(({ error, ...p }) => ({ ...p, error, imageAttached: (p.status === "published" || p.status === "pending_admin") && !!error?.includes("blob-preview בדיאלוג: כן") }));
  const totals: Record<string, number> = { total: posts.length };
  for (const s of STATUSES) totals[s] = 0;
  for (const p of posts) totals[p.status] = (totals[p.status] || 0) + 1;

  return NextResponse.json({
    id: campaign.id,
    externalId: campaign.externalId,
    scheduledAt: campaign.scheduledAt,
    repeatDays: parseRepeatDays(campaign.repeatDays),
    cancelled: !!campaign.cancelledAt,
    totals,
    done: totals.pending === 0 && totals.running === 0,
    posts: postsOut,
  });
}

// ביטול: עוצר מיד את כל הפוסטים שעוד לא יצאו, ומפסיק חזרות עתידיות.
// פוסט שבאמצע פרסום (running) יסתיים. מה שכבר פורסם נשאר בפייסבוק.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await findOwned(req, (await params).id);
  if (r.error) return r.error;
  const campaign = r.campaign;

  const [, stopped] = await prisma.$transaction([
    prisma.campaign.update({ where: { id: campaign.id }, data: { cancelledAt: campaign.cancelledAt ?? new Date() } }),
    prisma.post.updateMany({ where: { campaignId: campaign.id, status: "pending" }, data: { status: "cancelled" } }),
  ]);
  return NextResponse.json({ id: campaign.id, cancelled: true, stoppedPosts: stopped.count });
}

// עדכון התוכן לפני המחזור הבא (ניסוח שונה בכל פעם - פחות נראה כספאם)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await findOwned(req, (await params).id);
  if (r.error) return r.error;
  const campaign = r.campaign;
  if (campaign.cancelledAt) return NextResponse.json({ error: "הקמפיין בוטל" }, { status: 400 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const data: { content?: string; imageUrls?: string[]; whatsappMessage?: string | null } = {};
  if ("content" in body) {
    if (typeof body.content !== "string" || !body.content.trim()) return NextResponse.json({ error: "content לא תקין" }, { status: 400 });
    data.content = body.content;
  }
  if ("imageUrl" in body) {
    if (body.imageUrl === null || body.imageUrl === "") data.imageUrls = [];
    else if (typeof body.imageUrl === "string" && body.imageUrl.startsWith("https://")) data.imageUrls = [body.imageUrl];
    else return NextResponse.json({ error: "imageUrl חייב להתחיל ב-https://" }, { status: 400 });
  }
  if ("whatsappMessage" in body) {
    if (body.whatsappMessage != null && typeof body.whatsappMessage !== "string") return NextResponse.json({ error: "whatsappMessage לא תקין" }, { status: 400 });
    data.whatsappMessage = (body.whatsappMessage as string) || null;
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "אפשר לעדכן רק content / imageUrl / whatsappMessage" }, { status: 400 });

  await prisma.campaign.update({ where: { id: campaign.id }, data });
  return NextResponse.json({ id: campaign.id, updated: Object.keys(data) });
}
