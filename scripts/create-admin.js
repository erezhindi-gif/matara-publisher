const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const users = [
    { name: "ערז הינדי", email: "erezhindi@gmail.com", password: "matara2024", role: "admin" },
    { name: "נועה מילנה", email: "noa@matarahr.co.il", password: "matara2024", role: "user" },
  ];

  for (const u of users) {
    const hashed = await bcrypt.hash(u.password, 10);
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      console.log(`קיים: ${u.email}`);
      continue;
    }
    await prisma.user.create({ data: { ...u, password: hashed } });
    console.log(`נוצר: ${u.email} (${u.role})`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
