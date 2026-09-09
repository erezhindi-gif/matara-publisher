import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// רץ יומית (vercel.json) - מקדם קמפיינים חוזרים (Campaign.recurring) לשבוע
// הבא ברגע שהמחזור הנוכחי הסתיים. "מחזור הסתיים" = אין אף Post במצב
// pending/running - כלומר הכל פורסם או נכשל סופית. לא נוגעים בקמפיין
// שעדיין באמצע פרסום (גם אם scheduledAt כבר עבר), כדי לא לאפס פוסטים
// שממתינים/רצים ברגע זה.
//
// הגנה אופציונלית: אם מוגדר CRON_SECRET ב-Vercel, נדרש
// Authorization: Bearer <CRON_SECRET> (זה מה ש-Vercel Cron שולח אוטומטית
// כשמוגדר משתנה הסביבה הזה). אם לא הוגדר - ה-route פתוח (לא הרסני בטבעו,
// idempotent - הפעלה מוקדמת פשוט לא מוצאת קמפיינים "due" ולא עושה כלום).
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const due = await prisma.campaign.findMany({
    where: {
      recurring: true,
      scheduledAt: { lte: now },
    },
    include: { posts: true },
  });

  let advanced = 0;
  for (const campaign of due) {
    const stillActive = campaign.posts.some((p) => p.status === "pending" || p.status === "running");
    if (stillActive) continue;
    if (!campaign.scheduledAt) continue;

    // קדם שבוע-שבוע עד שהתאריך בעתיד - מכסה מקרה שה-cron לא רץ כמה ימים
    let next = new Date(campaign.scheduledAt);
    while (next <= now) next = new Date(next.getTime() + 7 * 24 * 60 * 60 * 1000);

    await prisma.$transaction([
      prisma.campaign.update({ where: { id: campaign.id }, data: { scheduledAt: next } }),
      // מאפסים את אותם Post-ים למחזור החדש - לא יוצרים חדשים, כי
      // Post.@@unique([campaignId, groupName]) לא מאפשר שורה שנייה לאותה
      // קבוצה באותו קמפיין. ההיסטוריה של המחזור הקודם (publishedAt/error)
      // נדרסת - אין טבלת היסטוריה נפרדת כרגע.
      prisma.post.updateMany({
        where: { campaignId: campaign.id },
        data: { status: "pending", claimedBy: null, claimedAt: null, publishedAt: null, error: null },
      }),
    ]);
    advanced++;
  }

  return NextResponse.json({ checked: due.length, advanced });
}
