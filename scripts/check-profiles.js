const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.profile.findMany({ select: { id: true, name: true, userId: true } })
  .then(r => console.log(JSON.stringify(r, null, 2)))
  .finally(() => p.$disconnect());
