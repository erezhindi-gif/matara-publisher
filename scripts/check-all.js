const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
Promise.all([
  p.profile.findMany({ select: { id: true, name: true, userId: true, businessId: true } }),
  p.business.findMany(),
  p.user.findMany({ select: { id: true, email: true, role: true, businessId: true } }),
]).then(([profiles, businesses, users]) => {
  console.log("PROFILES:", JSON.stringify(profiles, null, 2));
  console.log("BUSINESSES:", JSON.stringify(businesses, null, 2));
  console.log("USERS:", JSON.stringify(users, null, 2));
}).finally(() => p.$disconnect());
