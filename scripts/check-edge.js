const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.profile.findMany({ select: { name: true, edgeProfile: true } })
  .then(r => console.log(JSON.stringify(r, null, 2)))
  .finally(() => p.$disconnect());
