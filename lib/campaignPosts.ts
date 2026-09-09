import { prisma } from "@/lib/prisma";

// יוצר Post לכל קבוצה בקמפיין (מתבניות + קבוצות ישירות, ללא כפילויות) -
// נקרא גם ביצירת קמפיין (ברירת מחדל היום, בלי סוכן שכותב לבד) וגם במעבר
// ל-"approved" (זרימת האישור הישנה, נשמרת למקרה שיחזרו סוכנים בעתיד).
export async function createPostsForCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { posts: true } });
  if (!campaign || campaign.posts.length > 0) return;

  const groupIds: string[] = (() => {
    try { return JSON.parse(campaign.groupIds || "[]"); } catch { return []; }
  })();
  const templateIds: string[] = (() => {
    try { return JSON.parse(campaign.templateIds || "[]"); } catch { return []; }
  })();

  const groupsFromTemplates = templateIds.length > 0
    ? await prisma.group.findMany({ where: { templateId: { in: templateIds } } })
    : [];

  const directGroups = groupIds.length > 0
    ? await prisma.group.findMany({ where: { fbGroupId: { in: groupIds } } })
    : [];

  const allGroups = [...groupsFromTemplates, ...directGroups];
  const seen = new Set<string>();
  const unique = allGroups.filter((g) => {
    if (seen.has(g.fbGroupId)) return false;
    seen.add(g.fbGroupId);
    return true;
  });

  if (unique.length > 0) {
    await prisma.post.createMany({
      data: unique.map((g) => ({
        campaignId,
        fbGroupId: g.fbGroupId,
        groupName: g.name,
        status: "pending",
      })),
      skipDuplicates: true,
    });
  }
}
