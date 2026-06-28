const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.user.update({ where: { email: "erezhindi@gmail.com" }, data: { name: "ארז הנדי" } })
  .then(() => console.log("updated")).catch(console.error).finally(() => p.$disconnect());
