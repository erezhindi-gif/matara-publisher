const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  const admin = await p.user.findUnique({ where: { email: "erezhindi@gmail.com" } });
  const result = await p.campaign.updateMany({
    where: { userId: null },
    data: { userId: admin.id },
  });
  console.log("Updated campaigns:", result.count);

  const templates = await p.groupTemplate.updateMany({
    where: { userId: null },
    data: { userId: admin.id },
  });
  console.log("Updated templates:", templates.count);
}

main().catch(console.error).finally(() => p.$disconnect());
