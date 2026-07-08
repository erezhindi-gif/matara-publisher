import { prisma } from "@/lib/prisma";
import type { Profile } from "@prisma/client";

const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * מחזיר את הפרופיל של המשתמש (1:1 כרגע) עם postsToday מאופס אם עברו 24 שעות
 * מאז lastReset - חלון מתגלגל, לא "איפוס חצות" קבוע. אם עברו 24 שעות, מאפס
 * בפועל ב-DB (לא רק מדמה בזיכרון) כדי שהקריאה הבאה תראה מצב עקבי.
 */
export async function getProfileWithRollingReset(userId: string): Promise<Profile | null> {
  const profile = await prisma.profile.findFirst({ where: { userId } });
  if (!profile) return null;

  const elapsed = Date.now() - profile.lastReset.getTime();
  if (elapsed >= ROLLING_WINDOW_MS) {
    return prisma.profile.update({
      where: { id: profile.id },
      data: { postsToday: 0, lastReset: new Date() },
    });
  }
  return profile;
}

/** מעלה postsToday ב-1 אחרי פרסום מוצלח - לא נוגע ב-lastReset (זה מתאפס רק ב-getProfileWithRollingReset) */
export async function incrementPostsToday(userId: string): Promise<void> {
  const profile = await prisma.profile.findFirst({ where: { userId } });
  if (!profile) return;
  await prisma.profile.update({ where: { id: profile.id }, data: { postsToday: { increment: 1 } } });
}
