const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
async function main() {
  const campaigns = await p.campaign.findMany({ select: { userId: true }, take: 5 });
  const profiles = await p.profile.findMany({ select: { name: true, userId: true } });
  const users = await p.user.findMany({ select: { id: true, name: true } });
  console.log("campaign userIds:", [...new Set(campaigns.map(c => c.userId))]);
  console.log("profiles:", profiles);
  console.log("users:", users.map(u => u.id + " = " + u.name));
}
main().catch(console.error).finally(() => p.$disconnect());
