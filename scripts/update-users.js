const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
Promise.all([
  p.user.update({ where: { email: "erezhindi@gmail.com" }, data: { businessId: "carpentry" } }),
  p.user.update({ where: { email: "noa@matarahr.co.il" }, data: { businessId: "recruitment" } }),
]).then(() => console.log("updated")).catch(console.error).finally(() => p.$disconnect());
