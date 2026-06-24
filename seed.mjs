import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

await p.business.upsert({
  where: { id: "recruitment" },
  update: {},
  create: { id: "recruitment", name: "מטרה - גיוס והשמה", type: "recruitment" },
});

await p.business.upsert({
  where: { id: "carpentry" },
  update: {},
  create: { id: "carpentry", name: "נויה מטבחים", type: "carpentry" },
});

console.log("Done!");
await p.$disconnect();
