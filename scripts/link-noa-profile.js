const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  const noa = await p.user.findUnique({ where: { email: "noa@matarahr.co.il" } });
  if (!noa) { console.log("User noa not found"); return; }

  // Link the "נויה מטבחים" profile to noa's user
  const updated = await p.profile.updateMany({
    where: { name: "נויה מטבחים" },
    data: { userId: noa.id },
  });
  console.log("Linked profiles to noa:", updated.count);

  // Detach "ארז - נגרות" from any user (admin sees all anyway)
  const detached = await p.profile.updateMany({
    where: { name: "ארז - נגרות" },
    data: { userId: null },
  });
  console.log("Detached ארז - נגרות:", detached.count);

  // Update noa's businessId to match her profile
  await p.user.update({
    where: { email: "noa@matarahr.co.il" },
    data: { businessId: "carpentry" },
  });
  console.log("Updated noa businessId to carpentry");
}

main().catch(console.error).finally(() => p.$disconnect());
