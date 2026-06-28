const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  // Show current state
  const users = await p.user.findMany({ select: { id: true, name: true, email: true, role: true, businessId: true } });
  console.log("Users:", JSON.stringify(users, null, 2));

  const profiles = await p.profile.findMany({ select: { id: true, name: true, businessId: true, userId: true } });
  console.log("Profiles:", JSON.stringify(profiles, null, 2));
}

main().catch(console.error).finally(() => p.$disconnect());
