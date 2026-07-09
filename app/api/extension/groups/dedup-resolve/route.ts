import { prisma } from "@/lib/prisma";
import { validateApiToken } from "@/lib/apiToken";
import { NextRequest, NextResponse } from "next/server";

// מפעיל את המיזוג רק אם התוסף אימת בפועל (מספר חברים זהה בשני עמודי הקבוצה) -
// verified=false פירושו "לא הצלחתי לאמת" ואז לא נוגעים בנתונים בכלל (ברירת
// המחדל הבטוחה, בדיוק כמו המצב היום). ראה project-map.md להסבר המלא.
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const deviceId = req.nextUrl.searchParams.get("deviceId");

  const auth = await validateApiToken(token, deviceId);
  if ("error" in auth) return auth.error;
  const user = auth.user;

  const { templateId, keepFbGroupId, removeFbGroupId, verified } = await req.json();
  if (!templateId || !keepFbGroupId || !removeFbGroupId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const template = await prisma.groupTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!verified) {
    return NextResponse.json({ ok: true, merged: false });
  }

  const keep = await prisma.group.findUnique({
    where: { fbGroupId_templateId: { fbGroupId: keepFbGroupId, templateId } },
  });
  const remove = await prisma.group.findUnique({
    where: { fbGroupId_templateId: { fbGroupId: removeFbGroupId, templateId } },
  });
  if (!keep || !remove) return NextResponse.json({ ok: true, merged: false });

  await prisma.group.delete({ where: { id: remove.id } });
  await prisma.group.update({ where: { id: keep.id }, data: { lastSeenAt: new Date() } });

  return NextResponse.json({ ok: true, merged: true });
}
