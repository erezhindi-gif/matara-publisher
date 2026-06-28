const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  const admin = await p.user.findUnique({ where: { email: "erezhindi@gmail.com" } });
  const updated = await p.profile.updateMany({
    where: { name: "ארז - נגרות" },
    data: { userId: admin.id },
  });
  console.log("Linked ארז - נגרות to admin:", updated.count);
}

main().catch(console.error).finally(() => p.$disconnect());
